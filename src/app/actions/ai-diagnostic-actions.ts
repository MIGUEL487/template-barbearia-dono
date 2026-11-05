"use server";
import { resolveCurrentShop } from "@/lib/current-shop";
import { aiRuntime } from "@/lib/runtime-secret";
import {
  cachedInterpretation,
  aiDeadlineMs,
  type AiProbe,
} from "@/lib/saas2/openrouter";
import {
  AiFailure,
  safeAiDiagnostic,
  assertAiQuotaResult,
} from "@/lib/saas2/ai-errors";
import { loadIntelligence } from "@/lib/saas2/source";
import { localDate, shiftDate } from "@/lib/saas2/analytics";
export async function aiDiagnosticAction(
  runProbe = false,
  profile: AiProbe = "B",
) {
  const started = performance.now();
  let timeoutMs = aiDeadlineMs;
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
        modelAdjusted: boolean;
      }
    | undefined;
  try {
    if (!["A", "B", "C", "D"].includes(profile))
      throw new AiFailure("internal");
    const { db, shop } = await resolveCurrentShop();
    const runtime = aiRuntime();
    timeoutMs = runtime.timeoutMs;
    metadata = {
      keyPresent: Boolean(runtime.key),
      source: runtime.source,
      workerContext: runtime.contextAvailable,
      model: runtime.model,
      modelAdjusted: runtime.modelAdjusted,
    };
    if (!runtime.key) throw new AiFailure("missing_runtime_key");
    if (!runtime.model) throw new AiFailure("invalid_model");
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
      "[IA diagnostic]",
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
        assertAiQuotaResult(data, error);
        stage = "provider_request";
      },
      runtime.model,
      profile,
      runtime.timeoutMs,
      (value) => {
        stage = value;
      },
    );
    const timing = {
      profile,
      stage: "complete",
      dataMs,
      quotaMs,
      totalMs: Math.round(performance.now() - started),
      provider: result.trace,
      deadlineMs: runtime.timeoutMs,
      cacheHit: result.cacheHit,
      verifiedAt: result.trace.verifiedAt,
    };
    console.info(
      "[IA diagnostic]",
      JSON.stringify({ ...timing, modelConfigured: true, status: "success" }),
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
      error instanceof AiFailure
        ? error
        : stage === "supabase_aggregate"
          ? new AiFailure("data_query")
          : /sess|autoriz|Acesso|login/i.test(original)
            ? new AiFailure("authorization")
            : /loja|barbearia|vínculo/i.test(original)
              ? new AiFailure("shop_resolution")
              : new AiFailure("internal");
    const diagnostic = safeAiDiagnostic(failure);
    const timing = {
      profile,
      stage: failure.trace?.stage || stage,
      dataMs,
      quotaMs,
      totalMs: Math.round(performance.now() - started),
      deadlineMs: timeoutMs,
    };
    console.warn(
      "[IA diagnostic]",
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
