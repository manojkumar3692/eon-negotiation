// Heuristic rank, NOT an estimated conversion probability. No personal wealth proxies.
export function rankDeals(candidates, {strategy='balanced',preferredType,inventoryPriority=0}={}) {
  const weights = {protect_margin:0.85,balanced:0.6,maximize_conversion:0.35,clear_inventory:0.45};
  const weight = weights[strategy] ?? weights.balanced;
  const maxMargin = Math.max(1,...candidates.map(c=>c.contributionMinor));
  return candidates.map(c=>({...c,score:Math.round(100*(weight*c.contributionMinor/maxMargin+
    (1-weight)*(c.type===preferredType?1:0.4)) +
    (strategy==='clear_inventory' && c.type==='quantity'?Math.max(0,Math.min(1,inventoryPriority))*5:0)),scoreVersion:'heuristic-v1'}))
    .sort((a,b)=>b.score-a.score || a.concessionMinor-b.concessionMinor);
}
export function suggestRuleChange({completedOrders,minOrders=100,controlVisitors,treatmentVisitors}) {
  if (completedOrders < minOrders || !controlVisitors || !treatmentVisitors)
    return {status:'collecting_data',message:'Keep current rules. More verified orders and a control comparison are needed.'};
  return {status:'review_required',message:'Review concession cohorts and confidence intervals before proposing a new policy version.',autoApply:false};
}
