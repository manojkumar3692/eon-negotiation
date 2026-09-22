import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {contextualDecision,createContextualService,normalizeCart,validateContext} from '../src/contextual.js';
const cart={productId:'fixture-product',quantity:1,pincode:'560001',paymentMethod:'full'};
function fixture(now=Date.now()) {return {schemaVersion:1,merchantId:'fixture-merchant',currency:'INR',cart,observedAt:now,validUntil:now+120000,currentPricePaise:99900,promotion:'launch',product:{id:cart.productId,title:'Synthetic product'},inventory:{available:60},history:{sampleCount:0,medianUnitPaise:null},shipping:{serviceable:true,costPaise:6000,validUntil:now+120000},economics:{basis:'tax-exclusive-fixture',source:'synthetic-unapproved',unitCostPaise:50000,packagingPaise:3000,returnsAllowancePaise:2000,minimumContributionPaise:15000,fixedFeePaise:0,feeBps:200,maxDiscountBps:1250}};}
test('contextual rules preserve integer contribution and discount limits',()=>{
 for(let fee=0;fee<10000;fee+=233)for(let cost=0;cost<=100000;cost+=2500){
  const c=fixture();c.economics.feeBps=fee;c.shipping.costPaise=cost;
  const d=contextualDecision(c,1,3);if(d.status==='unavailable')continue;
  assert(BigInt(d.amountPaise)*BigInt(10000-fee)>=BigInt(70000+cost)*10000n);
  assert(d.amountPaise>=87413&&d.amountPaise<=99900);
 }
});
test('unknown costs, no stock, stale shipping and missing pincode fail closed',()=>{
 for(const mutate of [c=>c.economics=null,c=>c.inventory.available=null,c=>c.inventory.available=0,c=>c.shipping.validUntil=1,c=>c.cart={...cart,pincode:null}]){
  const c=fixture();mutate(c);assert.equal(contextualDecision(c,90000,1).status,'unavailable');
 }
});
test('invalid money, unsupported economic basis and stacked carts are rejected',()=>{
 for(const change of [{currentPricePaise:NaN},{currentPricePaise:1.1},{currentPricePaise:-1},{currentPricePaise:Number.MAX_SAFE_INTEGER}])assert.throws(()=>validateContext({...fixture(),...change},cart),/INVALID/);
 const c=fixture();c.economics.basis='unverified-tax-inclusive';assert.throws(()=>validateContext(c,cart),/ECONOMICS/);
 assert.throws(()=>normalizeCart({...cart,couponCode:'COUPON'}),/STACKING/);
});
test('explicit current quote acceptance is idempotent and does not consume a round',async()=>{
 let count=0;
 const service=createContextualService({merchantId:'fixture-merchant',getContext:async()=>fixture(),checkout:async offer=>({id:String(++count),amountPaise:offer.amountPaise})});
 const s=await service.start(cart),q=await service.offer(s.id,s.capability,80000),body={quoteId:q.quote.id,cart,idempotencyKey:randomUUID()};
 const accepted=await service.accept(s.id,s.capability,body);assert.equal(accepted.amountPaise,q.quote.amountPaise);
 assert.deepEqual(await service.accept(s.id,s.capability,body),accepted);assert.equal(count,1);
 await assert.rejects(service.accept(s.id,s.capability,{...body,quoteId:randomUUID()}),/IDEMPOTENCY_MISMATCH/);
});
