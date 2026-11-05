export type AiCategory =
  | "missing_runtime_key"
  | "invalid_model"
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
  | "internal";
const messages: Record<AiCategory, string> = {
  missing_runtime_key:
    "Configure OPENROUTER_API_KEY como secret de runtime no Worker e ambiente deste deployment. Nunca use NEXT_PUBLIC_OPENROUTER_API_KEY. O resumo calculado continua disponível.",
  invalid_model:
    "OPENROUTER_MODEL deve ser um identificador válido de modelo do OpenRouter, no formato provedor/modelo.",
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
    | "response_validation";
  deadlineMs: number;
  inputBytes: number;
  httpStatus: number | null;
};
export class AiFailure extends Error {
  trace: AiTrace | null = null;
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
  const text = String(e?.message || "")
    .slice(0, 20000)
    .toLowerCase();
  if (status === 401) return new AiFailure("invalid_key", status);
  if (status === 402) return new AiFailure("insufficient_credits", status);
  if (status === 403) return new AiFailure("access_denied", status);
  if (
    status === 404 ||
    /model.*not found|invalid model|no endpoints found/.test(text)
  )
    return new AiFailure("model_unavailable", status);
  if (status === 408) return new AiFailure("request_timeout", status);
  if (status === 429) return new AiFailure("rate_limit", status);
  if (status === 502) return new AiFailure("bad_gateway", status);
  if (status === 503) return new AiFailure("provider_unavailable", status);
  if (status === 504) return new AiFailure("gateway_timeout", status);
  if (
    status === 400 &&
    /schema|response_format|structured|support.*parameter/.test(text)
  )
    return new AiFailure("structured_response", status);
  if (status === 400) return new AiFailure("invalid_request", status);
  if (
    /abort|timeout|timed out/.test(text + String(e?.name || "").toLowerCase())
  )
    return new AiFailure("timeout", status);
  if (
    /fetch failed|network|econn|enotfound|connect tunnel|failed to fetch/.test(
      text,
    )
  )
    return new AiFailure("network", status);
  if (status && status >= 500)
    return new AiFailure("provider_unavailable", status);
  return new AiFailure("internal", status);
}
export function safeAiDiagnostic(error: unknown) {
  const e = classifyAiError(error);
  return {
    category: e.category,
    status: e.status,
    rpcCode: e.rpcCode && /^[A-Z0-9]{5,12}$/.test(e.rpcCode) ? e.rpcCode : null,
    message: e.message,
    trace: e.trace,
  };
}
