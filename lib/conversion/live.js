import {readInvitation} from './invitations.js';
import {importReady} from '../commerce/catalog-facts.js';
import {createHash,randomUUID} from 'node:crypto';
import {consumeGrant} from '../../modules/recovery/index.js';
import {eligibility} from '../../modules/trigger/index.js';
import {decideLiveOffer} from '../live/rules.js';
import {recordEvent} from '../../modules/analytics/index.js';
export async function activeConfiguration(c,workspaceId){const {rows:[s]}=await c.query('select * from negotiation.conversion_settings where workspace_id=$1',[workspaceId]);if(!s||s.status!=='active')throw Error('NEGOTIATION_UNAVAILABLE');return s;}
export function constrainContext(context,config,product){
 if(product?.commerce_facts?.pricing&&(context.line.unitPriceMinor!==product.commerce_facts.pricing.sellingMinor||context.taxBasis!==product.commerce_facts.pricing.taxBasis))throw Error('CONTEXT_CHANGED');
 const rule=config.products.find(p=>p.id===product?.id);
 if(!rule?.enabled||rule.costMinor===null||config.triggers.excludeNewLaunch&&rule.newLaunch||context.line.quantity>config.maxQuantity||context.line.availableToSell<=config.triggers.lowStock)throw Error('NEGOTIATION_UNAVAILABLE');
 if(!config.concessions.price)throw Error('NEGOTIATION_UNAVAILABLE');
 if(config.shipping.mode==='free'&&context.shipping.customerChargeMinor!==0)throw Error('CONTEXT_CHANGED');
 // Minimum contribution apportioned conservatively across quantity. Shipping/fees are
 // added by the existing deterministic price engine, exactly once.
 const unitContributionFloor=rule.costMinor+Math.ceil(config.minContributionMinor/context.line.quantity);
 return {...context,line:{...context.line,approvedFloorMinor:Math.max(context.line.approvedFloorMinor??0,rule.floorMinor,unitContributionFloor)}};
}
export async function gateSession(c,installation,product,context,input){
 const settings=await activeConfiguration(c,installation.workspace_id),config=settings.config;
 const surface=typeof input.surface==='string'?input.surface:'dedicated_page';
 if(!config.surfaces[surface])throw Error('NEGOTIATION_UNAVAILABLE');
 const visitor=typeof input.visitorId==='string'&&/^[a-zA-Z0-9_-]{16,100}$/.test(input.visitorId)?input.visitorId:null;
 if(!visitor)throw Error('NEGOTIATION_UNAVAILABLE');
 let invitation=null;
 if(['product','chat','cart','exit_intent'].includes(surface)){if(!importReady(product))throw Error('NEGOTIATION_UNAVAILABLE');invitation=await readInvitation(c,installation,product,settings,input);}
 else if((config.audience||'testers')==='testers')throw Error('NEGOTIATION_UNAVAILABLE');
 const visitorKey=createHash('sha256').update(installation.workspace_id+':'+visitor).digest('hex');
 const {rows:[rate]}=await c.query(`insert into negotiation.rate_buckets(workspace_id,bucket_key,window_start,request_count)
 values($1,$2,date_trunc('hour',now()),1) on conflict(workspace_id,bucket_key,window_start) do update set request_count=negotiation.rate_buckets.request_count+1 returning request_count`,[installation.workspace_id,'visitor:'+visitorKey]);
 if(rate.request_count>10)return {allowed:false,rateLimited:true};
 const {rows:[prior]}=await c.query(`select 1 from negotiation.live_sessions where workspace_id=$1 and visitor_key=$2 and created_at>now()-$3*interval '1 hour' limit 1`,[installation.workspace_id,visitorKey,config.triggers.cooldownHours]);
 const hints=input.signals||{};
 // Browser hints only affect invitation eligibility; costs/stock/floors are connector facts.
 let recovery=null;
 if(surface==='recovery_link'){
  const binding=JSON.stringify({publicKey:installation.public_key,productId:product.external_product_id,variantId:product.external_variant_id,currency:context.currency});
  if(typeof input.recoveryToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(input.recoveryToken))throw Error('GRANT_UNAVAILABLE');
  const {rows:[found]}=await c.query("select id from negotiation.offer_grants where workspace_id=$1 and cart_hash=$2 and purpose='recovery' and token_hash=$3 and consumed_at is null and revoked_at is null and expires_at>now()",[installation.workspace_id,binding,createHash('sha256').update(input.recoveryToken).digest('hex')]);
  if(!found)throw Error('GRANT_UNAVAILABLE');recovery={...found,binding};
 }
 if(product?.commerce_facts?.pricing&&(context.line.unitPriceMinor!==product.commerce_facts.pricing.sellingMinor||context.taxBasis!==product.commerce_facts.pricing.taxBasis))throw Error('CONTEXT_CHANGED');
 const rule=config.products.find(p=>p.id===product?.id);
 const signals={abandonedCart:!!recovery,recoveryConsent:!!recovery,stock:context.line.availableToSell,newLaunch:rule?.newLaunch,cooldown:!!prior,
  visits:Math.min(100,Math.max(0,Number(hints.visits)||0)),dwellSeconds:Math.min(3600,Math.max(0,Number(hints.dwellSeconds)||0)),
  inCart:hints.inCart===true,cartMinor:context.line.unitPriceMinor*context.line.quantity,
  checkoutHesitation:config.triggers.checkoutHesitation&&hints.checkoutHesitation===true};
 const assigned=parseInt(createHash('sha256').update(visitorKey+':'+settings.version).digest('hex').slice(0,8),16)%10000;
 const arm=invitation?.signals.tester?'tester':assigned<config.experiment.treatmentBps?'treatment':'control';
 const decision=eligibility({...signals,experimentArm:arm},config.triggers);
 await recordEvent(c,{workspaceId:installation.workspace_id,eventKey:`assignment:${settings.version}:${visitorKey}:${invitation?.signals.tester?'sandbox':'live'}`,type:'experiment_assigned',mode:invitation?.signals.tester?'sandbox':'live',visitorKey,properties:{reasonCode:arm,policyVersion:settings.version}});
 await recordEvent(c,{workspaceId:installation.workspace_id,eventKey:`eligibility:${randomUUID()}`,type:'eligibility_evaluated',mode:invitation?.signals.tester?'sandbox':'live',visitorKey,properties:{reasonCode:decision.state,surface}});
 if(decision.state==='no_negotiation')return {allowed:false};
 const constrained=constrainContext(context,config,product);
 if(invitation)await c.query('update negotiation.invitations set consumed_at=now() where id=$1',[invitation.id]);
 if(recovery)await consumeGrant(c,{workspaceId:installation.workspace_id,cartHash:recovery.binding,purpose:'recovery',token:input.recoveryToken});
 return {allowed:true,settings,context:constrained,visitorKey,surface,decision,recoveryGrantId:recovery?.id||null};
}
export async function logConversion(c,workspaceId,key,type,sessionId,quoteId=null,properties={}){
 await recordEvent(c,{workspaceId,eventKey:key,type,mode:'live',sessionId,quoteId,properties});
}

export function configuredPrice(context,policy,target,round,config,product){
 const p={...policy};
 if(config.strategy==='maximize_conversion'||config.strategy==='clear_inventory'&&context.line.availableToSell>=policy.excessStockThreshold)p.rounds=1;
 const decision=decideLiveOffer(context,p,target,Math.min(round,p.rounds));
 if(decision.status==='unavailable')return decision;
 const rule=config.products.find(p=>p.id===product.id);
 if(config.strategy==='protect_margin'||config.strategy==='balanced'&&round<policy.rounds){
  decision.amountMinor=Math.max(decision.amountMinor,Math.min(context.line.unitPriceMinor,rule.targetMinor)*context.line.quantity);
  decision.status=target>=decision.amountMinor?'accepted':'counteroffer';
 }
 if(context.promotions?.evaluation&&decision.amountMinor+decision.shippingMinor>context.promotions.evaluation.totalMinor)return {status:'unavailable',reason:'existing_promotion_better'};
 return decision;
}
