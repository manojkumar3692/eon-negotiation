import test from "node:test";
import assert from "node:assert/strict";
import {
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
