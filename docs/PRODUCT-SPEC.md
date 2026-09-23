# EON Negotiation — House of EON validation specification

> Live dashboard update: see [the integrated release status](LIVE-DASHBOARD-RELEASE.md). Authenticated saved controls now supersede the earlier sandbox-only status below. Checkout/channel limitations remain explicit.

Decision, 23 September 2026: EON is a conversion layer. House of EON is the only validation client until usability, real checkout, attributable paid orders, contribution protection and credible incremental value are demonstrated. The user confirmed EON remains on Neon database/Auth; House of EON retains Supabase. JavaScript, Next.js, Vercel and GitHub remain the application stack.

This specification and ROADMAP.md supersede the earlier platform-first pause and MVP exclusions. Existing production safeguards remain. No new merchant recruitment, multi-client rollout or agent-commerce claims before the pilot gate. Code may remain tenant-aware and platform-independent.

## Coverage and delivery status

“Scaffold” means executable domain logic or documented interface, not a production-integrated feature. The new `/pilot` route is an offline merchant planning and testing studio, deliberately separate from authenticated `/dashboard`. Existing live code remains the price-only engine until the new modules pass integration acceptance.

| # | Product area | Current live-dashboard implementation | Remaining dependency |
|---|---|---|---|
| 1 | Entry points | Saved product/chat/cart/exit/recovery/page/API controls; configuration-aware website widget | Platform-specific checkout and channel adapters |
| 2 | Selective invitations | Saved thresholds, server eligibility checks, cooldown and holdout | Reliable cross-device identity and richer first-party events |
| 3 | Eligibility | Behavior/cart/stock inputs and explicit states; per-product launch exclusions | Trusted customer/campaign enrichment from merchant |
| 4 | Concessions | All concession types selectable, costed and server-testable | Price-only live adapter; each additional term needs checkout enforcement |
| 5 | Public pricing | Public catalog remains unchanged; shipping baseline separated from concessions | Merchant cost/tax consistency validation |
| 6 | Merchant console | Saved per-product boundaries and four strategies on real catalog | Owner-approved costs/floors, not guessed values |
| 7 | Learning | Data threshold, recorded cohorts and review gate in Optimize | Sufficient verified orders, calibrated model and actionable evidence |
| 8 | Funnel | Actual started/accepted/checkout/paid/refund totals, recovery attribution and top products | Full-price/control order events and cost snapshots for measured lift/margin comparisons |
| 9 | Deal Score | Safe candidates ranked and explained in saved server tests | Validated conversion probability after enough data |
| 10 | Natural language | Existing live AI and numeric fallback; saved request/rule tests | Rich non-price intent/checkout contract; test interpreter is bounded and offline |
| 11 | Trigger rules | Persisted visits/dwell/cart/stock/cooldown/exclusions and surfaces | Native platform event adapters where not supplied by widget |
| 12 | Recovery | Saved consent-first settings, one-use expiring grants and recovery landing | Ready checkout plus authorized email/WhatsApp provider; no automatic outreach |
| 13 | Channels | Existing custom/Shopify connection and clear future-channel state in EON Connect | Other platform adapters and supported DM/agent APIs |
| 14 | Modules | Five named modules in authenticated dashboard, persisted configuration, server logic | Continue consolidating legacy controls and richer commerce capabilities |

## Merchant experience

Plain-language setup: Your store → Choose products → Price boundaries → Allowed extras → When to invite → Try a negotiation → Launch review → Your results. Show sensible defaults, a short explanation of each boundary and a customer preview. Hide advanced settings behind disclosure. Show what has saved, what is draft, the active policy version and how to pause. Never show “Connected” or “Live” for a planning selection.

Core promise: the owner controls list/target/floor, permissible extras and exposure. Protect Margin emphasizes contribution; Balanced weighs contribution and shopper request; Maximize Conversion favors request fit within identical hard limits; Clear Inventory favors approved quantity/bundle offers on verified excess inventory. Strategy is not permission to breach a floor.

## Commercial definitions

Store money as safe integer minor units with currency, quantity and tax basis. Public price is consistent. The sandbox treats entered prices as tax-inclusive, uses fictional fixed shipping, and has no tax engine. Production must compute comparable net-of-tax economics.

Item floor is protected after shipping subsidy, payment fees, gifts and credit liability. Separate minimum contribution = net revenue minus product cost, shipping cost, fees, gift/bundle cost, credit liability and variable service expense. Discount cap, round cap, daily concession budget, stock and provider capabilities are additional constraints. Do not stack public coupons unless explicitly modeled and verified at checkout. If required cost or capability is unknown, suppress that concession.

Approved geography differences must be explained as actual shipping/tax/service costs; device, inferred wealth, protected traits and hidden willingness-to-pay must not set prices. Acquisition can govern campaign eligibility but never secretly rewrite list prices.

## House of EON configuration

`config/house-of-eon.js` contains fictional, editable INR examples, sample SKU identifiers and no live approval. Arctic Wave and Trial Pack each need confirmed product/variant IDs, selling price, target, floor, landed cost, stock, tax basis, shipping zones, payment fees and sample/credit terms. Trial credit validity/redemption scope must be explicitly approved; no real credit entitlement is assumed.

Initial launch: selected Arctic Wave SKU, product/dedicated entry point, price-only if that is the only verified checkout capability; then shipping, quantity and other concessions one at a time. Trial Pack joins after its economics and credit rules are approved. Recovery follows a successful paid-order path. All 14 areas remain committed scope, but unsupported concessions stay off.

## Security and operational controls

Authenticate merchants and check ownership in every privileged transaction. Shopper clients receive public quote projections only. Server verifies product/cart/history, limits sessions by merchant + pseudonymous visitor + IP bucket, enforces maximum body size/turns/model spend, and persists distributed counters. Existing global count limit is not a complete distributed abuse defense.

Version policies; record actor, reason and before/after references. Merchant can pause invitations, revoke offers and override terms only by publishing a new valid policy, never bypassing a floor silently. Expiring random tokens are hashed at rest, bound to tenant/session/cart/offer, and never logged or placed in analytics. Recovery token consumption is POST-only to avoid email preview scanners consuming it. Accepted checkout retries return the same provider outcome. Signed webhooks are deduplicated; payment/cancellation/refund transitions must tolerate out-of-order delivery.

Kill switch and `NEGOTIATION_ENABLED=false` remain until rollout checks pass. Sandbox events and orders never enter production analytics. Recovery requires permission, channel opt-out, frequency cap and suppression after purchase. Minimize PII; retain pseudonymous behavioral events for a configured period and redact free text before analytics. Do not send outreach as part of implementation.
