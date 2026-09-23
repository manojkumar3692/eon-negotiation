import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedReadinessProduct,validateCartReadiness} from '../lib/conversion/readiness.js';
import {defaultConversion} from '../lib/conversion/config.js';
const product={id:'p',floor_minor:99900,commerce_facts:{status:'confirmed',pricing:{sellingMinor:99900,taxBasis:'inclusive'},storeTerms:{shipping:{mode:'free'},promotions:{status:'known'}}}};
const policy={rounds:3,maxDiscountBps:2000,lowStockThreshold:2,lowStockDiscountBps:500,excessStockThreshold:30,historyEnabled:false};
function fixture(){const c=defaultConversion();c.products=[{id:'p',enabled:true,costMinor:40000,floorMinor:70000,targetMinor:90000}];c.shipping.mode='free';c.shipping.costMinor=5000;return c;}
const context={operation:'context',currency:'INR',taxBasis:'inclusive',line:{quantity:1,unitPriceMinor:99900,availableToSell:20,approvedFloorMinor:null,fulfillmentType:'physical'},shipping:{serviceable:true,merchantCostMinor:null,customerChargeMinor:0},payment:{supported:true,feeMinor:0},checkoutSupported:true};
test('economic capability is insufficient without confirmed import and approved rules',()=>{const c=fixture();assert.throws(()=>approvedReadinessProduct({...product,commerce_facts:{}},c));c.products[0].costMinor=null;assert.throws(()=>approvedReadinessProduct(product,c));assert.throws(()=>approvedReadinessProduct(product,null));});
test('readiness uses approved rules without retaining an initial catalog-only floor',()=>{const c=fixture(),p=approvedReadinessProduct(product,c);assert.equal(p.floor_minor,70000);assert.equal(product.floor_minor,99900);const result=validateCartReadiness(context,c,p,policy);assert.equal(result.line.approvedFloorMinor,70000);assert.equal(result.shipping.merchantCostMinor,5000);assert.equal(context.shipping.merchantCostMinor,null);});
test('missing expense, bad destination and unsupported payment block readiness',()=>{const c=fixture(),p=approvedReadinessProduct(product,c);c.shipping.costMinor=null;assert.throws(()=>validateCartReadiness(context,c,p,policy),/delivery cost/);c.shipping.costMinor=5000;assert.throws(()=>validateCartReadiness({...context,shipping:{...context.shipping,serviceable:null}},c,p,policy),/destination/);assert.throws(()=>validateCartReadiness({...context,payment:{supported:false,feeMinor:0}},c,p,policy),/payment/);});
test('impossible economics and changed selling price block readiness',()=>{const c=fixture(),p=approvedReadinessProduct(product,c);c.products[0].floorMinor=98000;assert.throws(()=>validateCartReadiness(context,c,p,policy),/exceeds the selling price/);assert.throws(()=>validateCartReadiness({...context,line:{...context.line,unitPriceMinor:124900}},c,p,policy),/conflicts/);});

test('cart errors identify the selected product and the missing approval',()=>{
 const p={...product,name:'Desert Tonka',price_minor:99900};const c=fixture();
 c.products[0].enabled=false;assert.throws(()=>approvedReadinessProduct(p,c),/Desert Tonka is not enabled/);
 c.products[0].enabled=true;c.products[0].costMinor=null;assert.throws(()=>approvedReadinessProduct(p,c),/product cost for Desert Tonka/);
 c.products[0].costMinor=40000;c.products[0].floorMinor=0;assert.throws(()=>approvedReadinessProduct(p,c),/protected minimum for Desert Tonka/);
 c.products[0].floorMinor=124900;assert.throws(()=>approvedReadinessProduct(p,c),/exceed its current selling price/);
});
