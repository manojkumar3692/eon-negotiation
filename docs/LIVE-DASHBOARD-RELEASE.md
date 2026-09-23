# Integrated merchant dashboard release — 23 September 2026

The five EON modules and guided Setup now live inside the authenticated `/dashboard`. They read House of EON's connected catalog and persist configuration in Neon. `/pilot` remains a separate fictional example; it is no longer the primary implementation.

## Available in the dashboard

- **Setup:** eight resumable steps using the connected store and actual products, with server-validated readiness.
- **EON Rules:** per-product enabled state, preferred price, absolute floor, cost, launch exclusion, four strategies, contribution/quantity controls, concession choices and extra costs. Always-free, flat, threshold and connector shipping options; free shipping never counted as a new concession when already free.
- **EON Trigger:** visits, dwell, cart threshold, low-stock exclusions, cooldown, checkout hesitation, returning-customer and recovery preferences, campaigns and all seven entry surfaces.
- **EON Converse:** saved welcome/voice preferences, server-side catalog/rule simulations, stored test history, merchant-only score and economics. Shopper pricing still requires deterministic approval.
- **Recovery:** persisted consent-first timing/channel preferences and server-gated generation of one-use expiring links. No messages sent automatically. Messaging automation requires a provider and authoritative cart/consent/purchase events.
- **EON Optimize:** actual session, accepted, checkout, paid/refunded totals, recovered attribution, average price discount, top paid products, experiment settings and evidence-gated recommendations. Unknown lift and margin comparisons remain explicitly unmeasured.
- **EON Connect:** existing installed custom/Shopify setup and capability checks, plus transparent future-channel status. All checkout-dependent capabilities stay locked if unsupported.
- **Pause:** pauses connected negotiation and expires open quotes while preserving order reconciliation.

## Server integration

Authenticated API `/api/platform/workspaces/:id/conversion` loads settings and accepts save/test/pause/activate/recovery_link actions. Writes use tenant-scoped transactions, optimistic version checks, history and audit events. No production product pricing is seeded from fixtures.

The live shopper service checks active saved configuration, product selection, exclusions, quantity, contribution minimum, shipping agreement, policy version, invitation eligibility, treatment assignment and visitor rate buckets. Numeric pricing strategies honor the existing hard limits. Widget placements read merchant configuration and handle dwell/visits, desktop exit intent, dismissal cooldown and accessibility. Recovery tokens stay in URL fragments, are hashed in the database, and are consumed atomically when starting the bound negotiation.

## Boundaries that remain real

House of EON is currently catalog-connected: exact-cart economics, enforceable checkout and payment reconciliation remain incomplete at its connector. Customer negotiation must remain off until those pass. Extra concessions are configurable/testable but cannot activate until the store adapter enforces them. Current checkout adapter supports price terms; automatic messaging and future channels require their own provider integration. No production payment was made during this release.

Natural-language simulation uses a bounded offline intent interpreter; the existing live price negotiation retains the model-backed interpreter and numeric fallback. A richer live model/checkout contract is still required for arbitrary bundle/sample/credit conditions. No claim is made that all 14 areas are fully operational across every channel.

## Validation

57 automated tests; production build; isolated Neon migration and replay; real PostgreSQL save/reload, simulation persistence, always-free shipping, stale-write rejection, tenant read/write isolation, activation gate and pause checks. Migration 006/007 applied to the live EON production branch after validation. Original catalog, workspace and connector retained.
