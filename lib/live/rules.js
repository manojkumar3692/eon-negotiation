const safe=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
const ceilDiv=(a,b)=>(a+b-1n)/b;

export function decideLiveOffer(context,policy,targetMinor,round) {
  if(!context||context.operation!=="context"||!safe(targetMinor,1)||!safe(round,1)||round>policy.rounds)throw Error("INVALID_LIVE_OFFER");
  const quantity=context.line.quantity,baseline=context.line.unitPriceMinor*quantity;
  if(!safe(baseline,1)||context.line.approvedFloorMinor==null)return {status:"unavailable",reason:"approved_floor_required"};
  if(context.line.availableToSell==null)return {status:"unavailable",reason:"inventory_required"};
  if(context.line.availableToSell<quantity)return {status:"unavailable",reason:"out_of_stock"};
  if(!context.payment.supported)return {status:"unavailable",reason:"payment_not_supported"};
  if(!context.checkoutSupported)return {status:"unavailable",reason:"checkout_not_supported"};
  if(context.line.fulfillmentType==="physical") {
    if(!context.shipping||context.shipping.serviceable!==true)return {status:"unavailable",reason:context.shipping?.serviceable===false?"shipping_unavailable":"destination_required"};
    if(context.shipping.merchantCostMinor==null||context.shipping.customerChargeMinor==null)return {status:"unavailable",reason:"shipping_cost_required"};
  }
  const shippingGap=Math.max(0,(context.shipping?.merchantCostMinor||0)-(context.shipping?.customerChargeMinor||0));
  const paymentFee=context.payment.feeMinor||0;
  const merchantFloor=context.line.approvedFloorMinor*quantity+shippingGap+paymentFee;
  const inventory=context.line.availableToSell;
  const discountBps=inventory<=policy.lowStockThreshold?Math.min(policy.maxDiscountBps,policy.lowStockDiscountBps):policy.maxDiscountBps;
  const discountFloor=Number(ceilDiv(BigInt(baseline)*BigInt(10000-discountBps),10000n));
  const historyFloor=policy.historyEnabled&&context.sales?.sampleCount>=3?Number(ceilDiv(BigInt(context.sales.medianUnitMinor*quantity)*9500n,10000n)):0;
  const floor=Math.max(merchantFloor,discountFloor,historyFloor);
  if(floor>baseline)return {status:"unavailable",reason:"insufficient_economics"};
  const pace=inventory>=policy.excessStockThreshold?discountBps:Math.max(1,Math.floor(discountBps/(policy.rounds+1)));
  const scheduled=Number(ceilDiv(BigInt(baseline)*BigInt(10000-Math.min(discountBps,pace*round)),10000n));
  const amount=Math.max(floor,scheduled,Math.min(targetMinor,baseline));
  return {status:targetMinor>=amount?"accepted":"counteroffer",amountMinor:amount,baselineMinor:baseline,shippingMinor:context.shipping?.customerChargeMinor||0,currency:context.currency,audit:{merchantFloor,discountFloor,historyFloor,discountBps,pace}};
}
