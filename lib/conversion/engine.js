import {eligibility} from '../../modules/trigger/index.js';
import {candidates,publicOffer} from '../../modules/rules/index.js';
import {rankDeals} from '../../modules/optimize/index.js';
import {interpretSandbox} from '../../modules/converse/index.js';
export function simulateConversion(product,policy,config,input){
 const rule=config.products.find(p=>p.id===product.id);
 if(!rule?.enabled)return {status:'unavailable',message:'Enable this product in EON Rules, then save before testing.'};
 if(rule.costMinor===null)return {status:'unavailable',message:'Enter the product cost before testing contribution protection.'};
 const scenario=input.scenario,quantity=input.quantity;
 const signals={stock:scenario==='out_of_stock'?0:product.stock,visits:scenario==='new'?1:4,dwellSeconds:scenario==='new'?10:180,
  inCart:['cart','hesitation'].includes(scenario),cartMinor:product.price_minor*quantity,newLaunch:rule.newLaunch||scenario==='launch',
  checkoutHesitation:scenario==='hesitation'&&config.triggers.checkoutHesitation,
  abandonedCart:scenario==='recovery'&&config.triggers.recovery,recoveryConsent:scenario==='recovery',returningCustomer:scenario==='returning'&&config.triggers.returningCustomer};
 const eligible=eligibility(signals,config.triggers);
 if(eligible.state==='no_negotiation')return {status:'not_invited',eligible,message:'No invitation for this customer scenario. Public pricing stays unchanged.'};
 let shipping=input.shippingChargeMinor;
 if(config.shipping.mode==='free'||config.shipping.mode==='threshold'&&product.price_minor*quantity>=config.shipping.thresholdMinor)shipping=0;
 else if(['flat','threshold'].includes(config.shipping.mode))shipping=config.shipping.chargeMinor;
 const shippingCost=config.shipping.mode==='connector'?input.shippingCostMinor:config.shipping.costMinor;
 if(shippingCost===null)return {status:'unavailable',eligible,message:'Enter the merchant delivery cost; free to the shopper still costs the business.'};
 const intent=interpretSandbox(input.message);
 const deals=rankDeals(candidates({publicMinor:product.price_minor,targetMinor:rule.targetMinor,floorMinor:rule.floorMinor,costMinor:rule.costMinor,stock:signals.stock},
 {...config,enabled:true,maxDiscountBps:policy.maxDiscountBps,maxRounds:policy.rounds,dailyBudgetMinor:policy.dailyBudgetMinor,allowed:Object.keys(config.concessions).filter(k=>config.concessions[k])},
 {quantity,round:1,shippingCostMinor:shippingCost,shippingChargeMinor:shipping,paymentFeeMinor:input.paymentFeeMinor,remainingBudgetMinor:policy.dailyBudgetMinor,paymentMethod:input.paymentMethod,capabilities:Object.keys(config.concessions)}),
 {strategy:config.strategy,preferredType:intent.preferredType,inventoryPriority:product.stock>=policy.excessStockThreshold?1:0});
 if(!deals.length)return {status:'unavailable',eligible,message:'No allowed offer fits the floor, costs, discount cap, budget and stock.'};
 return {status:'counteroffer',eligible,quantity,intent,offer:publicOffer(deals[0],product.currency||'INR',new Date(Date.now()+policy.ttlMinutes*60000).toISOString()),
 contributionMinor:deals[0].contributionMinor,concessionMinor:deals[0].concessionMinor,dealScore:deals[0].score,scoreVersion:deals[0].scoreVersion,
 alternatives:deals.slice(1).map(d=>({type:d.type,totalMinor:d.totalMinor,score:d.score})),
 message:'Saved rule test using your catalog. No checkout or payment was created.'};
}
