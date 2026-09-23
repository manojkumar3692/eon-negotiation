# Measurement from the first live session

## Event contract

Server envelopes: `eventKey`, `schemaVersion:1`, `workspaceId`, `mode:sandbox|live`, `visitorKey`, `assignmentId`, `sessionId`, `quoteId`, `type`, `occurredAt`, `properties`. Server generates trusted timestamps and validates ID ownership. Stable keyed-hash visitor IDs; never email/phone/IP or raw messages in event properties. Dedupe on `(workspace_id,event_key)`. Browser exposure telemetry is untrusted; monetary events come from verified server/webhook state only.

Events: `eligibility_evaluated`, `experiment_assigned`, `invitation_shown`, `invitation_dismissed`, `negotiation_started`, `intent_confirmed`, `offer_created`, `offer_accepted`, `checkout_created`, `order_paid`, `order_cancelled`, `order_refunded`, `recovery_invited`, `recovery_opened`, `policy_published`, `merchant_paused`. Funnel ordering can arrive late; join by IDs and occurrence time, not arrival order.

## Dashboard definitions

| Metric | Definition / caveat |
|---|---|
| Started | Distinct live sessions with negotiation_started |
| Accepted | Distinct sessions with accepted valid quote; never count as revenue |
| Paid conversion | Distinct assigned visitors with verified paid orders / eligible assigned visitors; include full-price orders in each arm |
| Accepted-to-paid | Distinct paid quote-linked orders / accepted quote sessions |
| Attributed negotiated sales | Net paid revenue attached to accepted quotes, minus refunds, excluding tax; not automatically incremental |
| Recovered sales | Paid recovery-linked orders after recorded abandonment within agreed attribution window; separate holdout for incremental recovery |
| Average concession | Total price reduction + shipping subsidy + gift cost + credit liability / paid negotiated orders; show components |
| Contribution | Net revenue − COGS − fulfillment − payment fees − shipping subsidy − gift/credit liability − variable AI/service costs; avoid double counting shipping |
| Contribution lift | Treatment contribution / assigned visitor minus control equivalent, with uncertainty |
| Margin vs coupons | Modeled same-cart coupon benchmark unless randomized coupon cohort exists; label estimate |
| Best / worst concession | Paid conversion and contribution by deal type, sample count and interval; “insufficient data” for small groups |
| Best products | Incremental contribution and attributable order counts by SKU; don't rank solely by acceptance |

Freeze attribution window (proposed 7 days for recovery), identity rules, refund maturity and experiment duration before pilot. Exclude sandbox, staff and bot traffic. Purchase visitors belong to their original arm even when they decline negotiation. Record full-price purchases in both groups; otherwise lift is biased. Monitor AI/session cost, provider errors, expiry, response latency, floor violations and grant replay attempts.

## Learning gate

Heuristic Deal Score is not probability. Current ranking considers contribution, request fit and excess-inventory quantity priority. Conversion probability/customer value inputs are future validated model features, not inferred wealth. Require an agreed sample-size plan and minimum data threshold (scaffold default 100 completed orders is a review trigger, not proof of significance). Propose, explain and ask the merchant to publish a version; never silently relax floors. Re-test on held-out time windows and monitor policy drift.
