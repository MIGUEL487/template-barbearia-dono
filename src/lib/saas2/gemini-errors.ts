export type GeminiCategory =
  | "missing_runtime_key"
  | "invalid_key"
  | "access_denied"
  | "model_unavailable"
  | "provider_quota"
  | "rate_limit"
  | "timeout"
  | "network"
  | "structured_response"
  | "provider_unavailable"
  | "app_quota"
  | "quota_check"
  | "authorization"
  | "shop_resolution"
  | "internal";
const messages: Record<GeminiCategory, string> = {
  missing_runtime_key:
    "O secret GEMINI_API_KEY não está disponível neste runtime. Confira o Worker e ambiente deste deployment.",
  invalid_key:
    "O Google recusou a chave da API. Confira validade e restrições da credencial no projeto Google.",
  access_denied:
    "O Google recusou a permissão desta credencial ou projeto. Confira restrições da API, região e acesso ao modelo.",
  model_unavailable:
    "O modelo configurado não está disponível para esta API ou projeto. Confira o identificador e o acesso no Google.",
  provider_quota:
    "A cota do projeto Google foi esgotada. Confira os limites e o faturamento do projeto.",
  rate_limit:
    "O Google limitou a frequência de chamadas. Aguarde antes de tentar novamente.",
  timeout: "A chamada ao Google excedeu o tempo de resposta permitido.",
  network:
    "O servidor não conseguiu alcançar a API Google. Confira a conectividade de saída do Worker.",
  structured_response:
    "O Google retornou uma resposta estruturada inválida, incompleta ou bloqueada.",
  provider_unavailable: "O serviço Google está temporariamente indisponível.",
  app_quota:
    "O limite diário do Raio-X desta loja foi atingido. É um limite do aplicativo, separado da cota Google.",
  quota_check:
    "Não foi possível validar a cota do Raio-X no Supabase. Confira a RPC e suas permissões.",
  authorization:
    "A sessão não tem autorização owner/admin para executar este diagnóstico.",
  shop_resolution:
    "Não foi possível resolver a barbearia da sessão. Confira o vínculo em shop_members.",
  internal:
    "O servidor encontrou uma falha interna na integração. Consulte o código de diagnóstico seguro.",
};
export class GeminiFailure extends Error {
  constructor(
    public category: GeminiCategory,
    public status: number | null = null,
    public rpcCode: string | null = null,
  ) {
    super("Gemini indisponível: " + messages[category]);
    this.name = "GeminiFailure";
  }
}
export function classifyGeminiError(error: unknown): GeminiFailure {
  if (error instanceof GeminiFailure) return error;
  const e = error as {
    status?: unknown;
    message?: unknown;
    name?: unknown;
    cause?: { code?: unknown };
  } | null;
  const status = Number(e?.status) || null;
  // Provider text is inspected only to classify, never returned or logged.
  const text = String(e?.message || "")
    .slice(0, 40000)
    .toLowerCase();
  if (
    /api_key_invalid|api key not valid|invalid api key|api key expired/.test(
      text,
    ) ||
    status === 401
  )
    return new GeminiFailure("invalid_key", status);
  if (status === 403) return new GeminiFailure("access_denied", status);
  if (status === 404 || /model.*not found|model.*not supported/.test(text))
    return new GeminiFailure("model_unavailable", status);
  if (
    status === 400 &&
    /schema|response_mime|responsemime|structured|json/.test(text)
  )
    return new GeminiFailure("structured_response", status);
  if (status === 429) {
    const daily = /perday|per.day|daily|billing/.test(text);
    const burst = /perminute|per.minute|persecond|per.second|rate.limit/.test(
      text,
    );
    return new GeminiFailure(
      daily
        ? "provider_quota"
        : burst
          ? "rate_limit"
          : /quota.*(?:exceeded|limit|exhaust)/.test(text)
            ? "provider_quota"
            : "rate_limit",
      status,
    );
  }
  if (
    status === 408 ||
    status === 504 ||
    /abort|timeout|timed out/.test(
      text + " " + String(e?.name || "").toLowerCase(),
    )
  )
    return new GeminiFailure("timeout", status);
  if (
    /fetch failed|network|econn|enotfound|connect tunnel|failed to fetch/.test(
      text + " " + String(e?.cause?.code || "").toLowerCase(),
    )
  )
    return new GeminiFailure("network", status);
  if (status && status >= 500)
    return new GeminiFailure("provider_unavailable", status);
  return new GeminiFailure("internal", status);
}
export function safeGeminiDiagnostic(error: unknown) {
  const e = classifyGeminiError(error);
  return { category: e.category, status: e.status, rpcCode: e.rpcCode&&/^[A-Z0-9]{5,12}$/.test(e.rpcCode)?e.rpcCode:null, message: e.message };
}
