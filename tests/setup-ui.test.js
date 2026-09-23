import test from 'node:test';
import assert from 'node:assert/strict';
import {ruleIssues,preferredSetupProduct,setupTestProducts} from '../lib/conversion/setup-ui.js';
const products=[{id:'desert',name:'Desert Tonka',priceMinor:99900},{id:'arctic',name:'Arctic Wave',priceMinor:99900}];
const config={products:[{id:'desert',enabled:false,targetMinor:124900,floorMinor:124900,costMinor:40000},{id:'arctic',enabled:true,targetMinor:99900,floorMinor:75500,costMinor:50000}]};
test('setup defaults to the enabled pilot even when disabled stale rules sort first',()=>{
 assert.equal(preferredSetupProduct(products,config).id,'arctic');
 assert.deepEqual(setupTestProducts(products,config).map(p=>p.id),['arctic']);
});
test('stale rules are explained without silently lowering merchant floors',()=>{
 const before=structuredClone(config);assert.equal(ruleIssues(products[0],config.products[0]).length,2);
 assert.deepEqual(config,before);assert.deepEqual(ruleIssues(products[1],config.products[1]),[]);
});
test('enabled but unreviewed rules cannot be selected for a simulator test',()=>{
 const c=structuredClone(config);c.products[0].enabled=true;c.products[1].costMinor=null;
 assert.deepEqual(setupTestProducts(products,c),[]);
 assert.match(ruleIssues(products[1],c.products[1]).join(' '),/product cost/);
});
test('setup handles an empty catalog and accepts explicitly approved zero cost',()=>{
 assert.equal(preferredSetupProduct([],config),null);
 assert.equal(preferredSetupProduct(products,{products:[]}).id,'desert');
 assert.deepEqual(ruleIssues(products[1],{...config.products[1],costMinor:0}),[]);
 assert.ok(ruleIssues(products[1],{...config.products[1],targetMinor:70000}).length);
});
