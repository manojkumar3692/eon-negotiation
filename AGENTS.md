# Project conventions

> Database decision: eon-negotiation uses Neon project `calm-fog-75034810`; House of EON retains Supabase. Supabase-specific platform setup below is historical and must not be applied to Neon. Rewrite draft auth references/access policies before any application migration.

Read README.md and docs/HANDOFF.md first. The current conversion-layer scope is docs/PRODUCT-SPEC.md; House of EON validation gates in docs/ROADMAP.md must pass before multi-client expansion. New modules are sandbox scaffolds until explicitly integrated and verified. Use JavaScript ES modules. Keep all monetary values in integer minor units with explicit currency. Never expose merchant policies/floors to shopper clients or model prompts. Authenticated merchant dashboards may display their own policies. Never expose service credentials or tokens in any browser bundle. All economic decisions belong to the deterministic rules service. Preserve local-demo versus production boundaries. Validate tenant ownership at every privileged server operation. Use PostgreSQL transactions for state transitions, not chains of independent REST writes. Run npm test after rules/service changes. Live checkout and deployment require the documented production gates; do not claim unimplemented integrations work.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
