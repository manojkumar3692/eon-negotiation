// Reusable deterministic authority. Server-only; integer paise, tax-exclusive fixture basis.
import { randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';
const fail = code => { throw new Error(code); };
const integer = (n, min = 0, max = 100000000) => Number.isSafeInteger(n) && n >= min && n <= max;
export const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function normalizeCart(c) {
  if (!c || Object.keys(c).some(k => !['productId','quantity','pincode','paymentMethod','couponCode','trialCredit'].includes(k)) ||
      typeof c.productId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(c.productId) || !integer(c.quantity,1,20) ||
      !['full','partial_cod'].includes(c.paymentMethod) || (c.pincode !== null && !/^[1-9][0-9]{5}$/.test(c.pincode)) ||
      (c.couponCode !== undefined && c.couponCode !== '') || (c.trialCredit !== undefined && c.trialCredit !== false)) fail('INVALID_CART_OR_STACKING');
  return { productId:c.productId, quantity:c.quantity, pincode:c.pincode, paymentMethod:c.paymentMethod };
}
export function validateContext(c, cart, now = Date.now()) {
  if (!c || c.schemaVersion !== 1 || typeof c.merchantId !== 'string' || c.currency !== 'INR' ||
      fingerprint(c.cart) !== fingerprint(cart) || !integer(c.observedAt,0,Number.MAX_SAFE_INTEGER) ||
      !integer(c.validUntil,0,Number.MAX_SAFE_INTEGER) || c.observedAt > now || now-c.observedAt > 300000 || now >= c.validUntil ||
      !integer(c.currentPricePaise,1) || !['launch','bundle'].includes(c.promotion) ||
      !c.product || c.product.id !== cart.productId || typeof c.product.title !== 'string' ||
      !c.inventory || !(c.inventory.available === null || integer(c.inventory.available)) ||
      !c.shipping || ![true,false,null].includes(c.shipping.serviceable) || !c.history || !integer(c.history.sampleCount) ||
      !(c.history.medianUnitPaise === null || integer(c.history.medianUnitPaise,1))) fail('INVALID_OR_STALE_CONTEXT');
  const p = c.economics;
  if (p !== null && (!p || p.basis !== 'tax-exclusive-fixture' || p.source !== 'synthetic-unapproved' ||
      ![p.unitCostPaise,p.packagingPaise,p.returnsAllowancePaise,p.minimumContributionPaise,p.fixedFeePaise].every(x=>integer(x)) ||
      !integer(p.feeBps,0,9999) || !integer(p.maxDiscountBps,0,2000))) fail('INVALID_ECONOMICS');
  if (c.shipping.costPaise !== null && (!integer(c.shipping.costPaise) || !integer(c.shipping.validUntil,0,Number.MAX_SAFE_INTEGER))) fail('INVALID_SHIPPING');
  return c;
}
const ceilDiv = (a,b) => (a+b-1n)/b;
export function contextualDecision(c, target, round, now = Date.now()) {
  validateContext(c,c.cart,now);
  if (!integer(target,1) || !integer(round,1,3)) fail('INVALID_OFFER');
  if (!c.cart.pincode) return {status:'unavailable',reason:'pincode_required'};
  if (c.shipping.serviceable !== true) return {status:'unavailable',reason:'shipping_unavailable'};
  if (c.inventory.available === null || c.economics === null || c.shipping.costPaise === null) return {status:'unavailable',reason:'unknown_economics_or_stock'};
  if (c.shipping.validUntil <= now) return {status:'unavailable',reason:'shipping_expired'};
  if (c.inventory.available < c.cart.quantity) return {status:'unavailable',reason:'out_of_stock'};
  if (c.cart.paymentMethod !== 'full') return {status:'unavailable',reason:'prepaid_only_in_simulator'};
  const p=c.economics, price=c.currentPricePaise;
  const costs=BigInt(p.unitCostPaise)*BigInt(c.cart.quantity)+BigInt(p.packagingPaise+p.returnsAllowancePaise+p.minimumContributionPaise+p.fixedFeePaise+c.shipping.costPaise);
  const marginFloor=Number(ceilDiv(costs*10000n,BigInt(10000-p.feeBps)));
  const discountFloor=Number(ceilDiv(BigInt(price)*BigInt(10000-p.maxDiscountBps),10000n));
  // Stock controls the pace, clean comparable history can only tighten it.
  const pace=c.inventory.available <= 3 ? 100 : c.inventory.available >= 30 ? 400 : 250;
  const historyFloor=c.history.sampleCount >= 3 && c.history.medianUnitPaise !== null
    ? Number(ceilDiv(BigInt(c.history.medianUnitPaise*c.cart.quantity)*9500n,10000n)) : 0;
  const floor=Math.max(marginFloor,discountFloor,historyFloor);
  if (floor>price) return {status:'unavailable',reason:'insufficient_margin'};
  const scheduled=Number(ceilDiv(BigInt(price)*BigInt(10000-Math.min(p.maxDiscountBps,pace*round)),10000n));
  const amount=Math.max(floor,scheduled,Math.min(target,price));
  return {status:target>=amount?'accepted':'counteroffer',amountPaise:amount,currency:'INR',
    audit:{marginFloor,discountFloor,historyFloor,pace,historyQualified:c.history.sampleCount>=3}};
}
export function signRequest(secret, merchant, timestamp, nonce, raw) {
  return createHmac('sha256',secret).update(`${merchant}\n${timestamp}\n${nonce}\n${raw}`).digest('hex');
}
export function createVerifier({secret,merchantId,now=Date.now}) {
  const used=new Map();
  return (headers,raw) => {
    const merchant=headers['x-merchant'], timestamp=headers['x-timestamp'],nonce=headers['x-nonce'],signature=headers['x-signature'];
    if(merchant!==merchantId || !/^\d{13}$/.test(timestamp||'') || Math.abs(now()-Number(timestamp))>30000 || !/^[a-f0-9-]{36}$/.test(nonce||'') || !/^[a-f0-9]{64}$/.test(signature||'')) fail('UNAUTHORIZED');
    const expected=signRequest(secret,merchant,timestamp,nonce,raw);
    if(!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex'))) fail('UNAUTHORIZED');
    for(const [key,expiry] of used) if(expiry<=now()) used.delete(key);
    if(used.has(nonce)) fail('REPLAYED_REQUEST');
    if(used.size>=10000) fail('RATE_LIMIT');
    used.set(nonce,now()+60001);
  };
}
// Local-only isolated in-memory state. Serializes each session and shared checkout writes.
// Never install this repository behind production/serverless endpoints.
export function createContextualService({merchantId,getContext,checkout,now=Date.now}) {
  const sessions=new Map();
  const owner = (id,capability) => {
    const s=sessions.get(id);
    if(!s || s.capability!==capability || s.merchantId!==merchantId) fail('SESSION_UNAVAILABLE');
    if(now()>=s.expiresAt) fail('SESSION_EXPIRED');
    return s;
  };
  async function locked(s,fn) {
    if(s.busy) fail('IN_PROGRESS');
    s.busy=true;try{return await fn();}finally{s.busy=false;}
  }
  async function context(cart) {
    const c=validateContext(await getContext(cart),cart,now());
    if(c.merchantId!==merchantId) fail('TENANT_MISMATCH');
    return c;
  }
  return {
    async start(cart) {
      cart=normalizeCart(cart);
      for(const [id,s] of sessions) if(s.expiresAt<=now()&&!s.busy) sessions.delete(id);
      if(sessions.size>=1000) fail('SESSION_LIMIT');
      const c=await context(cart), id=randomUUID(),capability=randomUUID()+randomUUID();
      sessions.set(id,{merchantId,cart,capability,round:0,quote:null,redemption:null,busy:false,expiresAt:now()+900000,keys:new Map()});
      return {id,capability,product:c.product,currentPricePaise:c.currentPricePaise,promotion:c.promotion,currency:'INR',simulated:true};
    },
    async offer(id,capability,target) {
      const s=owner(id,capability);
      return locked(s,async()=>{
        if(s.redemption) fail('ALREADY_ACCEPTED');
        if(s.round>=3) fail('ROUND_LIMIT');
        const c=await context(s.cart), d=contextualDecision(c,target,s.round+1,now());
        if(d.status==='unavailable') {s.quote=null;return d;}
        s.round++;
        s.quote={id:randomUUID(),cart:s.cart,amountPaise:d.amountPaise,currency:'INR',expiresAt:Math.min(c.validUntil,c.shipping.validUntil,now()+120000),baseline:c.currentPricePaise,promotion:c.promotion};
        return {status:d.status,quote:{id:s.quote.id,amountPaise:s.quote.amountPaise,currency:'INR',expiresAt:s.quote.expiresAt,shippingPaise:0,totalPaise:s.quote.amountPaise},roundsRemaining:3-s.round,simulated:true};
      });
    },
    async accept(id,capability,{quoteId,cart,idempotencyKey}) {
      const s=owner(id,capability);
      cart=normalizeCart(cart);
      if(typeof idempotencyKey!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(idempotencyKey)) fail('INVALID_IDEMPOTENCY_KEY');
      const hash=fingerprint({quoteId,cart});
      return locked(s,async()=>{
        const prior=s.keys.get(idempotencyKey);
        if(prior) {if(prior.hash!==hash) fail('IDEMPOTENCY_MISMATCH');return prior.result;}
        if(s.keys.size>=100) fail('IDEMPOTENCY_LIMIT');
        const q=s.quote;
        if(!q || q.id!==quoteId || fingerprint(cart)!==fingerprint(s.cart)) fail('STALE_QUOTE_OR_CHANGED_CART');
        if(s.redemption) {s.keys.set(idempotencyKey,{hash,result:s.redemption});return s.redemption;}
        if(now()>=q.expiresAt) fail('QUOTE_EXPIRED');
        const c=await context(s.cart), d=contextualDecision(c,q.amountPaise,s.round,now());
        if(now()>=q.expiresAt || d.status==='unavailable' || d.amountPaise>q.amountPaise || c.currentPricePaise!==q.baseline || c.promotion!==q.promotion) fail('CONTEXT_CHANGED');
        const result=await checkout({merchantId,quoteId:q.id,cart:s.cart,amountPaise:q.amountPaise,currency:q.currency,expiresAt:q.expiresAt,round:s.round,baseline:q.baseline,promotion:q.promotion});
        s.redemption=result;s.keys.set(idempotencyKey,{hash,result});return result;
      });
    }
  };
}
