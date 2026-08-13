# RestoPro final POS design

Goal: finish the Russian premium animated restaurant POS as a browser/PWA app that can be installed on a monoblock, with real PostgreSQL-backed management flows.

## UI
- Dark navy premium base with bright electric blue/cyan accents, glass cards, soft glow and short transitions.
- Russian labels throughout the operator UI.
- Sidebar tabs: Главная, Заказы, Зал и столы, Меню, Кухня, Бар, Склад и закупки, Техкарты, Персонал, Отчёты, AI-помощник, Настройки, Telegram.
- Responsive desktop-first layout and PWA install support.

## Functional model
- Staff: create/edit role, phone, salary, commission, rating, username and password.
- Tables: create/edit capacity, zone, status and service percentage.
- Menu: create/edit category, name, description, price, cost, image/emoji and dish rating.
- Recipes: edit ingredients/quantities; dish cost is recalculated from recipe.
- Orders: create, progress, open details, split, pay; details show every line item, subtotal, service %, service amount and total.
- Reports: revenue, orders, top dishes and waiter ratings.
- AI: use current POS data and persistent memory endpoint.

## Data
- PostgreSQL remains the source of truth.
- Additive columns only; keep existing records valid with defaults.
- Passwords are stored as scrypt hashes, never plaintext.
