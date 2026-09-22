# Next build handoff

The current priority is the independent platform in `/Users/manoj/Documents/eon-negotiation`. EON website integration is paused. Read README and ONBOARDING-PLATFORM.md first. The platform uses Neon; EON keeps Supabase. Older Supabase/platform integration-first documents are historical.

## Completed

- Next.js merchant dashboard: eight sections, multi-company selection, validation, empty states, CSV preview/import and explicit connector readiness.
- Neon Auth SDK wiring, protected server page/API, same-origin POST checks and bounded input. No server secrets in client configuration.
- Neon schema on isolated `dashboard-onboarding` branch of `calm-fog-75034810`.
- PostgreSQL RLS, restricted role, owner-only access, transactional catalog/audit writes, immutable policy versions with concurrency lock and expected-version check.
- Merchant arithmetic simulator and a custom context-contract schema scaffold. Existing OpenAI shopper prototype preserved separately.
- Unit checks, real two-principal database isolation/persistence checks, production build and unauthenticated HTTP checks.

## Immediate next work

1. Complete account signup/verification, sign-in/sign-out and persisted onboarding in the browser with an owner-controlled account. Add recovery, verification resends, quotas and rate limiting before public signup. Do not claim this acceptance flow was completed merely because SDK routes respond.
2. Create the registered Shopify development app and test store; choose app distribution and exact callback URLs. Implement official standalone OAuth flow for this dashboard, nonce/state binding, signature verification, encrypted installation tokens, revocation/uninstall and scoped read-only sync. Use official libraries. No app client credentials were discovered/configured this turn.
3. Implement source/mapping review and live capability readiness: synchronization time, missing economics, unavailable shipping, approved product eligibility and connector diagnostics. Add bounded retry/outbox/reconciliation jobs rather than long serverless requests.
4. Implement a server-to-server custom context adapter in this repository, with SSRF-safe egress, signed requests, replay protection and contract tests. Only resume changes to the EON codebase when the user resumes that work.
5. Consolidate dashboard simulation and existing contextual/live prototype rules into one approved, versioned evaluator. Introduce durable sessions/turns/quotes and connect the existing OpenAI intent layer. Do not expose floors to shoppers or AI.
6. Add atomic daily budget reservations, current-quote validation, idempotent checkout handoff, verified payment/refund webhooks and exact amount/currency/quantity checks. Then widget and controlled pilot.

## Database operations

`npm run db:migrate` applies the current single idempotent migration to the selected branch. `npm run test:db` only accepts `dashboard-onboarding`, generates synthetic principals/workspaces and removes only those fixtures. Migration URLs and role privileges are server-only. Every application operation must use `tenant()` and identity from `getAuth().getSession()`. Never accept a user ID from a request body. The default privileged Neon connection is not a replacement for RLS: the transaction switches to `negotiation_app` before tenant SQL.

## Known scope limits

Owner-only workspaces; six two-decimal currencies; 500 manual products; 200 CSV rows per import. No live connector client, domain verification, credential storage, worker, team management, real budget spending, orders or revenue analytics. Simulation stock/history are explicit scenario inputs. Quote validity and daily budget settings are saved but not full live reservation services. The dashboard is local; production Neon still has its separate hello function.

## Validation notes

All 25 unit tests passed. The real Neon development test passed cross-tenant read/write denial (including direct SQL under the restricted role), upsert, all-or-nothing import validation, immutable versions, stale publish conflict, connector setup persistence, simulations and audits. Build passed. HTTP checks returned 401 for anonymous platform reads and redirected the dashboard to login; incorrect origins were rejected. Confirm the configured local origin remains 127.0.0.1:3000.

Browser acceptance uses `/demo`, clearly temporary. It covers a second company in AED, manual product creation, rule publication, bounded counteroffer, out-of-stock rejection, connector setup state, switching companies and mobile layout. It does not establish real auth/signup, OAuth installation or production checkout.
