import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool, tenant } from "../lib/db.js";
import {
  createWorkspace,
  listWorkspaces,
  state,
  mutate,
} from "../lib/repository.js";
if (process.env.NEON_BRANCH !== "dashboard-onboarding")
  throw Error(
    "This test only runs on the isolated dashboard-onboarding branch.",
  );
const a = "test:" + randomUUID(),
  b = "test:" + randomUUID();
const created = [];
try {
  const company = {
    name: "Disposable integration test",
    domain: "example.com",
    industry: "Retail & ecommerce",
    currency: "USD",
  };
  const wa = await createWorkspace(a, company);
  created.push(wa.id);
  const wb = await createWorkspace(b, company);
  created.push(wb.id);
  assert.deepEqual(
    (await listWorkspaces(a)).map((w) => w.id),
    [wa.id],
  );
  await assert.rejects(() => state(b, wa.id), /NOT_FOUND/);
  await assert.rejects(
    () =>
      mutate(b, wa.id, "product", {
        sku: "A",
        name: "Product",
        priceMinor: 10000,
        floorMinor: 8000,
        stock: 40,
      }),
    /NOT_FOUND/,
  );
  await tenant(b, async (c) => {
    assert.equal(
      (
        await c.query("select * from negotiation.workspaces where id=$1", [
          wa.id,
        ])
      ).rowCount,
      0,
    );
  });
  await assert.rejects(
    () =>
      tenant(b, (c) =>
        c.query(
          "insert into negotiation.products(workspace_id,sku,name,price_minor,floor_minor,stock) values($1,$2,$3,100,80,1)",
          [wa.id, "intrusion", "Rejected"],
        ),
      ),
    /row-level security/,
  );
  await mutate(a, wa.id, "product", {
    sku: "A",
    name: "Product",
    priceMinor: 10000,
    floorMinor: 8000,
    stock: 40,
  });
  await mutate(a, wa.id, "product", {
    sku: "A",
    name: "Updated",
    priceMinor: 10000,
    floorMinor: 8000,
    stock: 41,
  });
  let data = await state(a, wa.id);
  assert.equal(data.products.length, 1);
  assert.equal(data.products[0].stock, 41);
  await assert.rejects(() =>
    mutate(a, wa.id, "import", {
      csv: "sku,name,price,floor,stock\nB,Valid,10,8,1\nC,Invalid,1,8,1",
    }),
  );
  assert.equal((await state(a, wa.id)).products.length, 1);
  await mutate(a, wa.id, "policy", { config: data.policy, expectedVersion: 1 });
  await assert.rejects(
    () =>
      mutate(a, wa.id, "policy", { config: data.policy, expectedVersion: 1 }),
    /CONFLICT/,
  );
  await assert.rejects(
    () =>
      tenant(a, (c) =>
        c.query(
          "update negotiation.policy_versions set config=$1 where workspace_id=$2",
          [{}, wa.id],
        ),
      ),
    /permission denied/,
  );
  await mutate(a, wa.id, "connector", { connectorId: "shopify" });
  const result = await mutate(a, wa.id, "simulate", {
    productId: data.products[0].id,
    targetMinor: 7500,
    stock: 40,
    round: 3,
    shippingReserveMinor: 0,
    medianMinor: null,
    sampleCount: 0,
  });
  assert.equal(result.amountMinor, 9000);
  data = await state(a, wa.id);
  assert.equal(data.simulations.length, 1);
  assert.equal(data.policyVersion, 2);
  assert.equal(
    data.connections.find((c) => c.id === "shopify").status,
    "setup_required",
  );
  assert.ok(data.activity.length >= 5);
  await tenant(b, async (c) => {
    assert.equal(
      (
        await c.query(
          "select * from negotiation.simulations where workspace_id=$1",
          [wa.id],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await c.query(
          "select * from negotiation.products where workspace_id=$1",
          [wa.id],
        )
      ).rowCount,
      0,
    );
  });
  console.log(
    "PASS: two-tenant isolation, direct RLS enforcement, catalog upsert, atomic validation, immutable rules, stale-version rejection, connector state, simulation persistence and audit events.",
  );
} finally {
  for (const id of created)
    await pool.query(
      "delete from negotiation.workspaces where id=$1 and owner_user_id=any($2::text[])",
      [id, [a, b]],
    );
  await pool.end();
}
