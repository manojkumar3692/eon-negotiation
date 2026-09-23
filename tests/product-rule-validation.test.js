import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProductRuleAgainstCatalog} from '../lib/conversion/product-rule-validation.js';
const product={name:'Desert Tonka',price_minor:99900};
const stale={enabled:false,targetMinor:124900,floorMinor:124900};
test('disabled pre-import limits do not block other products or mutate approved amounts',()=>{
 const rule={...stale};assert.doesNotThrow(()=>validateProductRuleAgainstCatalog(rule,product));assert.deepEqual(rule,stale);
});
test('reenabling stale limits requires review and identifies the product',()=>{
 assert.throws(()=>validateProductRuleAgainstCatalog({...stale,enabled:true},product),/Desert Tonka/);
 assert.doesNotThrow(()=>validateProductRuleAgainstCatalog({enabled:true,targetMinor:99900,floorMinor:75500},product));
 assert.throws(()=>validateProductRuleAgainstCatalog({enabled:true,targetMinor:100000,floorMinor:75500},product),/catalog selling price/);
});
test('disabled rules still require a product in the owned workspace',()=>{
 assert.throws(()=>validateProductRuleAgainstCatalog(stale,undefined),/NOT_FOUND/);
});
