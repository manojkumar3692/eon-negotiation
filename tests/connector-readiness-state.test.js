import test from 'node:test';
import assert from 'node:assert/strict';
import {capabilityCheckStatus,catalogSyncStatus} from '../lib/connectors/readiness-state.js';
const caps={inventory:true,economics:true,checkout:true,reconciliation:true,events:true};
test('routine refresh retains a verified cart',()=>assert.equal(catalogSyncStatus(capabilityCheckStatus('ready',caps)),'ready'));
test('refresh cannot promote an unverified connection',()=>{
 for(const status of ['connected','read_only','failed']){
 assert.equal(capabilityCheckStatus(status,caps),'read_only');assert.equal(catalogSyncStatus(status),'read_only');}
});
test('loss of required capability revokes readiness',()=>{
 for(const key of Object.keys(caps))assert.equal(capabilityCheckStatus('ready',{...caps,[key]:false}),'read_only');
 assert.equal(capabilityCheckStatus('ready'),'read_only');
});
