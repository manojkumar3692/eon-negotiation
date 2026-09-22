# Deployment and environment

> Database decision: eon-negotiation uses Neon project `calm-fog-75034810`; House of EON retains Supabase. Supabase-specific platform setup below is historical and must not be applied to Neon. Rewrite draft auth references/access policies before any application migration.

## Local and source control

The repository is initialized locally. No GitHub remote exists. Run `npm run dev` and `npm test`. There are no runtime dependencies in this starter. The GitHub workflow runs tests on Node 22. Choose a supported Node runtime on Vercel and pin it when adding package dependencies; commit the resulting lockfile.

Create a private GitHub repository named `eon-negotiation` in the chosen account, add it as `origin`, push the initial branch and protect main with required checks/reviews. Repository ownership has not been supplied, so no remote repository was created. Keep production secrets out of commits, screenshots, issue bodies and AI prompts.

## Environments

| Variable | Where | Purpose / status |
|---|---|---|
| PORT | local | Optional local port, default 3000; implemented |
| APP_ORIGIN | backend | Exact public origin for session/CSRF rules; planned |
| SUPABASE_URL | backend | Environment-specific project endpoint; planned |
| SUPABASE_ANON_KEY | merchant auth frontend only where needed | Public auth key; RLS still mandatory; planned |
| SUPABASE_SERVICE_ROLE_KEY | backend secret | Privileged repository access; never in browser; planned |
| SESSION_SIGNING_SECRET | backend secret | Random 32+ byte integration bootstrap signing key; planned |
| COMMERCE_PROVIDER | backend | eon first, shopify optional; planned |
| COMMERCE_BASE_URL | backend | Allowlisted existing EON server endpoint; planned |
| COMMERCE_API_SECRET | backend secret | Server-to-server auth; planned |
| COMMERCE_WEBHOOK_SECRET | backend secret | Payment event signature verification; planned |
| AI_PROVIDER / AI_MODEL | backend | Chosen provider and pinned model; planned |
| AI_API_KEY | backend secret | Provider credentials; planned |
| NEGOTIATION_ENABLED | backend | Default false; actual database merchant flag also required; planned |
| SHOPIFY_SHOP_DOMAIN / SHOPIFY_API_VERSION | optional backend | Verified store domain and pinned supported API version; planned |
| SHOPIFY_ADMIN_ACCESS_TOKEN | optional backend secret | Least privilege discount/catalog access; planned |

`.env.example` lists planned variables. The current prototype reads PORT, OPENAI_API_KEY and OPENAI_MODEL. Use Node 22 `node --env-file=.env src/local.js` to load a local file, or export variables before `npm run dev`. When implementing configuration, add an explicit validated loader (or framework environment support) and fail startup on missing production secrets. Do not mistake a populated env file for a connected integration.

## Supabase

Create separate development/staging/production projects in a suitable region; select Vercel execution region near the database after checking availability. Apply `supabase/migrations/001_initial.sql` to a fresh development project using the Supabase CLI or SQL editor. This migration has not been database-tested here. Inspect RLS and run cross-tenant tests before production. Add EON merchant and owner membership through a privileged setup script; no public signup may grant itself ownership. Seed approved catalog and policy data with negotiation disabled. Add tested transaction RPCs, grants and retention jobs in new migrations. Keep backward-compatible schema migrations and backups/restore drills.

## Preview

Import GitHub project into Vercel; framework preset Other, output directory `public`, no build required for current static prototype. `api/demo.js` returns 503 deliberately. Protect previews, use sandbox payment credentials and staging Supabase only. The runnable negotiation demo is local until the durable repository exists. Environment keys must be scoped separately for Preview/Production; verify generated deployment behavior in Vercel rather than assuming local server state will survive serverless execution.

## Live rollout after milestones 1–3

1. Implement production API, auth, RLS tests, atomic budget/acceptance and outbox; remove the stub only when tests cover them.
2. Wire EON sandbox checkout. Prove cart/variant/amount/expiry binding and verified payment/refund events. Reconcile provider timeouts and webhook replay.
3. Deploy protected staging; perform browser/mobile/accessibility smoke tests, load/rate tests, model adversarial tests and inventory/price-change tests.
4. Owner approves live catalog economics and experiment criteria. Provision live keys, validate webhook account and allowlisted origins, retain feature flag false.
5. Enable a small eligible cohort, watch daily profit, redemption correctness and errors. Increase only after the pilot gate.
6. On incident, pause tenant and revoke pending offers as necessary; keep paid-order reconciliation running. Roll back application version without destructive schema rollback. Reconcile provider-created orders before releasing budget reservations.

Required external setup remains: GitHub destination/account, Vercel project, Supabase projects, EON backend access and approved prices, AI provider/model and sandbox/live commerce credentials. Nothing is deployed or connected by this scaffold.

References: [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js), [Vercel environment management](https://vercel.com/docs/cli/env), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
