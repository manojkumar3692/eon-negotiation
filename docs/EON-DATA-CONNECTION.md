# Smart negotiation and the EON data connection

## Confirmed locally

Inspected 21 September 2026: `/Users/manoj/Downloads/houseofeon-mini-store` is a Next.js storefront using Supabase, Razorpay and Delhivery. This is local source evidence; deployed schema, data completeness and production configuration have not been verified.

- `lib/products.ts` and `lib/pricing.ts`: catalog/pricing currently come from code, not necessarily a products database table. Pricing defines ₹1,249 base, ₹999 single-unit promotional price, and ₹799 per unit for a cart of two or more perfumes.
- `lib/order.ts`: calculates item prices using total cart quantity.
- `app/api/orders/create/route.ts`: writes order items, subtotal, coupon discount, final amount, pincode, payment type/status and inventory reservation reference into Supabase `orders`.
- `lib/inventoryServer.ts`: calls `reserve_storefront_inventory` and `release_storefront_inventory_reservation`. Enforcement is gated by `INVENTORY_ENFORCEMENT_ENABLED`; neither its enabled state nor the underlying live stock schema was verified.
- `lib/delhivery.ts`: shipment creation and pincode serviceability checks exist. A dependable pre-checkout freight-rate quotation was not established by the inspected code. Serviceability is not a shipping-cost quote.
- OpenAI key and model found in EON's local environment configuration. Only these two settings were copied to the negotiation project's ignored, owner-readable `.env`. A synthetic live request successfully extracted ₹900 and produced the guarded sample counteroffer ₹959.04. No production customer data was sent.

## Product behavior

Inventory, sales history and delivery economics belong in Stage 2. The current three-round discount schedule is only a test fixture. Replace it with a policy-driven decision using merchant facts:

| Signal | Required fact | Example effect |
|---|---|---|
| Inventory | Available-to-sell units after reservations, stock age and snapshot time | Excess/aging stock can allow a larger concession; scarce stock a smaller one |
| Sales velocity | Fulfilled/paid units over a defined window, accounting for refunds and incomplete COD collection | Slow movement can increase discount flexibility |
| Last sold price | Most recent comparable net unit price with date, quantity, promotion and payment context | Useful evidence, never an unconditional price floor |
| Recent sales distribution | 7/30-day median/range/sample count for comparable sales | Reduces dependence on one anomalous order |
| Delivery location | Pincode/serviceability, origin, package weight, payment method, carrier/rate-card quote and expiry | Higher fulfillment cost reduces available discount; unsupported pincode prevents a purchasable quote |
| Merchant economics | Approved costs, tax basis, payment fees, minimum contribution, maximum concession and daily budget | Hard boundary on every counteroffer |

Use location only for actual shipping/serviceability economics, not inferred buyer wealth. Ask for pincode before a delivery-inclusive offer. Before location is known, display item-only pricing without a free-shipping promise, or use an owner-approved conservative reserve.

Calculate contribution on a consistent tax basis: net item revenue + net shipping collected − COGS − packaging − carrier cost − payment fees − agreed returns allowance. Solve for a price that meets minimum contribution; percentage payment fees and tax must be included correctly. Never treat a last sold price or a model suggestion as proof that an order is profitable.

For comparable historical price, exclude cancelled/test/refunded orders and distinguish partially collected COD. Allocate order-level discounts to line items using a documented integer rounding method. Keep bundles, launch coupons, trial credits, shipping and taxes distinct. Sparse or unreliable history falls back to approved policy without invented statistics.

## Recommended integration

Our negotiation service calls a small authenticated connector inside EON's existing backend. That connector reads EON's own database/catalog/shipping systems and returns a bounded merchant-context response. EON retains its database credentials. Our platform stores its own merchant policies, sessions, quotes and analytics in a separate Supabase project.

Flow: shopper widget → negotiation service → EON connector → EON catalog / Supabase / shipping source → negotiation policy decision → approved quote → EON checkout → verified order events.

This solves differing merchant database schemas: EON implements our connector contract once; future stores implement the same contract using their systems. Direct database access through a restricted read-only view is an optional merchant-approved alternative, but should not become the default platform dependency. If used, enforce both object grants and row policies: https://supabase.com/docs/guides/api/securing-your-api

## Proposed connector contract (not implemented)

`POST /api/integrations/negotiation/context`

Input: product/variant ID, quantity, optional pincode, payment method, session/cart reference. Merchant identity is derived from the authenticated installation. Output: schema version, context ID, variant, quantity, currency, authoritative current applicable price, available-to-sell stock, inventory age/velocity if known, comparable-sale aggregates, shipping quote/reference/expiry, approved economic constraints or a computed minimum price, observedAt and validUntil. Missing facts must be explicit null/unknown, not zero. No names, phone numbers, full addresses, payment details or raw order history.

`POST /api/integrations/negotiation/checkout`

Input: approved offer reference plus session/cart identity. EON obtains/verifies the immutable approved offer server-to-server, rechecks product, quantity, pincode, payment method, stock and current promotion exclusions, reserves inventory and creates the existing Razorpay order at the authorized total. Never accept a browser-supplied negotiated amount. Persist negotiation offer/redemption IDs with the order; retries return the same checkout through idempotency.

`POST /v1/integrations/eon/events` on our platform

Receive authenticated inventory/order/refund events with unique event IDs and bounded non-personal fields. Update snapshots and aggregates idempotently. Reconcile periodically to catch lost events. Payment/order events must originate from EON's verified lifecycle; a widget callback is not payment proof.

Use per-installation credentials over TLS, scoped permissions, timestamped signatures of exact raw requests, replay protection, key rotation and endpoint rate limits. Validate responses with a strict schema. Do not transmit merchant API secrets or private economic facts to OpenAI. The model understands the conversation; the backend uses the full facts to authorize prices. Future AI strategy selection may propose an allowed concession action, but a deterministic validator must enforce the same boundaries.

## Freshness and safe execution

Start with catalog/inventory snapshots no older than an owner-approved limit (proposed five minutes), transaction-time stock checks/reservation on acceptance, and shipping quotes within their own expiry. Bind a quote to the cart, pincode, shipping option and payment method; any change requires a fresh quote. A historical summary can update less often, with its window and sample count recorded. Missing/stale costs or unavailable stock checks must not be replaced with fictional live values.

## Next build sequence

1. Verify EON's deployed stock schema, flags, order statuses, tax basis and cost/rate sources with its existing backend. Read only the necessary metadata/aggregates; no production write is needed for discovery.
2. Implement authenticated context connector in EON; contract-test the adapter in our separate project.
3. Add a contextual decision engine and server audit of input snapshot/policy/decision. Test same target under high stock, low stock, high shipping cost, missing history and stale facts. Fixed fixture pricing remains explicitly demo-only until then.
4. Connect the shopper widget, including pincode and quote conditions, to the contextual engine.
5. Integrate accepted offers into EON checkout, preventing unintended stacking with existing launch, bundle and trial-credit rules. Add reservation, payment, cancellation and refund reconciliation.

No EON source files, live database records or checkout behavior were changed in this investigation. Smart inventory/history/shipping pricing is now specified against the actual codebase; it is not yet implemented or connected.
