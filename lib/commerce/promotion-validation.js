export function validatePromotions(context,cart){
 const e=context.promotions.evaluation;
 const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
 if(cart.promotionCodes.length&&(!e||!same(e.requestedCodes,cart.promotionCodes)))throw Error('CONNECTOR_PROMOTION_EVALUATION_REQUIRED');
 if(!e)return;
 const accounted=[...e.appliedCodes,...e.rejectedCodes];
 if(new Set(accounted).size!==accounted.length||!same(accounted,e.requestedCodes)||!same(context.promotions.codes,e.appliedCodes)||!same(e.requestedCodes,cart.promotionCodes))throw Error('CONNECTOR_PROMOTION_CODE_MISMATCH');
 if(e.shippingMinor!==context.shipping.customerChargeMinor||e.itemSubtotalMinor>context.line.unitPriceMinor*context.line.quantity||e.totalMinor!==e.itemSubtotalMinor+e.shippingMinor)throw Error('CONNECTOR_PROMOTION_TOTAL_MISMATCH');
}
