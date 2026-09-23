> Pending local release: see [Store facts and invitation integration](IMPORT-TRIGGER-INTEGRATION.md) for the new import contract, customer preview, tester access and trigger endpoints. Not deployed.

# Current handoff

Read LIVE-DASHBOARD-RELEASE.md first, then PRODUCT-SPEC.md and ROADMAP.md. EON remains on Neon/Auth; House of EON keeps Supabase.

The authenticated dashboard now contains guided Setup, EON Trigger, Rules, Converse, Optimize, Connect and Recovery. Configuration, test history, audit and funnels persist through `lib/conversion` and migration 007. The live price-only service is guarded by saved configuration. The prior isolated `/pilot` is only a fictional reference.

House of EON's installed connector currently synchronizes six products but does not yet implement approved cart economics, enforceable checkout or payment events. Do not activate customer negotiation or claim a verified sale. Extra concession types are configurable and testable; live activation rejects unsupported terms. Email/WhatsApp sending and future channel adapters still require providers and consented events.

Next integration work: complete the merchant-side checkout/event contract, prove exact-price payment and refunds, expand checkout capabilities for approved non-price terms, attach messaging provider and authoritative abandonment/consent events, and measure controlled full-price plus negotiated outcomes. Preserve the House of EON validation gate before expansion.

Run npm test and npm run build. Database migration and repository tests passed on the conversion-dashboard-validation branch before the additive production migration. Private test credentials live outside this repository and must not be committed.
