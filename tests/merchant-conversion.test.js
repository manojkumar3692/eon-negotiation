import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultConversion,conversionSchema} from '../lib/conversion/config.js';
import {simulateConversion} from '../lib/conversion/engine.js';
import {constrainContext,configuredPrice} from '../lib/conversion/live.js';
const id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
function fixture(){const config=defaultConversion();config.products=[{id,enabled:true,targetMinor:95000,floorMinor:80000,costMinor:40000,newLaunch:false}];return config;}
const product={id,price_minor:100000,stock:40,currency:'INR'};
const policy={maxDiscountBps:2000,rounds:3,ttlMinutes:15,dailyBudgetMinor:200000,lowStockThreshold:2,lowStockDiscountBps:500,excessStockThreshold:30,historyEnabled:false};
const input={productId:id,message:'include shipping',scenario:'returning',quantity:1,paymentMethod:'prepaid',shippingCostMinor:5000,shippingChargeMinor:5000,paymentFeeMinor:0};
const context={operation:'context',currency:'INR',line:{quantity:1,unitPriceMinor:100000,availableToSell:40,approvedFloorMinor:80000,fulfillmentType:'physical'},shipping:{serviceable:true,merchantCostMinor:5000,customerChargeMinor:0},payment:{supported:true,feeMinor:0},checkoutSupported:true};
test('saved configuration rejects duplicate or malformed product rules',()=>{const c=fixture();assert.equal(conversionSchema.parse(c).products.length,1);c.products.push(c.products[0]);assert.throws(()=>conversionSchema.parse(c));const bad=fixture();bad.shipping.costMinor=-1;assert.throws(()=>conversionSchema.parse(bad));});
test('always-free shipping is normal terms and still reduces contribution',()=>{const c=fixture();c.shipping={mode:'free',costMinor:5000,chargeMinor:9999,thresholdMinor:0};c.concessions.shipping=true;const r=simulateConversion(product,policy,c,input);assert.equal(r.status,'counteroffer');assert.equal(r.offer.shippingMinor,0);assert.notEqual(r.offer.type,'shipping');assert.equal(r.contributionMinor,r.offer.itemMinor-40000-5000);});
test('shipping threshold distinguishes baseline terms from an extra concession',()=>{const c=fixture();c.shipping={mode:'threshold',costMinor:5000,chargeMinor:5000,thresholdMinor:150000};c.concessions.shipping=true;const single=simulateConversion(product,policy,c,input);const pair=simulateConversion(product,policy,c,{...input,quantity:2});assert.equal(single.offer.type,'shipping');assert.notEqual(pair.offer.type,'shipping');assert.equal(pair.offer.shippingMinor,0);});
test('new visitor, excluded launch, no stock and unknown costs fail safely',()=>{const c=fixture();for(const scenario of ['new','launch','out_of_stock'])assert.equal(simulateConversion(product,policy,c,{...input,scenario}).status,'not_invited');c.products[0].costMinor=null;assert.equal(simulateConversion(product,policy,c,input).status,'unavailable');});
test('live context enforces contribution and free-shipping agreement',()=>{const c=fixture();c.minContributionMinor=50000;assert.equal(constrainContext(context,c,product).line.approvedFloorMinor,90000);c.shipping.mode='free';assert.throws(()=>constrainContext({...context,shipping:{...context.shipping,customerChargeMinor:100}},c,product),/CONTEXT_CHANGED/);c.products[0].enabled=false;assert.throws(()=>constrainContext(context,c,product),/NEGOTIATION_UNAVAILABLE/);});
test('all live strategies preserve the same economic floor',()=>{for(const strategy of ['protect_margin','balanced','maximize_conversion','clear_inventory']){const c=fixture();c.strategy=strategy;const r=configuredPrice(constrainContext(context,c,product),policy,100,1,c,product);assert.ok(r.amountMinor>=85000);assert.ok(r.amountMinor<=100000);}});

test('merchant-approved delivery expense fills a missing connector cost without changing the customer charge',()=>{
 for(const mode of ['free','flat','threshold']){
  const c=fixture();c.shipping.mode=mode;c.shipping.costMinor=6000;
  const raw={...context,shipping:{...context.shipping,merchantCostMinor:null}};
  const resolved=constrainContext(raw,c,product);
  assert.equal(resolved.shipping.merchantCostMinor,6000);
  assert.equal(resolved.shipping.customerChargeMinor,0);
  assert.equal(raw.shipping.merchantCostMinor,null);
  const decision=configuredPrice(resolved,policy,100,3,{...c,strategy:'maximize_conversion'},product);
  assert.equal(decision.amountMinor,86000);
 }
});
test('unknown delivery expense remains unknown and blocks pricing; configured zero is explicit',()=>{
 const raw={...context,shipping:{...context.shipping,merchantCostMinor:null}};
 for(const cost of [null,undefined,-1,NaN,1.5]){
  const c=fixture();c.shipping.mode='free';c.shipping.costMinor=cost;
  const resolved=constrainContext(raw,c,product);
  assert.equal(resolved.shipping.merchantCostMinor,null);
  assert.equal(configuredPrice(resolved,policy,100,1,c,product).reason,'shipping_cost_required');
 }
 const c=fixture();c.shipping.mode='free';c.shipping.costMinor=0;
 assert.equal(constrainContext(raw,c,product).shipping.merchantCostMinor,0);
});
test('fresh connector expense wins, and carrier mode does not use a fixed-cost fallback',()=>{
 const c=fixture();c.shipping.mode='free';c.shipping.costMinor=6000;
 for(const amount of [0,9000])assert.equal(constrainContext({...context,shipping:{...context.shipping,merchantCostMinor:amount}},c,product).shipping.merchantCostMinor,amount);
 c.shipping.mode='connector';const raw={...context,shipping:{...context.shipping,merchantCostMinor:null}};
 assert.equal(constrainContext(raw,c,product).shipping.merchantCostMinor,null);
});
test('delivery fallback never invents serviceability or customer shipping and is per order',()=>{
 const c=fixture();c.shipping.mode='flat';c.shipping.costMinor=6000;
 for(const shipping of [{...context.shipping,merchantCostMinor:null,serviceable:null},{...context.shipping,merchantCostMinor:null,customerChargeMinor:null}]){
  const resolved=constrainContext({...context,shipping},c,product);
  assert.equal(configuredPrice(resolved,policy,100,1,c,product).status,'unavailable');
 }
 const pair=constrainContext({...context,line:{...context.line,quantity:2},shipping:{...context.shipping,merchantCostMinor:null}},c,product);
 assert.equal(pair.shipping.merchantCostMinor,6000);
 assert.equal(configuredPrice(pair,policy,100,3,{...c,strategy:'maximize_conversion'},product).amountMinor,166000);
});

test('processor expense falls back only to the approved selected payment method',()=>{
 const c=fixture();c.paymentFees={prepaid:2500,partial_cod:null,cod:4000};
 const raw={...context,payment:{...context.payment,method:'prepaid',feeMinor:null}};
 const resolved=constrainContext(raw,c,product);assert.equal(resolved.payment.feeMinor,2500);assert.equal(raw.payment.feeMinor,null);
 assert.equal(constrainContext({...raw,payment:{...raw.payment,method:'cod'}},c,product).payment.feeMinor,4000);
 assert.equal(constrainContext({...raw,payment:{...raw.payment,method:'partial_cod'}},c,product).payment.feeMinor,null);
 const offer=configuredPrice(resolved,policy,100,3,{...c,strategy:'maximize_conversion'},product);assert.equal(offer.amountMinor,87500);
});
test('unknown processor fee blocks pricing and a real zero remains explicit',()=>{
 const c=fixture();for(const fee of [null,undefined,-1,NaN,0.5]){
  const raw={...context,payment:{...context.payment,method:'prepaid',feeMinor:fee}};
  assert.equal(configuredPrice(constrainContext(raw,c,product),policy,100,1,c,product).reason,'payment_fee_required');
 }
 c.paymentFees.prepaid=2500;
 assert.equal(constrainContext(context,c,product).payment.feeMinor,0);
 c.paymentFees.prepaid=0;
 assert.equal(constrainContext({...context,payment:{method:'prepaid',supported:true,feeMinor:null}},c,product).payment.feeMinor,0);
});
test('older saved settings do not acquire a guessed processor expense',()=>{
 const c=fixture();delete c.paymentFees;
 assert.deepEqual(conversionSchema.parse(c).paymentFees,{prepaid:null,partial_cod:null,cod:null});
 assert.equal(constrainContext({...context,payment:{method:'prepaid',supported:true,feeMinor:null}},c,product).payment.feeMinor,null);
});
