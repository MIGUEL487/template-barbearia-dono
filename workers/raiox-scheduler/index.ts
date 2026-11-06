import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readIntelligence } from "../../src/lib/saas2/data";
import { readAll } from "../../src/lib/saas2/pagination";
import { localDate, shiftDate } from "../../src/lib/saas2/analytics";
import {
  businessWindow,
  operationalReport,
  type ReportKind,
} from "../../src/lib/raiox4/report";
import { toCents } from "../../src/lib/saas2/money";
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  BOOKING_WEBHOOK_SECRET: string;
}
/** No HTTP trigger: only Cloudflare scheduled events may invoke the privileged job. */
export async function runReports(
  db: SupabaseClient,
  notify: (id: string) => Promise<void>,
  now = Date.now(),
) {
  const shops = await readAll<{ id: string }>((a, b) =>
    db.from("barbershops").select("id").order("id").range(a, b),
  );
  let saved = 0,
    failed = 0;
  for (const shop of shops) {
    const today = localDate(new Date(now)),
      yesterday = shiftDate(today, -1);
    try {
      const { source } = await readIntelligence(
        db,
        shop.id,
        { start: yesterday, end: today, barber: null },
        now,
      );
      const settings = await db
        .from("raiox_settings")
        .select("low_occupancy_threshold")
        .eq("barbershop_id", shop.id)
        .maybeSingle();
      if (settings.error) throw settings.error;
      for (const date of [yesterday, today]) {
        const window = businessWindow(source, date);
        if (!window) continue;
        for (const kind of ["briefing", "closing"] as ReportKind[]) {
          const due = kind === "briefing" ? window.opens : window.closes;
          // A delayed closing can recover for 24h. Never send yesterday's morning briefing.
          if (
            now < due ||
            now - due > 86400000 ||
            (kind === "briefing" && date !== today)
          )
            continue;
          const log = async (
            result: "saved" | "push_accepted" | "failed",
            code?: string,
          ) => {
            const r = await db
              .from("raiox_job_runs")
              .insert({
                barbershop_id: shop.id,
                date,
                kind,
                result,
                error_code: code || null,
              });
            if (r.error) throw r.error;
          };
          try {
            let existing = await db
              .from("raiox_reports")
              .select("id,payload")
              .eq("barbershop_id", shop.id)
              .eq("date", date)
              .eq("kind", kind)
              .maybeSingle();
            if (existing.error) throw existing.error;
            if (!existing.data) {
              const goal = await db
                .from("daily_goals")
                .select("amount")
                .eq("barbershop_id", shop.id)
                .eq("date", date)
                .maybeSingle();
              if (goal.error) throw goal.error;
              const payload = operationalReport(
                source,
                date,
                kind,
                goal.data ? toCents(goal.data.amount) : null,
                now,
                Number(settings.data?.low_occupancy_threshold ?? 0.4),
              );
              const service = source.services
                .filter((s) => s.is_active)
                .sort(
                  (a, b) =>
                    a.duration_minutes +
                    a.buffer_minutes -
                    b.duration_minutes -
                    b.buffer_minutes,
                )[0];
              let availability = null;
              if (kind === "briefing" && service) {
                const r = await db.rpc("get_availability", {
                  p_barbershop_id: shop.id,
                  p_barber_id: null,
                  p_date: date,
                  p_service_ids: [service.id],
                });
                if (r.error) throw r.error;
                availability = {
                  referenceService: service.name,
                  slots: r.data || [],
                };
              }
              const inserted = await db
                .from("raiox_reports")
                .upsert(
                  {
                    barbershop_id: shop.id,
                    date,
                    kind,
                    payload: {
                      ...payload,
                      availability,
                      delayed: now - due > 300000,
                    },
                  },
                  {
                    onConflict: "barbershop_id,date,kind",
                    ignoreDuplicates: true,
                  },
                );
              if (inserted.error) throw inserted.error;
              existing = await db
                .from("raiox_reports")
                .select("id,payload")
                .eq("barbershop_id", shop.id)
                .eq("date", date)
                .eq("kind", kind)
                .maybeSingle();
              if (existing.error || !existing.data)
                throw existing.error || Error("snapshot_missing");
              saved++;
              await log("saved");
            }
            // Legacy snapshots are retained and never sent as current scheduled reports.
            if (existing.data?.payload?.version === 4) {
              await notify(existing.data.id);
              await log("push_accepted");
            }
          } catch (e) {
            failed++;
            await log("failed", safeCode(e));
          }
        }
      }
    } catch (e) {
      failed++;
      console.error("[RaioXJob]", { shop: shop.id, code: safeCode(e) });
    }
  }
  return { saved, failed };
}
function safeCode(e: unknown) {
  const c = (e as { code?: string })?.code;
  return typeof c === "string" && /^[A-Z0-9_]{1,24}$/.test(c)
    ? c
    : "job_failed";
}
export default {
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
  async scheduled(event: { scheduledTime: number }, env: Env) {
    if (
      !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL) ||
      !env.SUPABASE_SERVICE_ROLE_KEY ||
      !env.BOOKING_WEBHOOK_SECRET
    )
      throw Error("Scheduler configuration missing");
    const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
      },
    });
    const result = await runReports(
      db,
      async (reportId) => {
        const r = await fetch(
          `${env.SUPABASE_URL}/functions/v1/send-booking-push`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-booking-webhook-secret": env.BOOKING_WEBHOOK_SECRET,
            },
            body: JSON.stringify({ type: "RAIOX_REPORT", report_id: reportId }),
            signal: AbortSignal.timeout(25000),
            redirect: "manual",
          },
        );
        if (!r.ok) throw Error("push_dispatch_failed");
      },
      Date.now(),
    );
    console.info("[RaioXJob]", result);
    if (result.failed)
      throw Error("Some report jobs failed; inspect raiox_job_runs");
  },
};
