import type { SupabaseClient } from "@supabase/supabase-js";
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from "web-push";
import { notificationEventId } from "../_shared/booking-notification.ts";
export async function sendReportPush(
  db: SupabaseClient,
  event: { type: string; report_id?: string; barbershop_id?: string },
  request: Request,
  allowed: (endpoint: string) => boolean,
) {
  const test = event.type === "RAIOX_TEST";
  let shop: string,
    userId: string | null = null,
    title: string,
    body: string,
    url: string,
    eventKey: string;
  if (test) {
    const token =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    shop = event.barbershop_id || "";
    userId = data.user.id;
    const member = await db
      .from("shop_members")
      .select("role")
      .eq("barbershop_id", shop)
      .eq("user_id", userId)
      .maybeSingle();
    if (
      member.error ||
      !member.data ||
      !["owner", "admin"].includes(member.data.role)
    )
      return Response.json({ error: "Forbidden" }, { status: 403 });
    title = "Auto Stilo — Teste de relatório";
    body =
      "Este aparelho está pronto para receber seus relatórios autorizados.";
    url = "/raio-x";
    eventKey = `report-test:${shop}:${userId}:${Math.floor(Date.now() / 60000)}`;
  } else {
    const report = await db
      .from("raiox_reports")
      .select("barbershop_id,date,kind,payload")
      .eq("id", event.report_id)
      .maybeSingle();
    if (report.error) throw report.error;
    if (!report.data || report.data.payload?.version !== 4)
      return Response.json({ skipped: "report unavailable" });
    const r = report.data;
    shop = r.barbershop_id;
    // Never send a stale/future report, including a replayed webhook.
    const due = Date.parse(
      r.kind === "briefing"
        ? r.payload.window?.opens
        : r.payload.window?.closes,
    );
    if (
      !Number.isFinite(due) ||
      Date.now() < due ||
      Date.now() - due > 86400000
    )
      return Response.json({ skipped: "outside report window" });
    title =
      r.kind === "briefing"
        ? "Auto Stilo — Seu dia começou"
        : "Auto Stilo — Expediente encerrado";
    body =
      r.kind === "briefing"
        ? `Você tem ${Number(r.payload.current?.valid) || 0} atendimentos previstos. Confira seu Raio-X e planeje o expediente.`
        : "Seu fechamento está disponível. Confira receitas, despesas e resultados do dia.";
    url = `/raio-x?date=${r.date}&report=${r.kind}`;
    eventKey = `raiox4:${shop}:${r.date}:${r.kind}`;
  }
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY"),
    privateKey = Deno.env.get("VAPID_PRIVATE_KEY"),
    subject = Deno.env.get("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject)
    return Response.json({ error: "Push secrets missing" }, { status: 503 });
  const subs = await db
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .eq("barbershop_id", shop);
  if (subs.error) throw subs.error;
  const members = await db
    .from("shop_members")
    .select("user_id,role")
    .eq("barbershop_id", shop);
  if (members.error) throw members.error;
  const managers = new Set(
    members.data
      .filter((m) => ["owner", "admin"].includes(m.role))
      .map((m) => m.user_id),
  );
  const preferences = await db
    .from("raiox_notification_preferences")
    .select("user_id,morning,evening")
    .eq("barbershop_id", shop);
  if (preferences.error) throw preferences.error;
  let kind = "briefing";
  if (!test) {
    const r = await db
      .from("raiox_reports")
      .select("kind")
      .eq("id", event.report_id)
      .single();
    if (r.error) throw r.error;
    kind = r.data.kind;
  }
  const authorized = new Set(
    preferences.data
      .filter((p) => (kind === "briefing" ? p.morning : p.evening))
      .map((p) => p.user_id),
  );
  const targets = subs.data.filter(
    (s) =>
      managers.has(s.user_id) &&
      (test ? s.user_id === userId : authorized.has(s.user_id)),
  );
  const eventId = await notificationEventId(eventKey),
    payload = JSON.stringify({
      eventId,
      title,
      body,
      url,
      type: "RAIOX_REPORT",
    });
  webpush.setVapidDetails(subject, publicKey, privateKey);
  let sent = 0,
    failed = 0,
    removed = 0,
    alreadySent = 0;
  for (let offset = 0; offset < targets.length; offset += 8)
    await Promise.all(
      targets.slice(offset, offset + 8).map(async (sub) => {
        if (!allowed(sub.endpoint)) return;
        // Recheck permission immediately before claiming/sending (preferences may change mid-job).
        const pref = await db
          .from("raiox_notification_preferences")
          .select("morning,evening")
          .eq("barbershop_id", shop)
          .eq("user_id", sub.user_id)
          .maybeSingle();
        if (pref.error) throw pref.error;
        if (
          !test &&
          !(kind === "briefing" ? pref.data?.morning : pref.data?.evening)
        )
          return;
        const claim = await db.rpc("claim_booking_push_delivery", {
          p_event_key: eventId,
          p_subscription_id: sub.id,
        });
        if (claim.error) throw claim.error;
        if (!claim.data) {
          const receipt = await db
            .from("booking_push_deliveries")
            .select("delivered_at,attempts")
            .eq("event_key", eventId)
            .eq("subscription_id", sub.id)
            .maybeSingle();
          if (receipt.error) throw receipt.error;
          if (receipt.data?.delivered_at) alreadySent++;
          else failed++;
          return;
        }
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            { TTL: 900, urgency: "normal", timeout: 8000 },
          );
          const r = await db
            .from("booking_push_deliveries")
            .update({ delivered_at: new Date().toISOString() })
            .eq("event_key", eventId)
            .eq("subscription_id", sub.id);
          if (r.error) throw r.error;
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            const r = await db
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
            if (r.error) throw r.error;
            removed++;
          } else {
            failed++;
            const r = await db
              .from("booking_push_deliveries")
              .update({
                locked_until: new Date(Date.now() + 60000).toISOString(),
              })
              .eq("event_key", eventId)
              .eq("subscription_id", sub.id);
            if (r.error) throw r.error;
            console.error("[RaioXPush]", {
              eventId,
              status: status || "network",
            });
          }
        }
      }),
    );
  return Response.json(
    { sent, failed, removed, alreadySent, targets: targets.length, eventId },
    { status: failed ? 503 : 200 },
  );
}
