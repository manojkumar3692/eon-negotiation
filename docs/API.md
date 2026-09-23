# API contracts and implementation status

> Live dashboard update: see [the integrated release status](LIVE-DASHBOARD-RELEASE.md). Authenticated saved controls now supersede the earlier sandbox-only status below. Checkout/channel limitations remain explicit.

Existing `/api/platform/...`, `/api/negotiate/...` and signed custom/Shopify webhook routes remain unchanged. The endpoints below are the next-stage contract, NOT mounted production endpoints. No future endpoint should be exposed until tenant auth, schema validation, distributed rate limits and persistence are integrated.

Money is integer minor units with ISO currency. API version `v1`, UTC times, request IDs. No private floor/cost/score data in shopper responses. Merchant session authentication uses current Neon Auth. Shopper sessions use random scoped credentials; future agents use scoped OAuth/API credentials and never merchant cookies.

| Method / route | Principal | Purpose |
|---|---|---|
| GET/PUT `/api/v1/merchant/onboarding` | owner | Read/save draft step and revision; If-Match prevents lost updates |
| POST `/api/v1/merchant/import` | owner | Validate catalog preview then confirm import; never approve floors automatically |
| POST `/api/v1/merchant/policies` | owner | Validate and create immutable per-SKU rules version |
| POST `/api/v1/merchant/triggers` | owner | Publish validated trigger version, exclusions and caps |
| POST `/api/v1/merchant/simulate` | owner | Same core rules on isolated inputs; no commerce side effects |
| POST `/api/v1/merchant/activate` | owner | Verify readiness records server-side, merchant allowlist and experiment; not checkbox claims |
| POST `/api/v1/merchant/pause` | owner | Pause invites/accepts and audit reason; reconcile committed work |
| GET `/api/v1/merchant/funnel` | merchant member | Server aggregates, filter mode/date/product/cohort; enforce data permissions |
| POST `/api/v1/eligibility` | scoped installation/session | Normalize behavior, fetch verified facts, return state + public reason category |
| POST `/api/v1/sessions` | shopper/agent | Revalidate eligibility, persist policy/trigger/cohort/cart, issue session credential |
| POST `/api/v1/sessions/:id/messages` | session | Interpret bounded natural-language request; clarify structured intent |
| POST `/api/v1/sessions/:id/quotes` | session | Confirm intent, generate safe candidates and return public quote |
| POST `/api/v1/quotes/:id/accept` | session | Idempotent atomic acceptance, grant consumption, budget reserve and checkout outbox |
| POST `/api/v1/recovery/exchange` | one-use opaque grant | Exchange hashed expiring cart-bound recovery token; no consumption on GET |
| POST `/api/v1/events` | scoped telemetry | Allowlisted non-monetary browser events; cannot claim paid orders |
| POST `/api/v1/webhooks/:provider` | signed provider | Verify signature, replay window, merchant and payment; deduplicate and reconcile |

## Example quote request

```json
{"intent":{"quantity":2,"requestedType":"quantity","targetTotalMinor":180000,"currency":"INR"},"cartRevision":"opaque-revision","confirmed":true}
```

Amounts must explicitly state item-only versus all-in scope. Requests carry SKU/cart references, not caller-authorized floor, tax, stock or shipping costs. Server rebuilds verified context. AI output is validated against this schema and cannot add commercial fields.

## Example public response

```json
{"quoteId":"opaque-id","status":"counteroffer","type":"quantity","itemMinor":190000,"shippingMinor":5000,"totalMinor":195000,"currency":"INR","terms":{"quantity":2},"expiresAt":"2026-09-23T14:15:00Z"}
```

Example figures are fictional. Production tax/invoice breakdown must be explicit before acceptance. Unknown tax or destination means clarification/unavailable, not guessed all-in pricing.

## Accept, idempotency and errors

Require `Idempotency-Key` for mutation retries, bind request hash, principal and route. First accept returns 202 + attempt ID while checkout is created; repeat identical request returns same attempt/URL; changed payload → 409. Never consume a second token/budget reservation for retries. Persist inbox/outbox transitions with backoff, attempt limits and dead-letter diagnostics.

400 invalid/ambiguous data; 401 missing/invalid credential; 403 forbidden tenant/channel; 409 stale revision/policy/stock; 410 expired/revoked; 422 unsupported/unavailable concession; 429 rate/spend limit with Retry-After; 503 provider unavailable. Do not expose internal floor reasons, secrets or stack traces. Session pause invalidates new accepts; existing payment reconciliation continues.

## Connector capability extension

Existing providers implement the v3 price-only baseline. Before enabling new concessions, advertise exact supported terms (`price`, `shipping`, `sample`, `quantity`, `prepaid`, `credit`, `approved_terms`) and enforce every accepted term. A capability boolean is insufficient without acceptance tests. The extension interface in `modules/connect` is a scaffold; update the normalized contract and provider implementations together.

The detailed earlier implemented routes are preserved in [the historical API reference](history/API.md); use current route source as the final authority for existing endpoint behavior.
