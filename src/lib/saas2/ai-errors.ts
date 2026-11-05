export type AiCategory =
  | "missing_runtime_key"
  | "invalid_model"
  | "paid_model_forbidden"
  | "invalid_key"
  | "access_denied"
  | "insufficient_credits"
  | "model_unavailable"
  | "rate_limit"
  | "request_timeout"
  | "gateway_timeout"
  | "bad_gateway"
  | "timeout"
  | "network"
  | "structured_response"
  | "incomplete_response"
  | "context_limit"
  | "provider_unavailable"
  | "invalid_request"
  | "app_quota"
  | "quota_check"
  | "data_query"
  | "authorization"
  | "shop_resolution"
  | "runtime_incompatible"
  | "cache_error"
  | "provider_redirect"
  | "quota_forbidden"
  | "quota_missing"
  | "quota_contract"
  | "internal";
const messages: Record<AiCategory, string> = {
  missing_runtime_key:
    "Configure OPENROUTER_API_KEY como secret de runtime no Worker e ambiente deste deployment. Nunca use NEXT_PUBLIC_OPENROUTER_API_KEY. O resumo calculado continua disponível.",
  invalid_model:
    "OPENROUTER_MODEL deve ser um identificador válido de modelo do OpenRouter, no formato provedor/modelo.",
  paid_model_forbidden:
    "Somente modelos gratuitos são permitidos. Use openrouter/free ou uma variante :free com preços confirmados em zero. Nenhuma geração paga foi iniciada.",
  invalid_key:
    "O OpenRouter recusou a chave (401). Confira validade e restrições do secret de runtime.",
  access_denied:
    "O OpenRouter recusou o acesso desta credencial ou modelo (403).",
  insufficient_credits:
    "Créditos insuficientes no OpenRouter (402). Confira saldo e limite da chave. Nenhuma nova tentativa automática será feita.",
  model_unavailable:
    "O modelo configurado não está disponível no catálogo OpenRouter. Confira OPENROUTER_MODEL.",
  rate_limit:
    "O OpenRouter limitou a frequência (429). Aguarde antes de tentar novamente.",
  request_timeout: "O OpenRouter retornou timeout da solicitação (408).",
  gateway_timeout:
    "O caminho da API OpenRouter retornou timeout de gateway (504).",
  bad_gateway: "O OpenRouter retornou falha de gateway (502).",
  timeout: "A chamada foi cancelada pelo limite de tempo do aplicativo.",
  network:
    "O servidor não conseguiu alcançar a API OpenRouter. Confira a conectividade de saída do Worker.",
  structured_response:
    "O modelo não aceitou o schema ou retornou uma resposta estruturada inválida ou bloqueada.",
  incomplete_response:
    "O modelo devolveu uma resposta incompleta, vazia ou interrompida. Ela não foi apresentada como resposta válida.",
  context_limit:
    "O contexto excedeu o limite seguro da análise. Faça uma pergunta mais específica.",
  provider_unavailable:
    "O serviço OpenRouter ou o provedor do modelo está indisponível (503 ou outra falha de servidor).",
  invalid_request:
    "O OpenRouter recusou o formato da solicitação. Consulte o diagnóstico seguro.",
  app_quota:
    "O limite diário de cinco chamadas do Raio-X desta loja foi atingido. Esse limite é separado dos créditos OpenRouter.",
  quota_check:
    "Não foi possível validar a cota de IA no Supabase. Confira a RPC e suas permissões.",
  data_query:
    "Não foi possível consultar os indicadores reais no Supabase. A geração não foi iniciada.",
  authorization:
    "A sessão não tem autorização owner/admin para executar este diagnóstico.",
  shop_resolution:
    "Não foi possível resolver a barbearia da sessão. Confira o vínculo em shop_members.",
  runtime_incompatible:
    "O cliente HTTP encontrou uma incompatibilidade com o runtime Workers. Consulte o diagnóstico de etapa.",
  cache_error:
    "Não foi possível preparar a solicitação de IA no servidor. A chamada de geração não foi iniciada.",
  provider_redirect:
    "A API solicitou redirecionamento. O servidor recusou encaminhar a credencial para outro destino.",
  quota_forbidden:
    "A sessão não tem permissão para consumir a cota desta loja. Confira vínculo owner/admin e permissões da RPC.",
  quota_missing:
    "A RPC de cota não está disponível com o contrato esperado. Confira a instalação SaaS existente e o cache de schema do Supabase.",
  quota_contract:
    "A RPC de cota retornou um formato inesperado. A geração foi bloqueada para preservar o limite de uso.",
  internal:
    "O servidor encontrou uma falha interna na integração. Consulte o diagnóstico seguro.",
};
export type AiTrace = {
  stage: string;
  durationMs: number;
  origin:
    | "application_deadline"
    | "upstream_http"
    | "upstream_payload"
    | "network"
    | "response_validation"
    | "application";
  deadlineMs: number;
  inputBytes: number;
  httpStatus: number | null;
};
export class AiFailure extends Error {
  trace: AiTrace | null = null;
  exceptionType: string | null = null;
  constructor(
    public category: AiCategory,
    public status: number | null = null,
    public rpcCode: string | null = null,
  ) {
    super("IA indisponível: " + messages[category]);
    this.name = "AiFailure";
  }
}
export function classifyAiError(error: unknown): AiFailure {
  if (error instanceof AiFailure) return error;
  const e = error as {
    status?: unknown;
    message?: unknown;
    name?: unknown;
  } | null;
  const status = Number(e?.status) || null;
  const failure = (
    category: AiCategory,
    statusCode: number | null = status,
  ) => {
    const f = new AiFailure(category, statusCode);
    f.exceptionType = [
      "Error",
      "TypeError",
      "ReferenceError",
      "RangeError",
      "SyntaxError",
      "AbortError",
    ].includes(String(e?.name))
      ? String(e?.name)
      : null;
    return f;
  };
  const text = String(e?.message || "")
    .slice(0, 20000)
    .toLowerCase();
  if (/invalid redirect value|unsupported.*redirect/.test(text))
    return failure("runtime_incompatible");
  if (status && status >= 300 && status < 400)
    return failure("provider_redirect");
  if (status === 401) return failure("invalid_key", status);
  if (status === 402) return failure("insufficient_credits", status);
  if (status === 403) return failure("access_denied", status);
  if (
    status === 404 ||
    /model.*not found|invalid model|no endpoints found/.test(text)
  )
    return failure("model_unavailable", status);
  if (status === 408) return failure("request_timeout", status);
  if (status === 429) return failure("rate_limit", status);
  if (status === 502) return failure("bad_gateway", status);
  if (status === 503) return failure("provider_unavailable", status);
  if (status === 504) return failure("gateway_timeout", status);
  if (
    status === 400 &&
    /schema|response_format|structured|support.*parameter/.test(text)
  )
    return failure("structured_response", status);
  if (status === 400) return failure("invalid_request", status);
  if (
    /abort|timeout|timed out/.test(text + String(e?.name || "").toLowerCase())
  )
    return failure("timeout", status);
  if (
    /fetch failed|network|econn|enotfound|connect tunnel|failed to fetch/.test(
      text,
    )
  )
    return failure("network", status);
  if (status && status >= 500) return failure("provider_unavailable", status);
  return failure("internal", status);
}
export function safeAiDiagnostic(error: unknown) {
  const e = classifyAiError(error);
  return {
    category: e.category,
    status: e.status,
    rpcCode: e.rpcCode && /^[A-Z0-9]{5,12}$/.test(e.rpcCode) ? e.rpcCode : null,
    message: e.message,
    trace: e.trace,
    exceptionType: e.exceptionType,
  };
}

export function assertAiQuotaResult(
  data: unknown,
  error: { code?: string } | null,
) {
  if (error) {
    const code = error.code || null;
    if (code === "42501") throw new AiFailure("quota_forbidden", null, code);
    if (code === "PGRST301" || code === "28000")
      throw new AiFailure("authorization", null, code);
    if (code === "PGRST202" || code === "42883")
      throw new AiFailure("quota_missing", null, code);
    throw new AiFailure("quota_check", null, code);
  }
  if (typeof data !== "boolean") throw new AiFailure("quota_contract");
  if (!data) throw new AiFailure("app_quota");
}
