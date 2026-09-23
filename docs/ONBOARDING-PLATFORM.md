# Multi-merchant onboarding and integration design

Updated 23 September 2026. Working project: eon-negotiation. House of EON is the first reference customer. The platform uses Neon; merchants retain their own database and checkout authority.

## Product model

Each merchant gets an isolated workspace. The merchant signs in, verifies its company domain, connects a native platform or custom HTTPS endpoint, synchronizes a catalog, approves product minimums and commercial rules, tests a real cart, installs the widget, and activates the connector.

The current live contract deliberately starts with a one-line cart. It supports physical goods, digital goods, services and B2B as declared business models, but each connector must map its real availability and enforceable checkout behavior. No selector in the dashboard can invent a capability that the merchant backend does not have.

## Integration paths

| Merchant system | Connection | Data stays with | Status |
|---|---|---|---|
| Custom/Supabase/Postgres | Merchant-owned HTTPS connector v3 | Merchant | Implemented; House of EON catalog/inventory connected read-only |
| Shopify | Standalone OAuth app | Shopify | Adapter implemented; real development-store acceptance pending |
| Manual/CSV | Dashboard upload | Neon platform catalog | Implemented for simulation and floor review |
| WooCommerce | Future scoped REST/plugin adapter | WooCommerce | Planned after pilot |
| BigCommerce | Future registered OAuth app | BigCommerce | Planned after pilot |
| ERP/carrier | Custom endpoint or future native adapter | Merchant/provider | Contract supports normalized facts |

The platform never needs a Supabase service-role key or direct access to a merchant's production database. The merchant endpoint reads its own systems and returns only the facts needed for the exact cart.

## Facts required for a live negotiation

| Fact | Authority | If missing or stale |
|---|---|---|
| Stable product/variant ID, price, currency | Commerce backend | Decline live offer |
| Available-to-sell stock or capacity | Inventory/booking system | Decline live offer |
| Approved unit floor | Merchant workspace or connector, with the stricter value winning | No discount |
| Shipping serviceability, merchant cost and customer charge | Merchant/carrier adapter | Ask destination or decline |
| Payment method support and fee | Merchant fee policy | Decline unsupported method |
| Comparable completed-sale aggregate | Merchant endpoint | Ignore optional history |
| Promotions, quantity and cart fingerprint | Checkout backend | Requote any change |
| Enforceable checkout and event status | Merchant/Shopify | Do not activate |

Comparable history must identify the same or valid comparable variant, currency, quantity basis and time window; exclude refunds, bundles and exceptional promotions; and include a sample count. It can raise the price floor but can never override the merchant's approved minimum.

## Architecture

```text
Merchant dashboard → authenticated platform API → Neon workspaces, policy and audit
Merchant backend/Shopify → provider adapter → normalized short-lived context
Shopper widget → AI intent extraction → explicit confirmation → deterministic rules
Approved quote → budget reservation → merchant checkout → signed payment event
```

AI understands requests, extracts a single monetary target and writes shopper-friendly replies. It never receives floors, costs, policy or credentials and never chooses an authorized price. `lib/live/rules.js` is the monetary authority. Direct numeric input remains usable if the model is unavailable.

Stage 3 agent-to-agent negotiation can reuse the same session, quote and checkout services later. It needs a separate authenticated transport, partner distribution and rate-limit policy; it does not change merchant economics.

## Custom connector v3

One merchant-owned `POST https://<company-domain>/negotiation/v3` endpoint implements:

- `capabilities`
- `catalog`
- `context`
- `checkout`
- `reconcile`

Every request is bound to `workspaceId` and `installationId`, carries a timestamp and nonce, and is signed over the exact body with the per-installation secret. The merchant must persistently claim nonces and persist checkout idempotency keys. Responses contain an as-of time, expiry and revision. The full schemas and reference handler are in [CUSTOM-CONNECTOR-V3.md](CUSTOM-CONNECTOR-V3.md).

The platform restricts the endpoint to HTTPS on the company domain or a subdomain, checks public DNS before outbound calls, disables redirects, limits response size and validates every field. The merchant should also restrict its endpoint to the platform credentials and apply its own request limits.

## Shopify adapter

The OAuth flow uses a one-time hashed state, validates Shopify's callback HMAC and stores encrypted expiring offline access/refresh tokens. Requested scopes cover products, inventory, orders and draft-order creation. New variants synchronize with minimum price equal to retail until reviewed. At checkout the adapter revalidates inventory/price, creates one tagged draft order with the exact negotiated discount and shipping amount, and returns Shopify's invoice URL.

Payment, cancellation, refund and uninstall webhooks are verified using the raw request body and deduplicated by Shopify event ID. App configuration and acceptance steps are in [SHOPIFY-SETUP.md](SHOPIFY-SETUP.md).

## Onboarding gates

1. **Company:** authenticated owner creates a workspace.
2. **Domain:** merchant publishes the displayed DNS TXT record.
3. **Connection:** custom endpoint credentials or Shopify OAuth.
4. **Capabilities:** adapter answers a signed/authorized health check.
5. **Catalog:** variants synchronize; merchant reviews floors and eligibility.
6. **Rules:** merchant publishes discount cap, rounds, quote validity, inventory thresholds and daily budget.
7. **Shipping:** custom connector supplies live facts; Shopify uses merchant-approved none/flat settings until another adapter exists.
8. **Real cart:** fresh price, stock, economics, destination, payment and checkout support pass.
9. **Widget:** merchant copies the snippet containing public workspace, product and variant identifiers.
10. **Activation:** requires domain verification and ready connector. Pause remains the kill switch.

Catalog synchronization and negotiation readiness are separate states. A connector that provides only catalog and inventory remains read-only: the platform may show its latest stock snapshot and allow merchant-only simulation, but it does not show a widget, test unsupported checkout in a retry loop or permit activation. Exact-cart economics, enforceable idempotent checkout, reconciliation and payment events must all be present before the live-cart gate opens.

For a reusable one-time merchant developer brief, see [CUSTOM-MERCHANT-HANDOFF.md](CUSTOM-MERCHANT-HANDOFF.md).

The global `NEGOTIATION_ENABLED` switch remains false until the first full staging checkout and webhook reconciliation pass.

## Live safety and data handling

Hard checks include tenant ownership, verified/active connector, current policy, exact currency/quantity/cart fingerprint, fresh provider revision, stock, floor, shipping economics, supported payment, round limit, quote expiry, daily budget under a workspace lock, idempotent checkout, signed events and context revalidation at acceptance.

The widget gets only a random public installation key, public product details, shopper replies and approved quote totals. Session capability tokens are random and stored only as hashes. Connector and OAuth tokens are encrypted at rest. Raw order history, full addresses, customer databases, merchant explanations and secrets are not copied into Neon.

Operational events record connector checks, syncs, sessions, quotes, checkout and reconciliation without raw shopper text or credentials. Metrics include readiness, negotiation rate, acceptance, paid conversion, discount spend and reconciliation failures. Any revenue-lift claim needs a controlled holdout.

## Current schema

Existing merchant tables remain in Neon. Migration `003_live_commerce.sql` adds OAuth state, external catalog IDs, durable sessions/turns/quotes, budget reservations, checkout attempts and webhook inbox, plus connector provider credentials/configuration and activation state. Merchant dashboard access continues through the restricted `negotiation_app` role and RLS. Public session, OAuth callback and verified webhook operations use narrowly validated server-only transactions.

## Rollout

1. Deploy schema and platform with negotiation disabled.
2. Build the House of EON v3 endpoint in `HOUSE_OF_EON_MINI_STORE` and complete the staging matrix.
3. Install Shopify on a development store and complete the acceptance matrix, including a second-store isolation test.
4. Enable a single EON staging product, then a small production cohort with the kill switch.
5. Add monitoring/reconciliation jobs and rate-limit infrastructure before broad signup.
6. Implement WooCommerce/BigCommerce based on merchant demand.
7. Add digital entitlement, booking and B2B-specific adapters.
8. Add an authenticated agent-facing transport after the commerce core is proven.

## Environment and deployment

Server variables are listed in `.env.example`. Production also needs reviewed values for Shopify and encryption secrets. Deploy the Next.js application through Vercel; `neon deploy` publishes only the separate Neon Function example.

Run unit tests, production build and development-branch database integration tests before release. Apply production migrations separately and keep `NEGOTIATION_ENABLED=false` until staging acceptance. See [HANDOFF.md](HANDOFF.md) for the next implementation task.
