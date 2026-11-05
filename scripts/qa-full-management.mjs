// Production source rendered through an isolated Next dev fixture. No real Supabase/network writes.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const root = process.cwd(),
  out = path.join(root, "docs/ai-free-only/evidencias");
await fs.mkdir(out, { recursive: true });
const shop = "11111111-1111-1111-1111-111111111111",
  uid = "99999999-9999-4999-8999-999999999999",
  barber = "22222222-2222-2222-2222-222222222221",
  service = "33333333-3333-3333-3333-333333333331",
  customer = "44444444-4444-4444-8444-444444444441";
const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date()),
  stamp = (d) => d + "T12:00:00Z";
let goal = [],
  closing = [],
  denied = false,
  memberRole = "owner",
  failLedger = false,
  missingSaas = false,
  emptyData = false;
let threads = [],
  messages = [],
  reports = [],
  manualLedger = [],
  missing3 = false;
const calls = [];
let providerFails = false;
let emptyManagement = false,
  failManagement = false;
let fixtureServices = [],
  fixtureBarbers = [];
const booking = (id, day, status = "completed") => ({
  id,
  barbershop_id: shop,
  customers: { id: customer, name: "Cliente Fixture", phone: "11900000000" },
  barbers: { name: "Carlos" },
  barber_id: barber,
  customer_id: customer,
  starts_at: stamp(day),
  ends_at: day + "T12:35:00Z",
  status,
  hold_expires_at: new Date(Date.now() + 900000).toISOString(),
  total_price: 50,
  booking_items: [
    {
      service_id: service,
      service_name: "Corte cadastrado",
      price: 50,
      duration_minutes: 30,
    },
  ],
});
const shift = (n) =>
  new Date(Date.parse(date + "T12:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const history = [
  booking("b1", date),
  booking("b2", shift(-35)),
  booking("b3", shift(-70)),
  booking("b4", date, "hold"),
  booking("b5", date, "cancelled"),
];
let waitlist = [
  {
    id: "55555555-5555-4555-8555-555555555555",
    barbershop_id: shop,
    barber_id: barber,
    service_ids: [service],
    customer_name: "Ana Fixture",
    phone: "11900000000",
    email: null,
    contact_channel: "phone",
    date,
    window_start: "09:00:00",
    window_end: "19:00:00",
    status: "waiting",
    created_at: stamp(date),
    offer_expires_at: null,
  },
];
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://fixture"),
    name = url.pathname.split("/").pop();
  let body = "";
  for await (const chunk of req) body += chunk;
  let payload = {};
  try {
    payload = JSON.parse(body || "{}");
  } catch {}
  calls.push({ name, method: req.method, body: payload });
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
  if (url.pathname === "/openrouter/models") {
    res.end(
      JSON.stringify({
        data: [
          {
            id: "fixture/model:free",
            supported_parameters: ["response_format", "structured_outputs"],
            pricing: { prompt: "0", completion: "0" },
          },
        ],
      }),
    );
    return;
  }
  if (url.pathname === "/openrouter/chat/completions") {
    if (providerFails) {
      res.statusCode = 402;
      res.end(
        JSON.stringify({
          error: { code: 402, message: "fixture-private-error-must-not-leak" },
        }),
      );
      return;
    }
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                resumo:
                  "Interpretação OpenRouter da fixture, sem chamada real.",
                pontos_positivos: [],
                pontos_de_atencao: [],
                sugestoes: [],
                prioridade: "normal",
              }),
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
          cost: 0,
        },
      }),
    );
    return;
  }
  if (name === "consume_raiox_ai_quota") {
    res.end("true");
    return;
  }
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  if (
    failManagement &&
    [
      "customers",
      "services",
      "barbers",
      "bookings",
      "financial_transactions",
      "site_settings",
    ].includes(name) &&
    req.method === "GET"
  ) {
    res.statusCode = 403;
    res.end(
      JSON.stringify({ code: "42501", message: "Falha de leitura da fixture" }),
    );
    return;
  }
  if (name === "user") {
    res.end(
      JSON.stringify({
        id: uid,
        email: "fixture@example.test",
        aud: "authenticated",
        role: "authenticated",
      }),
    );
    return;
  }
  if (
    missingSaas &&
    ["daily_goals", "day_closings", "waitlist_entries"].includes(name)
  ) {
    res.statusCode = 404;
    res.end(
      JSON.stringify({ code: "42P01", message: "relation missing fixture" }),
    );
    return;
  }
  if (
    missing3 &&
    (["raiox_conversations", "raiox_messages", "raiox_reports"].includes(
      name,
    ) ||
      (name === "financial_transactions" &&
        (url.searchParams.get("select") || "").includes("entry_status")))
  ) {
    res.statusCode = 404;
    res.end(
      JSON.stringify({
        code: "42703",
        message: "SaaS 3 fixture schema unavailable",
      }),
    );
    return;
  }
  if (name === "save_manual_financial_entry") {
    const id = payload.p_entry || crypto.randomUUID();
    let e = {
      id,
      barbershop_id: shop,
      booking_id: null,
      payment_id: null,
      type: payload.p_type,
      amount: payload.p_amount,
      description: payload.p_description,
      category: payload.p_category,
      created_at: payload.p_date + "T12:00:00-03:00",
      entry_status: payload.p_status,
      entry_origin: "manual",
      payment_label: payload.p_method,
      metadata: payload.p_metadata,
      bookings: null,
    };
    manualLedger = manualLedger.filter((r) => r.id !== id);
    manualLedger.push(e);
    res.end(JSON.stringify({ id, reused: false }));
    return;
  }
  if (name === "void_manual_financial_entry") {
    manualLedger = manualLedger.map((r) =>
      r.id === payload.p_entry ? { ...r, entry_status: "void" } : r,
    );
    res.end("null");
    return;
  }
  if (name === "delete_raiox_conversation") {
    threads = threads.filter((t) => t.id !== payload.p_conversation);
    messages = messages.filter(
      (m) => m.conversation_id !== payload.p_conversation,
    );
    res.end("null");
    return;
  }
  let rows = [];
  if (
    ["services", "barbers"].includes(name) &&
    ["POST", "PATCH"].includes(req.method)
  ) {
    let items = name === "services" ? fixtureServices : fixtureBarbers;
    if (req.method === "POST") {
      const item = { id: crypto.randomUUID(), ...payload };
      items.push(item);
      rows = [item];
    } else {
      const id = (url.searchParams.get("id") || "").slice(3);
      const extra = items.find((x) => x.id === id);
      if (extra) Object.assign(extra, payload);
      else items.push({ id, ...payload });
      rows = [{ id, ...payload }];
    }
    if (name === "services") fixtureServices = items;
    else fixtureBarbers = items;
    res.end(
      JSON.stringify(
        (req.headers.accept || "").includes("object") ? rows[0] : rows,
      ),
    );
    return;
  }

  if (name === "raiox_conversations") {
    if (req.method === "POST") {
      const t = {
        id: crypto.randomUUID(),
        ...payload,
        created_at: new Date().toISOString(),
      };
      threads.push(t);
      rows = [t];
    } else if (req.method === "PATCH") {
      const id = (url.searchParams.get("id") || "").slice(3);
      threads = threads.map((t) => (t.id === id ? { ...t, ...payload } : t));
      rows = threads.filter((t) => t.id === id);
    } else rows = threads;
  }
  if (name === "raiox_messages") {
    if (req.method === "POST") {
      const duplicate = messages.some(
        (m) =>
          m.conversation_id === payload.conversation_id &&
          m.request_id === payload.request_id &&
          m.role === payload.role,
      );
      if (duplicate) rows = [];
      else {
        const m = {
          id: crypto.randomUUID(),
          payload: {},
          ...payload,
          created_at: new Date(Date.now() + messages.length).toISOString(),
        };
        messages.push(m);
        rows = [m];
      }
    } else rows = messages;
  }
  if (name === "raiox_reports") {
    if (req.method === "POST") {
      const duplicate = reports.some(
        (r) =>
          r.barbershop_id === payload.barbershop_id &&
          r.date === payload.date &&
          r.kind === payload.kind,
      );
      if (duplicate) rows = [];
      else {
        const r = {
          id: crypto.randomUUID(),
          ...payload,
          generated_at: new Date().toISOString(),
        };
        reports.push(r);
        rows = [r];
      }
    } else rows = reports;
  }

  if (name === "shop_members")
    rows = denied
      ? []
      : [{ user_id: uid, barbershop_id: shop, role: memberRole }];
  if (name === "bookings") rows = history;
  if (name === "barbershops") rows = [{ id: shop }];
  if (name === "barbers")
    rows = [
      { id: barber, barbershop_id: shop, name: "Carlos", is_active: true },
    ];
  if (name === "services")
    rows = [
      {
        id: service,
        barbershop_id: shop,
        name: "Corte cadastrado",
        price: 50,
        duration_minutes: 30,
        buffer_minutes: 5,
        is_active: true,
      },
    ];
  if (name === "financial_transactions" && failLedger) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({ code: "XX000", message: "Fixture ledger unavailable" }),
    );
    return;
  }
  if (name === "financial_transactions")
    rows = [
      {
        id: "f1",
        barbershop_id: shop,
        booking_id: "b1",
        amount: 25,
        type: "income",
        created_at: stamp(date),
        bookings: { barber_id: barber },
      },
      {
        id: "f2",
        barbershop_id: shop,
        booking_id: null,
        amount: 5,
        type: "expense",
        created_at: stamp(date),
        bookings: null,
      },
    ];
  if (name === "working_hours")
    rows = Array.from({ length: 7 }, (_, day_of_week) => ({
      id: String(day_of_week),
      barber_id: barber,
      day_of_week,
      start_time: "09:00:00",
      end_time: "19:00:00",
      lunch_start: "12:00:00",
      lunch_end: "13:00:00",
      is_off: day_of_week === 0,
    }));
  if (name === "customers")
    rows = [
      {
        id: customer,
        barbershop_id: shop,
        name: "Cliente Fixture",
        phone: "11900000000",
        email: "fixture@example.test",
        notes: "Cliente de teste isolado",
        created_at: stamp(date),
        bookings: history,
      },
    ];
  if (name === "site_settings")
    rows = [
      {
        barbershop_id: shop,
        brand_name: "Auto Stilo",
        deposit_percentage: 0,
        cancellation_notice_hours: 24,
      },
    ];
  if (name === "daily_goals") {
    if (req.method === "POST") goal = [payload];
    rows = goal;
  }
  if (name === "day_closings") {
    if (req.method === "POST") closing = [payload];
    rows = closing;
  }
  if (name === "waitlist_entries") rows = waitlist;
  if (name === "get_availability" || name === "get_group_availability")
    rows = [
      {
        barber_id: barber,
        start_time: payload.p_date + "T18:00:00-03:00",
        end_time: payload.p_date + "T18:35:00-03:00",
      },
    ];
  if (name === "offer_waitlist") {
    waitlist = waitlist.map((e) => ({
      ...e,
      status: "offered",
      offered_booking_id: "hold-fixture",
      offer_expires_at: new Date(Date.now() + 900000).toISOString(),
    }));
    res.end(
      JSON.stringify({
        booking_id: "hold-fixture",
        cancellation_token: "local-offer-token",
        hold_expires_at: new Date(Date.now() + 900000).toISOString(),
      }),
    );
    return;
  }
  if (name === "cancel_waitlist") {
    waitlist = [];
    res.end("null");
    return;
  }
  if (name === "financial_transactions")
    rows = [
      ...rows.map((r, i) => ({
        ...r,
        description: i ? "Despesa fixture" : "Recebimento fixture",
        entry_status: "settled",
        entry_origin: "automatic",
        category: i ? "Energia" : "Serviços realizados",
      })),
      ...manualLedger,
    ];
  if (name === "services" || name === "barbers") {
    const extra = name === "services" ? fixtureServices : fixtureBarbers;
    if (req.method === "GET")
      rows = [
        ...rows.map((r) => ({ ...r, ...extra.find((x) => x.id === r.id) })),
        ...extra.filter((x) => !rows.some((r) => r.id === x.id)),
      ];
  }
  for (const [key, value] of url.searchParams) {
    if (
      ["select", "order", "offset", "limit", "on_conflict"].includes(key) ||
      key.includes(".")
    )
      continue;
    const dot = value.indexOf("."),
      op = value.slice(0, dot),
      v = value.slice(dot + 1);
    if (["eq", "gte", "gt", "lte", "lt"].includes(op))
      rows = rows.filter((r) => {
        const actual = String(r[key]);
        return op === "eq"
          ? actual === v
          : op === "gte"
            ? actual >= v
            : op === "gt"
              ? actual > v
              : op === "lte"
                ? actual <= v
                : actual < v;
      });
  }
  if (emptyData && ["bookings", "financial_transactions"].includes(name))
    rows = [];
  if (
    emptyManagement &&
    [
      "customers",
      "services",
      "barbers",
      "bookings",
      "financial_transactions",
    ].includes(name)
  )
    rows = [];
  const order = url.searchParams.get("order");
  if (order)
    rows = [...rows].sort((a, b) => {
      for (const rule of order.split(",")) {
        const [key, direction] = rule.split(".");
        const x = String(a[key] ?? "").localeCompare(String(b[key] ?? ""));
        if (x) return direction === "desc" ? -x : x;
      }
      return 0;
    });
  const offset = Number(url.searchParams.get("offset") || 0),
    limit = Number(url.searchParams.get("limit") || 1000);
  rows = rows.slice(offset, offset + limit);
  if ((req.headers.accept || "").includes("vnd.pgrst.object")) {
    if (rows.length === 1) res.end(JSON.stringify(rows[0]));
    else {
      res.statusCode = 406;
      res.end(JSON.stringify({ code: "PGRST116", message: "No rows" }));
    }
  } else res.end(JSON.stringify(rows));
});
await new Promise((r) => mock.listen(0, "127.0.0.1", r));
const supabaseUrl = `http://127.0.0.1:${mock.address().port}`;
const fixture = await fs.mkdtemp("/workspace/full-owner-qa-");
await fs.cp(path.join(root, "src"), path.join(fixture, "src"), {
  recursive: true,
});
// Fixture-only provider endpoint and runtime switch. Never copied into production.
const providerPath = path.join(fixture, "src/lib/saas2/openrouter.ts");
await fs.writeFile(
  providerPath,
  (await fs.readFile(providerPath, "utf8")).replace(
    'const api = "https://openrouter.ai/api/v1";',
    `const api = "${supabaseUrl}/openrouter";`,
  ),
);
const runtimePath = path.join(fixture, "src/lib/runtime-secret.ts");
const credentialFlag = path.join(fixture, ".qa-ai-enabled");
await fs.writeFile(
  runtimePath,
  'import {existsSync} from "node:fs";\n' +
    (await fs.readFile(runtimePath, "utf8")).replace(
      'nodeKey = process.env.OPENROUTER_API_KEY?.trim() || "";',
      `nodeKey = existsSync(${JSON.stringify(credentialFlag)}) ? "fixture-server-key" : "";`,
    ),
);
// Only the isolated report action gets an explicit after-close test clock.
// No clock override or fixture code is copied back into production source.
const reportActionPath = path.join(fixture, "src/app/actions/chat-actions.ts");
await fs.writeFile(
  reportActionPath,
  (await fs.readFile(reportActionPath, "utf8")).replace(
    "const now = Date.now(),",
    `const now = new Date('${date}T21:00:00-03:00').getTime(),`,
  ),
);
await fs.cp(path.join(root, "supabase"), path.join(fixture, "supabase"), {
  recursive: true,
});
for (const dir of ["public", "node_modules"])
  await fs.symlink(path.join(root, dir), path.join(fixture, dir));
for (const file of [
  "package.json",
  "tsconfig.json",
  "postcss.config.mjs",
  "tailwind.config.ts",
  "next-env.d.ts",
]) {
  try {
    await fs.copyFile(path.join(root, file), path.join(fixture, file));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const config = await fs.readFile(path.join(root, "next.config.mjs"), "utf8");
await fs.writeFile(
  path.join(fixture, "next.config.mjs"),
  config.replace(
    "export default config;",
    "config.output=undefined;config.headers=async()=>[];export default config;",
  ),
);
const log = await fs.open("/tmp/full-next-fixture.log", "w");
const child = spawn(
  process.execPath,
  [path.join(root, "node_modules/next/dist/bin/next"), "dev", "-p", "8897"],
  {
    cwd: fixture,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-public-key",
      NEXT_PUBLIC_BARBERSHOP_ID: "",
      NEXT_PUBLIC_DEMO_MODE: "false",
      NEXT_PUBLIC_DEMO_WATERMARK: "true",
      OPENROUTER_API_KEY: "",
      OPENROUTER_MODEL: "fixture/model:free",
    },
    stdio: ["ignore", log.fd, log.fd],
  },
);
let b;
const results = [];
const enc = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
async function choose(locator, choice) {
  const page = locator.page();
  await locator.click();
  const list = page.getByRole("listbox").last();
  if (typeof choice === "object")
    await list.getByRole("option").nth(choice.index).click();
  else
    await list.locator("[data-value=" + JSON.stringify(choice) + "]").click();
  await list.waitFor({ state: "hidden" });
}
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:8897/login")).status === 200) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  for (const width of process.env.QA_WIDTHS
    ? process.env.QA_WIDTHS.split(",").map(Number)
    : [1440, 1024, 820, 390]) {
    const context = await b.newContext({
      viewport: { width, height: 1000 },
      timezoneId: "America/Sao_Paulo",
      locale: "pt-BR",
      reducedMotion: width === 820 ? "reduce" : "no-preference",
    });
    const exp = Math.floor(Date.now() / 1000) + 3600,
      user = {
        id: uid,
        aud: "authenticated",
        role: "authenticated",
        email: "fixture@example.test",
      },
      access = [
        enc({ alg: "HS256" }),
        enc({ ...user, sub: uid, exp }),
        enc("fixture"),
      ].join(".");
    await context.addCookies([
      {
        name: "sb-127-auth-token",
        value:
          "base64-" +
          enc({
            access_token: access,
            refresh_token: "fixture",
            expires_at: exp,
            user,
          }),
        url: "http://127.0.0.1:8897",
      },
    ]);
    const p = await context.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("dialog", (d) => d.accept());
    for (const route of [
      "dashboard",
      "agenda",
      "clientes",
      "servicos",
      "equipe",
      "configuracoes",
      "suporte",
    ]) {
      await p.goto("http://127.0.0.1:8897/" + route);
      await p.getByRole("heading", { level: 1 }).waitFor();
      await p.waitForTimeout(500);
      assert.equal(
        await p.locator("main.management-workspace").count(),
        1,
        route + " missing shared layout",
      );
      if (width >= 1024) {
        const box = await p.locator("main.management-workspace").boundingBox();
        assert(box.y < 100, route + " header must align with sidebar");
      }
      if (route === "agenda") {
        await p.getByText("Carlos", { exact: true }).first().waitFor();
        await p
          .getByRole("button", { name: "Agendamento Rápido", exact: true })
          .click();
        const modal = p.getByRole("dialog");
        await modal.waitFor();
        await p.waitForTimeout(220);
        await p.screenshot({ path: `${out}/agenda-modal-${width}.png` });
        await p.keyboard.press("Escape");
        await modal.waitFor({ state: "hidden" });
        await p.getByRole("button", { name: "Abrir seletor de data" }).click();
        await p.waitForTimeout(200);
        await p.screenshot({ path: `${out}/agenda-calendario-${width}.png` });
        await p.keyboard.press("Escape");
        assert.equal(
          await p
            .getByRole("button", { name: "Abrir seletor de data" })
            .getAttribute("aria-expanded"),
          "false",
        );
      }
      if (route === "clientes") {
        await p.getByText("Cliente Fixture", { exact: true }).waitFor();
        await p
          .getByRole("button", { name: "Ver perfil", exact: true })
          .click();
        await p.getByRole("dialog").waitFor();
        await p
          .getByRole("heading", { name: "Histórico de atendimentos" })
          .waitFor();
        await p.waitForTimeout(220);
        await p.screenshot({ path: `${out}/cliente-perfil-${width}.png` });
        await p.getByRole("button", { name: "Fechar perfil" }).click();
        await p.getByRole("dialog").waitFor({ state: "hidden" });
        await p.getByLabel("Buscar clientes").fill("sem-resultado");
        await p.getByText("Nenhum cliente localizado na pesquisa.").waitFor();
        await p.getByLabel("Buscar clientes").fill("");
      }
      if (route === "servicos") {
        await p
          .getByRole("button", { name: "Novo Serviço", exact: true })
          .click();
        const modal = p.getByRole("dialog");
        await modal.waitFor();
        await modal
          .getByLabel("Nome do serviço")
          .fill("Procedimento fixture " + width);
        await modal.getByLabel("Preço do serviço").fill("70");
        await p.waitForTimeout(220);
        await p.screenshot({ path: `${out}/servico-modal-${width}.png` });
        await p.keyboard.press("Escape");
        await modal.waitFor({ state: "hidden" });
        if (width === 1440) {
          await p
            .getByRole("button", { name: "Novo Serviço", exact: true })
            .click();
          await modal
            .getByLabel("Nome do serviço")
            .fill("Cadastro serviço fixture");
          await modal.getByLabel("Preço do serviço").fill("70");
          await modal
            .getByRole("button", { name: "Salvar Serviço", exact: true })
            .click();
          await modal.waitFor({ state: "hidden" });
          await p
            .getByText("Cadastro serviço fixture", { exact: true })
            .waitFor();
        }
      }
      if (route === "equipe") {
        await p
          .getByRole("button", { name: "Configurar Carlos", exact: true })
          .waitFor();
        await p
          .getByRole("button", { name: "Configurar Carlos", exact: true })
          .click();
        await p
          .getByRole("heading", { name: "Expediente de Carlos", exact: true })
          .waitFor();
        await p.getByLabel("Segunda-feira — Entrada").fill("09:30");
        await p
          .getByRole("button", { name: "Adicionar Barbeiro", exact: true })
          .click();
        await p.getByRole("dialog").waitFor();
        await p.getByLabel("Nome do profissional").fill("Profissional fixture");
        await p.waitForTimeout(220);
        await p.screenshot({ path: `${out}/equipe-modal-${width}.png` });
        await p.keyboard.press("Escape");
        await p.getByRole("dialog").waitFor({ state: "hidden" });
      }
      if (route === "configuracoes") {
        await p.getByLabel("Percentual do sinal").fill("40");
        assert.equal(
          await p.getByLabel("Percentual do sinal").inputValue(),
          "40",
        );
      }
      if (route === "suporte") {
        const q = p.locator(".ui-expandable-trigger").first();
        await q.click();
        assert.equal(await q.getAttribute("aria-expanded"), "true");
        await p.waitForTimeout(240);
        await p.screenshot({ path: `${out}/suporte-aberto-${width}.png` });
        await q.click();
      }
      await p.waitForTimeout(200);
      await p.screenshot({
        path: `${out}/${route}-${width}.png`,
        fullPage: true,
      });
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        route + " overflow",
      );
    }
    await p.goto("http://127.0.0.1:8897/analises");
    await p
      .getByRole("heading", { name: "Evolução da receita", exact: true })
      .waitFor();
    await p.getByRole("button", { name: "Hoje", exact: true }).click();
    await p.getByRole("heading", { name: "Ritmo da agenda" }).waitFor();
    await choose(p.getByLabel("Data no gráfico").first(), { index: 0 });
    const seriesControl = p
      .getByRole("combobox", { name: "Séries da receita" })
      .first();
    await seriesControl.focus();
    await seriesControl.press("ArrowDown");
    assert.equal(await seriesControl.getAttribute("aria-expanded"), "true");
    await p.waitForTimeout(200);
    await p.screenshot({
      path: `${out}/seletor-aberto-${width}.png`,
      fullPage: true,
    });
    await seriesControl.press("End");
    await seriesControl.press("Enter");
    await p
      .getByRole("listbox", { name: "Séries da receita", exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(await seriesControl.getAttribute("aria-expanded"), "false");
    await choose(seriesControl, "both");
    const explain = p.getByRole("button", {
      name: "Como interpretar os cálculos",
      exact: true,
    });
    await explain.click();
    assert.equal(await explain.getAttribute("aria-expanded"), "true");
    await p.waitForTimeout(250);
    await p.screenshot({
      path: `${out}/expansao-aberta-${width}.png`,
      fullPage: true,
    });
    await explain.click();
    await p.waitForTimeout(250);
    assert.equal(await explain.getAttribute("aria-expanded"), "false");
    await p.getByRole("button", { name: "Personalizado", exact: true }).click();
    await p.getByLabel("De", { exact: true }).fill(shift(-2));
    await p.getByLabel("Até", { exact: true }).fill(date);
    await p.waitForTimeout(250);
    await p.screenshot({
      path: `${out}/analises-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await p.goto("http://127.0.0.1:8897/financeiro");
    await p
      .getByRole("button", { name: "Registrar compra", exact: true })
      .waitFor({ state: "visible" });
    await p
      .getByRole("button", { name: "Registrar compra", exact: true })
      .click();
    const dialog = p.getByRole("dialog");
    await p.waitForTimeout(250);
    await p.screenshot({
      path: `${out}/modal-aberto-${width}.png`,
      fullPage: false,
    });
    await dialog
      .getByLabel("Descrição", { exact: true })
      .fill("Pomadas fixture " + width);
    await dialog.getByLabel("Quantidade (opcional)").fill("2");
    await dialog.getByLabel("Valor unitário (R$)").fill("20,00");
    await dialog.getByLabel("Fornecedor (opcional)").fill("Fornecedor fixture");
    await dialog
      .getByRole("button", { name: "Salvar movimentação", exact: true })
      .click();
    await p
      .getByRole("status")
      .filter({ hasText: "Movimentação salva" })
      .waitFor();
    await dialog.waitFor({ state: "hidden" });
    await p
      .getByLabel("Pesquisar movimentações")
      .fill("Pomadas fixture " + width);
    await p
      .getByRole("cell", { name: "Pomadas fixture " + width, exact: true })
      .waitFor();
    await p.getByRole("button", { name: "Editar", exact: true }).click();
    await dialog.getByLabel("Valor unitário (R$)").fill("25,00");
    await dialog
      .getByRole("button", { name: "Salvar movimentação", exact: true })
      .click();
    await p
      .getByRole("status")
      .filter({ hasText: "Movimentação salva" })
      .waitFor();
    await dialog.waitFor({ state: "hidden" });
    const downloadPromise = p.waitForEvent("download");
    await p.getByRole("button", { name: "Exportar CSV" }).click();
    const download = await downloadPromise;
    assert(download.suggestedFilename().endsWith(".csv"));
    await p.getByRole("button", { name: "Anular", exact: true }).click();
    await p
      .getByRole("status")
      .filter({ hasText: "Lançamento anulado" })
      .waitFor();
    await p.getByLabel("Pesquisar movimentações").fill("");
    await p
      .getByRole("button", { name: "Registrar venda", exact: true })
      .click();
    await dialog
      .getByLabel("Descrição", { exact: true })
      .fill("Venda pendente fixture " + width);
    await dialog.getByLabel("Valor total (R$)").fill("90,00");
    await choose(dialog.getByLabel("Status", { exact: true }), "pending");
    await dialog
      .getByRole("button", { name: "Salvar movimentação", exact: true })
      .click();
    await p
      .getByRole("status")
      .filter({ hasText: "Movimentação salva" })
      .waitFor();
    await dialog.waitFor({ state: "hidden" });
    await p.waitForTimeout(250);
    await p.screenshot({
      path: `${out}/financeiro-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await p.goto("http://127.0.0.1:8897/raio-x");
    const reportDetails = p.getByRole("button", {
      name: "Detalhes deste relatório",
      exact: true,
    });
    await reportDetails.waitFor();
    await reportDetails.click();
    await p.getByText(/Resumo calculado dos registros da loja/).waitFor();
    assert(p.url().endsWith("/raio-x"));
    await p.waitForTimeout(220);
    await p.screenshot({
      path: `${out}/raio-x-relatorio-inline-${width}.png`,
      fullPage: true,
    });
    const entry = p.getByRole("textbox", { name: "Mensagem para o Raio-X" });
    await entry.fill("Teste de quebra");
    await entry.press("Shift+Enter");
    assert((await entry.inputValue()).includes("\n"));
    await entry.fill("");
    await p
      .locator(".s3-shortcuts")
      .getByRole("button", { name: "Resumo de hoje", exact: true })
      .waitFor();
    await p
      .locator(".s3-shortcuts")
      .getByRole("button", { name: "Resumo de hoje", exact: true })
      .click();
    await p
      .getByText("Raio-X · resumo calculado", { exact: true })
      .first()
      .waitFor();
    await p
      .getByRole("textbox", { name: "Mensagem para o Raio-X" })
      .fill("Como estão minhas despesas esta semana?");
    await p.getByRole("button", { name: "Enviar ↗", exact: true }).click();
    await p
      .getByText("Raio-X · resumo calculado", { exact: true })
      .nth(1)
      .waitFor();
    assert.equal(
      messages.filter((m) => m.role === "assistant").length >= 2,
      true,
    );
    await p
      .getByRole("button", { name: "+ Nova conversa", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Resumo de hoje", exact: true })
      .last()
      .click();
    await p
      .getByText("Raio-X · resumo calculado", { exact: true })
      .first()
      .waitFor();
    await p.reload();
    assert.equal(await p.getByRole("dialog").isVisible(), false);
    if (width >= 1024) {
      const sidebar = await p.locator(".admin-sidebar").boundingBox();
      assert.equal(sidebar.x, 0);
      assert.equal(sidebar.y, 0);
      assert.equal(Math.round(sidebar.height), p.viewportSize().height);
    }
    await p
      .getByRole("button", { name: "Histórico e opções", exact: true })
      .click();
    await p.getByRole("dialog").waitFor();
    await p.waitForTimeout(220);
    await p.screenshot({ path: `${out}/raio-x-historico-${width}.png` });
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Resumo de hoje", exact: true })
      .first()
      .click();
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    await p
      .getByText("Raio-X · resumo calculado", { exact: true })
      .first()
      .waitFor();
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${out}/raio-x-${width}.png`, fullPage: true });
    await fs.writeFile(credentialFlag, "fixture");
    await p.goto("http://127.0.0.1:8897/raio-x");
    const integrationQuestion = `OpenRouter integração ${width}`;
    await p
      .getByRole("textbox", { name: "Mensagem para o Raio-X" })
      .fill(integrationQuestion);
    await p.getByRole("button", { name: "Enviar ↗", exact: true }).click();
    await p
      .getByText("Raio-X · dados calculados + OpenRouter", { exact: true })
      .waitFor();
    await p.getByText(/Interpretação OpenRouter da fixture/).waitFor();
    assert(
      messages.some(
        (m) =>
          m.payload?.mode === "openrouter" && m.payload?.aiUsage?.costUsd === 0,
      ),
    );
    await p.reload();
    await p
      .getByRole("button", { name: "Histórico e opções", exact: true })
      .click();
    await p
      .getByRole("dialog")
      .getByRole("button", { name: integrationQuestion, exact: true })
      .click();
    await p
      .getByText("Raio-X · dados calculados + OpenRouter", { exact: true })
      .waitFor();
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    await p.waitForFunction(() => {
      const b = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "+ Nova conversa",
      );
      return b && !b.disabled;
    });
    await p.waitForTimeout(250);
    await p.screenshot({
      path: `${out}/openrouter-chat-${width}.png`,
      fullPage: true,
    });
    providerFails = true;
    const postBefore = calls.filter((c) => c.name === "completions").length;
    await p
      .getByRole("textbox", { name: "Mensagem para o Raio-X" })
      .fill(`Verificar créditos ${width}`);
    assert.equal(
      await p
        .getByRole("textbox", { name: "Mensagem para o Raio-X" })
        .inputValue(),
      `Verificar créditos ${width}`,
    );
    await p.getByRole("button", { name: "Enviar ↗", exact: true }).click();
    await p
      .getByText(/Créditos insuficientes no OpenRouter/)
      .first()
      .waitFor();
    assert.equal(
      calls.filter((c) => c.name === "completions").length,
      postBefore + 1,
    );
    assert(
      !(await p.locator("body").innerText()).includes(
        "fixture-private-error-must-not-leak",
      ),
    );
    providerFails = false;
    await fs.rm(credentialFlag, { force: true });
    await p.goto("http://127.0.0.1:8897/raio-x");
    const before = reports.length;
    await p
      .getByRole("button", { name: "Relatórios do expediente", exact: true })
      .click();
    await p.waitForTimeout(250);
    await p.screenshot({
      path: `${out}/relatorios-${width}.png`,
      fullPage: true,
    });
    await p.reload();
    await p
      .getByRole("button", { name: "Relatórios do expediente", exact: true })
      .waitFor();
    assert.equal(reports.length, before);
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    for (const route of ["resgate", "fila-de-espera", "configuracoes"]) {
      await p.goto("http://127.0.0.1:8897/" + route);
      await p.getByRole("heading", { level: 1 }).waitFor();
      await p.waitForTimeout(500);
      await p.waitForTimeout(250);
      await p.screenshot({
        path: `${out}/${route}-${width}.png`,
        fullPage: true,
      });
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        route + " overflows " + width,
      );
    }
    if (width < 1024) {
      await p.emulateMedia({ reducedMotion: "reduce" });
      const more = p.getByRole("button", { name: "Mais", exact: true });
      await more.click();
      const menu = p.getByRole("region", { name: "Mais opções", exact: true });
      await menu.waitFor();
      await p.waitForTimeout(220);
      await p.screenshot({
        path: `${out}/menu-aberto-${width}.png`,
        fullPage: true,
      });
      await p.keyboard.press("Escape");
      await menu.waitFor({ state: "hidden" });
      assert(await more.evaluate((el) => el === document.activeElement));
    }
    assert.deepEqual(errors, []);
    results.push({
      width,
      analytics: true,
      ledgerPurchaseEditVoidSale: true,
      csv: true,
      persistentChat: true,
      idempotentReports: true,
      noOverflow: true,
    });
    await context.close();
  }
  // Compatibility: no new schema must not enable write UI or fabricate saved conversations.
  missing3 = true;
  manualLedger = [];
  const c = await b.newContext({ viewport: { width: 390, height: 900 } });
  const exp = Math.floor(Date.now() / 1000) + 3600,
    access = [
      enc({ alg: "HS256" }),
      enc({ sub: uid, exp }),
      enc("fixture"),
    ].join(".");
  await c.addCookies([
    {
      name: "sb-127-auth-token",
      value:
        "base64-" +
        enc({
          access_token: access,
          refresh_token: "fixture",
          expires_at: exp,
          user: { id: uid },
        }),
      url: "http://127.0.0.1:8897",
    },
  ]);
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:8897/financeiro");
  await p.getByText(/Livro-caixa existente em leitura/).waitFor();
  assert(
    await p
      .getByRole("button", { name: "Registrar compra", exact: true })
      .isDisabled(),
  );
  await p.goto("http://127.0.0.1:8897/raio-x");
  await p.getByText(/Histórico aguardando a migration SaaS 3.0/).waitFor();
  await p
    .getByRole("textbox", { name: "Mensagem para o Raio-X" })
    .fill("Quanto faturei hoje?");
  await p.getByRole("button", { name: "Enviar ↗" }).click();
  await p.getByText(/Prévia calculada sem histórico/).waitFor();
  await p
    .getByRole("button", { name: "Histórico e opções", exact: true })
    .click();
  await p.getByRole("button", { name: "Conexão IA", exact: true }).click();
  await p.getByText(/missing_runtime_key/).waitFor();
  const quotaBefore = calls.filter(
    (c) => c.name === "consume_raiox_ai_quota",
  ).length;
  await p
    .getByRole("button", { name: "Testar integração", exact: true })
    .click();
  await p.getByText(/missing_runtime_key/).waitFor();
  assert.equal(
    calls.filter((c) => c.name === "consume_raiox_ai_quota").length,
    quotaBefore,
  );
  await p.screenshot({
    path: `${out}/ai-diagnostic-missing-runtime.png`,
    fullPage: true,
  });
  results.push({
    missingSchema: true,
    readOnlyLedger: true,
    explicitUnsavedChat: true,
  });
  missing3 = false;
  emptyData = true;
  await p.goto("http://127.0.0.1:8897/analises");
  await p
    .getByRole("heading", { name: "Sua história começa com os registros." })
    .waitFor();
  await p.goto("http://127.0.0.1:8897/financeiro");
  await p
    .getByRole("heading", { name: "Nenhuma movimentação neste filtro." })
    .waitFor();
  assert(
    reports.some((r) => r.kind === "briefing"),
    "Automatic briefing not generated",
  );
  assert(
    reports.some((r) => r.kind === "closing"),
    "Automatic closing not generated",
  );
  assert.equal(
    new Set(reports.map((r) => r.barbershop_id + r.date + r.kind)).size,
    reports.length,
  );
  results.push({
    emptyAnalytics: true,
    emptyLedger: true,
    generatedBriefing: true,
    generatedClosing: true,
  });
  emptyData = false;
  emptyManagement = true;
  for (const route of [
    "dashboard",
    "agenda",
    "clientes",
    "servicos",
    "equipe",
  ]) {
    await p.goto("http://127.0.0.1:8897/" + route);
    await p.getByRole("heading", { level: 1 }).waitFor();
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}/${route}-vazio.png`, fullPage: true });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  }
  emptyManagement = false;
  failManagement = true;
  for (const route of [
    "dashboard",
    "agenda",
    "clientes",
    "servicos",
    "equipe",
    "configuracoes",
    "financeiro",
    "analises",
    "raio-x",
    "resgate",
    "fila-de-espera",
  ]) {
    await p.goto("http://127.0.0.1:8897/" + route);
    await p.getByRole("heading", { level: 1 }).waitFor();
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/${route}-erro.png`, fullPage: true });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  }
  failManagement = false;
  await c.clearCookies();
  await p.goto("http://127.0.0.1:8897/login");
  await p.locator("input[type=email]").fill("fixture@example.test");
  await p.locator("input[type=password]").fill("fixture");
  await p.screenshot({ path: `${out}/login-390.png`, fullPage: true });
  results.push({
    managementPages: true,
    supportRoute: true,
    profileHistory: true,
    quickBookingAndStaffModals: true,
    emptyManagement: true,
    dataErrors: true,
    login: true,
  });
  await c.close();
  console.log(results);
} catch (error) {
  console.error(
    "Fixture state",
    JSON.stringify({
      threads: threads.length,
      messages: messages.length,
      reports: reports.map((r) => ({ date: r.date, kind: r.kind })),
    }),
  );
  throw error;
} finally {
  await b?.close();
  if (child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise((r) => child.once("exit", r));
    child.kill("SIGTERM");
    await stopped;
  }
  await new Promise((r) => mock.close(r));
  await log.close();
  await fs.writeFile(
    path.join(out, "ui-results.json"),
    JSON.stringify(
      {
        results,
        calls: [
          ...calls.reduce((map, c) => {
            const key = c.method + " " + c.name;
            map.set(key, (map.get(key) || 0) + 1);
            return map;
          }, new Map()),
        ].map(([operation, count]) => ({ operation, count })),
      },
      null,
      2,
    ),
  );
  await fs.rm(fixture, { recursive: true, force: true });
}
