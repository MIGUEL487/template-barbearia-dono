"use server";
import { z } from "zod";
import { loadIntelligence, Filter, all } from "@/lib/saas2/source";
import { resolveCurrentShop } from "@/lib/current-shop";
import { operationalReport } from "@/lib/raiox4/report";
import { localDate, dayStart, shiftDate } from "@/lib/saas2/analytics";
import { toCents } from "@/lib/saas2/money";
import { pendingSchema } from "@/lib/saas3/ledger";
export async function operationalDashboardAction(raw: unknown) {
  try {
    const { db, shop, source, current, previous, filter, generatedAt } =
      await loadIntelligence(raw);
    const [goals, history, settings] = await Promise.all([
      db
        .from("daily_goals")
        .select("date,amount")
        .eq("barbershop_id", shop)
        .gte("date", filter.start)
        .lte("date", filter.end),
      all<{
        id: string;
        date: string;
        kind: string;
        payload: unknown;
        generated_at: string;
      }>((a, b) =>
        db
          .from("raiox_reports")
          .select("id,date,kind,payload,generated_at")
          .eq("barbershop_id", shop)
          .gte("date", filter.start)
          .lte("date", filter.end)
          .order("date", { ascending: false })
          .order("kind")
          .range(a, b),
      ),
      db
        .from("raiox_settings")
        .select("low_occupancy_threshold")
        .eq("barbershop_id", shop)
        .maybeSingle(),
    ]);
    if (goals.error) throw goals.error;
    if (settings.error && !pendingSchema(settings.error)) throw settings.error;
    const threshold = Number(settings.data?.low_occupancy_threshold ?? 0.4);
    const goal = goals.data?.length
      ? goals.data.reduce((s, g) => s + toCents(g.amount), 0)
      : null;
    const report = operationalReport(
      source,
      filter.end,
      "briefing",
      filter.start === filter.end ? goal : null,
      Date.now(),
      threshold,
    );
    const service = source.services
      .filter((s) => s.is_active)
      .sort(
        (a, b) =>
          a.duration_minutes +
          a.buffer_minutes -
          (b.duration_minutes + b.buffer_minutes),
      )[0];
    let slots: { barber_id: string; start_time: string; end_time: string }[] =
        [],
      availabilityError: string | null = null;
    if (filter.start === filter.end && service) {
      const result = await db.rpc("get_availability", {
        p_barbershop_id: shop,
        p_barber_id: filter.barber,
        p_date: filter.start,
        p_service_ids: [service.id],
      });
      if (result.error)
        availabilityError = "Não foi possível consultar os encaixes reais.";
      else slots = result.data || [];
    } else if (filter.start === filter.end)
      availabilityError = "Cadastre um serviço ativo para consultar encaixes.";
    return {
      ok: true as const,
      current,
      previous,
      generatedAt,
      goal,
      goalsCount: goals.data?.length || 0,
      report,
      history,
      barbers: source.barbers,
      slots,
      availabilityError,
      referenceService: service?.name,
      threshold,
      schedulerSchemaReady: !settings.error,
    };
  } catch (error) {
    console.error("[Raio-X]", {
      code: (error as { code?: string }).code || "query",
    });
    return {
      ok: false as const,
      error:
        "Não foi possível consultar o Raio-X. Confira a sessão, a conexão e a instalação SQL do SaaS.",
    };
  }
}
export async function reportPreferencesAction() {
  try {
    const { db, shop, user } = await resolveCurrentShop();
    const { data, error } = await db
      .from("raiox_notification_preferences")
      .select("morning,evening")
      .eq("barbershop_id", shop)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return {
      ok: true as const,
      morning: data?.morning ?? false,
      evening: data?.evening ?? false,
    };
  } catch {
    return {
      ok: false as const,
      error:
        "Preferências indisponíveis. Confira a instalação SQL do Raio-X 4.0.",
    };
  }
}
export async function saveReportPreferencesAction(raw: unknown) {
  try {
    const value = z
      .object({ morning: z.boolean(), evening: z.boolean() })
      .strict()
      .parse(raw);
    const { db, shop, user } = await resolveCurrentShop();
    const { error } = await db
      .from("raiox_notification_preferences")
      .upsert({
        ...value,
        barbershop_id: shop,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      error: "Não foi possível salvar as preferências.",
    };
  }
}
export async function saveOccupancyThresholdAction(value: number) {
  try {
    z.number().min(0).max(1).parse(value);
    const { db, shop } = await resolveCurrentShop();
    const { error } = await db
      .from("raiox_settings")
      .upsert({ barbershop_id: shop, low_occupancy_threshold: value });
    if (error) throw error;
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      error: "Não foi possível salvar o limite de ocupação.",
    };
  }
}
/** Legacy messages are read-only and never sent to a model. */
export async function legacyHistoryAction() {
  try {
    const { db, shop } = await resolveCurrentShop();
    const { data, error } = await db
      .from("raiox_messages")
      .select(
        "id,role,content,created_at,raiox_conversations!inner(barbershop_id)",
      )
      .eq("raiox_conversations.barbershop_id", shop)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return { ok: true as const, messages: data || [] };
  } catch {
    return { ok: false as const, error: "Histórico legado indisponível." };
  }
}
