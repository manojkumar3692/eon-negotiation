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
