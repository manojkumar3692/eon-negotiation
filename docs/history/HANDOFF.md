> Historical baseline before 23 September conversion-layer update. Current PRODUCT-SPEC.md and ROADMAP.md take precedence. Retained for implementation reference.

# Current build handoff

The independent platform lives in `/Users/manoj/Documents/eon-negotiation`. House of EON is the first reference merchant and keeps its Supabase database. The platform uses Neon and consumes only normalized, merchant-approved facts through a narrow connector.

## Implemented

- Protected multi-company merchant dashboard, Neon Auth, PostgreSQL RLS, versioned policies, catalog management, simulator and audit history.
- Custom commerce connector contract v3 for any non-Shopify backend. It covers capabilities, catalog, live cart context, enforced checkout and reconciliation. Requests are tenant-bound, timestamped, nonce-protected and HMAC-signed. Endpoint setup is restricted to the company domain, public DNS is checked before each call and redirects are disabled.
- Shopify standalone OAuth with one-time state, callback HMAC validation, encrypted expiring offline credentials and refresh rotation. The adapter synchronizes products/inventory, reads fresh cart context and creates idempotent discounted draft-order checkout.
- Customer widget and `/offer/:publicKey` conversation UI. AI extracts shopper intent; deterministic server rules alone authorize prices. A numeric fallback remains available when AI is down.
- Durable sessions, turns and quotes; fresh-context revalidation; atomic daily discount-budget reservations; idempotent checkout attempts; signed payment/cancellation/refund events; and live dashboard counters.
- Company-domain verification, connector diagnostics, real-cart readiness check, merchant-configured shipping assumptions, activation/pause controls and copyable widget installation snippet.

## Production safety state

`NEGOTIATION_ENABLED=false` must remain set in production until a real connector passes staging. The code and schema are deployable, but no House of EON checkout or Shopify development-store order has yet completed the full install → negotiate → pay → webhook path. Do not describe either native integration as accepted until those tests pass.

Newly synchronized products default their approved minimum to retail, so they cannot discount until the merchant reviews them. A connector can be tested before domain verification, but production activation requires a ready connector and verified domain. Floors, costs, policy and credentials never enter the widget or AI prompt.

## Next task: House of EON staging

Work in `HOUSE_OF_EON_MINI_STORE` only after this platform deployment is healthy.

1. Add one server-only `/api/negotiation/v3` endpoint using `lib/connector-kit/index.js` as the reference.
2. Read EON product, current price, available stock and comparable completed-sale aggregates from its existing Supabase server client. Do not send the Supabase service key to this platform.
3. Map EON checkout creation to an exact, non-stackable negotiated quote and persist the platform idempotency key.
4. Send signed paid, cancelled and refunded events back to the platform.
5. Connect the EON workspace, sync the catalog, review each floor, configure shipping, run a real-cart test and verify the domain.
6. Install the widget on one staging product and complete concurrency, expiry, price change, stock change, remote postcode, payment failure and webhook-retry tests.
7. Enable negotiation only for that staging cohort. Keep the connector kill switch available.

## Shopify acceptance still required

Create a Shopify Partner/Dev Dashboard app, set the callback and webhook routes in [SHOPIFY-SETUP.md](SHOPIFY-SETUP.md), add the Vercel environment credentials, and install it on a development store. Verify token refresh, catalog sync, minimum-price review, draft-order invoice total, paid event, cancellation, refund, uninstall and a second-store isolation test.

## Verification

Run:

```sh
npm test
npm run build
npm run db:migrate
npm run test:db
```

Development database integration tests intentionally require `NEON_BRANCH=dashboard-onboarding`. Production migration requires `node --env-file=<reviewed-production-env> scripts/migrate.js --production` and must be run separately from Vercel deployment.

The development watcher can hit the macOS open-file limit in this workspace. `npm run build && npm run start` is the stable local acceptance path.
