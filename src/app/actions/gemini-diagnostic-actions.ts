"use server";
import { resolveCurrentShop } from "@/lib/current-shop";
import { geminiRuntime } from "@/lib/runtime-secret";
import {
  cachedInterpretation,
  geminiDeadlineMs,
  type GeminiProbe,
} from "@/lib/saas2/gemini";
import { GeminiFailure, safeGeminiDiagnostic } from "@/lib/saas2/gemini-errors";
import { loadIntelligence } from "@/lib/saas2/source";
import { localDate, shiftDate } from "@/lib/saas2/analytics";
export async function geminiDiagnosticAction(
  runProbe = false,
  profile: GeminiProbe = "B",
) {
  const started = performance.now();
  let stage = "authorization",
    dataMs = 0,
    dataStarted = 0,
    quotaMs = 0;
  let metadata:
    | {
        keyPresent: boolean;
        source: string;
        workerContext: boolean;
        model: string;
      }
    | undefined;
  try {
    if (!["A", "B", "C", "D"].includes(profile))
      throw new GeminiFailure("internal");
    const { db, shop } = await resolveCurrentShop();
    const runtime = geminiRuntime();
    metadata = {
      keyPresent: Boolean(runtime.key),
      source: runtime.source,
      workerContext: runtime.contextAvailable,
      model: runtime.model,
    };
    if (!runtime.key) throw new GeminiFailure("missing_runtime_key");
    if (!runProbe)
      return {
        ok: true as const,
        ...metadata,
        tested: false,
        checkedAt: new Date().toISOString(),
      };
    const aggregate: Record<string, number | string | null> = {
      question:
        "Resuma brevemente os indicadores fornecidos. Teste técnico autenticado.",
      diagnostic: profile,
    };
    stage = "supabase_aggregate";
    dataStarted = performance.now();
    console.info(
      "[Gemini diagnostic]",
      JSON.stringify({ stage, profile, status: "started" }),
    );
    if (profile === "C" || profile === "D") {
      const end = localDate(),
        start = profile === "D" ? shiftDate(end, -6) : end;
      const { current: c, previous: p } = await loadIntelligence({
        start,
        end,
        barber: null,
      });
      Object.assign(aggregate, {
        start,
        end,
        receivedCents: c.income,
        bookings: c.valid,
      });
      if (profile === "D")
        Object.assign(aggregate, {
          question:
            "Compare os últimos sete dias com o período anterior e resuma agenda, caixa e serviços, sem inventar causas.",
          scope: "overview",
          relevantDetail: JSON.stringify({
            daily: c.daily,
            services: c.services.slice(0, 10),
            notes: c.notes,
          }),
          forecastCents: c.expected,
          expensesCents: c.expenses,
          refundsCents: c.refunds,
          balanceCents: c.registeredBalance,
          completed: c.completed,
          occupancy: c.occupancy,
          previousReceivedCents: p.income,
        });
    }
    dataMs = Math.round(performance.now() - dataStarted);
    stage = "quota_and_provider";
    const result = await cachedInterpretation(
      shop,
      runtime.key,
      aggregate,
      async () => {
        stage = "supabase_quota";
        const quotaStarted = performance.now();
        const { data, error } = await db.rpc("consume_raiox_ai_quota", {
          p_barbershop_id: shop,
        });
        quotaMs = Math.round(performance.now() - quotaStarted);
        if (error) throw new GeminiFailure("quota_check", null, error.code);
        if (!data) throw new GeminiFailure("app_quota");
        stage = "provider_request";
      },
      runtime.model,
      profile,
    );
    const timing = {
      profile,
      stage: "complete",
      dataMs,
      quotaMs,
      totalMs: Math.round(performance.now() - started),
      provider: result.trace,
      deadlineMs: geminiDeadlineMs,
    };
    console.info(
      "[Gemini diagnostic]",
      JSON.stringify({ ...timing, model: runtime.model, status: "success" }),
    );
    return {
      ok: true as const,
      ...metadata,
      tested: true,
      checkedAt: new Date().toISOString(),
      timing,
      message:
        profile === "A"
          ? "API e modelo responderam ao prompt mínimo; schema e dados não testados."
          : "API, modelo e resposta estruturada verificados para este perfil.",
    };
  } catch (error) {
    if (stage === "supabase_aggregate" && dataStarted)
      dataMs = Math.round(performance.now() - dataStarted);
    const original = error instanceof Error ? error.message : "";
    const failure =
      error instanceof GeminiFailure
        ? error
        : stage === "supabase_aggregate"
          ? new GeminiFailure("data_query")
          : /sess|autoriz|Acesso|login/i.test(original)
            ? new GeminiFailure("authorization")
            : /loja|barbearia|vínculo/i.test(original)
              ? new GeminiFailure("shop_resolution")
              : new GeminiFailure("internal");
    const diagnostic = safeGeminiDiagnostic(failure);
    const timing = {
      profile,
      stage,
      dataMs,
      quotaMs,
      totalMs: Math.round(performance.now() - started),
      deadlineMs: geminiDeadlineMs,
    };
    console.warn(
      "[Gemini diagnostic]",
      JSON.stringify({ ...diagnostic, ...timing }),
    );
    return {
      ok: false as const,
      ...metadata,
      ...diagnostic,
      timing,
      tested: runProbe,
      checkedAt: new Date().toISOString(),
    };
  }
}
