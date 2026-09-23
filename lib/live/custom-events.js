import {createHash} from 'node:crypto';
// Financial facts outrank delivery order: a paid order may later be refunded,
// but cancellation or a delayed paid event can never undo a full refund.
export function nextCheckoutStatus(current,type){
 if(!['started','created','failed','paid','refunded'].includes(current))throw Error('INVALID_CHECKOUT_STATE');
 if(!['checkout.paid','checkout.cancelled','checkout.refunded'].includes(type))throw Error('INVALID_EVENT');
 if(current==='refunded'||type==='checkout.refunded')return 'refunded';
 if(current==='paid'||type==='checkout.paid')return 'paid';
 return 'failed';
}
export function customEventKey(installationId,eventId){return createHash('sha256').update(JSON.stringify([installationId,eventId])).digest('hex');}
export async function applyCustomEvent(client,installation,event){
 const key=customEventKey(installation.id,event.eventId);
 const inserted=await client.query("insert into negotiation.webhook_inbox(provider,event_id,topic,payload) values('custom',$1,$2,$3) on conflict(provider,event_id) do nothing returning id",[key,event.type,{installationId:installation.id,externalId:event.externalId,occurredAt:event.occurredAt}]);
 if(!inserted.rowCount)return {ok:true,duplicate:true};
 const {rows:[attempt]}=await client.query(`select a.id,a.quote_id,a.status from negotiation.checkout_attempts a join negotiation.live_sessions s on s.id=a.session_id where a.workspace_id=$1 and s.installation_id=$2 and a.external_id=$3 for update of a`,[installation.workspace_id,installation.id,event.externalId]);
 // Throw inside the transaction: roll back the inbox insert so the same event
 // can succeed after the checkout-creation transaction commits.
 if(!attempt)throw Error('CHECKOUT_NOT_READY');
 const status=nextCheckoutStatus(attempt.status,event.type);
 if(status!==attempt.status){
  await client.query('update negotiation.checkout_attempts set status=$1,updated_at=now() where id=$2',[status,attempt.id]);
  await client.query('update negotiation.budget_reservations set status=$1,updated_at=now() where quote_id=$2',[status==='paid'?'committed':'released',attempt.quote_id]);
 }
 await client.query("update negotiation.webhook_inbox set status='processed',processed_at=now() where provider='custom' and event_id=$1",[key]);
 return {ok:true};
}
