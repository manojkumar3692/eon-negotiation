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
      const event=eventSchema.parse(JSON.parse(raw)),inserted=await client.query("insert into negotiation.webhook_inbox(provider,event_id,topic,payload) values('custom',$1,$2,$3) on conflict(provider,event_id) do nothing returning id",[event.eventId,event.type,{externalId:event.externalId,occurredAt:event.occurredAt}]);if(!inserted.rowCount)return Response.json({ok:true,duplicate:true});
      const statuses={"checkout.paid":"paid","checkout.cancelled":"failed","checkout.refunded":"refunded"},reservation=event.type==="checkout.paid"?"committed":"released";
      const {rows:[attempt]}=await client.query("update negotiation.checkout_attempts set status=$1,updated_at=now() where workspace_id=$2 and external_id=$3 returning quote_id",[statuses[event.type],installation.workspace_id,event.externalId]);if(attempt)await client.query("update negotiation.budget_reservations set status=$1,updated_at=now() where quote_id=$2",[reservation,attempt.quote_id]);
      await client.query("update negotiation.webhook_inbox set status=$1,processed_at=now() where provider='custom' and event_id=$2",[attempt?"processed":"ignored",event.eventId]);return Response.json({ok:true});
    });
  }catch(error){if(error instanceof z.ZodError||error instanceof SyntaxError)return Response.json({error:"Invalid event"},{status:400});console.error("Custom webhook failed",error.message);return Response.json({error:"Webhook failed"},{status:503});}
}
