import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

const supported = { languages: ["ru", "uz", "en"], currencies: ["UZS", "USD", "RUB"] };
let data = {
  restaurant: { name: "RestoPro Demo", currency: "UZS", language: "ru" },
  daily: [
    { day: "Пн", revenue: 12800000, expenses: 6900000 }, { day: "Вт", revenue: 14100000, expenses: 7300000 },
    { day: "Ср", revenue: 11900000, expenses: 6700000 }, { day: "Чт", revenue: 15300000, expenses: 7600000 },
    { day: "Пт", revenue: 18100000, expenses: 8400000 }, { day: "Сб", revenue: 21400000, expenses: 9600000 },
    { day: "Вс", revenue: 19700000, expenses: 9100000 }
  ],
  orders: [],
  menu: [
    { id: 1, name: "Лазанья", category: "Основные", price: 78000, cost: 31000, sales: 86, imageUrl: "" },
    { id: 2, name: "Стейк", category: "Основные", price: 149000, cost: 67000, sales: 54, imageUrl: "" },
    { id: 3, name: "Цезарь", category: "Салаты", price: 62000, cost: 25000, sales: 112, imageUrl: "" },
    { id: 4, name: "Лимонад", category: "Напитки", price: 28000, cost: 7000, sales: 231, imageUrl: "" },
    { id: 5, name: "Тирамису", category: "Десерты", price: 49000, cost: 18000, sales: 74, imageUrl: "" }
  ]
};

function summary() {
  const revenue = data.daily.reduce((s, x) => s + x.revenue, 0);
  const expenses = data.daily.reduce((s, x) => s + x.expenses, 0);
  const profit = revenue - expenses;
  const avgCheck = data.orders.length ? data.orders.reduce((s, x) => s + x.amount, 0) / data.orders.length : 0;
  const foodCost = data.menu.reduce((s, x) => s + x.cost * x.sales, 0);
  const menuRevenue = data.menu.reduce((s, x) => s + x.price * x.sales, 0);
  return { revenue, expenses, profit, avgCheck, margin: revenue ? profit / revenue * 100 : 0, foodCostPct: menuRevenue ? foodCost / menuRevenue * 100 : 0 };
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "restopro-app", time: new Date().toISOString() }));
app.get("/api/config", (_req, res) => res.json(supported));
app.get("/api/dashboard", (_req, res) => res.json({ ...summary(), daily: data.daily, orders: data.orders, menu: data.menu, restaurant: data.restaurant }));

app.post("/api/settings", (req, res) => {
  if (req.body.currency && !supported.currencies.includes(req.body.currency)) return res.status(400).json({ error: "Unsupported currency" });
  if (req.body.language && !supported.languages.includes(req.body.language)) return res.status(400).json({ error: "Unsupported language" });
  data.restaurant = { ...data.restaurant, ...(req.body.name ? { name: String(req.body.name).trim() } : {}), ...(req.body.currency ? { currency: req.body.currency } : {}), ...(req.body.language ? { language: req.body.language } : {}) };
  res.json(data.restaurant);
});

app.post("/api/orders", (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Сумма заказа должна быть больше 0" });
  const order = { id: Math.max(0, ...data.orders.map(o => o.id || 0)) + 1, time: new Date().toISOString(), table: String(req.body.table || "-"), amount, status: String(req.body.status || "Новый"), items: Array.isArray(req.body.items) ? req.body.items : [] };
  data.orders.unshift(order);
  res.status(201).json(order);
});

app.post("/api/menu", (req, res) => {
  const item = { id: Date.now(), name: String(req.body.name || "").trim(), category: String(req.body.category || "Другое").trim(), price: Number(req.body.price), cost: Number(req.body.cost || 0), sales: Number(req.body.sales || 0), imageUrl: String(req.body.imageUrl || "").trim() };
  if (!item.name || !Number.isFinite(item.price) || item.price <= 0) return res.status(400).json({ error: "Укажите название и цену" });
  data.menu.push(item); res.status(201).json(item);
});

app.patch("/api/menu/:id", (req, res) => {
  const item = data.menu.find(x => x.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: "Блюдо не найдено" });
  if (req.body.name !== undefined) item.name = String(req.body.name).trim();
  if (req.body.category !== undefined) item.category = String(req.body.category).trim();
  if (req.body.price !== undefined) item.price = Number(req.body.price);
  if (req.body.cost !== undefined) item.cost = Number(req.body.cost);
  if (req.body.imageUrl !== undefined) item.imageUrl = String(req.body.imageUrl).trim();
  res.json(item);
});

app.post("/api/ai/chat", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OPENAI_API_KEY не настроен в Railway Variables" });
  const message = String(req.body.message || "").trim();
  if (!message) return res.status(400).json({ error: "Введите вопрос" });
  const context = JSON.stringify({ restaurant: data.restaurant, summary: summary(), orders: data.orders.slice(0, 20), menu: data.menu });
  try {
    const r = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.6", instructions: "Ты AI-помощник RestoPro для владельца и менеджера ресторана. Не принимаешь заказы от гостей. Анализируй данные POS, отвечай кратко и по делу, предлагай действия.", input: `Данные RestoPro: ${context}\n\nВопрос менеджера: ${message}` }) });
    const json = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: json.error?.message || "OpenAI request failed" });
    const text = json.output_text || json.output?.flatMap(x => x.content || []).map(x => x.text || "").join("") || "Нет ответа";
    res.json({ answer: text });
  } catch (e) { res.status(502).json({ error: "AI temporarily unavailable", detail: e.message }); }
});

app.post("/api/telegram/test", async (_req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN; const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(503).json({ error: "TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID не настроены" });
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "✅ RestoPro: Telegram интеграция работает." }) });
    const j = await r.json(); res.status(r.ok ? 200 : 502).json(j);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get("/api/export/menu", (_req, res) => {
  const rows = [["ID","Название","Категория","Цена","Себестоимость","Продажи","Фото"], ...data.menu.map(x => [x.id,x.name,x.category,x.price,x.cost,x.sales,x.imageUrl])];
  const csv = rows.map(row => row.map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", "attachment; filename=restopro-menu.csv"); res.send("\ufeff" + csv);
});

app.use((req, res, next) => { if (req.method !== "GET" || req.path.startsWith("/api/") || req.path === "/health") return next(); res.sendFile(path.join(__dirname, "public", "index.html")); });
app.listen(PORT, "0.0.0.0", () => console.log(`RestoPro running on port ${PORT}`));
