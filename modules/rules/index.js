const valid = n => Number.isSafeInteger(n) && n >= 0;
export const concessionTypes = ['price','shipping','sample','quantity','prepaid','credit','approved_terms'];
export const strategies = ['protect_margin','balanced','maximize_conversion','clear_inventory'];
// Private server domain module; the pilot UI uses fictional merchant-owned fixtures only.
export function candidates(product, policy, context) {
  const q = context.quantity;
  if (!policy.enabled || !strategies.includes(policy.strategy) || !Array.isArray(policy.allowed) ||
      ![product.publicMinor,product.targetMinor,product.floorMinor,product.costMinor,product.stock,
        policy.maxDiscountBps,policy.minContributionMinor,policy.maxQuantity,policy.maxRounds,policy.dailyBudgetMinor,
        context.shippingCostMinor,context.shippingChargeMinor,context.paymentFeeMinor,context.remainingBudgetMinor,context.round].every(valid) ||
      product.publicMinor === 0 || product.floorMinor > product.targetMinor || product.targetMinor > product.publicMinor ||
      policy.maxDiscountBps > 10000 || !Number.isSafeInteger(q) || q < 1 || q > policy.maxQuantity || q > product.stock ||
      context.round < 1 || context.round > policy.maxRounds) return [];
  const baseline = product.publicMinor*q;
  if (!Number.isSafeInteger(baseline)) return [];
  const capFloor = Number((BigInt(baseline)*BigInt(10000-policy.maxDiscountBps)+9999n)/10000n);
  const amount = Math.max(product.targetMinor*q,capFloor,product.floorMinor*q);
  const list = [];
  const add = (type,itemMinor,shippingMinor,extraCostMinor=0,terms={}) => {
    if (!policy.allowed.includes(type) || !context.capabilities?.includes(type)) return;
    const totalMinor = itemMinor+shippingMinor;
    const concessionMinor = baseline+context.shippingChargeMinor-totalMinor+extraCostMinor;
    const contributionMinor = totalMinor-product.costMinor*q-context.shippingCostMinor-context.paymentFeeMinor-extraCostMinor;
    const netAfterConcessions = itemMinor-Math.max(0,context.shippingCostMinor-shippingMinor)-context.paymentFeeMinor-extraCostMinor;
    if (![itemMinor,shippingMinor,extraCostMinor,totalMinor,concessionMinor,contributionMinor,netAfterConcessions].every(valid) ||
        itemMinor < capFloor || netAfterConcessions < product.floorMinor*q || contributionMinor < policy.minContributionMinor ||
        concessionMinor > Math.min(context.remainingBudgetMinor,policy.dailyBudgetMinor)) return;
    list.push({type,itemMinor,shippingMinor,totalMinor,concessionMinor,contributionMinor,terms});
  };
  add('price',amount,context.shippingChargeMinor);
  if (context.shippingChargeMinor > 0) add('shipping',baseline,0);
  if (valid(policy.sampleCostMinor)) add('sample',baseline,context.shippingChargeMinor,policy.sampleCostMinor,{sample:true});
  if (q >= 2) add('quantity',amount,context.shippingChargeMinor,0,{quantity:q});
  if (context.paymentMethod === 'prepaid') add('prepaid',amount,context.shippingChargeMinor,0,{paymentMethod:'prepaid'});
  // Credit is reserved at full face value; liability is not treated as free margin.
  if (valid(policy.creditMinor) && policy.creditMinor > 0) add('credit',baseline,context.shippingChargeMinor,policy.creditMinor,{creditMinor:policy.creditMinor});
  if (policy.approvedTerm && valid(policy.approvedTerm.costMinor) && typeof policy.approvedTerm.id === 'string')
    add('approved_terms',baseline,context.shippingChargeMinor,policy.approvedTerm.costMinor,{approvedTermId:policy.approvedTerm.id});
  return list;
}
// Explicit shopper projection: never return costs, floor, score, budget or policy.
export function publicOffer(candidate, currency, expiresAt) {
  return {type:candidate.type,itemMinor:candidate.itemMinor,shippingMinor:candidate.shippingMinor,
    totalMinor:candidate.totalMinor,terms:candidate.terms,currency,expiresAt};
}
