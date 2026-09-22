# Platform-first plan: merchant data, dashboard and database

> Database decision: eon-negotiation uses Neon project `calm-fog-75034810`; House of EON retains Supabase. Supabase-specific platform setup below is historical and must not be applied to Neon. Rewrite draft auth references/access policies before any application migration.

## Decision and current status

Build `eon-negotiation` as an independent multi-merchant platform before doing further House of EON website integration. This plan supersedes the earlier integration-first sequence. EON is tenant/customer one. Pause the separate EON integration task and preserve its isolated proof of concept; it is not a live connector or production system.

Current assets: live-tested OpenAI intent extraction, rule/pricing prototypes, contextual engine and tests, local demo, draft SQL schema. The isolated EON experiment reportedly tested synthetic stock/sales/shipping and an unpaid Razorpay test order. A merchant dashboard, provisioned platform Supabase project, persistent transactions and real data synchronization are not complete. The draft initial schema has not been applied.

## Three separate pieces

1. Merchant systems own catalog, current applicable selling price, available inventory, order/payment/refund facts and fulfillment.
2. Our platform owns merchant accounts, access roles, connection configuration, approved policy versions, cached/derived context, negotiations, quotes, redemption tracking and reporting.
3. The shopper widget is a client of our API. It cannot set authoritative prices or read private policies/database credentials.

Use a separate Supabase project for the platform, with merchant_id isolation in every tenant-owned record. Do not reuse EON's Supabase project as our SaaS database. Supabase Auth serves merchant users; shoppers can use short-lived session capabilities rather than forced signup. Development/staging/production must not share writable production state.

## Merchant onboarding

Owner signs up → creates store → verifies domain ownership → selects a connection method → connects/imports catalog → reviews field mappings/data quality → sets permitted products and commercial rules → runs test negotiations → passes readiness checks → obtains installation instructions. Domain verification and merchant identity must precede production credential issuance. Until installation is explicitly enabled, use test mode.

Support three integration levels:

| Mode | What merchant provides | Suitable use |
|---|---|---|
| Manual/import | Catalog and private policy forms or validated CSV import, optional approved shipping zone rate card | Build and test platform immediately; no database connection required |
| Custom backend connector | Authenticated bounded context API, event notifications and eventual checkout handoff | EON and other custom stores; recommended initial live architecture |
| Commerce-platform app | Platform-approved install and scoped authorization, mapped to the same contract | Later Shopify or other supported platform adapters |

Manual mode must be labelled manual with timestamp/source. It cannot promise live stock or checkout enforcement. CSV imports are previewed, mapped, validated, deduplicated and then published with an import audit record. Bad rows have explicit errors. Do not build arbitrary SQL queries supplied by a model. Do not require every merchant to share a master database key.

## How a custom merchant supplies data

The merchant creates an installation with permitted capabilities such as context:read, events:write and checkout:create. Keep checkout write authority separate from read-only discovery. EON later implements a small server connector which reads its own Supabase/catalog/fulfillment system and returns only normalized facts. Its Supabase service key remains on its server.

Initial sync pulls bounded catalog and aggregate context. Subsequent signed events update inventory, products and order/refund aggregates. Periodic reconciliation repairs missed events. Each event carries a unique ID, schema version, source revision/time and installation identity. Deduplicate before applying; reject older revisions; queue retries and expose sync errors. Connector secrets are stored encrypted with rotation/key-version metadata; bearer tokens are hashed when only verification is needed. Database rows store secret references or ciphertext, never plaintext in dashboard-readable columns.

Context requests include variant, quantity, destination pincode and payment mode; response includes current price/promotion basis, available-to-sell stock, qualified sales summary, delivery quote, timestamps and data-quality flags. Recheck authoritative inventory, price, shipping and constraints on offer acceptance. A cache accelerates negotiation; it is not checkout authority.

Allow only verified HTTPS merchant endpoints. Protect server-side connector calls from private/link-local/metadata destinations, unsafe redirects and DNS rebinding. Local test connectors use an explicit development-only transport. Use timestamped request authentication, replay protection, scoped access, bounded payloads and installation rate limits. Neither the browser nor the LLM gets connector secrets.

## Data we need, and what is optional

| Data | Source/owner | Why needed | Behavior when missing |
|---|---|---|---|
| Variant ID, currency, price and promotion context | Merchant catalog/backend | Bind quote to a sellable item and the actual applicable price | Block purchasable offer |
| Approved minimum price and discount cap | Merchant dashboard | Non-negotiable commercial limits | Block activation |
| Cost, fees, tax basis and contribution target | Merchant dashboard or approved economics API | Calculate delivery-aware minimum profit | Use only an explicitly approved fixed-floor/item-only policy; no margin claim |
| Stock and reservation availability | Merchant inventory system | Availability and scarcity strategy | No stock-based strategy or live purchasable quote without authoritative acceptance validation |
| Destination and shipping quote/rate card | Shopper pincode + merchant shipping source | Serviceability and delivered-order economics | Ask for destination; item-only quote clearly states shipping pending |
| Comparable recent net prices, sample count and period | Merchant computes aggregates or scoped event processor | Reference price and strategy | Ignore history; use approved policy |
| Sales velocity and stock age | Optional merchant inventory/order history | Clearance/slow-moving stock strategy | Disable those strategies |
| Paid/refunded/cancelled events | Merchant's verified order lifecycle | Outcome attribution and budget reconciliation | Treat paid-order metrics as unavailable, never inferred from click |
| Loyalty eligibility | Later merchant capability | Explicit program benefit | Do not offer personalized loyalty concessions |

We do not need the whole customer database, card details, full addresses or every order row. Product-level aggregates suffice for historical pricing. If a connector must compute from orders, it does so inside the merchant boundary where practical. Location is used for fulfillment economics, not wealth inference. Approved price floors and costs are server-private.

## Merchant dashboard (MVP)

| Area | Merchant actions |
|---|---|
| Overview | See test/live mode, connection health, active products, accepted and verified paid offers, spend, estimated/actual margin where available |
| Store and connections | Verify domain; configure connector; test auth; inspect last sync and errors; rotate/revoke access |
| Catalog | Import/map products; inspect price, stock, freshness and source; choose eligible variants |
| Negotiation rules | Set floor, max discount, approved inventory/history adjustments, rounds, expiry, daily subsidy budget and excluded promotions |
| Shipping and economics | Set origin/zone rate cards or quote integration; tax basis, costs/fees, contribution target and shipping responsibility |
| Simulator | Try product, target, stock scenario and pincode; see decision and private reasons without creating an order |
| Negotiations | Inspect state/offer/expiry, private audit and linked redemption; revoke pending offers within defined rules |
| Reports | Conversion, discount spend, verified sales, returns and contribution; distinguish estimates, missing data and true observed results |
| Team and security | Invite owner/operator/analyst; manage roles, audit, credentials and emergency pause |

Owners manage credentials/roles/activation. Operators manage permitted catalog/policies within owner constraints. Analysts see aggregates without private cost/secret access. Every policy publish creates an immutable version and audit record. In-flight quotes retain their snapshot unless explicitly revoked; tightening policy has an explicit revoke option. A floor change or budget reset must not bypass reserved obligations.

## Platform database design

Keep and evolve the unapplied `001_initial.sql` draft through reviewed migrations; do not assume it already implements this plan.

Existing draft concepts: merchants, memberships, products, policies, sessions, offers, redemptions, budget_days, idempotency_keys, events, webhook_receipts and outbox.

Add/extend these concepts:

| Group | Tables/changes | Key constraints |
|---|---|---|
| Onboarding | merchant_domains, invitations, onboarding_checks | Domain verification; expiring hashed invite tokens; no self-granted ownership |
| Connections | merchant_connections, connection_credentials, sync_runs, import_jobs | Tenant-bound installation, capability scopes, status, schema version, secret reference, cursor and last success/error |
| Merchant facts | product_variants, inventory_snapshots, sales_aggregates, shipping_quotes | Composite merchant/variant keys; source and observedAt/validUntil; unknown nullable values distinct from zero |
| Economics | economics_versions, shipping_rate_cards, policy_versions | Integer paise/basis points; explicit tax basis, currency, effective dates and approved state |
| Decisions | decision_snapshots, negotiation_messages, session actor data | Immutable context/policy reference; bounded/redacted content; retention policy |
| Budgets/redemptions | budget_reservations; extend redemptions/outbox | Atomic reserve/spend/release; provider identity; unique acceptance and explicit expiry cleanup |
| Administration | audit_logs, analytics_daily | Append-only audited changes; tenant isolation; versioned event definitions |

Every tenant relationship uses merchant-aware foreign keys; a variant/policy/session cannot cross tenants. Also enforce policy variant matching, active version and role permissions in transaction logic. All exposed tables use explicit grants and RLS; secret/internal queues are backend-only. Backend privileged access still validates tenant ownership because service-role credentials bypass RLS. Derived analytical views must preserve tenant isolation and analyst restrictions.

Do not accumulate unlimited price snapshots or raw chat. Decide retention by class: short-lived request/idempotency data, bounded diagnostics, longer-lived financial/audit records as operationally needed. Scheduled cleanup must preserve reconciliation obligations. Deletion/export workflows are scoped to the requesting merchant and audited.

## Initial platform API areas

- Merchant identity/onboarding: create merchant, verify domain, invite member, accept invitation.
- Connections/import: create/revoke connection, test connection, validate/publish import, read sync health, request resync.
- Catalog/economics: list normalized variants, inspect data-quality status, publish economics/policy version.
- Simulator: evaluate a saved policy against marked test context; no paid provider, stock, budget or order side effects.
- Shopper: create bounded session, send message, obtain current quote, accept quote, read checkout status.
- Event intake/worker: authenticate and dedupe events; process outbox; release expired reservations and reconcile provider outcomes.

Writes are role-authorized and idempotent. Policy updates use expected-version concurrency. Unknown currencies/invalid money/foreign tenant objects reject explicitly. A merchant connector implementation is replaceable behind this normalized contract.

## Build order and exit tests

1. **Platform foundation:** separate Supabase development project, migrations, auth, tenant/role isolation, configuration and repository layer. Exit: two merchants cannot see or mutate each other's data; secrets inaccessible to browser/analyst.
2. **Merchant workspace:** onboarding, manual catalog import/forms, economics/policies, connection placeholders and health, simulator. Exit: a merchant can configure a test product and explainable offer end-to-end without editing code or touching EON.
3. **Durable negotiation:** contextual rules, AI conversation, persistent messages/session/quote, atomic acceptance, budget reservations, expiry cleanup and audit. Exit: retry/concurrency/restart/expiry tests pass with identical approved economics.
4. **Reusable connector contract:** signed API client/server contracts, sync/events/reconciliation, data-quality validation and a fake merchant reference backend. Exit: contract tests cover missing/stale/out-of-order/duplicate data and a second synthetic tenant.
5. **Return to EON:** map actual source data, add connector/widget, verify sandbox checkout and callbacks. Existing isolated proof of concept may be reused after review. Exit: accurate pricing and one reconciled sandbox redemption.
6. **Controlled pilot:** approved real economics, genuine inventory/fulfillment checks, observability and rollout decision.

Do not resume the EON task or change its storefront while stages 1–4 remain the focus. Existing experiments are preserved as reference. Creating a new Supabase project and installing real credentials remain provisioning work; this design update does not itself provision or migrate a database.
