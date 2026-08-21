import express from "express";
import pg from "pg";
import crypto from "node:crypto";

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 3000);
const APP_PORT = 3101;
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }) : null;

app.use(express.json({ limit: "2mb" }));

const q = (text, params = []) => pool.query(text, params);
const roleOf = req => ["owner", "admin", "waiter"].includes(req.get("x-restopro-role")) ? req.get("x-restopro-role") : "owner";
const staffIdOf = req => Number(req.get("x-restopro-staff-id") || 0) || null;
const rid = async () => (await q("SELECT id FROM restaurants ORDER BY id LIMIT 1")).rows[0]?.id;

async function initAI() {
  if (!pool) return;
  await q(`
    CREATE TABLE IF NOT EXISTS ai_sessions (
      id TEXT PRIMARY KEY, restaurant_id BIGINT NOT NULL, role TEXT NOT NULL,
      staff_id BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ai_messages (
      id BIGSERIAL PRIMARY KEY, session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ai_memory (
      id BIGSERIAL PRIMARY KEY, restaurant_id BIGINT NOT NULL, category TEXT NOT NULL,
      memory_key TEXT NOT NULL, memory_value TEXT NOT NULL, importance INT NOT NULL DEFAULT 3,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(restaurant_id, memory_key)
    );
    CREATE TABLE IF NOT EXISTS ai_audit (
      id BIGSERIAL PRIMARY KEY, restaurant_id BIGINT NOT NULL, session_id TEXT, role TEXT NOT NULL,
      action TEXT NOT NULL, arguments JSONB, result JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

const permissions = {
  owner: new Set(["get_sales","get_inventory","get_low_stock","get_staff","get_staff_rating","get_top_dishes","get_orders","get_recipe","get_dashboard","remember_business_fact","create_report"]),
  admin: new Set(["get_sales","get_inventory","get_low_stock","get_staff","get_staff_rating","get_top_dishes","get_orders","get_recipe","get_dashboard","remember_business_fact","create_report"]),
  waiter: new Set(["get_orders","get_top_dishes","get_recipe","get_dashboard"])
};

async function tool(name, args, ctx) {
  const id = ctx.restaurantId;
  if (!permissions[ctx.role].has(name)) throw new Error(`Недостаточно прав для ${name}`);
  let rows;
  switch (name) {
    case "get_sales": rows = (await q(`SELECT created_at::date date, COUNT(*) orders, COALESCE(SUM(total),0) revenue, COALESCE(AVG(total),0) avg_check FROM orders WHERE restaurant_id=$1 AND status='paid' AND created_at >= CURRENT_DATE-INTERVAL '30 days' GROUP BY created_at::date ORDER BY date`, [id])).rows; break;
    case "get_inventory": rows = (await q("SELECT id,name,unit,stock,cost_per_unit,min_stock,(stock<=min_stock) low_stock FROM ingredients WHERE restaurant_id=$1 ORDER BY name", [id])).rows; break;
    case "get_low_stock": rows = (await q("SELECT name,unit,stock,min_stock FROM ingredients WHERE restaurant_id=$1 AND stock<=min_stock ORDER BY (stock-min_stock)", [id])).rows; break;
    case "get_staff": rows = (await q("SELECT id,name,role,base_salary,commission_pct,rating,active FROM staff WHERE restaurant_id=$1 ORDER BY active DESC,name", [id])).rows; if (ctx.role === "waiter" && ctx.staffId) rows = rows.filter(x => Number(x.id) === ctx.staffId).map(x => ({id:x.id,name:x.name,role:x.role,rating:x.rating,active:x.active})); break;
    case "get_staff_rating": rows = (await q(`SELECT s.name,s.rating,COUNT(o.id) FILTER(WHERE o.status='paid') orders,COALESCE(SUM(o.total) FILTER(WHERE o.status='paid'),0) sales FROM staff s LEFT JOIN orders o ON o.waiter_id=s.id WHERE s.restaurant_id=$1 AND s.role ILIKE '%официант%' GROUP BY s.id ORDER BY s.rating DESC,sales DESC`, [id])).rows; if (ctx.role === "waiter" && ctx.staffId) rows = rows.filter(x => Number(x.id) === ctx.staffId); break;
    case "get_top_dishes": rows = (await q(`SELECT d.name,SUM(oi.quantity) qty,COALESCE(SUM(oi.quantity*oi.price),0) revenue, d.price,d.cost,ROUND(CASE WHEN d.price>0 THEN ((d.price-d.cost)/d.price*100) ELSE 0 END,2) margin_pct FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN dishes d ON d.id=oi.dish_id WHERE o.restaurant_id=$1 AND o.status='paid' AND o.created_at>=CURRENT_DATE-INTERVAL '30 days' GROUP BY d.id ORDER BY revenue DESC LIMIT 20`, [id])).rows; break;
    case "get_orders": rows = (await q(`SELECT o.id,o.status,o.total,o.created_at,rt.name table_name,s.name waiter_name,COALESCE(json_agg(json_build_object('name',d.name,'quantity',oi.quantity,'price',oi.price)) FILTER(WHERE oi.id IS NOT NULL),'[]') items FROM orders o LEFT JOIN restaurant_tables rt ON rt.id=o.table_id LEFT JOIN staff s ON s.id=o.waiter_id LEFT JOIN order_items oi ON oi.order_id=o.id LEFT JOIN dishes d ON d.id=oi.dish_id WHERE o.restaurant_id=$1 GROUP BY o.id,rt.name,s.name ORDER BY o.created_at DESC LIMIT 50`, [id])).rows; if (ctx.role === "waiter" && ctx.staffId) rows = rows.filter(x => Number(x.waiter_id) === ctx.staffId); break;
    case "get_recipe": rows = (await q(`SELECT d.name dish_name,COALESCE(SUM(r.quantity*i.cost_per_unit),d.cost) cost,COALESCE(json_agg(json_build_object('ingredient',i.name,'unit',i.unit,'quantity',r.quantity)) FILTER(WHERE r.id IS NOT NULL),'[]') ingredients FROM dishes d LEFT JOIN recipes r ON r.dish_id=d.id LEFT JOIN ingredients i ON i.id=r.ingredient_id WHERE d.restaurant_id=$1 GROUP BY d.id ORDER BY d.name`, [id])).rows; break;
    case "get_dashboard": { const r=(await q(`SELECT COALESCE(SUM(total) FILTER(WHERE status='paid' AND created_at::date=CURRENT_DATE),0) revenue,COUNT(*) FILTER(WHERE created_at::date=CURRENT_DATE) orders,COALESCE(AVG(total) FILTER(WHERE status='paid' AND created_at::date=CURRENT_DATE),0) avg_check FROM orders WHERE restaurant_id=$1`,[id])).rows[0]; rows=[r]; break; }
    case "remember_business_fact": { const key=String(args.key||"").trim(), value=String(args.value||"").trim(), category=String(args.category||"business").trim(); if(!key||!value) throw new Error("Нужны key и value"); const r=await q(`INSERT INTO ai_memory(restaurant_id,category,memory_key,memory_value,importance) VALUES($1,$2,$3,$4,$5) ON CONFLICT(restaurant_id,memory_key) DO UPDATE SET category=EXCLUDED.category,memory_value=EXCLUDED.memory_value,importance=EXCLUDED.importance,updated_at=now() RETURNING *`,[id,category,key,value,Math.min(5,Math.max(1,Number(args.importance)||3))]); rows=r.rows; break; }
    case "create_report": rows=[(await q(`SELECT COUNT(*) orders,COALESCE(SUM(total),0) revenue,COALESCE(AVG(total),0) avg_check FROM orders WHERE restaurant_id=$1 AND status='paid' AND created_at>=CURRENT_DATE-INTERVAL '30 days'`,[id])).rows[0]]; break;
    default: throw new Error("Неизвестный инструмент");
  }
  await q("INSERT INTO ai_audit(restaurant_id,session_id,role,action,arguments,result) VALUES($1,$2,$3,$4,$5,$6)",[id,ctx.sessionId,ctx.role,name,args||{},rows||[]]);
  return rows;
}

const tools = [
  ["get_sales","Продажи и выручка за последние 30 дней",{}], ["get_inventory","Остатки склада",{}], ["get_low_stock","Ингредиенты ниже минимального остатка",{}], ["get_staff","Сотрудники и их параметры",{}], ["get_staff_rating","Рейтинг официантов и их продажи",{}], ["get_top_dishes","Лучшие блюда, выручка и маржа",{}], ["get_orders","Последние заказы и состав чеков",{}], ["get_recipe","Техкарты и себестоимость блюд",{}], ["get_dashboard","Сводка сегодняшнего дня",{}], ["remember_business_fact","Запомнить бизнес-факт ресторана",{key:"string",value:"string",category:"string",importance:"number"}], ["create_report","Создать краткую финансовую сводку",{}]
].map(([name,description,props])=>({type:"function",name,description,parameters:{type:"object",properties:Object.fromEntries(Object.entries(props).map(([k,v])=>[k,{type:v}])),required:Object.keys(props).filter(k=>k!=="importance")}}));

function system(role) {
  const agent = role === "owner" ? "управляющий AI" : role === "admin" ? "AI администратора" : "AI официанта";
  return `${agent} RestoPro. Работай только с данными инструментов, не выдумывай цифры. Язык ответа — русский, если пользователь не попросил другой. ${role==='waiter'?'Официанту нельзя раскрывать зарплаты, прибыль ресторана, данные других сотрудников или внутренние финансовые показатели.':''} Если пользователь сообщает устойчивое правило или предпочтение бизнеса, при наличии прав используй remember_business_fact. Отвечай конкретно и предлагай действие.`;
}

app.get("/health", async (_req,res)=>{ try { await q("SELECT 1"); res.json({ok:true,service:"restopro-ai-gateway",database:true,agent:true}); } catch(e) { res.status(503).json({ok:false,database:false,error:e.message}); } });
app.get("/api/ai/memory", async (req,res)=>{ try { const id=await rid(); const rows=(await q("SELECT category,memory_key,memory_value,importance,updated_at FROM ai_memory WHERE restaurant_id=$1 ORDER BY importance DESC,updated_at DESC",[id])).rows; res.json(rows); } catch(e){res.status(500).json({error:e.message});} });
app.get("/api/ai/analytics", async (_req,res)=>{ try { const id=await rid(); const [dash,low,staff,dishes]=await Promise.all([tool("get_dashboard",{}, {restaurantId:id,role:"owner",sessionId:"analytics"}),tool("get_low_stock",{}, {restaurantId:id,role:"owner",sessionId:"analytics"}),tool("get_staff_rating",{}, {restaurantId:id,role:"owner",sessionId:"analytics"}),tool("get_top_dishes",{}, {restaurantId:id,role:"owner",sessionId:"analytics"})]); res.json({dashboard:dash,lowStock:low,staff,topDishes:dishes}); } catch(e){res.status(500).json({error:e.message});} });

app.post("/api/ai/chat", async (req,res)=>{
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({error:"OPENAI_API_KEY не настроен в Railway"});
    const restaurantId=await rid(); const role=roleOf(req); const staffId=staffIdOf(req); const sessionId=String(req.body.sessionId||req.get("x-ai-session")||crypto.randomUUID());
    await q("INSERT INTO ai_sessions(id,restaurant_id,role,staff_id) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role,staff_id=EXCLUDED.staff_id,updated_at=now()",[sessionId,restaurantId,role,staffId]);
    const message=String(req.body.message||"").trim(); if(!message)return res.status(400).json({error:"Введите вопрос"});
    const history=(await q("SELECT role,content FROM ai_messages WHERE session_id=$1 ORDER BY created_at DESC LIMIT 20",[sessionId])).rows.reverse();
    const memories=(await q("SELECT category,memory_key,memory_value FROM ai_memory WHERE restaurant_id=$1 ORDER BY importance DESC,updated_at DESC LIMIT 30",[restaurantId])).rows;
    const input=[...history.map(x=>({role:x.role==='assistant'?'assistant':'user',content:x.content})),{role:"user",content:`Память ресторана: ${JSON.stringify(memories)}\nВопрос: ${message}`}];
    let response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5.6-luna",instructions:system(role),input,tools,max_output_tokens:1200})});
    let data=await response.json(); if(!response.ok)return res.status(response.status).json({error:data.error?.message||"OpenAI error"});
    for(let round=0;round<4;round++){
      const calls=(data.output||[]).filter(x=>x.type==='function_call'); if(!calls.length)break;
      const outputs=[]; for(const call of calls){let args={};try{args=JSON.parse(call.arguments||"{}")}catch{};try{const result=await tool(call.name,args,{restaurantId,role,staffId,sessionId});outputs.push({type:"function_call_output",call_id:call.call_id,output:JSON.stringify(result)});}catch(e){outputs.push({type:"function_call_output",call_id:call.call_id,output:JSON.stringify({error:e.message})});}}
      response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5.6-luna",instructions:system(role),previous_response_id:data.id,input:outputs,tools,max_output_tokens:1200})});
      data=await response.json(); if(!response.ok)return res.status(response.status).json({error:data.error?.message||"OpenAI error"});
    }
    const answer=data.output_text||"Не удалось получить ответ.";
    await q("INSERT INTO ai_messages(session_id,role,content) VALUES($1,'user',$2),($1,'assistant',$3)",[sessionId,message,answer]);
    await q("UPDATE ai_sessions SET updated_at=now() WHERE id=$1",[sessionId]);
    res.json({answer,sessionId,role});
  } catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

// Proxy the existing POS application so the new AI gateway does not replace its current routes.
process.env.PORT=String(APP_PORT);
await import("./server.mjs");

app.use(async (req,res)=>{
  try {
    const url=`http://127.0.0.1:${APP_PORT}${req.originalUrl}`;
    const headers={}; for(const [k,v] of Object.entries(req.headers)){if(k!=='host'&&k!=='content-length'&&typeof v==='string')headers[k]=v;}
    const init={method:req.method,headers}; if(!["GET","HEAD"].includes(req.method))init.body=JSON.stringify(req.body||{});
    const r=await fetch(url,init); res.status(r.status); r.headers.forEach((v,k)=>{if(!['content-encoding','transfer-encoding','connection'].includes(k))res.setHeader(k,v)}); const buf=Buffer.from(await r.arrayBuffer()); res.send(buf);
  }catch(e){res.status(502).json({error:"POS backend unavailable",detail:e.message});}
});

await initAI();
app.listen(PORT,"0.0.0.0",()=>console.log(`RestoPro AI Gateway running on ${PORT}`));
