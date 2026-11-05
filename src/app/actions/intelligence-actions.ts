"use server";
import { resolveCurrentShop } from "@/lib/current-shop";
import { localDate, validBooking } from "@/lib/saas2/analytics";
import { geminiKey, geminiRuntime } from "@/lib/runtime-secret";
import { cachedInterpretation } from "@/lib/saas2/gemini";
import { Filter, loadIntelligence } from "@/lib/saas2/source";
export async function analyticsAction(filter: unknown) {
  try {
    const { current, previous, source, generatedAt } =
      await loadIntelligence(filter);
    return {
      ok: true as const,
      current,
      previous,
      barbers: source.barbers,
      generatedAt,
    };
  } catch (error) {
    console.error(
      "[Análises]",
      error instanceof Error ? error.message : "Erro",
    );
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível consultar as análises.",
    };
  }
}

export async function raioXAction(filter: unknown, serviceId?: string) {
  try {
    const {
      current,
      previous,
      source,
      generatedAt,
      db,
      shop,
      filter: valid,
    } = await loadIntelligence(filter);
    if (valid.start !== valid.end)
      throw Error("Raio-X usa uma data por consulta.");
    const { data: goal, error: goalError } = await db
      .from("daily_goals")
      .select("amount")
      .eq("barbershop_id", shop)
      .eq("date", valid.start)
      .maybeSingle();
    const { data: closing, error: closingError } = await db
      .from("day_closings")
      .select("report,generated_at")
      .eq("barbershop_id", shop)
      .eq("date", valid.start)
      .maybeSingle();
    const service =
      source.services.find((s) => s.id === serviceId && s.is_active) ||
      source.services
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
    if (service) {
      const { data, error } = await db.rpc("get_availability", {
        p_barbershop_id: shop,
        p_barber_id: valid.barber,
        p_date: valid.start,
        p_service_ids: [service.id],
      });
      if (error) availabilityError = error.message;
      else slots = data || [];
    } else
      availabilityError =
        "Cadastre um serviço ativo para consultar os horários.";
    const goalCents = goal ? Math.round(Number(goal.amount) * 100) : null;
    const { diagnose } = await import("@/lib/saas2/diagnosis");
    return {
      ok: true as const,
      current,
      previous,
      barbers: source.barbers,
      services: source.services.filter((s) => s.is_active),
      serviceId: service?.id,
      slots,
      availabilityError,
      goal: goalCents,
      closing: closing || null,
      schemaError: goalError?.message || closingError?.message || null,
      remainingAppointments: source.bookings.filter(
        (b) =>
          localDate(new Date(b.starts_at)) === valid.start &&
          (!valid.barber || b.barber_id === valid.barber) &&
          b.status !== "completed" &&
          validBooking(b, Date.now()) &&
          Date.parse(b.ends_at) > Date.now(),
      ).length,
      diagnosis: diagnose(current, previous, valid.barber ? null : goalCents),
      aiConfigured: Boolean(geminiKey()),
      generatedAt,
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível consultar o Raio-X.",
    };
  }
}
export async function saveGoalAction(date: string, amount: number) {
  try {
    Filter.parse({ start: date, end: date, barber: null });
    const { db, shop } = await resolveCurrentShop();
    if (!Number.isFinite(amount) || amount < 0 || amount > 99999999.99)
      throw Error("Meta inválida.");
    const { error } = await db.from("daily_goals").upsert({
      barbershop_id: shop,
      date,
      amount: Math.round(amount * 100) / 100,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a meta. Confira a migration de metas.",
    };
  }
}
export async function closeDayAction(date: string) {
  try {
    if (date > localDate())
      throw Error("Não é possível encerrar uma data futura.");
    const { db, shop, current, previous, source } = await loadIntelligence({
      start: date,
      end: date,
      barber: null,
    });
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) throw Error("Sessão inválida.");
    const { diagnose } = await import("@/lib/saas2/diagnosis");
    const ends = source.hours
      .filter(
        (h) =>
          !h.is_off &&
          h.day_of_week === new Date(date + "T12:00Z").getUTCDay() &&
          source.barbers.some((b) => b.id === h.barber_id && b.is_active),
      )
      .map((h) => Date.parse(date + "T" + h.end_time.slice(0, 8) + "-03:00"));
    const report = {
      version: 1,
      isPartial: date === localDate() && ends.some((end) => Date.now() < end),
      bookings: current.bookings,
      valid: current.valid,
      completed: current.completed,
      cancelled: current.cancelled,
      noShow: current.noShow,
      forecast: current.expected,
      received: current.income,
      difference: current.income - current.expected,
      registeredBalance: current.registeredBalance,
      occupancy: current.occupancy,
      services: current.services,
      attention: diagnose(current, previous, null),
    };
    const { error } = await db.from("day_closings").upsert(
      {
        barbershop_id: shop,
        date,
        report,
        generated_at: new Date().toISOString(),
        generated_by: user.id,
      },
      { onConflict: "barbershop_id,date" },
    );
    if (error) throw error;
    return { ok: true as const, report };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o encerramento. Confira a migration.",
    };
  }
}
export async function generateAiAction(date: string) {
  try {
    const { db, shop, current, previous } = await loadIntelligence({
      start: date,
      end: date,
      barber: null,
    });
    const { key, model } = geminiRuntime();
    if (!key)
      return {
        ok: false as const,
        error:
          "O secret Gemini não está disponível nesta execução. Confira Conexão Gemini no Raio-X. O diagnóstico determinístico continua disponível.",
      };
    const aggregate = {
      date,
      receivedCents: current.income,
      forecastCents: current.expected,
      completed: current.completed,
      holds: current.pending,
      cancelled: current.cancelled,
      noShow: current.noShow,
      occupancy: current.occupancy,
      previousReceivedCents: previous.income,
    };
    const output = await cachedInterpretation(
      shop,
      key,
      aggregate,
      async () => {
        const { data, error } = await db.rpc("consume_raiox_ai_quota", {
          p_barbershop_id: shop,
        });
        if (error)
          throw Error(
            "Cota de IA indisponível. Confira a migration de ai_daily_usage.",
          );
        if (!data)
          throw Error(
            "Limite de cinco análises generativas por loja/dia atingido.",
          );
      },
      model,
    );
    return { ok: true as const, output };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Análise generativa indisponível.",
    };
  }
}
