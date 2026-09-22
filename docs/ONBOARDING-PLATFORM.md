# Multi-merchant onboarding and integration plan

Updated 21 September 2026. Working project: eon-negotiation. First reference customer: House of EON. The platform uses Neon; merchants retain their existing databases and checkout systems.

## Product decision

Build one control panel with independent company/store workspaces. A merchant signs in, creates a company, connects approved data, selects negotiable products, sets commercial limits, tests outcomes, and activates only after checkout enforcement is verified. A company domain is an identifier until ownership is verified; entering a domain does not grant access to that company.

The architecture can support many domains, but launch with single-currency physical ecommerce and one-item offers. Digital products need entitlement/refund capabilities; services need availability and booking holds; B2B needs account-specific catalogs and approval limits. Those are separate adapters, not capabilities obtained merely by selecting a business type.

## What is built now

- Next.js JavaScript dashboard with Overview, Companies, Connections, Products, Rules, Simulator, Activity and Settings.
- Neon Auth integration: email/password forms, server-side session checks, protected dashboard and API. Account creation/verification journey still needs an owner-led end-to-end acceptance test.
- Multiple owner-managed company workspaces, one currency per workspace: INR, USD, AED, EUR, GBP or SGD. Team invitations and admin/support access are future work.
- Durable Neon records for companies, catalog, immutable policy versions, connector selections, simulation results and audit events.
- Validated manual product entry/editing and CSV import: at most 200 rows per import and 500 products per workspace. Existing SKUs update atomically. Unknown availability stays unknown.
- Merchant scenario simulator: product minimum, discount cap, concession rounds, low/excess inventory, entered shipping reserve and qualified comparable-history median. No claim of live inventory, carrier pricing, margin accounting or AI dialogue in this simulator.
- Per-company data isolation through server-verified identity and PostgreSQL RLS under a restricted application role. No browser database credentials.
- `/demo` is an explicitly labeled, disposable browser preview. `/dashboard` requires sign-in and persists through the API.

Native commerce connections, automatic synchronization, widget activation, live offers, real daily budget reservations and checkout are not implemented by this dashboard release. Selecting a connector saves a setup choice, not an external connection. The earlier local OpenAI shopper prototype remains available separately.

## Merchant onboarding journey

| Step | Merchant does | Platform verifies | Outcome |
|---|---|---|---|
| 1. Account/company | Signs in; adds name, domain, type and currency | Session, input, owner association | Isolated test workspace |
| 2. Source | Chooses store platform, custom API or manual catalog | Provider authorization and capabilities when adapter exists | Clear connected/pending/missing states |
| 3. Data mapping | Reviews variants, availability, costs, shipping and history | IDs, units, tax basis, currency, freshness and completeness | Only eligible products can negotiate |
| 4. Boundaries | Sets floors, discounts, rounds, exceptions and budgets | Feasible economics and immutable policy version | Repeatable approved policy |
| 5. Test | Tries low offers, stock shortages and remote shipping | Explainable outcomes and failure behavior | Merchant signs off on staging results |
| 6. Install | Adds widget/app embed and connects accepted-offer checkout | Domain ownership, signature, cart/price enforcement | Test storefront enabled |
| 7. Activate | Chooses cohort/products and turns on negotiation | All gates passed; kill switch ready | Controlled production rollout |

Steps 1, manual path of 2, basic catalog/guardrails of 3–4 and arithmetic tests in 5 exist. Remaining steps are milestones below.

## Connector priorities

| Connector | Access model | Data/capability | Delivery priority |
|---|---|---|---|
| Manual/CSV | Merchant enters only needed data | Catalog, approved floors, stock snapshot | Working now; testing only |
| Shopify | Merchant installs our registered app with approved scopes | Products/variants, inventory, permitted order summaries, checkout enforcement | First native adapter |
| Custom backend | Dedicated HTTPS adapter, scoped installation credentials | Normalized context and accepted-offer handoff | First reference implementation: EON |
| Supabase/Postgres | Merchant's backend implements custom API | Approved stock/cost/history summaries | No direct master database access |
| WooCommerce | Application authorization or scoped API keys | Catalog, inventory, orders; checkout plugin extension | After Shopify/custom pilot |
| BigCommerce | Registered app OAuth | Catalog, inventory, orders and tested checkout capability | Next commerce platform |
| Shipping | Existing merchant quote service or carrier adapter | Serviceability, cost, expiry, delivery/payment constraints | Via custom API first |
| Payments | Existing merchant checkout and verified events | Paid/cancelled/refunded reconciliation | No separate payment collection |
| ERP/CRM | Selected least-privilege adapter | Costs, warehouse stock, approved loyalty eligibility | Based on customer demand |

Shopify's current authentication model distinguishes embedded token exchange from standalone authorization-code flow. Client credentials are intended for stores in the app's own organization, so they are not our multi-client onboarding strategy. Use official libraries, register the app, choose distribution, configure callbacks and obtain a development store before calling it connected. Source: [Shopify authentication](https://shopify.dev/docs/apps/build/authentication-authorization).

WooCommerce supports scoped read/write API keys and application authorization. Start with required read access and expand only for an implemented checkout capability. Source: [WooCommerce authentication](https://developer.woocommerce.com/docs/apis/rest-api/authentication/). BigCommerce has its own app OAuth installation flow; its adapter must follow that flow rather than reuse Shopify tokens. Source: [BigCommerce OAuth](https://docs.bigcommerce.com/developer/docs/integrations/apps/guide/auth).

## Data needed for smart negotiation

| Fact | Authority | Why needed | If missing/stale |
|---|---|---|---|
| Variant, current price, currency and tax basis | Commerce backend | Exact offer basis | No live offer |
| Available-to-sell quantity/capacity and timestamp | Inventory/booking system | Avoid selling unavailable supply | No live offer |
| Approved floor or trusted cost model | Merchant rules/ERP | Protect minimum contribution | No discount |
| Shipping amount, serviceability and quote expiry | Merchant/carrier backend | Protect delivered economics | Ask destination or pause offer |
| Payment fee and COD restrictions | Merchant's fee schedule | Compare payment options correctly | Use conservative approved assumptions or decline |
| Comparable completed-sale aggregate | Merchant backend | Avoid reckless undercutting | Ignore optional history |
| Promotions/cart/quantity | Checkout backend | Prevent stacking and changing scope | Requote unsupported cart |
| Loyalty/eligibility flag | Merchant backend | Approved conditional perks | Base policy only |

Do not copy entire customer, address or order databases. Last sold price alone is a weak signal: use comparable variant, quantity, currency, tax basis and a defined time window; exclude refunded orders, bundles and exceptional promotions. Carry source, as-of time and sample count. An unusually low previous sale never overrides the merchant floor.

## Architecture and AI responsibility

Merchant dashboard → authenticated platform API → Neon workspaces/policies/audit.
Merchant store → connector/normalizer → trusted context snapshot → deterministic rules engine.
Shopper → widget → AI intent extraction → validated intent → rules engine → approved quote → AI/templates explain the approved result.
Accepted quote → atomic reservation → merchant checkout adapter → verified paid/refund event → reconciliation and analytics.

AI understands requests such as budget, quantity or payment preference and can ask for missing information. It may explain an approved counteroffer or propose permitted alternatives. It cannot invent inventory/shipping facts, set an unauthorized price, read credentials, reveal floors or treat customer prose as policy. Treat product descriptions and connector content as untrusted data. Only the server rules engine authorizes money, benefits and quote scope. Keep a numeric/template fallback when AI fails.

The existing `src/openai.js` and `src/chat.js` provide a local INR shopper prototype. The new dashboard's `lib/simulate.js` is a merchant scenario tool, not the live economic authority. Before activation, consolidate it with the contextual engine behind one versioned policy evaluator and regression suite. Do not let multiple price engines diverge in production.

Stage 3 adds an authenticated agent-facing transport to the same context/rules/quote/checkout services. Use idempotency, explicit scopes, rate limits and signed offers. Do not assume ChatGPT or another agent will discover or invoke our custom negotiation endpoint automatically; protocol/distribution integration is a separate milestone.

## Custom API contract v1 (design; client not yet implemented)

Each installation has a platform-generated ID bound to one verified merchant workspace. Credentials are server-only, separately rotatable and revocable. Prefer narrow merchant-owned endpoints over exposing SQL or a Supabase service-role key.

- `GET /negotiation/v1/capabilities`: supported context, inventory, shipping, history and checkout capabilities; schema version.
- `GET /negotiation/v1/catalog?cursor=...`: paginated stable product/variant IDs, currency, price basis, availability metadata.
- `POST /negotiation/v1/context`: variant ID, quantity, cart fingerprint, destination country/postcode, payment method. Returns authoritative normalized facts, source timestamps, expiry and revision. Send no full address until checkout actually needs it.
- `POST /negotiation/v1/checkout`: platform-signed quote ID, merchant ID, variant/quantity, currency, exact price, allowed benefits, expiry and idempotency key. Merchant revalidates and creates exactly one enforceable checkout. It must reject changed carts, expired prices or duplicate keys with changed payloads.
- `POST /api/connectors/{installationId}/events`: signed event envelope with unique event ID, timestamp, schema version, entity revision and minimal payload. Handle duplicate/out-of-order stock/order/refund events and retries.
- `GET /negotiation/v1/checkout/{externalId}`: reconciliation after timeouts/ambiguous checkout creation.

Proposed context example (private server-to-server; illustrative units and values):

```json
{
  "schemaVersion": "1",
  "variantId": "SKU-01",
  "currency": "INR",
  "quantity": 1,
  "priceMinor": 99900,
  "priceBasis": "tax_inclusive",
  "availableToSell": 40,
  "approvedItemFloorMinor": 87500,
  "shipping": {"serviceable": true, "merchantCostMinor": 4500},
  "sales": {"comparableMedianMinor": 94900, "sampleCount": 12},
  "asOf": "2026-09-21T10:00:00Z",
  "expiresAt": "2026-09-21T10:05:00Z",
  "revision": "catalog-123"
}
```

The cost/floor contract must specify whether freight, tax and payment fees are already included so they are not counted twice. Signed requests use canonical bytes, method/path, timestamp, nonce and per-installation key; verify signatures in constant time and persist replay IDs. Validate outbound HTTPS hosts, resolved IP ranges and redirects to prevent private-network access. Domain text validation alone is not an outbound-request security boundary.

## Current database and platform API

Schema `negotiation`: `workspaces`, `products`, `policy_versions`, `connections`, `simulations`, `audit_events`. All child records include `workspace_id`. Auth identities live in Neon Auth; platform owner IDs are obtained from verified server sessions, never request bodies. One owner per workspace in this release.

Each transaction selects the restricted `negotiation_app` role and sets transaction-local `app.user_id`; PostgreSQL policies enforce ownership. Privileged database URLs remain server-only. Policy changes are serialized with a workspace advisory lock, checked against the expected version and inserted as new versions. Catalog imports validate every row before committing.

| Method | Route | Result |
|---|---|---|
| GET | `/api/platform/workspaces` | Current owner's companies |
| POST | `/api/platform/workspaces` | Create company and default policy |
| GET | `/api/platform/workspaces/:id` | Owned catalog/rules/setup/activity |
| POST | `/api/platform/workspaces/:id/product` | Add/update validated SKU |
| POST | `/api/platform/workspaces/:id/import` | Atomic validated CSV import |
| POST | `/api/platform/workspaces/:id/policy` | Publish immutable policy, expected version required |
| POST | `/api/platform/workspaces/:id/connector` | Save setup selection only |
| POST | `/api/platform/workspaces/:id/simulate` | Persist scenario/result with policy version |

Use same-origin requests, bounded JSON bodies and authenticated sessions. Responses are not cacheable. The API returns no other merchant's existence/data. Platform-wide rate limits, account quotas and public deployment controls remain a release gate.

Later tables: memberships/invitations, encrypted installations/scopes, sync cursors/errors, normalized context snapshots, sessions/turns, signed quotes, atomic budget reservations, checkout attempts, webhook inbox/outbox and redemptions. These are not silently emulated by dashboard simulations.

## Guardrails and analytics

Hard live gates: verified merchant identity/domain; active approved policy; fresh authoritative prices/stock/costs; supported shipping/payment; quantity/cart/currency match; server-held session and current quote; atomic remaining-budget reservation; exact checkout price enforcement; signature/idempotency/replay checks; expiry; merchant kill switch. Authentication and database permissions are necessary but do not replace these economic gates.

Current audit events record company creation, catalog changes, rule publication, connector selection and simulations. They support troubleshooting, not revenue claims. Next add connector authorized/sync completed/sync failed, session started, target confirmed, counteroffer issued, offer accepted, checkout created, payment verified, quote expired and refund verified. Include tenant/session/quote IDs, policy/model version, timestamps and correlation/idempotency IDs; omit raw secrets and unnecessary shopper text/PII.

Metrics after verified payment integration: onboarding funnel, data readiness, connection health, negotiation rate, accepted-offer rate, paid conversion, discount spend, contribution by policy, abandonment and reconciliation failures. Revenue lift requires a randomized holdout or another defensible comparison, not gross negotiated order totals. Set retention and deletion policies before collecting live shopper data.

## Delivery milestones and acceptance

1. **Dashboard foundation — implemented in this build.** Owner workspaces, manual catalog, rules, arithmetic simulator, audit, protected routes and Neon isolation checks. Finish merchant signup/verification acceptance before inviting customers.
2. **Shopify read-only onboarding.** Registered development app/store, verified install callback/state/signatures, encrypted per-store tokens, scoped catalog/inventory/order sync, freshness/errors, uninstall/revocation and retries. Done when two independent stores stay isolated and sync failures are visible.
3. **Custom API reference / EON.** Map the verified EON backend to v1 context; keep EON Supabase untouched except a narrow authenticated adapter when that later task is resumed. Done when trusted stock/history/shipping context passes contract and stale-data tests.
4. **Unified live engine and conversation preview.** Durable sessions, shared evaluator, AI intent/confirmation, approved replies and realistic merchant test conversations; compare standard versus low-stock/remote-shipping/history scenarios.
5. **Checkout staging and widget.** One-time offers, budget and stock reservations, non-stacking checkout, webhook verification, refund reconciliation and payment/timeout/concurrency tests. Done when exactly one paid order reconciles to the exact approved offer.
6. **Controlled production pilot.** EON plus one Shopify merchant; limited products/cohort, kill switch, monitoring and support. Then add WooCommerce and BigCommerce based on demand.
7. **Broader businesses and agent transport.** Digital entitlements, bookings, B2B approvals; agent negotiation only after core commerce safety is proven.

## Deployment and handoff

Project directory: `/Users/manoj/Documents/eon-negotiation`. Node 22.23.2. `npm ci`, `npm test`, `npm run build`; `npm run dev` serves `http://127.0.0.1:3000`. `npm run dev:legacy` runs the earlier shopper prototype (stop the dashboard first if using the same port).

Neon project `calm-fog-75034810`, development branch `dashboard-onboarding` (`br-little-night-b5vubs3u`). The dashboard migration is applied there. Production retains the earlier hello function; this dashboard has not been publicly deployed. Never substitute production connection values for a development test run.

Required server configuration: `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (migration/tests), `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (at least 32 random characters), `APP_ORIGIN`, `NEON_BRANCH`. Existing `OPENAI_API_KEY` and `OPENAI_MODEL` serve the separate local AI prototype; no key is needed by the arithmetic simulator. Do not use `NEXT_PUBLIC_` for secrets. Future connector credentials belong in encrypted per-installation storage with a separate managed encryption key, not a single global merchant token.

Vercel plan: import the GitHub repository with Next.js framework; configure preview-only Neon branch and auth origin; set all server variables; run reviewed schema migration separately; test signed-in ownership and callback behavior over HTTPS; then configure production branch/domain/variables and repeat gates. Register exact OAuth URLs only after the deployment domain is chosen. `neon deploy` deploys the configured hello function and is not a deployment of the Next.js dashboard. GitHub remote and Vercel deployment remain to be connected; no remote was created in this turn.

Validation completed in this build: production compilation; 25 unit tests including pricing sweeps; real development-database isolation, immutable/stale-policy, import validation and persistence checks; unauthenticated API rejection and dashboard sign-in redirect. Browser checks are recorded in the project handoff. Signup emails, native store installs and live checkout have not been exercised.
