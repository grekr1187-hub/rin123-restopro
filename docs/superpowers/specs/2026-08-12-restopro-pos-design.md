# RestoPro POS — production hardening and product design

## Goal
Turn the current RestoPro prototype into a persistent, production-oriented restaurant/cafe POS with a polished animated interface and working operational modules.

## Product scope
- RU / UZ / EN interface.
- UZS / USD / RUB currency selection.
- Dashboard with live KPIs and operational shortcuts.
- Orders: create/edit, waiter, table, items, statuses, split checks, payment.
- Hall: zones/tables and occupancy.
- Menu: kitchen/bar categories, dish images, prices, costs, active state.
- Kitchen and bar queues.
- Stock and purchases: ingredients, receipts, adjustments, low-stock indicators.
- Tech cards: recipe ingredients and calculated cost.
- Staff: roles, base salary, commission %, rating/performance.
- Reports and Excel export.
- Telegram test/notification integration.
- AI manager assistant using current POS context.
- PostgreSQL persistence; no in-memory source of truth.

## Architecture
A single Node.js/Express service serves the SPA and JSON API. PostgreSQL is the source of truth. On boot the server ensures the schema exists and seeds a single demo restaurant only when the database is empty. All writes use parameterized SQL and transactions for order/purchase/stock flows.

Images are stored as data URLs in the existing `dishes.image_url` column for the initial deployment, capped at a safe payload size. This keeps dish photos persistent without introducing a separate object-storage dependency.

## UX
Dark premium POS dashboard with glass panels, gradient accents, animated transitions, compact operational cards, large touch targets, responsive mobile layout, dish photo cards, clear statuses, and quick actions. Navigation switches modules without page reloads.

## Reliability
- `/health` must verify the process and database connectivity.
- API errors return stable JSON error messages.
- DB connection pool is reused.
- Graceful shutdown closes the pool.
- Existing environment variables remain compatible.
- OpenAI and Telegram integrations fail gracefully when credentials are absent.

## Success criteria
A fresh Railway deployment starts successfully, initializes PostgreSQL, persists settings/menu/orders/stock/staff across restarts, provides the listed POS workflows through the UI, exports a valid `.xlsx` workbook, and exposes a working health endpoint.
