# Smart negotiation: capability roadmap and first EON test

> Current priority: build the standalone platform database, merchant dashboard and data-connection contract first. Further EON integration is paused. See [platform-first plan](PLATFORM-FIRST-PLAN.md). Earlier integration-first sequencing below is historical.

## Product promise

A merchant-controlled AI sales assistant that can understand a shopper's needs, select an economically sensible offer using current merchant facts, explain the offer, and hand it to an enforceable checkout. House of EON is the first merchant; it is not the platform itself.

The live OpenAI intent test has passed. The business-aware decision engine, EON connector, durable production sessions and enforceable checkout are not complete. The next milestone is a local/sandbox EON integration, not a production launch.

## Capability map

Priority A = first EON test. B = production pilot requirements. C = subsequent Stage 2 expansion. D = Stage 3. Proposed capabilities below are not claims of implemented functionality.

| Capability | What it does | Data or dependency | Priority |
|---|---|---|---|
| Natural-language negotiation | Understand target price, rejection and clarification; retain conversation context | Structured AI intent and validated state | A |
| Explicit quote acceptance | Let a shopper accept a current counteroffer without spending another bargaining round | Current quote ID, state transition and idempotency | A |
| Inventory-aware concessions | Adjust flexibility for available-to-sell stock and scarcity | Authoritative stock minus reservations; freshness | A |
| Sales-history-aware strategy | Use last comparable sale, recent median and sample count | Net line prices; promotion/quantity context; refunds/COD handling | A |
| Sales velocity and stock age | Allow controlled clearance of slow-moving stock | Reliable stock age, recent units sold and replenishment context | C; use only if verified in A |
| Delivery-aware economics | Ask for pincode and account for freight/serviceability | Verified carrier quote or merchant-approved rate card | A |
| Margin protection | Respect minimum contribution after costs and taxes | Approved costs, fees, tax basis and minimum profit | A |
| Existing offer awareness | Compare against actual applicable store promotions | EON launch, bundle and trial-credit rules | A |
| Honest price presentation | Show item price, shipping, total or clearly pending charges | Consistent checkout calculation | A |
| Product-grounded answers | Answer product questions from verified catalog facts | EON catalog; no invented stock/performance claims | A |
| Price too low | Decline politely, hold the best allowed quote or show a suitable alternative | Policy-approved actions and catalog | A (decline/hold); C (alternatives) |
| Expiry and stock changes | Revalidate quotes and explain changed availability | Quote TTL, revision, reservations | A |
| Resilient fallback | Continue with numeric offers or normal checkout when AI/data fails | Deterministic fallback and truthful UI | A |
| Explainable decisions | Record why a concession changed for merchant review | Input snapshot, policy version, decision reason | A |
| Multi-tenant merchant connection | Connect another merchant without rewriting the engine | Versioned connector contract, scoped credentials | B |
| Merchant dashboard | Manage products, floors, limits, pause/resume and audit | Supabase Auth, roles and immutable policies | B |
| Durable sessions and budgets | Persist rounds, quotes, acceptance and subsidy reservations | Supabase transactions, locking and idempotency | B; acceptance tests in A may use isolated local storage |
| Abuse and coupon protection | Prevent session farming, replay and unauthorized stacking | Distributed limits, signed bootstrap, checkout binding | B; boundary tests in A |
| Verified payment analytics | Attribute actual purchases, refunds and margin | Authenticated order events and reconciliation | B |
| Fair experiment | Compare contribution per eligible visitor with a control cohort | Stable assignment and a sufficient sample | B |
| Bundle/quantity negotiation | Offer a better total for a merchant-approved combination | Line-level allocation and quantity-aware costs | C |
| Alternative products/sizes | Suggest an affordable suitable substitute when price cannot move | Stock, attributes and user preference | C |
| Non-price offers | Offer approved samples, gift wrap or shipping benefit | Benefit costs, stock and checkout enforcement | C |
| Payment-method incentives | Offer prepaid savings if they reflect merchant economics | Actual payment selection enforced at checkout | C |
| Loyalty and returning customers | Honor a transparent merchant loyalty benefit | Verified eligibility and explicit program rules | C |
| Cart-level optimization | Choose the best permitted combination across items and offers | Cart optimizer and non-stacking rules | C |
| Save/resume an offer | Restore an unexpired authenticated negotiation | Secure session continuity; no hidden TTL extension | C |
| Abandoned negotiation recovery | Send an opted-in reminder or resume link | Consent, channel integration and frequency limits | C |
| Human handoff | Escalate unusual, bulk or corporate gifting requests | Merchant queue and explicit contact consent | C |
| Hindi/multilingual conversation | Understand language-specific prices and intent | Evaluated extraction, language-specific approved messages | C |
| Merchant campaign rules | Seasonal campaigns and controlled clearance windows | Scheduled approved policies and inventory facts | C |
| Strategy recommendations | Suggest better policies from aggregate outcomes | Enough clean data, offline evaluation, merchant review | C |
| Bounded AI strategy selection | AI proposes an allowed action; validator checks all economics | Approved action set, evidence and adversarial tests | C |
| Additional storefront channels | Reuse service on another web stack or opt-in messaging channel | Channel adapter and equivalent auth/consent | C |
| Agent-to-agent quotes | Authenticated buyer agents request and accept offers | Delegation, scoped access, consent and tested protocol adapter | D |

Do not infer wealth from location, invent urgency, promise unapproved benefits, expose private floors, or let the model autonomously loosen policy. Location affects real fulfillment economics. Adaptive strategy must not create a race to the bottom from repeated concessions.

## First EON integration: sequence

1. **Use an isolated EON checkout.** Inspect project instructions and current branch; preserve ongoing EON work. Read our separate platform at `/Users/manoj/Documents/eon-negotiation`. Do not copy its `.env` into tracked files or commit keys.
2. **Verify the data contract.** Map EON catalog and promotions, inventory RPCs/tables, comparable order aggregates and shipping quote sources. Use minimum read-only production metadata if needed and authorized; tests use synthetic data. Unknown stock/cost values remain unknown.
3. **Build the connector and contextual engine.** EON exposes authenticated bounded context; our reusable engine decides within merchant limits. No browser gets the EON database service key. Engine lives in the platform project; EON owns its data adapter and checkout integration.
4. **Build a local test experience.** Add an opt-in test page/widget to EON, disconnected from public rollout. Shopper chooses product, enters pincode, negotiates and explicitly accepts an offer. Show source freshness and decision reasons only in a developer/merchant test panel.
5. **Exercise checkout safely.** Connect to a payment test account only if its credentials are verified as test-mode, or use an explicitly labelled checkout simulator. No real payment, production order, email, WhatsApp message, stock reservation or Delhivery shipment during the test. Verify quote/cart/amount/expiry binding, acceptance replay and refund-event handling with fixtures.
6. **Record evidence and remaining gaps.** Run tests and a browser walkthrough. Deliver the test URL, source mapping, screenshots when available, results and deployment gates. A simulated checkout must not be reported as a real provider integration.

## Test matrix

| Scenario | Expected result |
|---|---|
| Same target with high vs scarce inventory | Policy-approved flexibility changes; hard floor never breached |
| High vs low carrier cost | Contribution protected; no invented free shipping |
| Missing pincode | Ask for location or clearly quote item-only pricing |
| Unsupported destination | No purchasable shipping-inclusive quote |
| Recent bundle sale below single price | No accidental single-item price anchoring |
| Sparse history / refunded sale / partial COD | Evidence qualified or excluded; no fabricated statistics |
| Existing coupon or trial credit | Best applicable permitted path; no unauthorized stacking |
| Stock changes or shipping quote expires | Refresh or reject before acceptance/checkout |
| Shopper accepts latest counteroffer | One redemption; no extra bargaining round required |
| Replayed, concurrent or changed-cart acceptance | Idempotent result or explicit rejection |
| AI outage, ambiguous price or malicious instructions | Safe fallback/clarification; no change to policy |
| Changed pincode/quantity/payment method | Quote recalculated and buyer reconfirms |
| Synthetic payment success/failure/refund | Correct event and budget state; no real fulfillment |

## Definition of ready

Ready for a local integration test: connector fixtures and UI can exercise all core decisions with an explicit simulator. Ready for a payment-provider sandbox test: verified test credentials and isolated order storage exist. Ready for a live pilot: real economics are approved, durable auth/transactions/budgets/stock/checkout enforcement pass, callbacks are verified, reconciliation works, and the merchant rollout flag is deliberately enabled after review. These are different milestones.
