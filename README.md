# EON Negotiation

A standalone, multi-merchant negotiation platform. House of EON is the first reference customer, not a hardcoded platform dependency. Platform database/auth: Neon. House of EON keeps Supabase. JavaScript, Next.js, Vercel and GitHub.

## Current build

The merchant dashboard supports owner-managed company workspaces, manual/CSV and synchronized catalogs, versioned guardrails, domain verification, live connector checks and audit history. Data persists in Neon. `/demo` is an interactive sample; `/dashboard` requires Neon Auth.

Custom HTTPS connector v3 and Shopify OAuth are implemented behind one normalized commerce interface. The live engine uses fresh price, inventory, floor, shipping and payment context; creates durable AI-assisted sessions; reserves daily discount budget; and hands accepted quotes to idempotent merchant checkout. Signed webhooks reconcile paid, cancelled and refunded checkouts. WooCommerce and BigCommerce remain future provider adapters.

Read [the current onboarding and connector plan](docs/ONBOARDING-PLATFORM.md) and [the next-build handoff](docs/HANDOFF.md). Earlier documents retain historical Supabase drafts and INR prototype assumptions; the current Neon dashboard plan takes precedence for platform work. Further edits to the EON website remain paused.

## Run

Use Node 22.23.2 (see `.nvmrc`).

```sh
npm ci
npm run dev
# http://127.0.0.1:3000/demo — interactive preview
# http://127.0.0.1:3000/login — merchant account
npm test
npm run build
```

Use `.env.example` for server variables; real local secrets are already in ignored `.env`. Do not print them or prefix them with `NEXT_PUBLIC_`. The exact local `APP_ORIGIN` is `http://127.0.0.1:3000`.

Database setup, if restoring a clean development branch:

```sh
npm run db:migrate
npm run test:db
```

The migration was applied on `dashboard-onboarding`; DB tests refuse other branches and delete only their own generated records. Never apply the historical `supabase/migrations/` to Neon. Production migration needs explicit review and `--production`.

## Where AI fits

`lib/live/ai.js` extracts shopper intent while `lib/live/rules.js` remains the only price authority. The customer confirms a target before the server evaluates it. Floors, costs, policy and private connector facts are never sent to the model. Numeric offers still work when the AI provider is unavailable.

The dashboard simulator remains a merchant-only scenario tool. The customer widget uses the durable live engine and never treats the model as a pricing authority.

## Repository

```text
app/                         Next dashboard/login/demo and protected route handlers
components/Dashboard.js       Merchant UI
lib/auth*.js                 Neon session integration
lib/db.js                    Restricted-role PostgreSQL transactions
lib/repository.js            Tenant-scoped persistence
lib/validation.js            Shared input/CSV validation
lib/simulate.js              Merchant-only scenario evaluator
lib/connectors.js            Capability catalogue and default policy
lib/commerce/               Custom and Shopify providers plus normalized v3 contract
lib/connector-kit/          Reference merchant endpoint and signed event helpers
lib/live/                   Durable conversation, pricing and checkout orchestration
db/migrations/               Current Neon platform schema
scripts/                     Explicit migration and isolated DB integration checks
src/                         Earlier shopper AI/rules/context prototype
public/                      CSV template and preserved earlier demo assets
tests/                       Domain and isolation-related unit checks
docs/                        Roadmap, integration contract and handoff
neon.ts, hello.ts             Separate Neon hello function config
```

## Verification and limits

Automated tests cover arithmetic guardrails, connector encryption/binding, response freshness, endpoint restrictions, Shopify OAuth helpers, request signing and replay claims. Database integration checks cover tenant isolation and persistence. A real Shopify development-store install and the House of EON staging adapter remain required acceptance tests before enabling `NEGOTIATION_ENABLED` in production.

The dashboard is deployed through Vercel. `neon deploy` publishes the separate configured hello function and is not the Next.js deployment command.
