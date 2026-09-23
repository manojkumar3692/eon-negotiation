# Store facts and product invitation pilot

Status: implemented locally; not deployed. Migration 008 must be applied before this application version. House of EON must still update its connector and complete checkout/payment acceptance. The contract is reusable for any tenant; no brand, prices, product IDs or coupon rules are hardcoded in production logic.

## Merchant flow

1. Connect and sync the store. EON Rules separates regular price, current selling price, shipping and advertised coupons. A legacy single-price import is labelled Needs confirmation and cannot launch. Product costs, preferred deal prices and private minimums remain merchant-owned.
2. Review imported shipping and choose Use imported shipping policy. It never overwrites approved costs automatically. Free customer shipping still requires the merchant delivery cost for margin calculations.
3. Choose one product, approve costs and limits, save and run a rule test.
4. EON Trigger includes an interactive customer preview. Choose Both repeat visits AND time on this visit, e.g. two views and 45 seconds. The preview does not create a quote/order or bypass readiness.
5. Keep Private testers only selected. Complete the normal connector/checkout checks, then activate. Generate a one-hour tester link for the product URL from Launch review. Install the widget via EON Connect’s developer instructions. The link does not bypass the production kill switch or economic checks.
6. Prove a real paid checkout and refund. Private tester invitation events are sandbox events, not customer experiment evidence. A real tester checkout is still a real order in the existing paid-order funnel. Do not interpret this as measured conversion lift.
7. Only after validation choose Eligible customers. Customer assignment follows the configured treatment percentage; control visitors receive no invitation.

## House of EON merchant-approved price presentation

Arctic Wave retains a ₹1,249 regular price and ₹999 current selling price. The storefront, ordinary cart and checkout must use ₹999 until the shopper explicitly enters an eligible EON20 code; that code produces ₹799 for the approved single-bottle case. Do not auto-apply the code or replace the default product price with ₹799 for the negotiation integration. Removing the code restores the ordinary ₹999 price. Other product pricing remains merchant-owned.

The connector imports regularMinor=124900 and sellingMinor=99900 separately from coupon metadata. It evaluates only the submitted coupon context with authoritative eligibility, rounding and payable totals. A negotiated checkout uses its signed agreed amount with no additional coupon stacking. No private cost or minimum is inferred from the coupon amount.

## Catalog extension (connector v3)

All money is integer minor units in the envelope’s store currency. Existing `priceMinor` must mean the current selling price, not MRP. Keep it for compatibility and add `pricing` to every item:

```json
{
  "productId": "STORE_PRODUCT_ID", "variantId": "STORE_VARIANT_ID",
  "sku": "SKU", "name": "Product name", "currency": "INR",
  "priceMinor": 99900,
  "pricing": {"regularMinor":124900,"sellingMinor":99900,"taxBasis":"inclusive","source":"store.product.pricing"},
  "availableToSell": 20, "fulfillmentType":"physical", "updatedAt":"2026-09-23T00:00:00Z"
}
```

Add `storeTerms` beside `items` and `nextCursor` on every catalog response page:

```json
{
 "shipping":{"mode":"free","customerChargeMinor":0},
 "promotions":{"status":"known","offers":[
   {"code":"EON20","description":"Describe actual eligibility, exclusions and rounding from the store rules","combinesWithNegotiation":"no","expiresAt":null}
 ]}
}
```

Shipping modes: free, flat (customerChargeMinor), threshold (customerChargeMinor + thresholdMinor), calculated, unknown. No merchant delivery expense is inferred from free shipping. Promotions can be known with an empty offers list (explicitly none) or unknown with an empty list. Unknown is never interpreted as none. Promotional metadata is for merchant review; it is never used to authorize a coupon or fabricate its payable amount.

`regularMinor` may be null if not applicable. Missing `pricing` retains backward-compatible catalog import but blocks launch. Tax-exclusive facts can be imported/displayed, but the current pricing engine requires inclusive taxes for live activation. Shopify now maps variant price and compare-at price separately; shipping and coupon discovery still need its adapter extension, so those unknowns remain blocked.

## Exact cart and coupon validation

EON requests the existing signed `context` operation with the actual cart and any entered `promotionCodes`. The customer conversation now has an optional coupon field. The store must validate each code for that cart and supply `promotions.evaluation` when codes are supplied:

```json
{
 "codes":["EON20"], "stackable":false,
 "evaluation":{
  "requestedCodes":["EON20"],"appliedCodes":["EON20"],"rejectedCodes":[],
  "itemSubtotalMinor":79900,"shippingMinor":0,"totalMinor":79900,
  "combinesWithNegotiation":false
 }
}
```

This amount is an illustrative reported store result; EON does not assume a percentage or rounding rule. Every requested code must appear once in appliedCodes or rejectedCodes. The ordinary unitPriceMinor remains the current pre-coupon selling price. Shipping must agree with the context, and totals must add up. EON will not offer a worse payable amount than the evaluated existing promotion. Negotiated checkout uses the approved quote exactly and must not reapply the codes already present in the quote cart. Stacking is deliberately unsupported in this first contract.

## Widget and browser signals

Preferred pilot installation: EON Connect supplies a script tag with the public installation key, external product/variant IDs and currency. No server secret belongs in this tag. Install once per page; an SPA must remount for a new variant. Website CSP must permit the EON script, connect requests and offer iframe. EON-origin /offer pages allow HTTPS embedding.

The widget reads public configuration from GET `/api/widget-config/{publicKey}`. Then it calls POST `/api/trigger/evaluate` on the EON origin with JSON:

```json
{
 "publicKey":"INSTALLATION_PUBLIC_UUID",
 "productId":"STORE_PRODUCT_ID","variantId":"STORE_VARIANT_ID",
 "visitorId":"BROWSER_GENERATED_UUID","surface":"product",
 "signals":{"visits":2,"dwellSeconds":45,"inCart":false,"checkoutHesitation":false}
}
```

In private tester mode the widget also supplies the `testerToken` from the private link fragment; it removes the fragment and retains access only in that browser tab. Tokens are encrypted, scoped to the workspace/product/saved version, and expire in one hour. They contain no approved floors or costs.

Response: `{eligible:false}` or `{eligible:true,invitationToken,expiresAt,presentation:{title,message,button}}`. The invitation lasts ten minutes, is bound to the installation/product/visitor/surface/settings version, and is consumed atomically at session start. No floor, costs or scoring values are returned. A paused/incomplete store always receives false.

The widget renders a small bottom-right invitation card using the returned wording. Clicking opens the EON-hosted conversation in an iframe; the invitation token travels in its URL fragment and is removed on load. The iframe calls same-origin POST `/api/negotiate/start` with the token and exact cart. Do not call this route directly from the merchant browser origin.

POST `/api/trigger/events` receives `{publicKey,invitationToken,event:"shown"}` or `"dismissed"`. EON deduplicates these events and applies cooldown. Only these two event types are public; a browser cannot report payment or revenue. Browser origins must match the configured store domain (HTTPS, apex/www only). Preflight grants no authorization; POST validates the origin and tenant. Request bodies, signal ranges and per-store/per-visitor rates are bounded.

Visits currently mean local product-page views, including reloads, not authenticated customer visits. Dwell is elapsed time on that page, not proof of attention. These browser hints affect invitation eligibility only; fresh signed store context controls all economic decisions. The first supported placement is the product page; deeper cart identity/history/abandonment and campaign enrichment remain separate integration work.

## Payment and checkout

Continue to use the signed backend operations at the store’s registered connector endpoint. EON calls catalog/context/checkout/reconcile; the store posts signed paid/cancelled/refunded events to `/api/webhooks/custom/{installationId}` using the connector kit. The trigger implementation does not replace checkout enforcement, stock reservation, idempotency, or event reconciliation.

## Release sequence (merchant handles deployment)

1. Review local changes and apply `db/migrations/008_catalog_invitations.sql` to the intended production Neon branch. The migration is additive and legacy rows remain unconfirmed. Do not run commands against a guessed database.
2. Deploy this EON version using the normal project deployment flow. No new environment variable is required; tester tokens use the existing connector encryption key with separate binding.
3. Update the merchant connector using this contract, sync again and review the imported facts. Configure limits and perform the private pilot. No existing production settings or live store records were altered by this release’s tests.
4. On rollback, keep the additive migration. Pause negotiation before reverting application code because the older widget lacks the new invitation gates.

Validation: automated contract/trigger/coupon/token tests; isolated Neon migration replay, owner isolation, saved facts, origin checks, private tester gate, exact thresholds, deduplicated impressions, cooldown, concurrent single-use redemption, dismissal and pause; browser preview journey on desktop/mobile. Actual House of EON checkout remains an external acceptance test.

## Shipping-cost fallback clarification

The merchant connector must return `shipping.merchantCostMinor: null` while its delivery expense is unknown; never substitute zero. EON's `constrainContext` now preserves a fresh connector cost (including explicit zero). When that cost is missing, it uses a valid saved `config.shipping.costMinor` only for the merchant-configured free/flat/threshold policies. This expense is per order, not per unit, and is incorporated once by the existing pricing engine. Store/carrier quote mode does not use this fixed fallback.

If neither source provides a cost, it stays null and physical-product pricing is unavailable. The fallback does not change customer shipping, serviceability, rate identity or payment fees; those still come from the store. No new migration is required. This shipping fallback patch requires application deployment after review.

## Custom webhook ordering and retries

The platform now scopes event deduplication to the installation. Full refund is terminal; late paid/cancelled events do not undo it. Cancellation never downgrades paid. A genuine late payment may supersede a failed/cancelled attempt. Reservation state changes with the resulting financial state, not blindly with the received event.

If the checkout is not yet committed/known, EON returns HTTP 409 with Retry-After: 5 and rolls back event deduplication. Keep the event in the outbox and retry the same eventId with a fresh signature timestamp/nonce. Unknown events are not acknowledged as processed. Partial refunds remain a store-side amount until fully refunded; this v3 event contract represents full refunds only. This application-only fix requires deployment and no migration.

## Embedded checkout navigation

After successful acceptance, the EON conversation displays an explicit Continue to checkout anchor with target=_top and an HTTPS destination validated at the connector boundary and again in the UI. A fresh user click navigates the full page, rather than redirecting the nested conversation iframe asynchronously. A noreferrer/noopener new-tab fallback is also available. Acceptance retries reuse one idempotency key for the quote.

If the merchant places the widget in an additional sandboxed lifecycle frame, allow top navigation by user activation and popups/popups-to-escape-sandbox for these deliberate checkout links. Do not navigate a hidden frame to the payment provider. Preserve the exact quote expiry; provider refusal for a short remaining TTL must fail rather than extend it. Provider-account TTL constraints remain a live acceptance check. No real payment was created to validate this UI change.

## Economic capability versus cart readiness

`capabilities.economics: true` means the connector implements the signed economic-context contract. It does not assert that every private cost or floor is known. Unknown store costs/floors remain null; the merchant's approved saved EON Rules supply applicable boundaries. Do not advertise support if the context operation is unimplemented.

EON refreshes capabilities for every cart-readiness test, requires a confirmed import and enabled saved rule with an approved product cost/minimum, applies the delivery-cost fallback, then validates deterministic offer economics. Missing destination/serviceability, expense, stock, unsupported payment/checkout, inconsistent prices or insufficient margin all block readiness. The initial catalog-only floor is not substituted for the saved merchant-approved test floor. This readiness test does not bypass launch gates or create a payment.

## Payment expense semantics (nullable fee)

`context.payment.feeMinor` is the merchant processor expense for the entire order in minor units, not a surcharge to the customer. Return null if unknown. No customer surcharge is not evidence of zero processor expense. A verified nonnegative store fee (including genuine zero) wins; otherwise EON uses only the matching explicitly approved `config.paymentFees.prepaid`, `.partial_cod`, or `.cod` amount. All three default to null. Missing or invalid expense blocks deterministic live pricing and cart readiness. The expense is included once in margin protection and never added as an invented customer surcharge. Merchant-configured values must cover the actual order; use a verified store quote for variable fees.

Update the store's vendored v3 context schema to allow feeMinor:null. Deploy the EON schema/guardrail patch before expecting null-fee responses to pass validation. No database migration is required because saved configuration is JSON; old configurations remain unknown until approved.

## Durable checkout acceptance and invitation handoff

EON now commits a checkout intent, original quote/context snapshot, idempotency key and budget reservation before calling the merchant checkout operation. Network failure leaves this intent pending. A retry uses the same stored quote/key and does not re-read inventory changed by its own reservation. The store must first recover a matching existing quote/key before requiring a new stock/context check, reject rebinding, and still enforce exact expiry. No retry extends expiry or allocates a second budget reservation. Configuration changes or pause continue to block new provider calls. An unresolved attempt stays pending for reconciliation rather than being treated as a successful checkout.

The session lookup retains the verified workspace domain for every subsequent signed connector request. Invitation-backed session eligibility reads the stored invitation signals explicitly, so an offer-page start request containing zero visit/dwell hints cannot erase the approved two-view/45-second evidence. Fresh cart, stock, shipping and payment checks remain separate.

Isolated integration coverage: `scripts/test-trigger-db.js` verifies the stored invitation handoff with zero request hints; `scripts/test-checkout-recovery-db.js` simulates an ambiguous response after last-unit reservation, same-key replay, concurrent recovery, expiry refusal, exactly one intent/reservation, and early/out-of-order financial events. The latter mocks provider transport and creates no payment. Both require NEON_BRANCH=conversion-dashboard-validation and credentials for that isolated branch only.
