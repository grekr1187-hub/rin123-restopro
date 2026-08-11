import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

let data = {
  restaurant: { name: "RestoPro Demo", currency: "UZS" },
  daily: [
    { day: "Пн", revenue: 12800000, expenses: 6900000 },
    { day: "Вт", revenue: 14100000, expenses: 7300000 },
    { day: "Ср", revenue: 11900000, expenses: 6700000 },
    { day: "Чт", revenue: 15300000, expenses: 7600000 },
    { day: "Пт", revenue: 18100000, expenses: 8400000 },
    { day: "Сб", revenue: 21400000, expenses: 9600000 },
    { day: "Вс", revenue: 19700000, expenses: 9100000 }
  ],
  orders: [
    { id: 1007, time: "13:42", table: "12", amount: 186000, status: "Оплачен" },
    { id: 1006, time: "13:31", table: "5", amount: 242000, status: "Оплачен" },
    { id: 1005, time: "13:18", table: "8", amount: 119000, status: "Оплачен" },
    { id: 1004, time: "12:56", table: "3", amount: 328000, status: "Оплачен" }
  ],
  menu: [
    { name: "Лазанья", category: "Основные", price: 78000, cost: 31000, sales: 86 },
    { name: "Стейк", category: "Основные", price: 149000, cost: 67000, sales: 54 },
    { name: "Цезарь", category: "Салаты", price: 62000, cost: 25000, sales: 112 },
    { name: "Лимонад", category: "Напитки", price: 28000, cost: 7000, sales: 231 },
    { name: "Тирамису", category: "Десерты", price: 49000, cost: 18000, sales: 74 }
  ]
};

function summary() {
  const revenue = data.daily.reduce((s, x) => s + x.revenue, 0);
  const expenses = data.daily.reduce((s, x) => s + x.expenses, 0);
  const profit = revenue - expenses;
  const avgCheck = data.orders.reduce((s, x) => s + x.amount, 0) / Math.max(data.orders.length, 1);
  const foodCost = data.menu.reduce((s, x) => s + x.cost * x.sales, 0);
  const menuRevenue = data.menu.reduce((s, x) => s + x.price * x.sales, 0);
  return {
    revenue, expenses, profit, avgCheck,
    margin: revenue ? profit / revenue * 100 : 0,
    foodCostPct: menuRevenue ? foodCost / menuRevenue * 100 : 0
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "restopro-app", time: new Date().toISOString() });
});

app.get("/api/dashboard", (_req, res) => {
  res.json({ ...summary(), daily: data.daily, orders: data.orders, menu: data.menu, restaurant: data.restaurant });
});

app.post("/api/orders", (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Сумма заказа должна быть больше 0" });
  }
  const order = {
    id: Math.max(0, ...data.orders.map(o => o.id)) + 1,
    time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    table: String(req.body.table || "-"),
    amount,
    status: "Оплачен"
  };
  data.orders.unshift(order);
  res.status(201).json(order);
});

app.post("/api/menu", (req, res) => {
  const item = {
    name: String(req.body.name || "").trim(),
    category: String(req.body.category || "Другое").trim(),
    price: Number(req.body.price),
    cost: Number(req.body.cost || 0),
    sales: Number(req.body.sales || 0)
  };
  if (!item.name || !Number.isFinite(item.price) || item.price <= 0) {
    return res.status(400).json({ error: "Укажите название и цену" });
  }
  data.menu.push(item);
  res.status(201).json(item);
});

app.post("/api/ai/insight", async (_req, res) => {
  const s = summary();
  const best = [...data.menu].sort((a,b) => b.sales - a.sales)[0];
  const weakest = [...data.menu].sort((a,b) => (b.price-b.cost) - (a.price-a.cost))[0];

  // Без OPENAI_API_KEY приложение работает автономно.
  // При наличии ключа здесь можно подключить OpenAI API отдельно.
  res.json({
    title: "Анализ RestoPro",
    points: [
      `Выручка за период: ${Math.round(s.revenue).toLocaleString("ru-RU")} UZS.`,
      `Операционная прибыль: ${Math.round(s.profit).toLocaleString("ru-RU")} UZS.`,
      `Маржинальность: ${s.margin.toFixed(1)}%.`,
      `Food cost: ${s.foodCostPct.toFixed(1)}%.`,
      `Лидер продаж: ${best?.name || "—"} (${best?.sales || 0} шт.).`,
      `Товар с высокой маржой: ${weakest?.name || "—"}.`
    ],
    actions: [
      "Проверить позиции с низкой маржой и пересмотреть цену/себестоимость.",
      "Продвигать лидера продаж в комбо и повторных продажах.",
      "Контролировать расходы ежедневно, а не в конце недели."
    ]
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RestoPro running on port ${PORT}`);
});