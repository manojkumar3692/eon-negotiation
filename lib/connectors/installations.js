import {catalogFacts} from "../commerce/catalog-facts.js";
import {randomBytes,randomUUID} from "node:crypto";
import {z} from "zod";
import {resolveTxt} from "node:dns/promises";
import {tenant} from "../db.js";
import {cartSchema} from "../commerce/contract.js";
import {validateCustomEndpoint} from "../commerce/custom.js";
import {providerCapabilities,providerCatalog,providerContext} from "../commerce/providers.js";
import {seal} from "./client-v2.js";

const inputSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("configure_custom"),endpoint:z.string().url().max(500)}).strict(),
  z.object({action:z.literal("update_custom_endpoint"),installationId:z.string().uuid(),endpoint:z.string().url().max(500)}).strict(),
  z.object({action:z.literal("rotate_custom_secret"),installationId:z.string().uuid()}).strict(),
  z.object({action:z.literal("test"),installationId:z.string().uuid(),cart:cartSchema.optional()}).strict(),
  z.object({action:z.literal("sync"),installationId:z.string().uuid()}).strict(),
  z.object({action:z.literal("shipping"),installationId:z.string().uuid(),mode:z.enum(["unconfigured","flat","zone_table","live_quote","none"]),merchantCostMinor:z.number().int().nonnegative().max(10000000).default(0),customerChargeMinor:z.number().int().nonnegative().max(10000000).default(0),countries:z.array(z.string().regex(/^[A-Z]{2}$/)).max(100).default([])}).strict(),
  z.object({action:z.enum(["activate","pause"]),installationId:z.string().uuid()}).strict(),
  z.object({action:z.literal("verify_domain")}).strict(),
]);
async function owned(client,id){if(!z.string().uuid().safeParse(id).success)throw Error("NOT_FOUND");const {rows:[row]}=await client.query("select * from negotiation.workspaces where id=$1",[id]);if(!row)throw Error("NOT_FOUND");return row;}
async function installation(client,workspaceId,installationId){const {rows:[row]}=await client.query("select * from negotiation.connector_installations where workspace_id=$1 and id=$2",[workspaceId,installationId]);if(!row)throw Error("Connector: Connection not found.");return row;}
function publicInstallation(row){return {id:row.id,provider:row.provider,status:row.status,shopDomain:row.shop_domain,endpoint:row.provider==="custom"?row.endpoint:null,lastAttemptAt:row.last_attempt_at,lastSuccessAt:row.last_success_at,lastSyncAt:row.config?.catalogSync?.at||null,error:row.last_error,result:row.last_result,shippingMode:row.shipping_mode,config:row.config,activationStatus:row.activation_status,publicKey:row.status==="ready"?row.public_key:null};}

export async function connectorState(user,id){return tenant(user,async client=>{const workspace=await owned(client,id),{rows}=await client.query("select * from negotiation.connector_installations where workspace_id=$1 and revoked_at is null order by created_at",[id]);return {shopifyConfigured:Boolean(process.env.SHOPIFY_CLIENT_ID&&process.env.SHOPIFY_CLIENT_SECRET),workspaceId:workspace.id,workspaceDomain:workspace.domain,domainVerified:workspace.domain_verified,domainVerificationHost:"_eon-negotiation",domainVerificationFqdn:`_eon-negotiation.${workspace.domain}`,domainVerificationRecord:`eon-negotiation-verification=${workspace.domain_verification_token}`,currency:workspace.currency,installations:rows.map(publicInstallation)};});}

export async function connectorAction(user,id,input){
  const data=inputSchema.parse(input);
  if(data.action==="configure_custom")return tenant(user,async client=>{
    const workspace=await owned(client,id),endpoint=await validateCustomEndpoint(data.endpoint,workspace.domain),{rows:[existing]}=await client.query("select id,revoked_at from negotiation.connector_installations where workspace_id=$1 and connector_kind='custom'",[id]);
    if(existing&&!existing.revoked_at)throw Error("Connector: A custom connection already exists. Save the endpoint without rotating its secret.");
    const installId=existing?.id||randomUUID(),setupSecret=randomBytes(32).toString("base64url"),ciphertext=seal(setupSecret,`${id}:${installId}`);
    const {rows:[row]}=await client.query(`insert into negotiation.connector_installations(id,workspace_id,connector_kind,provider,endpoint,credential_ciphertext,status,config)
      values($1,$2,'custom','custom',$3,$4,'connected',$5)
      on conflict(workspace_id,connector_kind) do update set endpoint=excluded.endpoint,credential_ciphertext=excluded.credential_ciphertext,status='connected',activation_status='testing',last_result=null,last_error=null,revoked_at=null returning *`,[installId,id,endpoint,ciphertext,{currency:workspace.currency,taxBasis:"inclusive",shipping:{mode:"unconfigured",merchantCostMinor:0,customerChargeMinor:0,countries:[]}}]);
    await client.query("insert into negotiation.audit_events(workspace_id,actor_user_id,name,detail) values($1,$2,'Custom connector configured','A scoped HTTPS connector credential was generated and encrypted. No database credential was stored.')",[id,user]);return {...publicInstallation(row),setupSecret};
  });
  return tenant(user,async client=>{
    const workspace=await owned(client,id);await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[id]);
    if(data.action==="verify_domain") {let values=[];try{values=(await resolveTxt(`_eon-negotiation.${workspace.domain}`)).map(parts=>parts.join(""));}catch{}const expected=`eon-negotiation-verification=${workspace.domain_verification_token}`;if(!values.includes(expected))throw Error("Connector: DNS verification record was not found yet.");await client.query("update negotiation.workspaces set domain_verified=true where id=$1",[id]);return {domainVerified:true};}
    const row=await installation(client,id,data.installationId);row.workspace_domain=workspace.domain;
    if(data.action==="update_custom_endpoint") {if(row.provider!=="custom")throw Error("Connector: Only custom connections have editable endpoints.");const endpoint=await validateCustomEndpoint(data.endpoint,workspace.domain),{rows:[updated]}=await client.query("update negotiation.connector_installations set endpoint=$1,status='connected',activation_status='testing',last_result=null,last_error=null where id=$2 returning *",[endpoint,row.id]);await client.query("insert into negotiation.audit_events(workspace_id,actor_user_id,name,detail) values($1,$2,'Custom endpoint updated','The endpoint changed without rotating its installation secret. Capability checks are required again.')",[id,user]);return publicInstallation(updated);}
    if(data.action==="rotate_custom_secret") {if(row.provider!=="custom")throw Error("Connector: Only custom connections use installation secrets.");const setupSecret=randomBytes(32).toString("base64url"),ciphertext=seal(setupSecret,`${id}:${row.id}`),{rows:[updated]}=await client.query("update negotiation.connector_installations set credential_ciphertext=$1,status='connected',activation_status='testing',last_result=null,last_error=null where id=$2 returning *",[ciphertext,row.id]);await client.query("insert into negotiation.audit_events(workspace_id,actor_user_id,name,detail) values($1,$2,'Installation secret rotated','The previous connector secret was revoked. Capability checks are required again.')",[id,user]);return {...publicInstallation(updated),setupSecret};}
    if(data.action==="shipping") {const config={...row.config,shipping:{mode:data.mode,merchantCostMinor:data.merchantCostMinor,customerChargeMinor:data.customerChargeMinor,countries:data.countries,rateId:"merchant-configured"}};const {rows:[updated]}=await client.query("update negotiation.connector_installations set shipping_mode=$1,config=$2 where id=$3 returning *",[data.mode,config,row.id]);return publicInstallation(updated);}
    if(data.action==="pause"){const {rows:[updated]}=await client.query("update negotiation.connector_installations set activation_status='paused' where id=$1 returning *",[row.id]);return publicInstallation(updated);}
    if(data.action==="activate"){if(row.status!=="ready")throw Error("Connector: Complete a successful cart test before activation.");if(!workspace.domain_verified)throw Error("Connector: Verify the company domain before production activation. Testing remains available.");const {rows:[updated]}=await client.query("update negotiation.connector_installations set activation_status='active' where id=$1 returning *",[row.id]);return publicInstallation(updated);}
    if(data.action==="sync"){
      await client.query("savepoint catalog_sync");
      try {
        let cursor=null,total=0,imported=0,updated=0;
        do {const result=await providerCatalog(client,row,{cursor,limit:100});for(const item of result.items){if(item.currency!==workspace.currency)throw Error("Connector: Store currency does not match this workspace.");const exists=(await client.query("select 1 from negotiation.products where workspace_id=$1 and external_variant_id=$2",[id,item.variantId])).rowCount>0;await client.query(`insert into negotiation.products(workspace_id,sku,name,price_minor,floor_minor,stock,source,external_product_id,external_variant_id,commerce_facts) values($1,$2,$3,$4,$4,$5,$6,$7,$8,$9) on conflict(workspace_id,external_variant_id) where external_variant_id is not null do update set sku=excluded.sku,name=excluded.name,price_minor=excluded.price_minor,floor_minor=least(negotiation.products.floor_minor,excluded.price_minor),stock=excluded.stock,source=excluded.source,external_product_id=excluded.external_product_id,commerce_facts=excluded.commerce_facts,updated_at=now()`,[id,item.sku,item.name,item.priceMinor,item.availableToSell,row.provider,item.productId,item.variantId,catalogFacts(item,result.storeTerms,result.asOf||new Date().toISOString())]);exists?updated++:imported++;total++;}cursor=result.nextCursor;if(total>=500&&cursor)throw Error("Connector: Catalog exceeds the current 500-product workspace limit.");}while(cursor);
        const at=new Date().toISOString(),config={...row.config,catalogSync:{at,imported,updated,total}};
        await client.query("update negotiation.connector_installations set status='read_only',last_success_at=now(),last_error=null,config=$2 where id=$1",[row.id,config]);await client.query("insert into negotiation.audit_events(workspace_id,actor_user_id,name,detail) values($1,$2,'Catalog synchronized',$3)",[id,user,`${imported} imported and ${updated} updated from ${row.provider}. New products remain non-negotiable until their minimum prices are reviewed.`]);await client.query("release savepoint catalog_sync");return {saved:total,imported,updated,lastSyncAt:at};
      } catch(error) {
        await client.query("rollback to savepoint catalog_sync");
        if(error.message.startsWith("Connector:"))throw error;
        const detail=/^(CONNECTOR|SHOPIFY|CURRENCY)/.test(error.message)?error.message:"CONNECTOR_SYNC_FAILED";
        const {rows:[failed]}=await client.query("update negotiation.connector_installations set last_attempt_at=now(),last_error=$1 where id=$2 returning *",[detail,row.id]);
        return publicInstallation(failed);
      }
    }
    if(data.action==="test"){
      await client.query("update negotiation.connector_installations set last_attempt_at=now() where id=$1",[row.id]);
      try {let result;if(data.cart){const capabilities=row.last_result?.capabilities||{};if(!capabilities.inventory||!capabilities.economics||!capabilities.checkout||!capabilities.reconciliation||!capabilities.events)throw Error("Connector: This connection is catalog-only. Complete exact-cart economics, enforceable checkout, reconciliation and payment events before live-cart testing.");if(data.cart.currency!==workspace.currency)throw Error("CURRENCY_MISMATCH");const {rows:[product]}=await client.query("select * from negotiation.products where workspace_id=$1 and (external_variant_id=$2 or sku=$2) limit 1",[id,data.cart.lines[0].variantId]);result=await providerContext(client,row,data.cart,product);if(!result.checkoutSupported)throw Error("CHECKOUT_UNSUPPORTED");}else result=await providerCapabilities(client,row);const status=data.cart?"ready":"read_only",{rows:[updated]}=await client.query("update negotiation.connector_installations set status=$1,last_result=$2,last_success_at=now(),last_error=null where id=$3 returning *",[status,result,row.id]);await client.query("insert into negotiation.audit_events(workspace_id,actor_user_id,name,detail) values($1,$2,$3,$4)",[id,user,data.cart?"Live cart verified":"Connector capabilities verified",data.cart?"Fresh price, inventory, economics and checkout capability passed the platform contract.":"The connector responded to a signed capability check."]);return publicInstallation(updated);}catch(error){if(error.message.startsWith("Connector:"))throw error;const detail=/^(CONNECTOR|SHOPIFY|CHECKOUT|CURRENCY)/.test(error.message)?error.message:"CONNECTOR_CHECK_FAILED";const {rows:[updated]}=await client.query("update negotiation.connector_installations set status='failed',last_error=$1 where id=$2 returning *",[detail,row.id]);return publicInstallation(updated);}
    }
  });
}
