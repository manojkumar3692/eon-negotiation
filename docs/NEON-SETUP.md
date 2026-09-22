# Neon setup completed

Project directory: `/Users/manoj/Documents/eon-negotiation`

- Neon project: `calm-fog-75034810` (eon-negotiation)
- Branch: `production` / `br-muddy-moon-b5kzz2wr`
- Region: `aws-us-east-2`
- Runtime for CLI: Node 22.23.2; selected by `.nvmrc`
- Neon CLI: 5.0.0, installed globally under the compatible Node runtime
- Login completed; requested Neon skills installed into the project
- Requested `neon mcp -y` installed MCP configuration for Codex, Claude Code, Cursor and VS Code through the CLI's detected-client defaults. It minted an account-scoped MCP key. No key values were displayed or added to the repository. Newly configured MCP tools may require a client reload.
- Linked project and initialized `@neon/config` / `@neon/env`
- Wrote the exact requested `neon.ts` and `hello.ts`
- `neon deploy` successfully deployed function `api`
- Postgres, Neon Auth and Object Storage were already available on the linked branch; the deployment plan added only `api` and declared private `images` storage. AI Gateway remains undeclared/disabled in the supplied configuration.

Endpoint: https://br-muddy-moon-b5kzz2wr-api.compute.c-7.us-east-2.aws.neon.tech/

Verified HTTP 200 with exact body `Hello from Neon Functions`.

All 16 existing application tests passed. `.env` and `.neon` are ignored by Git, `.env` is owner-readable/writable only, and existing OpenAI settings were preserved. Secrets were not included in the hello function's declared environment.

To use the CLI from this project:

```sh
nvm use
neon deploy
```

Neon accepts the requested `preview` block but emits a deprecation/GA advisory: functions and buckets may now be top-level configuration. The supplied layout was preserved. A subsequent plan proposes reapplying the function; no additional auth/storage change was listed. The live endpoint was tested directly rather than treating the plan as proof of execution.

Scope: infrastructure setup and the requested hello endpoint are deployed. Negotiation APIs, merchant dashboard, application tables and auth flows still need implementation. The old Supabase-specific draft SQL has NOT been applied to Neon. House of EON's Supabase setup was not changed, and its integration task remains paused.
