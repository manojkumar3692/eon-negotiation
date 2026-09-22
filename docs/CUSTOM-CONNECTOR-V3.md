# Custom commerce connector v3

Use this contract for any merchant that does not use a native platform adapter. The merchant keeps its database, payment system and checkout. The negotiation platform stores only a scoped installation secret and normalized business facts.

## Merchant endpoint

Expose one HTTPS `POST` endpoint on the company domain or a subdomain, for example:

`https://api.merchant.example/negotiation/v3`

Every request contains `schemaVersion`, `workspaceId`, `installationId` and an `operation`. Requests use a per-installation bearer secret plus `X-Negotiation-Timestamp`, `X-Negotiation-Nonce` and `X-Negotiation-Signature`. The signature is lowercase HMAC-SHA256 over:

```text
timestamp + "\n" + nonce + "\n" + exact_raw_body
```

The merchant must persist and atomically claim each nonce for at least 60 seconds. In-memory replay protection is insufficient on serverless infrastructure.

Use `createConnectorHandler` from `lib/connector-kit/index.js` as the reference handler. It validates authentication, tenant binding, input limits, response schemas and freshness.

## Required operations

- `capabilities`: declares supported business models and catalog, inventory, economics, shipping, checkout, reconciliation and event capabilities.
- `catalog`: returns stable product and variant IDs, SKU, display name, currency, current price, availability and fulfillment type.
- `context`: evaluates the exact cart and destination. Returns authoritative price, available-to-sell, approved floor, shipping economics, payment support, comparable sales aggregate and a short-lived revision.
- `checkout`: receives one signed, short-lived approved quote and an idempotency key. It must revalidate the cart, create exactly one enforceable checkout and return an HTTPS checkout URL.
- `reconcile`: returns pending, paid, cancelled or refunded for an external checkout ID.

The first release supports one cart line with quantity up to 20. Connectors declare `physical_goods`, `digital_goods`, `services` or `b2b`; each adapter maps its own stock, capacity or entitlement into the shared availability and checkout fields.

## Data rules

- Monetary values are integer minor units in the declared ISO currency.
- An approved floor is per unit. It must already reflect the merchant’s cost and contribution policy.
- Shipping returns both merchant cost and customer charge so the engine can protect any subsidy.
- Comparable sales are optional and must exclude refunds, bundles and exceptional promotions.
- Context expires within 60 seconds. Checkout must reject an expired quote, changed cart, changed price, unavailable inventory/capacity or reused idempotency key with a different payload.
- Never return database credentials, full customer records, raw order history or merchant-only explanations.

## Events

After payment, cancellation or refund, call `sendConnectorEvent` with one of:

- `checkout.paid`
- `checkout.cancelled`
- `checkout.refunded`

The platform verifies the signature, deduplicates `eventId`, updates checkout state and commits or releases the discount-budget reservation. Browser payment-success pages are not trusted.

## Onboarding sequence

1. Merchant creates a company workspace and verifies its domain.
2. Platform generates a workspace ID, installation ID and installation secret.
3. Merchant deploys the endpoint and stores the three values server-side.
4. Merchant enters the endpoint in Connections, then copies the generated installation ID and one-time secret into the merchant backend environment.
5. Platform checks capabilities, synchronizes catalog, and imports new variants with their floor equal to retail so they cannot discount accidentally.
6. Merchant reviews minimum prices and policy.
7. Platform tests a real cart, destination and checkout capability without creating an order.
8. Merchant installs the widget in testing mode.
9. Production activation requires domain verification and a successful cart test.
