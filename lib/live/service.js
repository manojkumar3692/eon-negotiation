import {createHash,randomBytes,randomUUID} from "node:crypto";
import {service} from "../db.js";
import {cartSchema} from "../commerce/contract.js";
import {fingerprint} from "../commerce/custom.js";
import {providerCheckout,providerContext} from "../commerce/providers.js";
import {decideLiveOffer} from "./rules.js";
import {interpretCustomer,numericTarget} from "./ai.js";

const hash=value=>createHash("sha256").update(value).digest("hex");
const money=(minor,currency)=>new Intl.NumberFormat("en",{style:"currency",currency}).format(minor/100);

async function installationByKey(client,key) {
  const {rows:[row]}=await client.query(`select i.*,w.currency,w.domain,w.domain_verified from negotiation.connector_installations i join negotiation.workspaces w on w.id=i.workspace_id where i.public_key=$1 and i.status='ready' and i.activation_status in ('testing','active') and i.revoked_at is null`,[key]);
  if(!row)throw Error("NEGOTIATION_UNAVAILABLE");return row;
}
async function sessionByToken(client,id,token,lock=false) {
  const {rows:[row]}=await client.query(`select s.*,i.id as connector_id,i.provider,i.endpoint,i.shop_domain,i.credential_ciphertext,i.refresh_credential_ciphertext,i.token_expires_at,i.scopes,i.config,i.status as installation_status,i.activation_status,i.revoked_at from negotiation.live_sessions s join negotiation.connector_installations i on i.id=s.installation_id where s.id=$1 and s.token_hash=$2 ${lock?"for update of s":""}`,[id,hash(token||"")]);
  if(!row||row.status!=="open"||Date.parse(row.expires_at)<=Date.now()||row.installation_status!=="ready"||row.activation_status==="paused"||row.revoked_at)throw Error("SESSION_UNAVAILABLE");
  return row;
}
const connectorFromSession=session=>({...session,id:session.connector_id,workspace_id:session.workspace_id});
async function platformProduct(client,workspaceId,variantId) {
  const {rows:[row]}=await client.query("select * from negotiation.products where workspace_id=$1 and (external_variant_id=$2 or sku=$2) limit 1",[workspaceId,variantId]);return row;
}
async function latestPolicy(client,workspaceId) {
  const {rows:[row]}=await client.query("select version,config from negotiation.policy_versions where workspace_id=$1 order by version desc limit 1",[workspaceId]);return row;
}
async function addTurn(client,sessionId,role,kind,content,metadata={}) {
  await client.query("insert into negotiation.negotiation_turns(session_id,role,kind,content,metadata) values($1,$2,$3,$4,$5)",[sessionId,role,kind,content,metadata]);
}

export async function startLiveSession(input) {
  if(process.env.NEGOTIATION_ENABLED!=="true")throw Error("NEGOTIATION_DISABLED");
  const cart=cartSchema.parse(input.cart),token=randomBytes(32).toString("base64url");
  return service(async client=>{
    const installation=await installationByKey(client,input.publicKey);
    if(cart.currency!==installation.currency)throw Error("CURRENCY_MISMATCH");
    const {rows:[limit]}=await client.query("select count(*)::int as count from negotiation.live_sessions where installation_id=$1 and created_at>now()-interval '1 hour'",[installation.id]);
    if(limit.count>=1000)throw Error("RATE_LIMIT");
    const product=await platformProduct(client,installation.workspace_id,cart.lines[0].variantId),policy=await latestPolicy(client,installation.workspace_id);
    const context=await providerContext(client,installation,cart,product);
    if(context.currency!==installation.currency)throw Error("CURRENCY_MISMATCH");
    const id=randomUUID(),expires=new Date(Date.now()+Math.min(policy.config.ttlMinutes,15)*60000);
    await client.query("insert into negotiation.live_sessions(id,workspace_id,installation_id,token_hash,cart,context_snapshot,policy_version,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8)",[id,installation.workspace_id,installation.id,hash(token),cart,context,policy.version,expires]);
    await client.query("insert into negotiation.audit_events(workspace_id,actor_user_id,name,detail) values($1,'system:widget','Customer negotiation started','A live session started with fresh connector context. No customer identity was stored.')",[installation.workspace_id]);
    const greeting=`Hi! You can make an offer for ${context.line.name}. What item price did you have in mind?`;
    await addTurn(client,id,"assistant","greeting",greeting);
    return {sessionId:id,sessionToken:token,expiresAt:expires.toISOString(),product:{name:context.line.name,unitPriceMinor:context.line.unitPriceMinor,currency:context.currency,quantity:context.line.quantity},message:greeting};
  });
}

export async function customerMessage(id,token,message) {
  if(typeof message!=="string"||!message.trim()||message.length>1000)throw Error("INVALID_MESSAGE");
  return service(async client=>{
    const session=await sessionByToken(client,id,token,true);
    const {rows:[count]}=await client.query("select count(*)::int as count from negotiation.negotiation_turns where session_id=$1",[id]);if(count.count>=40)throw Error("MESSAGE_LIMIT");
    const context=session.context_snapshot;
    const {rows:history}=await client.query("select role,content from negotiation.negotiation_turns where session_id=$1 order by id desc limit 6",[id]);
    await addTurn(client,id,"customer","message",message.trim());
    let target=numericTarget(message),intent=null;
    if(target==null) {
      try {intent=await interpretCustomer({message,history:history.reverse(),product:{name:context.line.name},currency:context.currency});}
      catch {const reply=`The assistant is temporarily unavailable. Enter one price directly, for example ${Math.floor(context.line.unitPriceMinor/100)}.`;await addTurn(client,id,"assistant","fallback",reply);return {message:reply,mode:"fallback"};}
      if(intent.intent==="offer"&&intent.confidence>=0.85&&intent.currency===context.currency)target=intent.targetMinor;
    }
    let reply;
    if(target!=null) {
      if(target>context.line.unitPriceMinor*context.line.quantity)reply="Your offer is above the current item price. Enter a price at or below the current price.";
      else {await client.query("update negotiation.live_sessions set pending_target_minor=$1,updated_at=now() where id=$2",[target,id]);reply=`You want to offer ${money(target,context.currency)}. Confirm this amount and I’ll check it against the merchant’s current rules.`;}
    } else if(intent?.intent==="greeting")reply=`Hi! What item price would you like to offer for ${context.line.name}?`;
    else if(intent?.intent==="accept")reply="Use the accept button on the current offer to create a secure checkout.";
    else if(intent?.currency&&intent.currency!==context.currency)reply=`This store negotiates in ${context.currency}. What ${context.currency} item price would you like to offer?`;
    else reply="Enter one item price without bundles or extra conditions, and I’ll ask you to confirm it.";
    await addTurn(client,id,"assistant",target!=null?"confirm_target":"reply",reply,target!=null?{targetMinor:target}:{});
    return {message:reply,confirmTarget:target!=null,targetMinor:target,mode:intent?"ai":"numeric"};
  });
}

export async function confirmTarget(id,token) {
  return service(async client=>{
    const session=await sessionByToken(client,id,token,true);if(!session.pending_target_minor)throw Error("NO_PENDING_TARGET");
    const policy=await latestPolicy(client,session.workspace_id);if(session.round>=policy.config.rounds)throw Error("ROUND_LIMIT");
    const product=await platformProduct(client,session.workspace_id,session.cart.lines[0].variantId);
    const context=await providerContext(client,connectorFromSession(session),session.cart,product),decision=decideLiveOffer(context,policy.config,session.pending_target_minor,session.round+1);
    if(decision.status==="unavailable"){await client.query("update negotiation.live_sessions set pending_target_minor=null,context_snapshot=$1,updated_at=now() where id=$2",[context,id]);const reply="I can’t create an offer right now because the required store data is unavailable.";await addTurn(client,id,"assistant","unavailable",reply,{reason:decision.reason});return {status:"unavailable",reason:decision.reason,message:reply};}
    await client.query("update negotiation.live_quotes set status='superseded' where session_id=$1 and status='offered'",[id]);
    // The connector context is revalidated at acceptance, so the customer-facing
    // quote can use the merchant's configured TTL without trusting stale facts.
    const quoteId=randomUUID(),expires=new Date(Date.now()+policy.config.ttlMinutes*60000);
    await client.query("insert into negotiation.live_quotes(id,session_id,workspace_id,policy_version,amount_minor,baseline_minor,shipping_minor,currency,context_revision,cart_fingerprint,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",[quoteId,id,session.workspace_id,policy.version,decision.amountMinor,decision.baselineMinor,decision.shippingMinor,decision.currency,context.revision,context.cartFingerprint,expires]);
    await client.query("insert into negotiation.audit_events(workspace_id,actor_user_id,name,detail) values($1,'system:widget','Live quote issued',$2)",[session.workspace_id,`${decision.status}; policy version ${policy.version}; quote ${quoteId}.`]);
    await client.query("update negotiation.live_sessions set round=round+1,pending_target_minor=null,context_snapshot=$1,policy_version=$2,updated_at=now() where id=$3",[context,policy.version,id]);
    const reply=decision.status==="accepted"?`Your offer of ${money(decision.amountMinor,decision.currency)} is accepted.`:`The merchant can offer ${money(decision.amountMinor,decision.currency)} for the item.`;
    await addTurn(client,id,"assistant","quote",reply,{quoteId,amountMinor:decision.amountMinor,status:decision.status,expiresAt:expires.toISOString()});
    return {status:decision.status,message:reply,quote:{id:quoteId,amountMinor:decision.amountMinor,shippingMinor:decision.shippingMinor,totalMinor:decision.amountMinor+decision.shippingMinor,currency:decision.currency,expiresAt:expires.toISOString()},roundsRemaining:policy.config.rounds-session.round-1};
  });
}

export async function acceptQuote(id,token,{quoteId,idempotencyKey}) {
  if(!/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey||""))throw Error("INVALID_IDEMPOTENCY_KEY");
  return service(async client=>{
    const session=await sessionByToken(client,id,token,true);
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[session.workspace_id]);
    const requestHash=fingerprint({quoteId,cart:session.cart});
    const {rows:[prior]}=await client.query("select * from negotiation.checkout_attempts where session_id=$1 and idempotency_key=$2",[id,idempotencyKey]);
    if(prior){if(prior.request_hash!==requestHash)throw Error("IDEMPOTENCY_MISMATCH");if(prior.status==="created")return {status:"created",checkoutUrl:prior.checkout_url,externalId:prior.external_id};}
    const {rows:[quote]}=await client.query("select * from negotiation.live_quotes where id=$1 and session_id=$2 and status='offered' for update",[quoteId,id]);
    if(!quote||Date.parse(quote.expires_at)<=Date.now())throw Error("QUOTE_EXPIRED");
    const product=await platformProduct(client,session.workspace_id,session.cart.lines[0].variantId),policy=await latestPolicy(client,session.workspace_id);
    const connector=connectorFromSession(session),context=await providerContext(client,connector,session.cart,product),decision=decideLiveOffer(context,policy.config,quote.amount_minor,session.round);
    if(decision.status==="unavailable"||decision.amountMinor>quote.amount_minor||context.cartFingerprint!==quote.cart_fingerprint||context.revision!==quote.context_revision)throw Error("CONTEXT_CHANGED");
    const discount=quote.baseline_minor-quote.amount_minor;
    const {rows:[spend]}=await client.query("select coalesce(sum(discount_minor),0)::int as total from negotiation.budget_reservations where workspace_id=$1 and status in ('reserved','committed') and created_at>=date_trunc('day',now())",[session.workspace_id]);
    if(spend.total+discount>policy.config.dailyBudgetMinor)throw Error("DAILY_BUDGET_EXHAUSTED");
    await client.query("insert into negotiation.budget_reservations(workspace_id,quote_id,discount_minor,expires_at) values($1,$2,$3,$4)",[session.workspace_id,quote.id,discount,quote.expires_at]);
    const attemptId=randomUUID();
    await client.query("insert into negotiation.checkout_attempts(id,workspace_id,session_id,quote_id,idempotency_key,request_hash) values($1,$2,$3,$4,$5,$6)",[attemptId,session.workspace_id,id,quote.id,idempotencyKey,requestHash]);
    const checkout=await providerCheckout(client,connector,{id:quote.id,cart:session.cart,amountMinor:quote.amount_minor,shippingMinor:quote.shipping_minor,currency:quote.currency,expiresAt:new Date(quote.expires_at).toISOString(),contextRevision:quote.context_revision},context,idempotencyKey);
    await client.query("update negotiation.checkout_attempts set status='created',external_id=$1,checkout_url=$2,response=$3,updated_at=now() where id=$4",[checkout.externalId,checkout.checkoutUrl,checkout,attemptId]);
    await client.query("update negotiation.live_quotes set status='accepted' where id=$1",[quote.id]);
    await client.query("update negotiation.live_sessions set status='accepted',updated_at=now() where id=$1",[id]);
    await client.query("update negotiation.budget_reservations set status='committed',updated_at=now() where quote_id=$1",[quote.id]);
    await client.query("insert into negotiation.audit_events(workspace_id,actor_user_id,name,detail) values($1,'system:widget','Checkout created',$2)",[session.workspace_id,`Accepted quote ${quote.id} was handed to ${session.provider} checkout.`]);
    await addTurn(client,id,"assistant","checkout","Your secure checkout is ready.",{externalId:checkout.externalId});
    return {status:"created",checkoutUrl:checkout.checkoutUrl,externalId:checkout.externalId};
  });
}
