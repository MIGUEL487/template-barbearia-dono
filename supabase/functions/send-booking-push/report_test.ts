import assert from "node:assert/strict";
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from "web-push";
import { handleRequest } from "./handler.ts";
Deno.test(
  "report push consent, auth, dedup, expiry, retries and safe route",
  async () => {
    const shop = "11111111-1111-1111-1111-111111111111",
      report = "33333333-3333-4333-8333-333333333333";
    let consent = true,
      manager = true,
      sends = 0,
      fail = 0,
      last = "",
      stale = false;
    let subs = [
      {
        id: "one",
        user_id: "owner",
        endpoint: "https://fcm.googleapis.com/one",
        p256dh: "fixture",
        auth: "fixture",
      },
      {
        id: "two",
        user_id: "staff",
        endpoint: "https://fcm.googleapis.com/two",
        p256dh: "fixture",
        auth: "fixture",
      },
    ];
    const receipts = new Map<string, Record<string, unknown>>();
    const server = Deno.serve(
      { hostname: "127.0.0.1", port: 0, onListen: () => {} },
      async (req) => {
        const u = new URL(req.url),
          table = u.pathname.split("/").pop();
        let result: unknown = [];
        if (table === "user") {
          const valid =
            req.headers.get("authorization") === "Bearer fixture-session";
          return Response.json(
            valid ? { id: "owner" } : { error: "bad session" },
            { status: valid ? 200 : 401 },
          );
        }
        if (table === "raiox_reports")
          result = {
            barbershop_id: shop,
            date: "2026-11-05",
            kind: "briefing",
            payload: {
              version: 4,
              current: { valid: 2 },
              window: {
                opens: new Date(
                  Date.now() - (stale ? 90000000 : 60000),
                ).toISOString(),
                closes: new Date(Date.now() + 3600000).toISOString(),
              },
            },
          };
        if (table === "shop_members")
          result = manager
            ? [
                { user_id: "owner", role: "owner" },
                { user_id: "staff", role: "barber" },
              ]
            : [];
        if (table === "raiox_notification_preferences")
          result = [
            { user_id: "owner", morning: consent, evening: true },
            { user_id: "staff", morning: true, evening: true },
          ];
        if (table === "push_subscriptions") {
          if (req.method === "DELETE") {
            subs = [];
            return new Response(null, { status: 204 });
          }
          result = subs;
        }
        if (table === "claim_booking_push_delivery") {
          const b = await req.json(),
            key = b.p_event_key + ":" + b.p_subscription_id,
            current = receipts.get(key);
          if (
            current &&
            (current.delivered_at ||
              Date.parse(String(current.locked_until)) > Date.now())
          )
            return Response.json(false);
          receipts.set(key, {
            delivered_at: null,
            locked_until: new Date(Date.now() + 90000).toISOString(),
            attempts: 1,
          });
          return Response.json(true);
        }
        if (table === "booking_push_deliveries") {
          const key =
            u.searchParams.get("event_key")!.slice(3) +
            ":" +
            u.searchParams.get("subscription_id")!.slice(3);
          if (req.method === "PATCH") {
            receipts.set(key, { ...receipts.get(key), ...(await req.json()) });
            return new Response(null, { status: 204 });
          }
          return Response.json(receipts.get(key) || null);
        }
        const userFilter = u.searchParams.get("user_id");
        if (userFilter && Array.isArray(result))
          result = result.filter((r) => r.user_id === userFilter.slice(3));
        if (
          (req.headers.get("accept") || "").includes("vnd.pgrst.object") &&
          Array.isArray(result)
        )
          result = result[0] || null;
        return Response.json(result);
      },
    );
    const keys = webpush.generateVAPIDKeys(),
      secret = "fixture-secret-".repeat(4),
    nextSecret=crypto.randomUUID()+crypto.randomUUID(),
      vars = {
        SUPABASE_URL: `http://127.0.0.1:${server.addr.port}`,
        SUPABASE_SERVICE_ROLE_KEY: "fixture-admin",
        BOOKING_WEBHOOK_SECRET: secret,
        BOOKING_WEBHOOK_SECRET_NEXT: nextSecret,
        VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: keys.privateKey,
        VAPID_SUBJECT: "mailto:test@example.test",
      };
    const old = Object.fromEntries(
      Object.keys(vars).map((k) => [k, Deno.env.get(k)]),
    );
    for (const [k, v] of Object.entries(vars)) Deno.env.set(k, v);
    const send = webpush.sendNotification;
    webpush.sendNotification = async (_s, p) => {
      sends++;
      last = String(p);
      if (fail) throw { statusCode: fail };
      return { statusCode: 201, body: "", headers: {} };
    };
    const request = (test = false, valid = true) =>
      new Request("http://local/function", {
        method: "POST",
        headers: {
          "x-booking-webhook-secret": valid ? nextSecret : "wrong",
          authorization:
            test && valid ? "Bearer fixture-session" : "Bearer invalid",
        },
        body: JSON.stringify(
          test
            ? { type: "RAIOX_TEST", barbershop_id: shop }
            : { type: "RAIOX_REPORT", report_id: report },
        ),
      });
    try {
      const preflight = await handleRequest(
        new Request("http://local/function", {
          method: "OPTIONS",
          headers: {
            origin:
              "https://template-barbearia-dono.mi-c-openheimer.workers.dev",
          },
        }),
      );
      assert.equal(preflight.status, 204);
      assert.equal(
        preflight.headers.get("Access-Control-Allow-Origin"),
        "https://template-barbearia-dono.mi-c-openheimer.workers.dev",
      );
      assert.equal(
        (
          await handleRequest(
            new Request("http://local/function", {
              method: "OPTIONS",
              headers: { origin: "https://untrusted.example" },
            }),
          )
        ).status,
        403,
      );
      assert.equal((await handleRequest(request(false, false))).status, 401);
      assert.equal(sends, 0);
      consent = false;
      await handleRequest(request());
      assert.equal(sends, 0);
      consent = true;
      assert.equal((await handleRequest(request())).status, 200);
      assert.equal(sends, 1);
      assert.match(last, /2 atendimentos/);
      assert.match(last, /\/raio-x\?date=2026-11-05&report=briefing/);
      assert(!/p256dh|endpoint|phone|customer|fixture-admin/.test(last));
      await handleRequest(request());
      assert.equal(sends, 1);
      receipts.clear();
      stale = true;
      await handleRequest(request());
      assert.equal(sends, 1);
      stale = false;
      assert.equal((await handleRequest(request(true, false))).status, 401);
      manager = false;
      assert.equal((await handleRequest(request(true))).status, 403);
      manager = true;
      await handleRequest(request(true));
      assert.equal(sends, 2);
      await handleRequest(request(true));
      assert.equal(sends, 2);
      receipts.clear();
      fail = 503;
      assert.equal((await handleRequest(request())).status, 503);
      assert.equal(sends, 3);
      for (const r of receipts.values())
        r.locked_until = new Date(Date.now() - 1).toISOString();
      fail = 0;
      await handleRequest(request());
      assert.equal(sends, 4);
      receipts.clear();
      fail = 410;
      await handleRequest(request());
      assert.equal(subs.length, 0);
    } finally {
      webpush.sendNotification = send;
      for (const [k, v] of Object.entries(old))
        v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
      await server.shutdown();
    }
  },
);
