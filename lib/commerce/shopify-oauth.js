import {createHash,randomBytes,randomUUID} from "node:crypto";
import {tenant,service} from "../db.js";
import {seal} from "../connectors/client-v2.js";
import {exchangeShopifyCode,normalizeShopDomain,shopifyAuthorizationUrl,SHOPIFY_SCOPES,verifyShopifyOAuth} from "./shopify.js";

const hash=value=>createHash("sha256").update(value).digest("hex");

function configuration(env=process.env) {
  if(!env.SHOPIFY_CLIENT_ID||!env.SHOPIFY_CLIENT_SECRET||!env.APP_ORIGIN)throw Error("SHOPIFY_NOT_CONFIGURED");
  return {clientId:env.SHOPIFY_CLIENT_ID,clientSecret:env.SHOPIFY_CLIENT_SECRET,redirectUri:`${env.APP_ORIGIN}/api/integrations/shopify/callback`};
}

export async function beginShopifyOAuth(user,workspaceId,shop,env=process.env) {
  const cfg=configuration(env),domain=normalizeShopDomain(shop),raw=randomBytes(32).toString("base64url");
  await tenant(user,async client=>{
    const {rows:[workspace]}=await client.query("select id from negotiation.workspaces where id=$1",[workspaceId]);if(!workspace)throw Error("NOT_FOUND");
    await client.query("delete from negotiation.oauth_states where workspace_id=$1 and provider='shopify' and (expires_at<now() or consumed_at is not null)",[workspaceId]);
    await client.query("insert into negotiation.oauth_states(workspace_id,provider,state_hash,shop_domain,expires_at) values($1,'shopify',$2,$3,now()+interval '10 minutes')",[workspaceId,hash(raw),domain]);
  });
  return shopifyAuthorizationUrl({shop:domain,state:raw,clientId:cfg.clientId,redirectUri:cfg.redirectUri,scopes:SHOPIFY_SCOPES});
}

export async function finishShopifyOAuth(url,env=process.env,fetcher=fetch) {
  const cfg=configuration(env),query=url.searchParams;
  if(!verifyShopifyOAuth(query,cfg.clientSecret))throw Error("SHOPIFY_OAUTH_INVALID");
  const raw=query.get("state"),code=query.get("code"),shop=normalizeShopDomain(query.get("shop"));
  if(!raw||!code)throw Error("SHOPIFY_OAUTH_INVALID");
  const state=await service(async client=>{
    const {rows:[row]}=await client.query("select * from negotiation.oauth_states where state_hash=$1 and provider='shopify' and consumed_at is null and expires_at>now() for update",[hash(raw)]);
    if(!row||row.shop_domain!==shop)throw Error("SHOPIFY_OAUTH_INVALID");
    await client.query("update negotiation.oauth_states set consumed_at=now() where id=$1",[row.id]);return row;
  });
  const token=await exchangeShopifyCode({shop,code,clientId:cfg.clientId,clientSecret:cfg.clientSecret,fetcher});
  return service(async client=>{
    const {rows:[workspace]}=await client.query("select id,currency from negotiation.workspaces where id=$1",[state.workspace_id]);if(!workspace)throw Error("NOT_FOUND");
    const {rows:[existing]}=await client.query("select id from negotiation.connector_installations where workspace_id=$1 and connector_kind='shopify'",[workspace.id]);
    const id=existing?.id||randomUUID(),binding=`${workspace.id}:${id}`;
    const access=seal(token.access_token,binding,env),refresh=seal(token.refresh_token,`${binding}:refresh`,env),expires=new Date(Date.now()+Number(token.expires_in)*1000);
    await client.query(`insert into negotiation.connector_installations(id,workspace_id,connector_kind,provider,endpoint,shop_domain,credential_ciphertext,refresh_credential_ciphertext,token_expires_at,scopes,config,status)
      values($1,$2,'shopify','shopify',$3,$4,$5,$6,$7,$8,$9,'connected')
      on conflict(workspace_id,connector_kind) do update set endpoint=excluded.endpoint,shop_domain=excluded.shop_domain,credential_ciphertext=excluded.credential_ciphertext,refresh_credential_ciphertext=excluded.refresh_credential_ciphertext,token_expires_at=excluded.token_expires_at,scopes=excluded.scopes,config=excluded.config,status='connected',revoked_at=null,last_error=null`,[id,workspace.id,`https://${shop}`,shop,access,refresh,expires,SHOPIFY_SCOPES,{currency:workspace.currency,taxBasis:"inclusive",shipping:{mode:"none",merchantCostMinor:0,customerChargeMinor:0,countries:[]}}]);
    await client.query("insert into negotiation.audit_events(workspace_id,actor_user_id,name,detail) select id,owner_user_id,'Shopify authorized','Shopify OAuth completed. Catalog sync and rule review are required before activation.' from negotiation.workspaces where id=$1",[workspace.id]);
    return workspace.id;
  });
}
