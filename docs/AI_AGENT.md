# RestoPro AI Agent

RestoPro now has an AI gateway that sits in front of the existing POS server.

## Capabilities

- PostgreSQL-backed AI sessions and persistent business memory.
- Audited AI tool calls in `ai_audit`.
- Owner, administrator and waiter AI profiles.
- Sales, dashboard, inventory, low-stock, staff/rating, top-dish, orders and recipe tools.
- Business-fact memory via `remember_business_fact`.
- 30-day analytics endpoint at `/api/ai/analytics`.
- OpenAI Responses API with function calling.
- Existing POS routes are proxied transparently through the gateway.

## Role headers

The gateway accepts `x-restopro-role: owner|admin|waiter` and `x-restopro-staff-id` for waiter-scoped queries. These headers are intended to be populated by the future authenticated POS session layer; they must not be trusted as a security boundary by themselves.

## Production

Railway start command is `node ai-gateway.mjs`. The gateway listens on the public port and runs the legacy POS server internally on port 3101.

## Security follow-up

The next hardening step is to connect these role claims to the POS JWT/session authentication rather than accepting browser-supplied role headers. The AI tools themselves are permission-gated and never expose arbitrary SQL execution.
