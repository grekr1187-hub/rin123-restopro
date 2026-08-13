# RestoPro Premium POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current prototype UI with a premium Russian-first RestoPro POS that works in the browser, is installable on a monoblock as a PWA, and includes operational navigation, dashboard, orders, tables, menu, kitchen/bar, stock, reports, AI, settings, and thermal-printer workflows.

**Architecture:** Keep the existing Node/Express/PostgreSQL backend and REST API. Replace the frontend shell with a single production-oriented SPA in `public/index.html`, add a PWA manifest/service worker, and use browser-native print/Web Serial where available for thermal printers with a normal print-dialog fallback. Persist UI preferences locally while using API data as the operational source of truth.

**Tech Stack:** Existing Node.js/Express/PostgreSQL backend, vanilla HTML/CSS/JS SPA, Web APIs (Print, Web Serial, Service Worker), browser localStorage.

## Global Constraints

- RU / UZ / EN interface; Russian is the default.
- UZS / USD / RUB currency selection.
- Dark premium POS dashboard with glass panels, gradient accents, animated transitions, compact operational cards, large touch targets, responsive mobile layout.
- PostgreSQL remains the source of truth; frontend must not replace backend persistence with in-memory-only data.
- Existing environment variables and Railway start command remain compatible.
- AI and Telegram remain graceful when credentials are absent.
- Thermal printers must support browser print fallback and Web Serial when supported.
- App must be installable on desktop/monoblock through a PWA manifest and service worker.

---

### Task 1: Replace the frontend with the approved premium Russian-first POS shell

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Consumes: `/api/bootstrap`, `/api/dashboard`, `/api/menu`, `/api/tables`, `/api/settings`.
- Produces: responsive SPA navigation and reusable render functions for all requested operational modules.

- [ ] Build the sidebar/topbar layout from the approved concept: RestoPro branding, search, status indicators, profile, Russian labels, bright blue/purple/orange/green/cyan accents, glass surfaces, strong contrast, and motion.
- [ ] Add navigation for Главная, Касса, Заказы, Зал и столы, Меню, Кухня, Бар, Склад, Техкарты, Персонал, Отчёты, AI-Manager, Принтеры, Интеграции, Настройки.
- [ ] Add reusable KPI cards, charts rendered with CSS/SVG, order rows, table map, menu cards, queue tickets, alerts, and modal primitives.
- [ ] Add working local navigation without page reload and preserve selected page in localStorage.
- [ ] Add reduced-motion handling and keyboard-visible focus states.

### Task 2: Wire operational data and actions to the existing backend

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Consumes: existing REST endpoints exposed by `server.mjs`.
- Produces: `api()`, `loadBootstrap()`, `loadDashboard()`, `saveSettings()`, `createDish()`, `createOrder()`, and `updateTable()` frontend actions.

- [ ] Load restaurant, menu, tables, staff, ingredients, and orders from `/api/bootstrap`.
- [ ] Load live KPI data from `/api/dashboard` and refresh dashboard data after mutations.
- [ ] Implement new-order flow with table selection, waiter selection, dish picker, quantity controls, totals, payment method, and success state.
- [ ] Implement menu search/category filtering and create-dish modal against `/api/menu`/`/api/categories`/`/api/menu` POST.
- [ ] Implement table occupancy view using `/api/tables` and clearly distinguish free, occupied, and cleaning/reserved states in the UI.
- [ ] Implement settings save against `/api/settings` with RU/UZ/EN and UZS/USD/RUB.
- [ ] Show explicit API/database error states instead of silently pretending data was saved.

### Task 3: Add printer/PWA capabilities

**Files:**
- Modify: `public/index.html`
- Create: `public/manifest.json`
- Create: `public/sw.js`

**Interfaces:**
- Produces: `PrinterManager.connectSerial()`, `PrinterManager.printReceipt()`, `PrinterManager.browserPrint()`, and PWA install support.

- [ ] Add Принтеры screen with receipt width, printer name, connection state, test print, reconnect, and default-printer selection.
- [ ] Implement Web Serial ESC/POS connection when `navigator.serial` exists and report unsupported-browser status otherwise.
- [ ] Implement browser print fallback using a print-only receipt layout so a normal thermal printer selected in the OS can print correctly.
- [ ] Store printer preferences in localStorage and never expose device credentials.
- [ ] Add installable PWA metadata and a service worker that caches the app shell and serves cached assets offline while API calls remain online-only.

### Task 4: Add premium motion, responsive behavior, and installation polish

**Files:**
- Modify: `public/index.html`
- Modify: `public/manifest.json`

**Interfaces:**
- Produces: desktop/monoblock/tablet/mobile layouts and animated state transitions.

- [ ] Add staggered page/card entrance, hover lift, glowing status dots, chart drawing animation, modal transitions, toast notifications, and skeleton loading.
- [ ] Make touch targets at least 44px where practical and provide a compact tablet/mobile navigation drawer.
- [ ] Add standalone display mode, theme color, icons, and Russian app metadata for desktop installation.

### Task 5: Verify and document the result

**Files:**
- Modify: `README.md`

- [ ] Run the existing Node syntax check with `node --check server.mjs` and a browser-side syntax check by loading the app and exercising navigation.
- [ ] Verify `/health` and `/api/bootstrap` when the database is configured.
- [ ] Verify dashboard, order creation, menu creation, settings, printer fallback, PWA install metadata, and mobile layout.
- [ ] Update README with browser/PWA installation and thermal-printer usage instructions.
