export const eventTypes = new Set(['eligibility_evaluated','experiment_assigned','invitation_shown','invitation_dismissed',
 'negotiation_started','intent_confirmed','offer_created','offer_accepted','checkout_created','order_paid','order_cancelled',
 'order_refunded','recovery_invited','recovery_opened','policy_published','merchant_paused']);
// Only pass server-validated properties; allowlist prevents messages, tokens and private floors leaking.
const properties = new Set(['surface','concessionType','reasonCode','policyVersion','triggerVersion','scoreVersion','orderReference','currency','netRevenueMinor','contributionMinor']);
export async function recordEvent(client,event) {
 if(!eventTypes.has(event.type)||!['live','sandbox'].includes(event.mode)||typeof event.eventKey!=='string'||event.eventKey.length>200)throw Error('INVALID_EVENT');
 const safeProperties=Object.fromEntries(Object.entries(event.properties||{}).filter(([key,value])=>properties.has(key)&&
   (typeof value==='string'&&value.length<=200||Number.isSafeInteger(value))));
 return client.query(`insert into negotiation.conversion_events
 (workspace_id,event_key,event_type,mode,visitor_key,assignment_id,session_id,quote_id,properties)
 values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(workspace_id,event_key) do nothing`,
 [event.workspaceId,event.eventKey,event.type,event.mode,event.visitorKey??null,event.assignmentId??null,event.sessionId??null,event.quoteId??null,safeProperties]);
}
// Caller must verify monetary events from the provider; never expose this function as raw public ingestion.
