import {importReady} from '../commerce/catalog-facts.js';
import {constrainContext} from './live.js';
import {decideLiveOffer} from '../live/rules.js';
export function approvedReadinessProduct(product,config){
 if(!product||!importReady(product))throw Error('Connector: Sync confirmed selling prices, shipping and promotion information first.');
 const rule=config?.products?.find(p=>p.id===product.id);
 const name=product.name||'This product';
 if(!rule?.enabled)throw Error(`Connector: ${name} is not enabled for negotiation. Select an enabled product or enable and save this product in EON Rules.`);
 if(!Number.isSafeInteger(rule.costMinor)||rule.costMinor<0)throw Error(`Connector: Save an approved product cost for ${name} in EON Rules.`);
 if(!Number.isSafeInteger(rule.floorMinor)||rule.floorMinor<=0)throw Error(`Connector: Save an approved protected minimum for ${name} in EON Rules.`);
 if(rule.floorMinor>product.price_minor||rule.targetMinor>product.price_minor)throw Error(`Connector: Review ${name}'s saved limits: they exceed its current selling price.`);
 // Catalog-only imports default their floor to the selling price. A saved
 // merchant rule is the source for this readiness test; no catalog write occurs.
 return {...product,floor_minor:rule.floorMinor};
}
export function validateCartReadiness(context,config,product,policy){
 let resolved;try{resolved=constrainContext(context,config,product);}catch{throw Error('Connector: The cart conflicts with your saved product, stock or shipping rules. Review EON Rules and sync current prices.');}
 const result=decideLiveOffer(resolved,policy,resolved.line.unitPriceMinor*resolved.line.quantity,1);
 if(result.status==='unavailable'){
  const reasons={payment_fee_required:'Supply a verified processor expense or approve a per-order fee for this payment method in EON Rules.',shipping_cost_required:'Supply a verified delivery cost or approve a per-order cost for free, flat or threshold shipping in EON Rules.',destination_required:'Supply a destination that the store can verify.',shipping_unavailable:'The store cannot deliver to this destination.',inventory_required:'The store must supply verified available stock.',out_of_stock:'There is not enough stock for this quantity.',payment_not_supported:'The selected payment method is not supported.',checkout_not_supported:'The store must implement enforceable checkout.',approved_floor_required:'Approve the product minimum in EON Rules.',insufficient_economics:'The approved minimum plus shipping and fees exceeds the selling price.'};
  throw Error('Connector: '+(reasons[result.reason]||'The required cart economics are not ready.'));
 }
 return resolved;
}
