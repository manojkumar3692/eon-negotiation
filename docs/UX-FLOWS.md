# Merchant and shopper flows

## Merchant setup

| Step | Plain-language task | Safe default and validation | Continue condition |
|---|---|---|---|
| Your store | Choose custom website or Shopify; connect and verify ownership | Default House of EON; show pending connection, scopes and actionable errors | Verified connection or explicit sandbox path |
| Choose products | Import catalog; choose Arctic Wave / Trial Pack variants | Imported floors equal public prices until reviewed; no guessed live SKU | At least one selected variant with currency/stock |
| Price boundaries | Public, preferred, absolute minimum and cost | Minimum ≤ preferred ≤ public; integer money; explain tax/cost basis | Owner-approved economics, no unknown mandatory costs |
| Allowed extras | Enable price, shipping, samples/bundles, quantity, payment/credit terms | Only supported/enforceable capabilities; all costs count | Every enabled extra has terms, cost and enforcement |
| When to invite | Choose visits, dwell, cart and recovery conditions | Do not prompt every visitor; exclude new launches, low stock and cooldown | Valid trigger version and frequency cap |
| Try a negotiation | Simulate requests and adverse scenarios | Clearly marked sandbox; show customer-facing total, terms and expiry | Passed below-floor, no-stock, expiry, unsupported-term and happy paths |
| Launch review | Read concise summary; choose controlled cohort; activate | Disabled until connector, verified payment, policy, consent and experiment gates pass | Authenticated owner explicitly activates |
| Your results | See funnel, paid orders and contribution | Empty state until verified events; distinguish estimates and facts | Owner can inspect an order and pause |

Production wizard saves drafts per step, allows backtracking, never publishes automatically, and warns before losing unsaved changes. Saving invalid input retains the field and focuses the error. Surface accessibility: keyboard focus, visible labels, screen-reader status messages, mobile single-column layout and no color-only status. Sandbox exports a JSON plan; it does not impersonate durable server saving.

## Shopper

Eligible invitation → discreet “Still deciding? Let’s find a deal” → bounded conversation → clarify amount/quantity/shipping/payment → view exact total and terms → accept → one checkout → verified payment. Floor/cost/budget never appear. Rejected requests receive an approved alternative or a polite unavailable state, not an invented discount. Preserve public-price purchase path. Limit dismissals and repeat invitations.

Exit intent is a desktop hint, not a reliable mobile close prediction. On mobile prefer cart hesitation or dwell. No prompt blocks leaving. Cart changes require a new quote. If price, stock or terms change, explain and ask for renewed acceptance; never silently switch the offer.

## Recovery

Consented abandoned cart → wait agreed delay → recheck no purchase and opt-out → send one invite within frequency cap → link landing explains store and expiry → POST exchange of one-use token → fresh eligibility and negotiation → new accepted checkout. Expired links offer a normal store link, not a revived discount. Email previews must not consume a grant. No channel outreach is sent by the scaffold.

## Error, pause and override

Unknown stock/cost → “We can’t make an offer right now.” AI outage → numeric request fallback. Unsupported shipping/sample/payment term → describe available options without pretending checkout can enforce it. Duplicate acceptance → same checkout. Expired/superseded quote → test a fresh offer. Merchant pause → stop invitations and new accepts; reconcile already-created orders. Owner may publish a replacement valid policy, revoke future offers and see the audit reason.

## Validation exercise

Observe the EON owner without coaching: select two products, set safe boundaries, test a low offer, understand why a first visitor gets no invitation, locate recovered paid revenue, and pause. Record confusion, completion time and incorrect assumptions. Resolve material issues before production. The `/pilot` studio is the reviewable starting point, not proof of usability from actual testing.
