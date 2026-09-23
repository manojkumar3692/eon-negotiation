import test from 'node:test';
import assert from 'node:assert/strict';
import {nextCheckoutStatus,customEventKey,applyCustomEvent} from '../lib/live/custom-events.js';
test('payment facts cannot be downgraded by event arrival order',()=>{
 for(const current of ['started','created','failed','paid','refunded']){
  assert.equal(nextCheckoutStatus(current,'checkout.paid'),current==='refunded'?'refunded':'paid');
  assert.equal(nextCheckoutStatus(current,'checkout.refunded'),'refunded');
  assert.equal(nextCheckoutStatus(current,'checkout.cancelled'),['paid','refunded'].includes(current)?current:'failed');
 }
});
test('all paid/refund/cancel arrival permutations finish refunded',()=>{
 for(const sequence of [['paid','cancelled','refunded'],['paid','refunded','cancelled'],['cancelled','paid','refunded'],['cancelled','refunded','paid'],['refunded','paid','cancelled'],['refunded','cancelled','paid']]){
  assert.equal(sequence.reduce((s,e)=>nextCheckoutStatus(s,'checkout.'+e),'created'),'refunded');
 }
});
test('duplicate keys cannot collide between installations',()=>{assert.notEqual(customEventKey('a','same'),customEventKey('b','same'));assert.equal(customEventKey('a','same'),customEventKey('a','same'));});
const installation={id:'install',workspace_id:'workspace'},event={eventId:'event-123',type:'checkout.cancelled',externalId:'checkout',occurredAt:'2026-09-23T00:00:00Z'};
test('late cancellation does not release a paid reservation',async()=>{
 const calls=[];const c={query:async(sql,args)=>{calls.push({sql,args});if(sql.startsWith('insert'))return {rowCount:1};if(sql.startsWith('select'))return {rows:[{id:'attempt',quote_id:'quote',status:'paid'}]};return {rowCount:1};}};
 await applyCustomEvent(c,installation,event);assert.equal(calls.some(c=>c.sql.includes('update negotiation.budget_reservations')),false);assert.deepEqual(calls[1].args,['workspace','install','checkout']);
});
test('unknown checkout throws so transaction can roll back dedupe record',async()=>{
 const c={query:async sql=>sql.startsWith('insert')?{rowCount:1}:{rows:[]}};
 await assert.rejects(()=>applyCustomEvent(c,installation,event),/CHECKOUT_NOT_READY/);
});
test('duplicate delivery does not replay financial mutations',async()=>{let count=0;const c={query:async()=>{count++;return {rowCount:0}}};assert.deepEqual(await applyCustomEvent(c,installation,event),{ok:true,duplicate:true});assert.equal(count,1);});
