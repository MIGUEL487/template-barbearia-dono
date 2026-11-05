"use client";
import { useEffect, useState } from "react";
import { aiDiagnosticAction } from "@/app/actions/ai-diagnostic-actions";
import { Expandable } from "@/components/ui/expandable";
import { AnimatedSelect } from "@/components/ui/animated-select";
import type { AiProbe } from "@/lib/saas2/openrouter";
import { Button } from "@/components/ui/button";
export function AiDiagnostic() {
  const [result, setResult] = useState<Awaited<
      ReturnType<typeof aiDiagnosticAction>
    > | null>(null),
    [busy, setBusy] = useState(false),
    [profile, setProfile] = useState<AiProbe>("A");
  useEffect(() => {
    void aiDiagnosticAction()
      .then(setResult)
      .catch(() =>
        setResult({
          ok: false,
          tested: false,
          category: "network",
          status: null,
          rpcCode: null,
          trace: null,
          timing: {
            profile: "A",
            stage: "browser_transport",
            dataMs: 0,
            quotaMs: 0,
            totalMs: 0,
            deadlineMs: 30000,
          },
          message: "Não foi possível consultar o diagnóstico do servidor.",
          checkedAt: new Date().toISOString(),
        }),
      );
  }, []);
  async function probe() {
    setBusy(true);
    try {
      setResult(await aiDiagnosticAction(true, profile));
    } catch {
      setResult({
        ok: false,
        tested: false,
        category: "network",
        status: null,
        rpcCode: null,
        trace: null,
        timing: {
          profile: "A",
          stage: "browser_transport",
          dataMs: 0,
          quotaMs: 0,
          totalMs: 0,
          deadlineMs: 30000,
        },
        message: "Falha de transporte ao consultar o servidor.",
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Expandable className="s3-gemini-diagnostic">
      <summary>Conexão IA</summary>
      <div className="s3-diagnostic-meta">
        <span data-connection={result?.ok ? "ready" : "attention"}>
          {result
            ? result.ok
              ? result.tested
                ? "Chamada verificada"
                : "Secret disponível · chamada não testada"
              : "Diagnóstico requer atenção"
            : "Verificando runtime…"}
        </span>
        {result && "model" in result && (
          <p>
            Modelo: <strong>{result.model}</strong>
            <br />
            Origem: {result.source} · Worker:{" "}
            {result.workerContext
              ? "contexto disponível"
              : "contexto não detectado"}
          </p>
        )}
        {result && "message" in result && (
          <p role={result.ok ? "status" : "alert"}>{result.message}</p>
        )}
        {result && !result.ok && "category" in result && (
          <code>
            código: {result.category}
            {result.status
              ? ` · ${result.trace?.origin === "upstream_payload" ? "Código do provedor" : "HTTP"} ${result.status}`
              : ""}
            {"rpcCode" in result && result.rpcCode
              ? ` · Supabase ${result.rpcCode}`
              : ""}
          </code>
        )}
      </div>
      {result && "timing" in result && result.timing && (
        <p className="s3-note">
          Etapa: {result.timing.stage} · Total: {result.timing.totalMs} ms ·
          Dados: {result.timing.dataMs} ms · Cota: {result.timing.quotaMs} ms ·
          Limite API: {result.timing.deadlineMs} ms
        </p>
      )}
      {result &&
        "timing" in result &&
        result.timing &&
        "cacheHit" in result.timing && (
          <p className="s3-note">
            {result.timing.cacheHit
              ? "Resultado em cache, sem nova chamada"
              : "Nova chamada ao OpenRouter"}{" "}
            · Verificado em {result.timing.verifiedAt}
          </p>
        )}
      {result && "trace" in result && result.trace && (
        <p className="s3-note">
          Origem: {result.trace.origin} · API: {result.trace.durationMs} ms ·
          Entrada: {result.trace.inputBytes} bytes · HTTP recebido:{" "}
          {result.trace.httpStatus ?? "sem resposta HTTP"}
        </p>
      )}
      <label>
        Perfil de teste
        <AnimatedSelect
          value={profile}
          onChange={(e) => setProfile(e.target.value as AiProbe)}
          disabled={busy}
        >
          <option value="A">A · Prompt mínimo, sem schema</option>
          <option value="B">B · Schema real, sem dados</option>
          <option value="C">C · Agregado real de hoje</option>
          <option value="D">D · Contexto real de 7 dias</option>
        </AnimatedSelect>
      </label>
      <p className="s3-note">
        Teste autenticado no servidor. C e D usam somente indicadores agregados,
        sem nomes ou contatos. Execute um perfil por vez. Usa até uma tentativa
        da cota diária da loja. Nenhuma chave é exibida.
      </p>
      <Button
        variant="secondary"
        size="sm"
        isLoading={busy}
        onClick={() => void probe()}
      >
        Testar integração
      </Button>
    </Expandable>
  );
}
