// REQUER mock-supabase.cjs e build com variáveis de fixture local. Nunca aponta para banco real.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const url = process.env.TEST_BASE_URL || "http://127.0.0.1:8788";
  assert.equal(new URL(url).hostname, "127.0.0.1", "Use somente fixture local");
  await mkdir("docs/qa", { recursive: true });
  const results = [];
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(url + "/dashboard");
  assert.match(p.url(), /login/);
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const uid = "99999999-9999-4999-8999-999999999999";
  const access = [
    enc({ alg: "HS256", typ: "JWT" }),
    enc({
      sub: uid,
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    enc("synthetic-test-signature"),
  ].join(".");
  const session = {
    access_token: access,
    refresh_token: "local-fixture-refresh",
    token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: uid,
      email: "owner@example.test",
      aud: "authenticated",
      role: "authenticated",
    },
  };
  await p
    .context()
    .addCookies([
      {
        name: "sb-127-auth-token",
        value: "base64-" + enc(session),
        domain: "127.0.0.1",
        path: "/",
        httpOnly: false,
        sameSite: "Lax",
      },
    ]);
  let intercepted = 0;
  await p.route("**/rest/v1/**", async (r) => {
    intercepted++;
    const response = await r.fetch();
    await r.fulfill({ response });
  });
  for (const width of [360, 390, 768, 1024, 1440]) {
    await p.setViewportSize({ width, height: 900 });
    for (const path of [
      "dashboard",
      "agenda",
      "clientes",
      "financeiro",
      "servicos",
      "equipe",
      "configuracoes",
    ]) {
      const errors = [];
      const handler = (e) => errors.push(e.message);
      p.on("pageerror", handler);
      await p.goto(url + "/" + path);
      await p.waitForLoadState("networkidle");
      await p.waitForTimeout(400);
      await p.screenshot({
        path: `docs/qa/${path}-${width}.png`,
        fullPage: true,
      });
      const overflow = await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      results.push({ width, path, url: p.url(), errors, overflow });
      assert.equal(overflow, false, `${path} ${width} overflow`);
      assert(!p.url().includes("login"));
      assert.equal(errors.length, 0);
      p.off("pageerror", handler);
    }
  }
  await writeFile(
    "docs/qa/results.json",
    JSON.stringify({ fixture: true, intercepted, results }, null, 2),
  );
  console.log({ intercepted, screens: results.length });
  await b.close();
})();
