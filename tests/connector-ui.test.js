import test from "node:test";
import assert from "node:assert/strict";
import {
  cartTestSelection,
  backendEnvironment,
  catalogSource,
  connectorDiagnostic,
  connectorReadiness,
  shouldRefreshWorkspace,
} from "../lib/connector-ui.js";

test("catalog presentation distinguishes manual and synchronized snapshots", () => {
  assert.deepEqual(catalogSource("manual"), {label:"Manual snapshot",detail:"Entered by the merchant"});
  assert.deepEqual(catalogSource("custom"), {label:"Custom API sync",detail:"Latest synchronized stock snapshot"});
});

test("catalog access remains distinct from negotiation readiness", () => {
  const readOnly=connectorReadiness({result:{capabilities:{catalog:true,inventory:true,economics:false,checkout:false,reconciliation:false,events:false}}});
  assert.equal(readOnly.catalogOnly,true);
  assert.equal(readOnly.negotiationReady,false);
  assert.deepEqual(readOnly.missing,["approved economics","enforceable checkout","checkout reconciliation","payment events"]);
  const ready=connectorReadiness({result:{capabilities:{catalog:true,inventory:true,economics:true,checkout:true,reconciliation:true,events:true}}});
  assert.equal(ready.negotiationReady,true);
});

test("merchant handoff contains complete server-only connector settings", () => {
  const value=backendEnvironment("workspace","installation","secret");
  assert.match(value,/NEGOTIATION_ENABLED=true/);
  assert.match(value,/NEGOTIATION_WORKSPACE_ID=workspace/);
  assert.match(value,/NEGOTIATION_INSTALLATION_ID=installation/);
  assert.match(value,/NEGOTIATION_CONNECTOR_SECRET=secret/);
  assert.doesNotMatch(value,/DATABASE|SUPABASE/);
});

test("diagnostics stay actionable and catalog sync refreshes the workspace", () => {
  assert.match(connectorDiagnostic("CONNECTOR_HTTP_401_NON_JSON"),/non-JSON 401/);
  assert.match(connectorDiagnostic("CONNECTOR_NONCE_STORAGE_UNAVAILABLE"),/nonce-storage migration/);
  assert.equal(shouldRefreshWorkspace("sync"),true);
  assert.equal(shouldRefreshWorkspace("test"),false);
});


test("successful legacy cart tests retain verified capability presentation", () => {
  const installation={status:"ready",config:{catalogSync:{total:6}},result:{operation:"context",checkoutSupported:true}};
  const ready=connectorReadiness(installation);
  assert.equal(ready.catalog,true);
  assert.equal(ready.negotiationReady,true);
  assert.deepEqual(ready.missing,[]);
  assert.equal(connectorReadiness({...installation,status:"failed"}).negotiationReady,false);
  assert.equal(connectorReadiness({...installation,result:{operation:"context",checkoutSupported:false}}).negotiationReady,false);
});

test("cart testing selects the enabled product rather than the first catalog item",()=>{
 const products=[{id:'disabled',externalVariantId:'d'},{id:'arctic',externalVariantId:'a'}];
 const rules=[{id:'disabled',ready:false},{id:'arctic',ready:true}];
 assert.equal(cartTestSelection(products,rules,'disabled').product.id,'arctic');
 assert.deepEqual(cartTestSelection(products,rules).eligible.map(p=>p.id),['arctic']);
 assert.equal(cartTestSelection(products,[]).product,null);
 assert.equal(cartTestSelection(products,undefined).product,null);
});
