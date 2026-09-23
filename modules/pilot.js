import {eligibility} from './trigger/index.js';
import {candidates,publicOffer} from './rules/index.js';
import {rankDeals} from './optimize/index.js';
import {interpretSandbox} from './converse/index.js';
export function simulatePilot({product,policy,trigger,signals,message,context}) {
  const eligible=eligibility(signals,trigger);
  if (eligible.state==='no_negotiation') return {eligible,status:'not_invited',message:'Continue shopping at the public price. No negotiation invitation for this scenario.'};
  const intent=interpretSandbox(message);
  if (intent.intent==='clarify') return {eligible,status:'clarify',message:'Enter a price, shipping request, or quantity.'};
  const ranked=rankDeals(candidates(product,policy,{...context,quantity:intent.quantity}),{strategy:policy.strategy,preferredType:intent.preferredType,inventoryPriority:1});
  if (!ranked.length) return {eligible,status:'unavailable',message:'No approved deal fits the cost, floor, budget and checkout capabilities.'};
  const deal=ranked[0];
  return {eligible,status:'simulated',intent,offer:publicOffer(deal,'INR',new Date(Date.now()+policy.ttlSeconds*1000).toISOString()),
    message:'This is a sandbox counteroffer. Review the total and conditions; no order will be created.'};
}
