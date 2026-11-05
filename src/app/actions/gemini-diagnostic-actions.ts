"use server";
import { resolveCurrentShop } from "@/lib/current-shop";
import { geminiRuntime } from "@/lib/runtime-secret";
import { cachedInterpretation } from "@/lib/saas2/gemini";
import { GeminiFailure, safeGeminiDiagnostic } from "@/lib/saas2/gemini-errors";
export async function geminiDiagnosticAction(runProbe = false) {
  try {
    const { db, shop } = await resolveCurrentShop(); // owner/admin authorization on every request
    const runtime = geminiRuntime();
    const metadata = {
      keyPresent: Boolean(runtime.key),
      source: runtime.source,
      workerContext: runtime.contextAvailable,
      model: runtime.model,
      checkedAt: new Date().toISOString(),
    };
    if (!runtime.key)
      return {
        ok: false as const,
        ...metadata,
        ...safeGeminiDiagnostic(new GeminiFailure("missing_runtime_key")),
        tested: false,
      };
    if (!runProbe) return { ok: true as const, ...metadata, tested: false };
    await cachedInterpretation(
      shop,
      runtime.key,
      {
        question:
          "Responda brevemente em português que este teste técnico de integração foi concluído. Não há dados financeiros ou pessoais neste teste.",
        diagnostic: 1,
      },
      async () => {
        const { data, error } = await db.rpc("consume_raiox_ai_quota", {
          p_barbershop_id: shop,
        });
        if (error) throw new GeminiFailure("quota_check", null, error.code);
        if (!data) throw new GeminiFailure("app_quota");
      },
      runtime.model,
    );
    return {
      ok: true as const,
      ...metadata,
      tested: true,
      message:
        "Autenticação, modelo e resposta estruturada verificados pelo servidor.",
    };
  } catch (error) {
    const original = error instanceof Error ? error.message : "";
    const failure =
      error instanceof GeminiFailure
        ? error
        : /sess|autoriz|Acesso|login/i.test(original)
          ? new GeminiFailure("authorization")
          : /loja|barbearia|vínculo/i.test(original)
            ? new GeminiFailure("shop_resolution")
            : new GeminiFailure("internal");
    const diagnostic = safeGeminiDiagnostic(failure);
    console.warn(
      "[Gemini diagnostic]",
      JSON.stringify({
        category: diagnostic.category,
        status: diagnostic.status,
      }),
    );
    return {
      ok: false as const,
      ...diagnostic,
      tested: runProbe,
      checkedAt: new Date().toISOString(),
    };
  }
}
