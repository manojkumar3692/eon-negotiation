import {createHmac,randomUUID,timingSafeEqual} from "node:crypto";
import {connectorRequestSchema,validateConnectorResponse} from "../commerce/contract.js";
import {fingerprint,verifyConnectorSignature} from "../commerce/custom.js";

const equal=(a,b)=>{const left=Buffer.from(String(a)),right=Buffer.from(String(b));return left.length===right.length&&timingSafeEqual(left,right);};
const json=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});

export function createConnectorHandler({workspaceId,installationId,secret,capabilities,listCatalog,getContext,createCheckout,reconcile,claimNonce,now=Date.now}) {
  if(!workspaceId||!installationId||!secret||typeof claimNonce!=="function")throw Error("Connector configuration is incomplete");
  return async function handle(request) {
    const length=Number(request.headers.get("content-length")||0);if(length>256000)return json({error:"Request too large"},413);
    const raw=await request.text();if(Buffer.byteLength(raw)>256000)return json({error:"Request too large"},413);
    const authorization=request.headers.get("authorization")||"",timestamp=request.headers.get("x-negotiation-timestamp"),nonce=request.headers.get("x-negotiation-nonce"),signature=request.headers.get("x-negotiation-signature");
    if(!authorization.startsWith("Bearer ")||!equal(authorization.slice(7),secret)||!verifyConnectorSignature(secret,{timestamp,nonce,body:raw,signature,now:now()}))return json({error:"Unauthorized"},401);
    if(!await claimNonce(nonce,new Date(now()+60000)))return json({error:"Duplicate request"},409);
    let input;try{input=connectorRequestSchema.parse(JSON.parse(raw));}catch{return json({error:"Invalid request"},400);}
    if(input.workspaceId!==workspaceId||input.installationId!==installationId)return json({error:"Wrong installation"},403);
    try {
      let payload;
      if(input.operation==="capabilities")payload={capabilities:await capabilities(),requirements:[]};
      if(input.operation==="catalog")payload=await listCatalog({cursor:input.cursor,limit:input.limit});
      if(input.operation==="context")payload={...(await getContext(input.cart)),cartFingerprint:fingerprint(input.cart)};
      if(input.operation==="checkout")payload=await createCheckout(input.quote,input.idempotencyKey);
      if(input.operation==="reconcile")payload=await reconcile(input.externalId);
      const current=now(),response={schemaVersion:"3",workspaceId,installationId,operation:input.operation,asOf:new Date(current).toISOString(),expiresAt:new Date(current+60000).toISOString(),revision:payload.revision||`${input.operation}-${current}`,...payload};
      validateConnectorResponse(response,{operation:input.operation,workspaceId,installationId,...(input.operation==="context"?{cartFingerprint:fingerprint(input.cart)}:{})},current);
      return json(response);
    } catch(error) {console.error("Merchant connector operation failed",input.operation,error?.code||error?.name);return json({error:"Operation unavailable"},error?.code==="UNSUPPORTED"?422:503);}
  };
}

export async function sendConnectorEvent({platformOrigin,installationId,secret,event,fetcher=fetch,now=Date.now()}) {
  const body=JSON.stringify({schemaVersion:"3",eventId:event.eventId||randomUUID(),type:event.type,externalId:event.externalId,occurredAt:event.occurredAt||new Date(now).toISOString()}),timestamp=String(now),nonce=randomUUID(),signature=createHmac("sha256",secret).update(`${timestamp}\n${nonce}\n${body}`).digest("hex");
  const response=await fetcher(`${platformOrigin}/api/webhooks/custom/${installationId}`,{method:"POST",redirect:"error",headers:{"Content-Type":"application/json","X-Negotiation-Timestamp":timestamp,"X-Negotiation-Nonce":nonce,"X-Negotiation-Signature":signature},body});
  if(!response.ok)throw Error("NEGOTIATION_EVENT_REJECTED");return response.json();
}
