import { chromium } from "playwright";
import assert from "node:assert/strict";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const context = await b.newContext({ viewport: { width: 390, height: 844 } }),
    p = await context.newPage();
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString("base64url"),
    uid = "99999999-9999-4999-8999-999999999999";
  const access = [
    enc({ alg: "HS256", typ: "JWT" }),
    enc({
      sub: uid,
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    enc("local-fixture"),
  ].join(".");
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value:
        "base64-" +
        enc({
          access_token: access,
          refresh_token: "local-fixture",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: uid, aud: "authenticated" },
        }),
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await fetch("http://127.0.0.1:54329/fixture/role/owner");
  await p.goto("http://127.0.0.1:8788/agenda");
  await p.waitForLoadState("networkidle");
  await p.getByRole("button", { name: "Gerenciar atendimento" }).click();
  await p.getByRole("button", { name: "Concluir", exact: true }).click();
  const before = await (
    await fetch("http://127.0.0.1:54329/fixture/stats")
  ).json();
  await fetch("http://127.0.0.1:54329/fixture/role/outsider");
  await p
    .getByRole("button", { name: "Confirmar concluir", exact: true })
    .click();
  await p
    .getByRole("alert")
    .filter({ hasText: "Não foi possível atualizar" })
    .waitFor();
  const after = await (
    await fetch("http://127.0.0.1:54329/fixture/stats")
  ).json();
  assert.equal(after.rpcCalls, before.rpcCalls);
  console.log("PASS: action denied non-member before RPC; no database writes");
  await fetch("http://127.0.0.1:54329/fixture/role/owner");
  await p
    .getByRole("button", { name: "Confirmar concluir", exact: true })
    .click();
  await p.getByRole("dialog").waitFor({ state: "hidden" });
  const approved = await (
    await fetch("http://127.0.0.1:54329/fixture/stats")
  ).json();
  assert.equal(approved.rpcCalls, after.rpcCalls + 1);
  console.log("PASS: owner action reached exactly one mocked RPC");
} finally {
  await fetch("http://127.0.0.1:54329/fixture/role/owner");
  await b.close();
}
