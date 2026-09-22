# EON ↔ negotiation platform: connected pilot plan

Status: architecture and data readiness verified on 21 September 2026. This supersedes the fixture-first integration direction. The existing port-4317 harness is a regression fixture, not the intended product or a completed live integration.

## Intended product

Run two independent applications:

1. **House of EON storefront**: owns catalog, selling prices, promotions, inventory, order lifecycle and checkout. Hosts a private `/negotiation-test` page, initially localhost/staging only.
2. **eon-negotiation**: owns merchant onboarding/dashboard, approved negotiation policies, conversation, deterministic offer decisions, quote/session records, budgets and negotiation analytics. Exposes a signed merchant API. It never needs EON's database administrator credential.

Flow: EON test page → EON server proxy → negotiation service → authenticated EON data connector → privacy-minimized EON DB queries. Negotiation service returns a bounded public quote. Acceptance returns an immutable offer reference to EON; EON revalidates and owns the test checkout.

“All data” means every relevant business fact needed to decide and enforce an offer, not a copy of the customer database or arbitrary tables. The model receives public product facts and the shopper's message, never costs, private floors, installation secrets or raw order/customer records.

## Verified source readiness

Read-only Supabase schema discovery and inventory RPC succeeded. No production mutations or customer detail queries were performed.

| Fact | Authoritative source | Verified readiness | Action |
|---|---|---|---|
| Catalog/product facts | EON `lib/products.ts` | Six 50 ml perfumes in source | Connector imports product facts, excluding reviews/customer identifiers |
| Applicable selling price | EON `lib/pricing.ts`, coupon/order rules | Single EON20 ₹999; 2+ perfumes ₹799/unit | EON calculates applicable cart price; platform does not duplicate promotion rules |
| Stock | `get_storefront_inventory_availability` | Live RPC returned 12 SKU-size records with current/reserved/available stock, enabled flag and availability | Connector returns product/size-specific ATS with snapshot time; disabled stock fails closed |
| Enforcement | Existing original-checkout environment | `INVENTORY_ENFORCEMENT_ENABLED` is not true | Availability is readable; production reservation enforcement still must be verified before launch |
| Unit cost | `finance_product_costs`, linked through `inventory_skus` | Table exists but contains **zero records** | Dashboard shows missing, not ₹0; owner supplies costs or populates EON finance first |
| SKU identities | `inventory_skus` | 12 records; product_key and size available | Map stable EON product ID + size to cost/stock SKU |
| Sales | `orders` projected financial/status fields | Schema supports line items, discounts, payment/shipping state and collected partial COD | Aggregate in EON; no raw customer fields leave connector |
| Clean comparable history | Test/refund provenance | Dedicated refund/test fields not present in verified orders schema; `is_hidden`, coupon and lifecycle fields exist | Do not assume hidden means test or paid means never refunded. Agree authoritative classification/reconciliation; unqualified history cannot drive prices |
| Carrier serviceability | Existing Delhivery integration | Code supports read-only pincode availability lookup | Add bounded connector lookup; serviceability is not a cost quote |
| Carrier cost | Approved rate card or verified carrier quotation | No verified source established | Dashboard configures approved rate card, or connector calls a verified quotation API with packaging details |
| Margin/tax/budget policy | Merchant approval | No approved policy supplied | Maintain in negotiation merchant dashboard with version, owner and publication time |

Discovery details remain ignored in `negotiation/.local/discovery.json`. They contain schema/non-personal inventory/cost evidence, not credentials. The platform must not import that file as a live source.

## Merchant dashboard in eon-negotiation

The dashboard is required. It has two clearly separated categories:

### Connected facts (automatic, usually read-only)

Products, applicable promotions, current ATS, source timestamps, imported costs when present, qualified comparable-sales count/median/range, payment/shipping capabilities, and connector health. Display source and freshness beside each field. Missing, stale and unqualified are different states. Never substitute demo values automatically.

### Merchant decisions (owner-configured)

- Enabled products/sizes and permitted quantities/payment methods.
- Cost components missing from the source, with explicit source and tax basis: product cost, packaging, fees, returns allowance and any shipping reserve.
- Price tax basis/GST treatment; evaluate contribution using a consistent net basis.
- Minimum contribution per order or unit, maximum concession, round/quote limits, and daily subsidy budget.
- Shipping: verified live quote versus published merchant rate card; package/weight, origin/destination rules, validity and serviceability. Pincode affects fulfillment only.
- Promotion exclusions, including launch/bundle/trial credit interaction.
- Kill switch, policy versions, source health and test/published status.

Cost authority is explicit per field/SKU: either imported from EON finance or maintained as a merchant override. No silent conflict resolution and no back-writing to EON finance during this pilot. If EON finance later contains a conflicting value, flag it for review before publishing a policy change. Ideally EON finance remains the long-term source of accounting cost; the platform owns negotiation-specific limits.

Draft → validate → preview test cases → publish a policy version. A populated database value is an observed cost, not approval to discount. An unpublished/missing required policy blocks redeemable quotes but still allows product answers and connection diagnostics.

## Connector contract

All privileged calls use a scoped merchant installation, signed method/path/raw body, timestamp, nonce, replay protection and TLS outside localhost. Derive tenant from authentication; do not accept arbitrary browser merchant IDs. Keep the Supabase service key in EON only.

- `catalog`: bounded public product/variant data and supported cart rules, source revision.
- `context`: normalized cart, current applicable promotion/price, ATS, qualified aggregate sales, shipping quote/serviceability and imported cost fields; each fact has provenance, observation time and validity. Unknown values are null with reason codes.
- `checkout`: immutable approved offer reference, session/cart reference and idempotency key. EON fetches/verifies the offer server-to-server and never trusts a browser price.
- `events`: unique authenticated order/payment/refund/inventory events, non-personal fields only. Reconcile against provider/EON records; a shopper callback is not payment proof.

Public quote serialization contains only product/cart, item and delivery amounts, total, currency, expiry, quote ID and buyer-visible conditions. Dashboard diagnostics and decision audit require merchant authorization and never appear in shopper responses or model prompts.

## Build order and acceptance evidence

### 1. Real connector and source dashboard

Add gated EON connector routes backed by live read-only catalog/stock/finance projections and conservative comparable-sales summaries. Start a separate negotiation API process; demonstrate an actual network call to EON. Dashboard lists each product and provenance, including empty costs and unresolved historical classifications. Contract tests cover auth, tenant mismatch, stale/unknown data, bounds and accidental private-field serialization.

Done when stopping either server visibly changes connection status and the other fails safely; no local imports substitute for the HTTP connection.

### 2. Merchant setup and deterministic policy

Build the EON merchant dashboard inside the platform with draft/published policies, missing-input checklist and owner-selected cost authority. Unit-test inclusive/exclusive tax arithmetic, percentage fees, shipping, floor/cap conflicts, quantities and promotion exclusions. Local development can use an explicit owner-only access token; deployment requires real merchant authentication/roles and durable tenant storage.

Done when the owner can see where every required value came from, publish a complete policy, and reproduce price decisions. Until genuine values are provided, any sample-policy demonstration is separately and explicitly labelled, never the default for connected data.

### 3. Private page in the actual EON website

Implement `/negotiation-test` under the Next.js app; initially off by default and localhost/development gated, with no store navigation link. Use ordinary product/cart selection and conversational messages. High-confidence single-price offers can be processed directly; ambiguity asks one clear question. Explain when the current best quote cannot improve. Accepting a current quote never costs another round.

Show concise owner diagnostics separately: both service statuses, last data refresh and policy readiness. Remove developer scenario dropdowns from the shopper conversation.

Done when the page talks across the two running services using actual EON catalog/stock and the explicitly published policy. Test product changes, pincode/payment/quantity changes, outage, expiry, insufficient stock and final-offer acceptance in the browser.

### 4. Isolated checkout/payment test

Bind acceptance to immutable cart/price/shipping/policy context. Use a dedicated sandbox order/redemption store, verified Razorpay test credentials and no production-order or inventory writes. Transactional/idempotent local/staging state must cover acceptance races, provider timeout and duplicate callbacks. Do not reuse the production order route, which can trigger customer messages and fulfillment.

Done when a sandbox payment and verified callback reconcile once to the accepted total; failure/refund/late events are tested. The previous unpaid test-order create/read check does not satisfy this step.

### 5. Staging hardening, then deliberate launch

Use separate staging DB and durable tenant/session/quote/budget/reservation transactions, merchant auth, key rotation, distributed rate/replay limits, verified stock enforcement, reconciliation/outbox/expiry workers and privacy controls. Exercise two tenants and restarts. Review outcomes in the merchant dashboard. Publish/enable a small production cohort only after explicit launch approval and all real economics/sources are verified.

## First complete demo definition

Both applications are running separately. EON's actual test page negotiates against its live-read business facts and a merchant-approved policy; accepted offers hand off to isolated test checkout. The dashboard explains sources and decisions. Real EON orders/customers/inventory remain untouched during the demo. Neither a fixture UI nor a read-only connection alone is described as a completed integration.

## Decisions still needed from EON owner

No secret/key resubmission is needed. The remaining business decisions are cost authority and actual missing costs, tax basis, minimum contribution/discount budget and carrier rate authority. The dashboard should collect these, not force the owner to provide them through chat. Clean historical-sale qualification and staging resource selection also need verification before they influence prices or persist financial state.
