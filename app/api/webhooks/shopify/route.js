import {createHmac,timingSafeEqual} from "node:crypto";
import {service} from "../../../../lib/db.js";

function valid(raw,header,secret){if(!header||!secret)return false;const expected=createHmac("sha256",secret).update(raw).digest("base64"),a=Buffer.from(expected),b=Buffer.from(header);return a.length===b.length&&timingSafeEqual(a,b);}
function quoteFromTags(tags){const list=Array.isArray(tags)?tags:String(tags||"").split(","),tag=list.map(x=>x.trim()).find(x=>x.startsWith("negotiation-")),value=tag?.slice(12)||"";return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)?value:null;}
export async function POST(request){
  const raw=await request.text(),hmac=request.headers.get("x-shopify-hmac-sha256");if(!valid(raw,hmac,process.env.SHOPIFY_CLIENT_SECRET))return Response.json({error:"Invalid signature"},{status:401});
  const eventId=request.headers.get("x-shopify-webhook-id"),topic=request.headers.get("x-shopify-topic")||"unknown",shop=(request.headers.get("x-shopify-shop-domain")||"").toLowerCase();if(!eventId||!shop)return Response.json({error:"Missing webhook identity"},{status:400});
  let payload;try{payload=JSON.parse(raw);}catch{return Response.json({error:"Invalid JSON"},{status:400});}
  await service(async client=>{
    const minimal={id:payload.id||null,adminGraphqlApiId:payload.admin_graphql_api_id||null,orderId:payload.order_id||null,tags:payload.tags||null};
    const inserted=await client.query("insert into negotiation.webhook_inbox(provider,event_id,shop_domain,topic,payload) values('shopify',$1,$2,$3,$4) on conflict(provider,event_id) do nothing returning id",[eventId,shop,topic,minimal]);if(!inserted.rowCount)return;
    if(topic==="app/uninstalled"||topic==="shop/redact")await client.query("update negotiation.connector_installations set status='revoked',activation_status='paused',revoked_at=now(),credential_ciphertext='',refresh_credential_ciphertext=null where provider='shopify' and shop_domain=$1",[shop]);
    if(topic==="orders/paid") {const quoteId=quoteFromTags(payload.tags);if(quoteId){await client.query("update negotiation.checkout_attempts set status='paid',response=coalesce(response,'{}'::jsonb)||jsonb_build_object('orderId',$2::text),updated_at=now() where quote_id=$1",[quoteId,String(payload.id)]);await client.query("update negotiation.budget_reservations set status='committed',updated_at=now() where quote_id=$1",[quoteId]);}}
    if(topic==="orders/cancelled") {const quoteId=quoteFromTags(payload.tags);if(quoteId){await client.query("update negotiation.checkout_attempts set status='failed',updated_at=now() where quote_id=$1",[quoteId]);await client.query("update negotiation.budget_reservations set status='released',updated_at=now() where quote_id=$1",[quoteId]);}}
    if(topic==="refunds/create"&&payload.order_id) {const {rows:[attempt]}=await client.query("update negotiation.checkout_attempts set status='refunded',updated_at=now() where response->>'orderId'=$1 returning quote_id",[String(payload.order_id)]);if(attempt)await client.query("update negotiation.budget_reservations set status='released',updated_at=now() where quote_id=$1",[attempt.quote_id]);}
    await client.query("update negotiation.webhook_inbox set status='processed',processed_at=now() where provider='shopify' and event_id=$1",[eventId]);
  });
  return Response.json({ok:true});
}
