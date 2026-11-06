import assert from "node:assert/strict";
import { webhookAuthorization } from "./webhook-auth.ts";
import { handleRequest } from "./handler.ts";
Deno.test(
  "dual-secret transition and explicit retirement preserve notifications",
  async () => {
    const old = crypto.randomUUID() + crypto.randomUUID(),
      next = crypto.randomUUID() + crypto.randomUUID();
    assert((await webhookAuthorization(old, old, undefined)).authorized);
    assert(!(await webhookAuthorization(next, old, undefined)).authorized);
    assert.equal(
      (await webhookAuthorization(old, old, next)).credential,
      "primary",
    );
    assert.equal(
      (await webhookAuthorization(next, old, next)).credential,
      "next",
    );
    for (const invalid of [undefined, "", "short"]) {
      assert((await webhookAuthorization(old, old, invalid)).authorized);
      assert(!(await webhookAuthorization(next, old, invalid)).authorized);
    }
    assert(!(await webhookAuthorization("", old, next)).authorized);
    assert(!(await webhookAuthorization("wrong", old, next)).authorized);
    assert(!(await webhookAuthorization(next, undefined, next)).authorized);
    assert(!(await webhookAuthorization(old, next, undefined)).authorized);
    assert((await webhookAuthorization(next, next, undefined)).authorized);
  },
);
Deno.test(
  "safe invalid-event auth probe uses neither database nor Web Push",
  async () => {
    const primary = crypto.randomUUID() + crypto.randomUUID(),
      next = crypto.randomUUID() + crypto.randomUUID();
    const vars = {
      BOOKING_WEBHOOK_SECRET: primary,
      BOOKING_WEBHOOK_SECRET_NEXT: next,
    };
    const original = Object.fromEntries(
      Object.keys(vars).map((k) => [k, Deno.env.get(k)]),
    );
    for (const [k, v] of Object.entries(vars)) Deno.env.set(k, v);
    const probe = (key: string) =>
      handleRequest(
        new Request("http://local", {
          method: "POST",
          headers: { "x-booking-webhook-secret": key },
          body: JSON.stringify({ type: "ROTATION_AUTH_PROBE" }),
        }),
      );
    try {
      for (const key of [primary, next]) {
        const r = await probe(key);
        assert.equal(r.status, 400);
        assert.deepEqual(await r.json(), { error: "Invalid booking event" });
      }
      assert.equal((await probe("wrong")).status, 401);
      Deno.env.set("BOOKING_WEBHOOK_SECRET", next);
      Deno.env.delete("BOOKING_WEBHOOK_SECRET_NEXT");
      assert.equal((await probe(primary)).status, 401);
      assert.equal((await probe(next)).status, 400);
    } finally {
      for (const [k, v] of Object.entries(original))
        v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
    }
  },
);
