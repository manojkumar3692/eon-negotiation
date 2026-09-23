# Custom merchant developer handoff

Use this handoff for a merchant that does not use a native commerce adapter. The merchant keeps its existing database, hosting and checkout. EON Negotiation needs no database password, Supabase service-role key, payment master key or hosting account access.

## What the merchant chooses

The merchant selects **Custom store**, saves one HTTPS endpoint on its verified company domain, and securely gives the generated server-side settings to its developer. Saving a different endpoint does not rotate the secret. Secret rotation is a separate explicit action and revokes the old value.

The generated block contains:

```text
NEGOTIATION_ENABLED=true
NEGOTIATION_WORKSPACE_ID=<workspace UUID>
NEGOTIATION_INSTALLATION_ID=<installation UUID>
NEGOTIATION_CONNECTOR_SECRET=<one-time secret>
```

Use these names in new integrations. If an older merchant implementation expects `INSTALLATION_SECRET`, map the one generated secret to that name instead. Do not configure both secret variables with different values. All four values are server-side only.

## Capability stages

1. **Catalog connected:** implement `capabilities` and `catalog`. The platform can synchronize product IDs, price and an inventory snapshot. New products enter with minimum price equal to retail until the merchant reviews it.
2. **Exact-cart facts:** implement `context` for current price, availability, approved economics, shipping, promotions and payment method. A synchronized stock number alone is not live availability.
3. **Enforceable checkout:** implement idempotent `checkout`, revalidate the accepted quote and return a real checkout URL.
4. **Order truth:** implement `reconcile` and signed paid, cancelled and refunded events.
5. **Activation:** verify the domain, review product minimums and rules, pass a real-cart check, then explicitly activate. Catalog-only connections remain read-only and do not expose the widget.

The dashboard's simulator can be used while stages 2–4 are unfinished, but it uses saved or typed assumptions. It does not create an offer, reserve inventory or prove checkout readiness.

## Merchant developer checklist

- Host one public HTTPS POST route on the merchant domain.
- Verify signed requests and atomically persist nonces for replay protection.
- Bind every request to the configured workspace and installation IDs.
- Return only normalized facts from the merchant's existing systems.
- Keep response clocks synchronized and expiry within contract limits.
- Persist checkout idempotency keys before enabling checkout.
- Keep the route disabled until its environment and nonce migration are ready.
- Never send database credentials, customer tables or raw order history.

See [CUSTOM-CONNECTOR-V3.md](CUSTOM-CONNECTOR-V3.md) for schemas and signing details.
