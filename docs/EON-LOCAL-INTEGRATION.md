# First EON local integration — 21 September 2026

The isolated EON worktree now hosts an opt-in local sidecar at http://127.0.0.1:4317. Its source and run instructions are in:

`/Users/manoj/.codex/worktrees/5b42/houseofeon-mini-store/negotiation/README.md`

Reusable server-only implementation here: `src/contextual.js`; regression tests: `tests/contextual.test.js`. The EON adapter imports this module directly (configurable `NEGOTIATION_PLATFORM_DIR`), so economics and acceptance logic are not copied into the storefront. Existing `src/local.js` and fixed-schedule demo remain separate; Vercel is still fail-closed.

Implemented locally: validated INR/paise context, contribution/discount floors, stock-sensitive concessions, qualified comparable-history guard, missing/stale-data failures, exact current-quote acceptance, cart/pincode/payment/promotion binding, session serialization, idempotent acceptance, tenant check and signed connector request verification. EON owns catalog/pricing source loading, synthetic aggregate/inventory/shipping/cost fixtures, atomic in-process stock/subsidy accounting and payment/failure/refund simulation.

Validation: platform `npm test` 16/16; EON integration suite 18/18. Synthetic browser AI extraction returned a ₹900 confirmation. A Razorpay **test-mode** order was created/read at 95,904 paise INR, status created and zero paid. That is an unpaid provider create/read test only, not a completed sandbox payment/webhook integration. No production DB access/write, stock mutation, fulfillment, customer message or public deployment.

Important limitations: economics are explicitly unapproved **tax-exclusive fixtures** and cannot be treated as verified GST-inclusive EON costs; stock/sales/freight are synthetic or unknown. Persistent Supabase session/quote/redemption transactions are not implemented. The loopback connector uses a per-process installation secret, not a durable rotated installation. Browser sessions, replay cache and budgets reset on restart. Developer scenario controls reset fixture stock globally. Expired pending reservations need explicit simulated failure or process restart; an expiry-release worker remains a production gate. The UI must never be deployed or reverse-proxied as live commerce.

Next gates: read-only deployed stock/schema verification; approved cost/tax/fee/contribution policy; actual freight quotes; reliable sales test/refund/COD classifications; staging-only durable auth/RLS/transactions/budgets/expiry workers; immutable offer handoff into EON checkout; Razorpay test capture/signature/webhook/refund/timeout reconciliation; kill switch, abuse/privacy controls and explicit pilot rollout approval. Full mapping, provider test command and test matrix are documented in the EON README.
