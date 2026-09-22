# API contract v1 — target design

These endpoints are a specification for the next build. Only local `POST /api/demo` is implemented. Never direct a real storefront to the demo.

JSON, UTF-8, integer paise, INR. UUID resource IDs, UTC ISO-8601 timestamps. Maximum message length 1000 characters and body 8 KB. Mutating calls require `Idempotency-Key` (UUID recommended). Persist key for at least 24 hours; same key and body returns stored response, changed body returns 409. Error format: `{ "error": { "code": "OFFER_EXPIRED", "message": "Please request a new offer", "requestId": "..." } }`. Responses containing sessions/offers use `Cache-Control: no-store`.

| Method / route | Input | Success | Authorization |
|---|---|---|---|
| POST /v1/sessions | signed integration bootstrap, variantId, quantity:1 | 201 sessionId, capability, expiresAt, currentPricePaise, currency | verified installed merchant bootstrap; abuse limits |
| POST /v1/sessions/:id/messages | message OR targetPaise, currency | 200 decision, offer or clarification, roundsRemaining | session capability bound to tenant/session |
| GET /v1/sessions/:id | none | 200 current public state | same capability |
| POST /v1/offers/:id/accept | sessionId, cartFingerprint | 202 redemptionId, status:pending | session capability + current quote ownership |
| GET /v1/redemptions/:id | none | 200 status, checkoutUrl when ready | owner capability; allowlisted checkout host |
| POST /v1/webhooks/:provider | raw signed payload | 200 on processed/duplicate, 202 on durable queue | provider signature and expected account |
| GET /v1/admin/policies | variantId filter | 200 tenant policies | verified Supabase JWT + membership |
| POST /v1/admin/policies | full new policy version, expectedVersion | 201 immutable version | owner/operator; optimistic concurrency |
| POST /v1/admin/pause | enabled:false | 200 disabled | owner/operator; audited |
| GET /v1/admin/analytics | date range, cohort | 200 aggregates | merchant member |

Session capability is a random 256-bit bearer secret stored hashed; never log it or put it in URLs. Browser delivery/storage depends on verified EON integration (same-origin HttpOnly cookie preferred; cross-origin short-lived capability in memory). A random session ID is not production authentication. Integration bootstrap signatures and expiration must be validated. Stage 3 replaces shopper capability bootstrap with delegated agent credentials; it does not bypass authorization.

Example quote request:

```json
{"targetPaise":90000,"currency":"INR"}
```

Example response:

```json
{"decision":"counteroffer","offer":{"id":"uuid","amountPaise":95904,"currency":"INR","quantity":1,"expiresAt":"2026-09-21T18:15:00Z","conditions":{"shipping":"calculated_at_checkout","tax":"confirmed_at_checkout"}},"roundsRemaining":2}
```

No floor, margin, policy internals, token hash or customer history in public serializers. Offer acceptance means a quote can be redeemed, not that payment occurred. `checkoutUrl` exists only after provider reconciliation succeeds.

Errors: 400 malformed or ambiguous numeric request; 401 missing/invalid auth; 404 resource not owned/not found (avoid existence leaks); 409 idempotency mismatch, stale quote/cart or exhausted rounds; 410 expired; 422 ineligible product/currency/quantity; 429 quota with Retry-After; 503 paused, stale catalog or unavailable dependency. AI ambiguity normally returns a 200 clarification without consuming a price round.

Future agent endpoint `POST /v1/agent/quotes` maps to the same service after validating scopes, buyer delegation and merchant allowlist. No protocol compatibility claim until an adapter passes a partner integration test.

Local demo API: `{action:"start"}` returns `{id,expiresAt,demo:true}`; `{id,target:"900"}` returns a template reply and public decision. IDs are local-only bearer handles; no checkout or durable authorization exists.
