# Product roadmap

> Current priority: build the standalone platform database, merchant dashboard and data-connection contract first. Further EON integration is paused. See [platform-first plan](PLATFORM-FIRST-PLAN.md). Earlier integration-first sequencing below is historical.

See `SMART-NEGOTIATION-PLAN.md` for the expanded prioritized capability map and concrete first integration test.

## Updated Stage 2 requirement

Inventory, comparable recent sales and shipping-location economics are required for the smart Stage 2 engine. The fixed concession schedule below describes the initial fixture, not the final policy. Follow `EON-DATA-CONNECTION.md` for the verified local data sources, connector contract and implementation sequence.

## Product decision

Build Stage 2 first: an optional “Make an offer” experience on eligible product pages. A customer proposes a price, receives an approved counteroffer, accepts it and completes the merchant's existing checkout. The engine is reusable across merchants; EON is the pilot tenant, not a hard-coded platform dependency.

Success means increased contribution profit per eligible visitor, not merely more accepted offers. The AI explains and understands; the pricing service owns every commercial decision.

## MVP scope

Include INR, quantity one, selected in-stock perfume variants, three rounds, a 15-minute session, explicit expiry, context-sensitive concessions (inventory, comparable sales and shipping economics), merchant floor and discount cap, daily subsidy cap, kill switch, checkout handoff, payment reconciliation, merchant login and a compact performance dashboard. The customer sees item price and any conditions before accepting; shipping/tax totals are finalized by the merchant checkout. Use existing EON checkout if its backend can enforce the offer securely.

Merchant workflow: connect catalog → enter validated floor/cap/budget per variant → preview price scenarios → publish policy version → enable a small traffic cohort → inspect paid orders and margins → pause instantly if necessary.

Customer workflow: eligible product → start session → type request or numeric offer → confirm extracted price if ambiguous → deterministic decision → accept current quote → server creates checkout → pay → verified webhook records purchase.

Exclude bundles, quantity bargaining, multiple currencies, automatic free shipping, COD-specific incentives, customer-specific willingness-to-pay scoring, autonomous purchasing, cross-store agents and Shopify app marketplace distribution. Do not promise prepaid-only pricing unless the actual checkout can enforce it. English first; add Hindi only after evaluated intent parsing.

## Phases and acceptance gates

Estimates assume one full-time developer with timely merchant access; discovery may change them.

| Phase | Estimate | Deliverables | Exit gate |
|---|---|---|---|
| 0: discovery | 2–3 days | Confirm EON stack, catalog/variant IDs, tax basis, costs, checkout APIs, stock, permissions and owner-approved policy | One sandbox order proves server-controlled amount and webhook verification |
| 1: foundations | 1 week | Supabase projects, auth, migrations, tenant isolation, catalog sync, versioned policy editor, audit | Cross-tenant and unauthorized policy tests pass; stale catalog fails closed |
| 2: Stage 2 experience | 1 week | Embedded widget, durable sessions, structured AI intent extraction, deterministic pricing, expiry, abuse controls | Model cannot change prices; retries and parallel requests cannot add rounds |
| 3: checkout | 1–2 weeks | Offer acceptance transaction, budget reserve, outbox worker, EON adapter, signed webhooks and recovery | Replay, changed cart, duplicate payment, failed provider and refund tests pass |
| 4: controlled pilot | 1–2 weeks | Feature flag, dashboard, control cohort, operational alerts and support procedure | No guardrail breaches; contribution per visitor meets predeclared success rule |
| 5: expand Stage 2 | 2–4 weeks | More EON variants, multi-merchant onboarding, optional Shopify adapter, language evaluation | Second merchant onboarded without changing rules engine |
| 6: Stage 3 | separate discovery | Authenticated agent quote/accept API, consent receipts, quotas, protocol adapters | An actual partner agent completes authorized sandbox flow |

Do not schedule Stage 3 as a promise that ChatGPT will discover a custom negotiation endpoint. Protocol availability, negotiation extension support and platform onboarding must be validated separately.

## Pilot and analytics

Assign eligible visitors to stable control/treatment cohorts before widget exposure; start with a small cohort (e.g. 10% of eligible traffic), retaining a control group. Fix policy versions during each experiment. Compute a sample-size plan using EON baseline conversion before interpreting results; no fixed promised uplift or significance from tiny samples.

Primary metric: contribution profit / eligible assigned visitor. Contribution = net revenue excluding tax − COGS − fulfillment − payment fees − shipping subsidy − refunds/returns allowance − AI and variable service cost. Floor setup must use the same tax/cost basis. Compare treatment against control; account for customers who would have bought at full price.

Secondary metrics: widget start / exposure; offers / session; accepted / sessions; verified paid / accepted; paid orders / eligible visitors; average discount vs actual current selling price; revenue/order; checkout failures; refund rate; latency p50/p95; model cost/session. Never equate a checkout redirect with revenue.

Events: experiment_assigned, widget_viewed, session_started, intent_parsed, clarification_required, offer_created, offer_accepted, offer_expired, checkout_requested, checkout_ready, payment_confirmed, payment_failed, refund_recorded, policy_published, guardrail_denied, rate_limited. Each uses event ID, merchant ID, pseudonymous visitor/session ID, channel, policy version, variant ID, experiment arm, UTC timestamp, schema version and request correlation ID. Financial events originate server-side; validate any browser event. Dedupe payment events by provider order/payment IDs.

Operational targets for pilot: zero below-floor orders, zero duplicate redemptions; rule processing p95 under 200 ms excluding network; conversational response p95 under 3 seconds with template fallback; checkout failure below 1%. Targets are launch criteria to validate, not measured claims. Pause on any margin breach or signature verification anomaly; investigate a material failure spike.

## Decisions required before the live pilot

EON owner confirms backend and access, authoritative variant/stock feed, actual floors/costs and tax treatment, shipping/discount stacking policy, daily subsidy budget, refund process, customer support owner, data retention and pilot cohort. Until then all sample economics remain disabled in production.
