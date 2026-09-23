import {applyCustomEvent} from '../../../../../lib/live/custom-events.js';
import {z} from "zod";
import {service} from "../../../../../lib/db.js";
import {unseal} from "../../../../../lib/connectors/client-v2.js";
import {verifyConnectorSignature} from "../../../../../lib/commerce/custom.js";

const eventSchema=z.object({schemaVersion:z.literal("3"),eventId:z.string().min(8).max(200),type:z.enum(["checkout.paid","checkout.cancelled","checkout.refunded"]),externalId:z.string().min(1).max(240),occurredAt:z.string().datetime()}).strict();
export async function POST(request,{params}){
  const {installationId}=await params,raw=await request.text();
  try {
    return await service(async client=>{
      const {rows:[installation]}=await client.query("select * from negotiation.connector_installations where id=$1 and provider='custom' and revoked_at is null",[installationId]);if(!installation)return Response.json({error:"Not found"},{status:404});
      const token=unseal(installation.credential_ciphertext,`${installation.workspace_id}:${installation.id}`),valid=verifyConnectorSignature(token,{timestamp:request.headers.get("x-negotiation-timestamp"),nonce:request.headers.get("x-negotiation-nonce"),signature:request.headers.get("x-negotiation-signature"),body:raw});if(!valid)return Response.json({error:"Invalid signature"},{status:401});
      const event=eventSchema.parse(JSON.parse(raw));
      return Response.json(await applyCustomEvent(client,installation,event));
    });
  }catch(error){if(error.message==='CHECKOUT_NOT_READY')return Response.json({error:"Checkout not ready; retry this event."},{status:409,headers:{'Retry-After':'5'}});if(error instanceof z.ZodError||error instanceof SyntaxError)return Response.json({error:"Invalid event"},{status:400});console.error("Custom webhook failed",error.message);return Response.json({error:"Webhook failed"},{status:503});}
}
