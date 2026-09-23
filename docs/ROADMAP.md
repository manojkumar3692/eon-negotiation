# House of EON first roadmap

> Live dashboard update: see [the integrated release status](LIVE-DASHBOARD-RELEASE.md). Authenticated saved controls now supersede the earlier sandbox-only status below. Checkout/channel limitations remain explicit.

Stage 2 (human shopper ↔ AI merchant) is the immediate product. Keep EON on Neon/Auth and House of EON on Supabase, per the user's confirmed decision. This replaces earlier platform-first sequencing and blanket exclusion of non-price concessions.

| Milestone | Deliverable | Exit gate |
|---|---|---|
| 1 — Product foundation | This specification, five modules, guided sandbox, pricing/concession safety tests, additive schema/API contracts | Local tests/build pass; every requested area mapped honestly |
| 2 — Persistent merchant setup | Integrate wizard with existing authenticated dashboard; version per-SKU boundaries, trigger rules, capabilities, onboarding drafts and audit | Owner completes connect/import/configure/test flow without developer help; no cross-tenant access |
| 3 — EON checkout proof | Connect actual EON staging catalog and checkout; bind eligibility, rules, offer grants, budget, provider idempotency and webhooks | Negotiate → accept → pay → reconcile; replay, race, expiry, inventory/price change, failure/refund tests pass |
| 4 — Concessions and surfaces | Add checkout-verified shipping, quantity, samples/bundles, prepaid/COD and credit one by one; product/chat/cart/page/exit placements | Each enabled term enforced by merchant checkout; no unsupported option visible |
| 5 — Recovery and measurement | Consented recovery links; reliable outbox; sticky control/treatment cohorts; full funnel and contribution reporting | Paid orders attributed once, opt-out/purchase suppression tested, no simulated data counted |
| 6 — Controlled House of EON pilot | Small approved traffic cohort, help content, pause/override, weekly commercial review | Gate below is met and owner signs off usefulness |
| 7 — Expansion only after proof | Shopify development-store acceptance; then a second client and other store adapters | EON gate remains healthy; same core rules require no platform fork |
| 8 — Future buyer-agent API | Scoped agent auth, structured quote/accept API, buyer consent receipts, quota and protocol adapters | Real authorized agent sandbox transaction; no assumption ChatGPT/Gemini discovers custom endpoints |

No automatic timeline or guaranteed uplift: checkout readiness, traffic and data quality govern progression.

## Pilot release and expansion gate

1. **Usability:** House of EON owner independently completes setup, runs a test, finds an order and pauses negotiation; record observed time, errors and help requests. Suggested goal ≤15 minutes after store connection and commercial data are ready; agree the target before evaluation.
2. **Functional:** genuine staging payment, signed paid webhook and reconciliation succeed; then at least one production paid order is traceable through assignment/session/offer/checkout/order. One order proves plumbing, not conversion lift.
3. **Economics:** zero floor or budget breaches; actual cost/tax basis reconciles; non-negative incremental contribution within the agreed experiment threshold. Refunds, credits and gifts count as costs/liabilities.
4. **Incrementality:** freeze an experiment plan before launch using EON's baseline conversion, a minimum detectable lift, sample-size/power calculation and observation window. Compare intention-to-treat visitors with sticky control/treatment assignment. Report intervals; if underpowered, say inconclusive and do not expand on anecdotal sales.
5. **Owner confidence:** owner understands dashboard definitions, finds useful insights, approves ongoing operational effort and signs off expansion.

Pause immediately on incorrect totals, floor/stock violations, attribution failures, provider failures above the approved threshold or owner override. Continue EON iteration if lift is negative/inconclusive. “Recovered revenue” is attributed paid recovery revenue; incremental recovery requires a holdout.

## Next implementation work

Merge the sandbox components into authenticated onboarding; do not wire client fixture logic to public shopper traffic. Integrate server modules with the existing transactional live service. Apply migration 006 to an isolated Neon development branch only after SQL/isolation tests. Build real cohort analytics and recovery worker before pilot activation. Production remains disabled until signed-off gates pass.
