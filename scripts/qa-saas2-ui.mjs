// Production source rendered through an isolated Next dev fixture. No real Supabase/network writes.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const root = process.cwd(),
  out = path.join(root, "docs/saas-2/evidencias");
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
  failLedger = false;
const calls = [];
const booking = (id, day, status = "completed") => ({
  id,
  barbershop_id: shop,
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
  if (req.method === "OPTIONS") {
    res.end();
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
  let rows = [];
  if (name === "shop_members")
    rows = denied
      ? []
      : [{ user_id: uid, barbershop_id: shop, role: memberRole }];
  if (name === "bookings") rows = history;
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
    rows = [{ id: customer, barbershop_id: shop, name: "Cliente Fixture" }];
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
const fixture = await fs.mkdtemp("/workspace/saas2-owner-qa-");
await fs.cp(path.join(root, "src"), path.join(fixture, "src"), {
  recursive: true,
});
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
const log = await fs.open("/tmp/saas2-next-fixture.log", "w");
const child = spawn(
  process.execPath,
  [path.join(root, "node_modules/next/dist/bin/next"), "dev", "-p", "8891"],
  {
    cwd: fixture,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-public-key",
      NEXT_PUBLIC_BARBERSHOP_ID: shop,
      NEXT_PUBLIC_DEMO_MODE: "false",
      NEXT_PUBLIC_DEMO_WATERMARK: "true",
      OPENAI_API_KEY: "",
    },
    stdio: ["ignore", log.fd, log.fd],
  },
);
let b;
const results = [];
const enc = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
try {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch("http://127.0.0.1:8891/login");
      if (r.status === 200) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  for (const width of [1440, 1024, 820, 390]) {
    const context = await b.newContext({
      viewport: { width, height: 1000 },
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
        enc({ alg: "HS256", typ: "JWT" }),
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
            expires_in: 3600,
            token_type: "bearer",
            user,
          }),
        url: "http://127.0.0.1:8891",
      },
    ]);
    const p = await context.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (
        m.type() === "error" &&
        /hydration|didn.t match|cannot be a descendant|same key/i.test(m.text())
      )
        errors.push(m.text());
    });
    for (const route of ["analises", "raio-x", "resgate", "fila-de-espera"]) {
      await p.goto("http://127.0.0.1:8891/" + route);
      await p.getByRole("heading", { level: 1 }).waitFor();
      await p.waitForFunction(
        () =>
          !document.body.innerText.includes("Atualizando indicadores") &&
          !document.body.innerText.includes("Atualizando diagnóstico") &&
          !document.body.innerText.includes("Consultando oportunidades") &&
          !document.body.innerText.includes("Consultando fila e horários"),
      );
      if (route === "analises") {
        await p.getByText("Como interpretar", { exact: true }).waitFor();
        await p.getByLabel("Período", { exact: true }).selectOption("today");
        await p.getByText("Google Analytics · não configurado").waitFor();
        const first = p
          .getByRole("button")
          .filter({ hasText: "Período selecionado" })
          .first();
        await first.click();
      }
      if (route === "raio-x") {
        await p.getByText("Raio-X do seu dia", { exact: true }).waitFor();
        await p
          .getByRole("spinbutton", { name: "Meta diária da loja (R$)" })
          .fill("500");
        await p
          .getByRole("button", { name: "Salvar meta", exact: true })
          .click();
        await p.getByText("Meta salva.", { exact: true }).waitFor();
        await p
          .getByRole("button", { name: "Gerar encerramento manual" })
          .click();
        await p.getByText(/Relatório salvo para a loja inteira/).waitFor();
        assert(
          await p
            .getByRole("button", { name: "Interpretar indicadores" })
            .isDisabled(),
        );
      }
      if (route === "resgate") {
        await p
          .getByText("Campanha de retorno · Demonstração — integração futura")
          .waitFor();
        await p.getByRole("button", { name: "Consultar sem reservar" }).click();
        await p.getByText(/Interpretação:/).waitFor();
        assert.equal(
          calls.filter(
            (c) =>
              c.name === "create_booking_hold" ||
              c.name === "create_group_booking_hold",
          ).length,
          0,
        );
      }
      if (route === "fila-de-espera") {
        await p.getByRole("heading", { name: "1. Ana Fixture" }).waitFor();
        await p
          .getByRole("button", { name: "Consultar vagas compatíveis" })
          .click();
        await p
          .getByRole("option", { name: /18:00/ })
          .waitFor({ state: "attached" });
        await p
          .getByLabel("Encaixe para Ana Fixture")
          .selectOption({ index: 1 });
        if (width === 390) {
          await p
            .getByRole("button", { name: "Criar pré-reserva para oferta" })
            .click();
          await p
            .getByText(/Pré-reserva criada. Entre em contato manualmente/)
            .waitFor();
        }
      }
      await p.waitForTimeout(300);
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${route} overflows ${width}`,
      );
      await p.screenshot({
        path: `${out}/${route}-${width}.png`,
        fullPage: true,
      });
      results.push({
        route,
        width,
        realServerActions: true,
        fixtureDatabase: true,
        noOverflow: true,
      });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Server actions must deny a logged-in actor without shop membership, even with a tenant env.
  denied = true;
  const c = await b.newContext();
  const exp = Math.floor(Date.now() / 1000) + 3600,
    user = { id: uid, aud: "authenticated", role: "authenticated" },
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
          user,
        }),
      url: "http://127.0.0.1:8891",
    },
  ]);
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:8891/analises");
  await p.getByRole("alert").filter({ hasText: "Acesso negado" }).waitFor();
  results.push({ security: "server action denies nonmember", passed: true });
  denied = false;
  memberRole = "barber";
  await p.reload();
  await p.getByRole("alert").filter({ hasText: "Acesso negado" }).waitFor();
  results.push({
    security: "financial analytics denies barber role",
    passed: true,
  });
  memberRole = "owner";
  failLedger = true;
  await p.reload();
  await p
    .getByRole("alert")
    .filter({ hasText: "Fixture ledger unavailable" })
    .waitFor();
  assert.equal(
    await p.getByText("Receita realizada", { exact: true }).count(),
    0,
  );
  results.push({
    security: "database error never becomes fake financial totals",
    passed: true,
  });
  await c.close();
  console.log(results);
} finally {
  await b?.close();
  child.kill("SIGTERM");
  await new Promise((r) => child.once("exit", r));
  await new Promise((r) => mock.close(r));
  await log.close();
  await fs.writeFile(
    path.join(out, "ui-results.json"),
    JSON.stringify(
      {
        results,
        calls: calls.map((c) => ({ name: c.name, method: c.method })),
      },
      null,
      2,
    ),
  );
  await fs.rm(fixture, { recursive: true, force: true });
}
