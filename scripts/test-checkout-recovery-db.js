import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {pool,service} from '../lib/db.js';
import {seal} from '../lib/connectors/client-v2.js';
import {fingerprint} from '../lib/commerce/custom.js';
import {applyCustomEvent,customEventKey} from '../lib/live/custom-events.js';
import {acceptQuote} from '../lib/live/service.js';
import {defaultConversion} from '../lib/conversion/config.js';
if(process.env.NEON_BRANCH!=='conversion-dashboard-validation')throw Error('Isolated branch required');
const wid=randomUUID(),pid=randomUUID(),iid=randomUUID(),sid=randomUUID(),qid=randomUUID(),token=randomUUID(),key=randomUUID();
const cart={currency:'INR',lines:[{productId:'prod',variantId:'var',quantity:1}],promotionCodes:[],paymentMethod:'prepaid',destination:{country:'IN',postalCode:'560001'}};
const config=defaultConversion();config.strategy='maximize_conversion';config.triggers.lowStock=0;config.products=[{id:pid,enabled:true,targetMinor:90000,floorMinor:70000,costMinor:40000,newLaunch:false}];config.shipping={mode:'free',costMinor:5000,chargeMinor:0,thresholdMinor:0};config.paymentFees.prepaid=2000;
const policy={rounds:3,maxDiscountBps:2500,lowStockThreshold:0,lowStockDiscountBps:500,excessStockThreshold:30,historyEnabled:false,dailyBudgetMinor:1000000,ttlMinutes:15};
const context={schemaVersion:'3',workspaceId:wid,installationId:iid,operation:'context',revision:'before-reservation',cartFingerprint:fingerprint(cart),currency:'INR',taxBasis:'inclusive',line:{productId:'prod',variantId:'var',name:'Retry fixture',quantity:1,unitPriceMinor:99900,availableToSell:1,approvedFloorMinor:null,fulfillmentType:'physical'},shipping:{mode:'flat',serviceable:true,merchantCostMinor:null,customerChargeMinor:0,rateId:'free'},sales:null,promotions:{codes:[],stackable:false},payment:{method:'prepaid',supported:true,feeMinor:null},checkoutSupported:true};
const facts={status:'confirmed',pricing:{regularMinor:124900,sellingMinor:99900,taxBasis:'inclusive'},storeTerms:{shipping:{mode:'free'},promotions:{status:'known',offers:[]}}};
const originalFetch=globalThis.fetch;let contextCalls=0,checkoutCalls=0,preparedBody;
try{
 await service(async c=>{
  await c.query("insert into negotiation.workspaces(id,owner_user_id,name,domain,industry,currency,domain_verified) values($1,'retry-test','Retry fixture','example.com','retail','INR',true)",[wid]);
  await c.query("insert into negotiation.products(id,workspace_id,sku,name,price_minor,floor_minor,stock,external_product_id,external_variant_id,commerce_facts) values($1,$2,'retry','Retry fixture',99900,70000,1,'prod','var',$3)",[pid,wid,facts]);
  await c.query("insert into negotiation.connector_installations(id,workspace_id,endpoint,credential_ciphertext,status,activation_status) values($1,$2,'https://example.com/api/negotiation/v3',$3,'ready','active')",[iid,wid,seal('test-connector-secret',`${wid}:${iid}`)]);
  await c.query("insert into negotiation.policy_versions(workspace_id,version,config) values($1,1,$2)",[wid,policy]);
  await c.query("insert into negotiation.conversion_settings(workspace_id,version,config,status,updated_by) values($1,1,$2,'active','retry-test')",[wid,config]);
  await c.query("insert into negotiation.live_sessions(id,workspace_id,installation_id,token_hash,cart,context_snapshot,policy_version,conversion_version,round,expires_at) values($1,$2,$3,$4,$5,$6,1,1,1,now()+interval '15 minutes')",[sid,wid,iid,createHash('sha256').update(token).digest('hex'),cart,context]);
  await c.query("insert into negotiation.live_quotes(id,session_id,workspace_id,policy_version,amount_minor,baseline_minor,shipping_minor,currency,context_revision,cart_fingerprint,expires_at) values($1,$2,$3,1,90000,99900,0,'INR','before-reservation',$4,now()+interval '15 minutes')",[qid,sid,wid,fingerprint(cart)]);
 });
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://example.com/api/negotiation/v3');const body=JSON.parse(options.body),now=new Date(),envelope={schemaVersion:'3',workspaceId:wid,installationId:iid,asOf:now.toISOString(),expiresAt:new Date(+now+60000).toISOString()};
  if(body.operation==='context'){contextCalls++;return Response.json({...context,...envelope,...(checkoutCalls?{revision:'after-own-reservation',line:{...context.line,availableToSell:0}}:{})});}
  assert.equal(body.operation,'checkout');checkoutCalls++;
  if(checkoutCalls===1){preparedBody=body;throw Error('Synthetic timeout after store reserved final unit');}
  assert.deepEqual(body,preparedBody);
  return Response.json({...envelope,operation:'checkout',revision:'checkout-v1',status:'already_created',externalId:'fixture-checkout',checkoutUrl:'https://example.com/checkout/fixture'});
 };
 await assert.rejects(()=>acceptQuote(sid,token,{quoteId:qid,idempotencyKey:key}),/CONNECTOR_UNREACHABLE/);
 const pending=await service(async c=>(await c.query('select status,response from negotiation.checkout_attempts where session_id=$1',[sid])).rows);
 assert.equal(pending.length,1);assert.equal(pending[0].status,'started');assert.equal(pending[0].response.preparedQuote.id,qid);
 const event={eventId:randomUUID(),type:'checkout.paid',externalId:'fixture-checkout',occurredAt:new Date().toISOString()},installation={id:iid,workspace_id:wid};
 await assert.rejects(()=>service(c=>applyCustomEvent(c,installation,event)),/CHECKOUT_NOT_READY/);
 assert.equal(await service(async c=>(await c.query("select count(*)::int n from negotiation.webhook_inbox where provider='custom' and event_id=$1",[customEventKey(iid,event.eventId)])).rows[0].n),0);
 const expired=structuredClone(pending[0].response);expired.preparedQuote.expiresAt=new Date(Date.now()-1000).toISOString();
 await service(c=>c.query('update negotiation.checkout_attempts set response=$1 where session_id=$2',[expired,sid]));
 await assert.rejects(()=>acceptQuote(sid,token,{quoteId:qid,idempotencyKey:key}),/QUOTE_EXPIRED/);assert.equal(checkoutCalls,1);
 await service(c=>c.query('update negotiation.checkout_attempts set response=$1 where session_id=$2',[pending[0].response,sid]));
 await assert.rejects(()=>acceptQuote(sid,token,{quoteId:qid,idempotencyKey:randomUUID()}),/SESSION_UNAVAILABLE/);
 const [one,two]=await Promise.all([acceptQuote(sid,token,{quoteId:qid,idempotencyKey:key}),acceptQuote(sid,token,{quoteId:qid,idempotencyKey:key})]);
 assert.equal(one.checkoutUrl,'https://example.com/checkout/fixture');assert.deepEqual(one,two);assert.equal(contextCalls,1);assert.equal(checkoutCalls,2);
 const counts=await service(async c=>(await c.query('select (select count(*)::int from negotiation.checkout_attempts where session_id=$1) attempts,(select count(*)::int from negotiation.budget_reservations where quote_id=$2) reservations',[sid,qid])).rows[0]);assert.deepEqual(counts,{attempts:1,reservations:1});
 await assert.rejects(()=>acceptQuote(sid,token,{quoteId:randomUUID(),idempotencyKey:key}),/IDEMPOTENCY_MISMATCH/);
 await service(c=>applyCustomEvent(c,installation,event));
 await service(c=>applyCustomEvent(c,installation,{...event,eventId:randomUUID(),type:'checkout.cancelled'}));
 assert.equal(await service(async c=>(await c.query('select status from negotiation.checkout_attempts where session_id=$1',[sid])).rows[0].status),'paid');
 await service(c=>applyCustomEvent(c,installation,{...event,eventId:randomUUID(),type:'checkout.refunded'}));
 await service(c=>applyCustomEvent(c,installation,{...event,eventId:randomUUID(),type:'checkout.paid'}));
 assert.equal(await service(async c=>(await c.query('select status from negotiation.checkout_attempts where session_id=$1',[sid])).rows[0].status),'refunded');
 console.log('PASS: durable checkout intent survives ambiguous response; last-unit reservation does not force repricing; exact key/quote replay; concurrent recovery returns one checkout; one budget reservation; changed key/payload rejected; workspace domain retained. Provider transport mocked, no payment created.');
}finally{globalThis.fetch=originalFetch;await pool.end();}
