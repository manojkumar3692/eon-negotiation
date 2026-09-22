# EON Negotiation

A standalone, multi-merchant negotiation platform. House of EON is the first reference customer, not a hardcoded platform dependency. Platform database/auth: Neon. House of EON keeps Supabase. JavaScript, Next.js, Vercel and GitHub.

## Current build

The merchant dashboard supports owner-managed company workspaces, manual/CSV catalogs, versioned guardrails, inventory/shipping/history scenario tests, connector setup choices and audit history. Data persists on the isolated Neon `dashboard-onboarding` branch. `/demo` is an interactive sample with temporary browser-only data; `/dashboard` requires Neon Auth.

Shopify, WooCommerce, BigCommerce and custom APIs are described in the connector catalogue. Only the manual catalog is operational. Saving another connector does not authorize or connect it. Live offers, checkout, automatic sync and activation remain disabled.

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

`src/openai.js` extracts shopper intent; `src/chat.js` confirms it and applies deterministic merchant rules. The earlier local INR shopper prototype is available with `npm run dev:legacy` (stop the dashboard if sharing port 3000). Existing local OpenAI credentials remain server-only.

The dashboard simulator is arithmetic scenario testing, not AI dialogue. It accepts merchant-entered stock/shipping/history inputs. The next engine milestone connects authenticated merchant policies and trusted connector facts to durable AI conversations through one shared evaluator. AI never receives private floors or gets authority to set prices.

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
lib/connectors/contract.js   Custom adapter response schema (design scaffold)
db/migrations/               Current Neon platform schema
scripts/                     Explicit migration and isolated DB integration checks
src/                         Earlier shopper AI/rules/context prototype
public/                      CSV template and preserved earlier demo assets
tests/                       Domain and isolation-related unit checks
docs/                        Roadmap, integration contract and handoff
neon.ts, hello.ts             Separate Neon hello function config
```

## Verification and limits

25 unit tests and the development-database integration checks passed at initial implementation. Production compilation passed. Browser onboarding, catalog, rules and simulations are checked separately in the handoff. No real customer/store data was imported, and no live checkout was enabled. Signup verification emails and a complete signed-in browser journey still require acceptance testing with a merchant-owned account. Team invitations, account recovery UI, native OAuth adapters, quotas and public production hardening are future milestones.

The Next.js dashboard has not been publicly deployed. `neon deploy` publishes the separate configured hello function; it does not deploy this dashboard. No GitHub remote was created in this turn.
