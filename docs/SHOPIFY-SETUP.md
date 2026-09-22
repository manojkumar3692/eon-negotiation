# Shopify app setup

The adapter uses Shopify's standalone authorization-code flow with encrypted, expiring offline tokens. A merchant enters their canonical `*.myshopify.com` domain in Connections and approves only the configured scopes.

## App configuration

Use these production URLs:

- App URL: `https://eon-negotiation.vercel.app/dashboard`
- OAuth callback: `https://eon-negotiation.vercel.app/api/integrations/shopify/callback`
- Webhook endpoint: `https://eon-negotiation.vercel.app/api/webhooks/shopify`

Requested scopes:

```text
read_products,read_inventory,read_orders,write_draft_orders
```

Configure webhook deliveries for:

- `orders/paid`
- `orders/cancelled`
- `refunds/create`
- `app/uninstalled`
- the mandatory customer/shop data compliance topics required for the selected distribution model

Set `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_API_VERSION`, `CONNECTOR_ENCRYPTION_KEY` and the exact HTTPS `APP_ORIGIN` in Vercel. Never put them in `NEXT_PUBLIC_*` variables.

## Acceptance test

1. Install on a Shopify development store and return to the correct workspace.
2. Check capabilities and synchronize the catalog.
3. Confirm every imported variant initially has minimum price equal to retail; review one staging variant and publish its approved minimum.
4. Configure shipping and verify a real cart with the Shopify variant GID.
5. Verify company-domain ownership and activate the connector.
6. Negotiate in testing mode, accept the quote and confirm the draft-order invoice contains the exact item discount and shipping amount.
7. Pay the development order and verify checkout status changes to paid.
8. Repeat for cancellation, refund, expired quote, inventory change and duplicate acceptance.
9. Uninstall and confirm the connector is revoked and paused.
10. Install a second store and verify no catalog, token, session or order crosses tenant boundaries.

Do not enable the public negotiation switch until this sequence and the House of EON staging sequence pass.
