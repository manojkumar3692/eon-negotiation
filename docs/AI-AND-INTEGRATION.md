# Standalone negotiation platform

House of EON is customer one. The service, data model and business rules belong to an independent product; the current folder name is temporary. Merchant fixtures are separate from the rules and chat service so another merchant can be supplied without changing the engine.

## Where the AI is

`src/openai.js` calls the OpenAI Responses API with structured output to interpret natural language. `src/chat.js` keeps recent conversation context, handles product questions, asks the shopper to confirm an extracted price, and calls the deterministic rules engine. `src/rules.js` alone authorizes the actual offer. Final replies use approved templates, so the model cannot invent a price or promise free delivery.

Example: shopper says “Can you do 900?” → AI extracts INR 90000 paise → shopper confirms → merchant rules counteroffer ₹959.04 in the first sample round. Product questions and clarification do not consume price rounds. Model failure falls back to explicit numeric input. This is a real provider integration in code, tested using mocked provider responses; a live synthetic offer request has now passed using the authorized EON OpenAI configuration.

## Enable AI locally

Use a Node runtime with `--env-file` support (Node 22 recommended). The local `.env` is now configured with OPENAI_API_KEY and OPENAI_MODEL from the authorized EON configuration. On another machine, create an ignored `.env` with those settings. Choose an available model supporting Responses structured output in your API account. Do not paste credentials into chat.

```sh
node --env-file=.env src/local.js
```

`npm run dev` also works when these variables are already in the shell environment. Without them the interface explicitly reports AI unavailable and permits numeric offers. No invented offline AI is used.

## House of EON integration plan

1. Register EON as a merchant, add its allowed website origin and connect approved product/variant data and private policies.
2. EON's product page mounts our future widget using its public merchant ID and variant ID. EON's server supplies a short-lived signed bootstrap to authenticate a shopper session. Public IDs are not secrets or authorization.
3. Our service handles conversation and returns an expiring approved offer bound to merchant, session, variant, quantity and currency.
4. On acceptance our server calls EON's existing backend to create checkout using the approved offer. EON must validate/retrieve the offer server-to-server; never trust a price from the widget.
5. EON's verified order/payment events reconcile purchase and analytics in our service.

The local page is a test harness, not yet the installable widget. Supabase transactions, merchant auth, signed bootstrap, widget packaging, distributed limits and checkout adapter remain required before an EON install. No changes were made to EON's website. Stage 3 will use the same negotiation service through an authenticated agent adapter.

Documentation used: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
