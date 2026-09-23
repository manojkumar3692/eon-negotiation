import { tenant } from "./db.js";
import { defaults, connectors } from "./connectors.js";
import {
  companySchema,
  productSchema,
  policySchema,
  simulationSchema,
  parseCatalogCSV,
} from "./validation.js";
import { simulate } from "./simulate.js";
const camelProduct = (p) => ({
  id: p.id,
  sku: p.sku,
  name: p.name,
  priceMinor: p.price_minor,
  commerceFacts: p.commerce_facts || {},
  floorMinor: p.floor_minor,
  stock: p.stock,
  source: p.source,
  externalProductId: p.external_product_id,
  externalVariantId: p.external_variant_id,
  updatedAt: p.updated_at,
});
export async function listWorkspaces(user) {
  return tenant(
    user,
    async (c) =>
      (
        await c.query(
          "select id,name,domain,industry,currency,domain_verified,created_at from negotiation.workspaces order by created_at",
        )
      ).rows,
  );
}
export async function createWorkspace(user, input) {
  const v = companySchema.parse(input);
  return tenant(user, async (c) => {
    const {
      rows: [w],
    } = await c.query(
      "insert into negotiation.workspaces(owner_user_id,name,domain,industry,currency) values($1,$2,$3,$4,$5) returning id,name,domain,industry,currency",
      [user, v.name, v.domain, v.industry, v.currency],
    );
    await c.query(
      "insert into negotiation.policy_versions(workspace_id,version,config) values($1,1,$2)",
      [w.id, defaults],
    );
    await audit(
      c,
      user,
      w.id,
      "Company created",
      "Workspace created in test mode.",
    );
    return w;
  });
}
async function owned(c, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id || "")) throw Error("NOT_FOUND");
  const {
    rows: [w],
  } = await c.query("select * from negotiation.workspaces where id=$1", [id]);
  if (!w) throw Error("NOT_FOUND");
  return w;
}
async function audit(c, user, id, name, detail) {
  await c.query(
    "insert into negotiation.audit_events(workspace_id,actor_user_id,name,detail) values($1,$2,$3,$4)",
    [id, user, name, detail],
  );
}
export async function state(user, id) {
  return tenant(user, async (c) => {
    const w = await owned(c, id);
    const products = (
      await c.query(
        "select * from negotiation.products where workspace_id=$1 order by updated_at desc limit 500",
        [id],
      )
    ).rows.map(camelProduct);
    const {
      rows: [p],
    } = await c.query(
      "select version,config,created_at from negotiation.policy_versions where workspace_id=$1 order by version desc limit 1",
      [id],
    );
    const connections = (
      await c.query(
        "select connector_id as id,status,created_at from negotiation.connections where workspace_id=$1",
        [id],
      )
    ).rows;
    const activity = (
      await c.query(
        "select id,name,detail,created_at from negotiation.audit_events where workspace_id=$1 order by created_at desc limit 20",
        [id],
      )
    ).rows;
    const simulations = (
      await c.query(
        "select id,policy_version,result,created_at from negotiation.simulations where workspace_id=$1 order by created_at desc limit 20",
        [id],
      )
    ).rows;
    const {rows:[liveMetrics]}=await c.query(`select
      (select count(*)::int from negotiation.connector_installations where workspace_id=$1 and revoked_at is null) as connections,
      (select count(*)::int from negotiation.connector_installations where workspace_id=$1 and status in ('read_only','ready') and last_result->'capabilities'->>'catalog'='true' and revoked_at is null) as catalog_connections,
      (select count(*)::int from negotiation.connector_installations where workspace_id=$1 and status in ('read_only','ready') and last_result->'capabilities'->>'inventory'='true' and revoked_at is null) as inventory_snapshot_connections,
      (select count(*)::int from negotiation.connector_installations where workspace_id=$1 and status='ready' and last_result->'capabilities'->>'economics'='true' and revoked_at is null) as economics_connections,
      (select count(*)::int from negotiation.connector_installations where workspace_id=$1 and status='ready' and last_result->'capabilities'->>'checkout'='true' and last_result->'capabilities'->>'reconciliation'='true' and last_result->'capabilities'->>'events'='true' and revoked_at is null) as checkout_connections,
      (select count(*)::int from negotiation.connector_installations where workspace_id=$1 and status='ready' and revoked_at is null) as ready_connections,
      (select count(*)::int from negotiation.live_sessions where workspace_id=$1 and created_at>now()-interval '30 days') as sessions,
      (select count(*)::int from negotiation.live_quotes where workspace_id=$1 and created_at>now()-interval '30 days') as quotes,
      (select count(*)::int from negotiation.checkout_attempts where workspace_id=$1 and status in ('created','paid') and created_at>now()-interval '30 days') as checkouts,
      (select count(*)::int from negotiation.checkout_attempts where workspace_id=$1 and status='paid' and created_at>now()-interval '30 days') as paid`,[id]);
    return {
      workspace: {
        id: w.id,
        name: w.name,
        domain: w.domain,
        industry: w.industry,
        currency: w.currency,
        domainVerified: w.domain_verified,
      },
      products,
      policy: p.config,
      policyVersion: p.version,
      policyPublished: p.version > 1,
      connections,
      activity,
      simulations,
      liveMetrics,
    };
  });
}
export async function mutate(user, id, action, body) {
  let parsed;
  if (action === "product") parsed = productSchema.parse(body);
  else if (action === "import") parsed = parseCatalogCSV(body.csv);
  else if (action === "policy") parsed = policySchema.parse(body.config);
  else if (action === "simulate") parsed = simulationSchema.parse(body);
  else if (action === "connector") {
    if (!connectors.some((c) => c.id === body.connectorId))
      throw Error("Invalid connector");
  } else throw Error("NOT_FOUND");
  return tenant(user, async (c) => {
    await owned(c, id);
    await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [id]);
    if (action === "product" || action === "import") {
      const list = action === "product" ? [parsed] : parsed;
      const existing = (
        await c.query(
          "select sku from negotiation.products where workspace_id=$1",
          [id],
        )
      ).rows.map((p) => p.sku);
      if (new Set([...existing, ...list.map((p) => p.sku)]).size > 500)
        throw Error(
          "Catalog limit: this release supports 500 products per workspace.",
        );
      for (const p of list)
        await c.query(
          "insert into negotiation.products(workspace_id,sku,name,price_minor,floor_minor,stock) values($1,$2,$3,$4,$5,$6) on conflict(workspace_id,sku) do update set name=excluded.name,price_minor=excluded.price_minor,floor_minor=excluded.floor_minor,stock=excluded.stock,updated_at=now()",
          [id, p.sku, p.name, p.priceMinor, p.floorMinor, p.stock],
        );
      await c.query(
        "insert into negotiation.connections(workspace_id,connector_id,status) values($1,'manual','manual_ready') on conflict do nothing",
        [id],
      );
      await audit(
        c,
        user,
        id,
        "Catalog updated",
        `${list.length} product(s) saved from merchant-entered data.`,
      );
      return { saved: list.length };
    }
    if (action === "policy") {
      const {
        rows: [current],
      } = await c.query(
        "select max(version) as version from negotiation.policy_versions where workspace_id=$1",
        [id],
      );
      if (current.version !== body.expectedVersion) throw Error("CONFLICT");
      await c.query(
        "insert into negotiation.policy_versions(workspace_id,version,config) values($1,$2,$3)",
        [id, current.version + 1, parsed],
      );
      await audit(
        c,
        user,
        id,
        "Rules published",
        `Policy version ${current.version + 1} saved for testing.`,
      );
      return { version: current.version + 1 };
    }
    if (action === "connector") {
      if (body.connectorId === "manual")
        return {
          message:
            "Add a product or import a CSV to initialize your manual catalog.",
        };
      await c.query(
        "insert into negotiation.connections(workspace_id,connector_id,status) values($1,$2,'setup_required') on conflict do nothing",
        [id, body.connectorId],
      );
      await audit(
        c,
        user,
        id,
        "Connector selected",
        `${connectors.find((x) => x.id === body.connectorId).name}: setup required; no data access granted.`,
      );
      return { status: "setup_required" };
    }
    if (action === "simulate") {
      const {
        rows: [p],
      } = await c.query(
        "select * from negotiation.products where workspace_id=$1 and id=$2",
        [id, parsed.productId],
      );
      if (!p) throw Error("NOT_FOUND");
      const {
        rows: [policy],
      } = await c.query(
        "select version,config from negotiation.policy_versions where workspace_id=$1 order by version desc limit 1",
        [id],
      );
      const product = camelProduct(p);
      const result = simulate(product, policy.config, parsed);
      await c.query(
        "insert into negotiation.simulations(workspace_id,policy_version,product_snapshot,input,result) values($1,$2,$3,$4,$5)",
        [id, policy.version, product, parsed, result],
      );
      await audit(
        c,
        user,
        id,
        "Simulation completed",
        `${product.name}: ${result.status}. No live offer or order created.`,
      );
      return result;
    }
  });
}
