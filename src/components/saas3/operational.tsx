"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  operationalDashboardAction,
  legacyHistoryAction,
  saveOccupancyThresholdAction,
} from "@/app/actions/operational-actions";
import { saveGoalAction } from "@/app/actions/intelligence-actions";
import { Workspace, Metric } from "./shell";
import { PeriodControl, periodFor, type PeriodValue } from "./period";
import { LineChart } from "./line-chart";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Expandable } from "@/components/ui/expandable";
import { AdminSkeleton } from "@/components/admin/skeleton";
import { money } from "@/lib/saas2/analytics";
import type { OperationalReport } from "@/lib/raiox4/report";
type SavedReport = Partial<OperationalReport> & {
  delayed?: boolean;
  availability?: {
    referenceService: string;
    slots: { barber_id: string; start_time: string; end_time: string }[];
  } | null;
};
const percent = (n: number | null) =>
  n === null ? "Sem expediente" : `${Math.round(n * 100)}%`;
const time = (s: string) =>
  new Date(s).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
export function OperationalDashboard() {
  const [period, setPeriod] = useState<PeriodValue | null>(null),
    [result, setResult] = useState<Awaited<
      ReturnType<typeof operationalDashboardAction>
    > | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [goal, setGoal] = useState(""),
    [threshold, setThreshold] = useState("40"),
    [legacy, setLegacy] = useState<Awaited<
      ReturnType<typeof legacyHistoryAction>
    > | null>(null);
  const revision = useRef(0),
    highlight = useRef("");
  useEffect(() => {
    const p = periodFor("today");
    const query = new URLSearchParams(location.search);
    const date = query.get("date");
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date))
      Object.assign(p, { start: date, end: date, preset: "custom" });
    highlight.current = query.get("report") || "";
    setPeriod(p);
  }, []);
  const load = useCallback(async () => {
    if (!period) return;
    const v = ++revision.current;
    setBusy(true);
    const r = await operationalDashboardAction({
      barber: null,
      start: period.start,
      end: period.end,
    }).catch(() => ({
      ok: false as const,
      error: "Não foi possível conectar ao Raio-X. Tente novamente.",
    }));
    if (v !== revision.current) return;
    setResult(r);
    setBusy(false);
    if (r.ok) {
      setGoal(r.goal === null ? "" : String(r.goal / 100));
      setThreshold(String(Math.round(r.threshold * 100)));
    }
  }, [period]);
  useEffect(() => {
    void load();
  }, [load]);
  const d = result?.ok ? result : null,
    c = d?.current,
    p = d?.previous,
    single = period?.start === period?.end;
  return (
    <Workspace
      title="Raio-X"
      subtitle="Seu dia em números. Cálculos verificáveis, sem IA generativa."
      actions={period && <PeriodControl value={period} onChange={setPeriod} />}
    >
      {busy && !d && <AdminSkeleton />}
      {busy && d && <p role="status">Atualizando indicadores…</p>}
      {result && !result.ok && (
        <Card role="alert">
          {result.error}
          <Button onClick={load}>Tentar novamente</Button>
        </Card>
      )}
      {d && c && p && (
        <>
          <div className="s3-kpis">
            <Metric
              label="Receita realizada"
              value={money(c.income)}
              previous={
                p.income
                  ? `${c.income >= p.income ? "↗" : "↘"} ${Math.abs((c.income / p.income - 1) * 100).toFixed(1)}% · período anterior`
                  : "Sem recebimentos no período anterior"
              }
              tip={c.notes[0]}
            />
            <Metric
              label="Receita prevista"
              value={money(c.expected)}
              tip={c.notes[1]}
            />
            <Metric
              label="Saldo registrado"
              value={money(c.registeredBalance)}
              tip={c.notes[2]}
            />
            <Metric
              label="Taxa de ocupação"
              value={percent(c.occupancy)}
              previous={`${Math.round(c.freeMinutes)} minutos livres`}
              tip="Minutos reservados em expediente útil, descontados almoço, folgas e bloqueios. Holds expirados são excluídos."
            />
          </div>
          <section className="r4-operations" aria-label="Movimento do período">
            {[
              ["Marcados válidos", c.valid],
              ["Concluídos", c.completed],
              ["Cancelamentos", c.cancelled],
              ["Faltas", c.noShow],
              ["Pré-reservas válidas", c.pending],
              [
                "Ticket dos serviços",
                c.ticket === null ? "Sem concluídos" : money(c.ticket),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </section>
          {!c.bookings && (
            <Card>
              <CardTitle>Seu próximo atendimento começa aqui</CardTitle>
              <p>
                Nenhum agendamento registrado no período. Recebimentos e
                despesas continuam representando os lançamentos reais.
              </p>
              <Link href="/agenda">Abrir agenda →</Link>
            </Card>
          )}
          <div className="r4-editorial">
            <Card className="r4-main">
              <CardTitle>Recebimentos e previsão</CardTitle>
              <LineChart rows={c.daily} />
              <p className="text-sm text-text-muted">
                Despesas: {money(c.expenses)} · Estornos: {money(c.refunds)}.
                Previsão não é dinheiro recebido; saldo registrado não é lucro
                líquido.
              </p>
            </Card>
            <Card>
              <CardTitle>
                {single ? "Meta diária" : "Metas do período"}
              </CardTitle>
              <strong className="r4-goal">
                {d.goal === null ? "Não definida" : money(d.goal)}
              </strong>
              <p>
                {d.goal && d.goal > 0
                  ? `${Math.round((c.income / d.goal) * 100)}% pelos recebimentos registrados`
                  : "Configure uma meta para acompanhar o progresso."}
              </p>
              {d.goal !== null && d.goal > 0 && (
                <progress
                  aria-label="Progresso da meta"
                  max={100}
                  value={Math.min(100, (c.income / d.goal) * 100)}
                />
              )}
              {!single && (
                <p className="text-sm text-text-muted">
                  {d.goalsCount} data(s) com meta cadastrada; dias sem meta não
                  têm valor presumido.
                </p>
              )}
              {single && (
                <form
                  className="r4-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!period) return;
                    setBusy(true);
                    try {
                      const r = await saveGoalAction(
                        period.start,
                        goal.trim() ? Number(goal) : NaN,
                      );
                      setNotice(r.ok ? "Meta salva." : r.error);
                      if (r.ok) await load();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Meta em reais
                    <input
                      aria-label="Meta em reais"
                      disabled={busy}
                      type="number"
                      min="0"
                      step="0.01"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                    />
                  </label>
                  <Button disabled={busy} type="submit">
                    Salvar meta
                  </Button>
                </form>
              )}
            </Card>
          </div>
          <Card>
            <CardTitle>Oportunidades e pontos de atenção</CardTitle>
            <p className="text-sm text-text-muted">
              Referência das regras:{" "}
              {period?.end.split("-").reverse().join("/")}.
            </p>
            {d.report.rules.length ? (
              <div className="r4-insights">
                {d.report.rules.map((r) => (
                  <div key={r.id}>
                    <p>{r.message}</p>
                    <small>Condição: {r.condition}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p>Sem alertas com evidência suficiente nesta data.</p>
            )}
            <Expandable className="mt-4">
              <summary>Como os indicadores são calculados</summary>
              <ul>
                {c.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <p>
                Comparação com o período imediatamente anterior, com a mesma
                duração. Insights de retenção exigem pelo menos três visitas em
                dias distintos; cancelamentos exigem dez registros em cada
                amostra.
              </p>
            </Expandable>
          </Card>
          <div className="r4-editorial">
            <Card>
              <CardTitle>Serviços concluídos</CardTitle>
              {c.services.length ? (
                <div className="r4-ranking">
                  {c.services.map((s) => (
                    <div key={s.name}>
                      <span>{s.name}</span>
                      <strong>
                        {s.count} · {money(s.total)}
                      </strong>
                      <progress
                        aria-label={s.name}
                        value={s.count}
                        max={Math.max(...c.services.map((x) => x.count))}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p>Nenhum serviço concluído no período.</p>
              )}
            </Card>
            {c.professionals.length > 1 && (
              <Card>
                <CardTitle>Por profissional</CardTitle>
                <div className="s3-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Profissional</th>
                        <th>Concluídos</th>
                        <th>Serviços</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.professionals.map((b) => (
                        <tr key={b.name}>
                          <td>{b.name}</td>
                          <td>{b.completed}</td>
                          <td>{money(b.serviceValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-text-muted">
                  Valor dos serviços concluídos; não representa recebimento por
                  profissional.
                </p>
              </Card>
            )}
          </div>
          {single && (
            <Card>
              <CardTitle>Encaixes possíveis</CardTitle>
              <p className="text-sm text-text-muted">
                {d.referenceService
                  ? `Referência: ${d.referenceService}. Inícios alternativos podem se sobrepor; não somar como capacidade.`
                  : "Nenhum serviço ativo."}{" "}
                Consulta real de disponibilidade considera duração, preparação,
                almoço e bloqueios.
              </p>
              {d.availabilityError ? (
                <p role="alert">{d.availabilityError}</p>
              ) : (
                <div className="r4-slots">
                  {d.slots.map((s) => (
                    <Link key={s.barber_id + s.start_time} href="/agenda">
                      {time(s.start_time)} ·{" "}
                      {d.barbers.find((b) => b.id === s.barber_id)?.name ||
                        "Profissional"}
                    </Link>
                  ))}
                  {!d.slots.length && (
                    <p>
                      Nenhum início disponível para o serviço de referência.
                    </p>
                  )}
                </div>
              )}
              <p className="text-sm text-text-muted">
                Maior movimento:{" "}
                {d.report.busyHours.length
                  ? d.report.busyHours.map((h) => h.hour).join(", ")
                  : "sem reservas válidas"}
                .{" "}
                {d.report.window
                  ? `Expediente da loja: ${time(d.report.window.opens)}–${time(d.report.window.closes)}.`
                  : "Sem expediente útil nesta data."}
              </p>
            </Card>
          )}
          <Card id="relatorios">
            <CardTitle>Briefings e fechamentos</CardTitle>
            <p>
              Relatórios salvos pelo backend agendado. Não são regenerados ao
              abrir o painel.
            </p>
            {!d.schedulerSchemaReady && (
              <p role="status">
                A instalação SQL do Raio-X 4.0 ainda não foi detectada. Os
                indicadores acima continuam disponíveis.
              </p>
            )}
            {d.history.length ? (
              d.history.map((row) => {
                const report = row.payload as SavedReport;
                return (
                  <Expandable
                    key={row.id}
                    id={"report-" + row.id}
                    open={highlight.current === row.kind}
                    className="r4-history"
                  >
                    <summary>
                      {row.date.split("-").reverse().join("/")} ·{" "}
                      {row.kind === "closing"
                        ? "Fechamento"
                        : "Briefing matinal"}
                      {report.partial ? " · parcial" : ""}
                    </summary>
                    {report.version === 4 && report.current ? (
                      <>
                        <div className="r4-operations">
                          {[
                            ["Marcados", report.current.valid],
                            ["Concluídos", report.current.completed],
                            ["Cancelados", report.current.cancelled],
                            ["Faltas", report.current.noShow],
                            ["Previsão", money(report.current.expected)],
                            ["Recebido", money(report.current.income)],
                            ["Despesas", money(report.current.expenses)],
                            ["Estornos", money(report.current.refunds)],
                            [
                              "Saldo registrado",
                              money(report.current.registeredBalance),
                            ],
                            ["Ocupação", percent(report.current.occupancy)],
                            [
                              "Ticket",
                              report.current.ticket === null
                                ? "Sem concluídos"
                                : money(report.current.ticket),
                            ],
                            [
                              "Meta",
                              report.goal === null || report.goal === undefined
                                ? "Não definida"
                                : money(report.goal),
                            ],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <span>{k}</span>
                              <strong>{v}</strong>
                            </div>
                          ))}
                        </div>
                        <p>
                          Recebimentos no dia anterior:{" "}
                          {report.previous
                            ? money(report.previous.income)
                            : "não disponível"}
                          .{" "}
                          {report.window
                            ? `Expediente: ${time(report.window.opens)}–${time(report.window.closes)}.`
                            : "Sem expediente cadastrado."}
                        </p>
                        <p>
                          Serviços agendados:{" "}
                          {report.scheduledServices?.length
                            ? report.scheduledServices
                                .map((s) => `${s.name} (${s.count})`)
                                .join(", ")
                            : "nenhum"}
                          .
                        </p>
                        <p>
                          Serviços concluídos:{" "}
                          {report.current.services.length
                            ? report.current.services
                                .map((s) => `${s.name} (${s.count})`)
                                .join(", ")
                            : "nenhum"}
                          .
                        </p>
                        {report.delayed && (
                          <p>
                            Gerado com atraso; os números representam o instante
                            registrado abaixo.
                          </p>
                        )}
                        {row.kind === "briefing" && (
                          <div>
                            <h3>Encaixes registrados no briefing</h3>
                            {report.availability ? (
                              <>
                                <p>
                                  {report.availability.referenceService} ·{" "}
                                  {report.availability.slots.length} inícios
                                  alternativos. Horários podem se sobrepor.
                                </p>
                                <div className="r4-slots">
                                  {report.availability.slots
                                    .slice(0, 30)
                                    .map((slot) => (
                                      <span
                                        key={slot.barber_id + slot.start_time}
                                      >
                                        {time(slot.start_time)} ·{" "}
                                        {d.barbers.find(
                                          (b) => b.id === slot.barber_id,
                                        )?.name || "Profissional"}
                                      </span>
                                    ))}
                                </div>
                                {report.availability.slots.length > 30 && (
                                  <p>
                                    Exibindo os primeiros 30 inícios do
                                    snapshot.
                                  </p>
                                )}
                              </>
                            ) : (
                              <p>
                                A disponibilidade não foi registrada neste
                                snapshot.
                              </p>
                            )}
                          </div>
                        )}
                        <ul>
                          {report.attention?.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <LegacyReport payload={row.payload} />
                    )}
                    <small>
                      Gerado em{" "}
                      {new Date(row.generated_at).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </small>
                  </Expandable>
                );
              })
            ) : (
              <p className="s3-empty">
                Nenhum relatório salvo nesse período. O histórico começa após a
                instalação e ativação da rotina agendada.
              </p>
            )}
            <Link href="/configuracoes#relatorios">
              Configurar relatórios e notificações →
            </Link>
          </Card>
          <Expandable>
            <summary>Critério de baixa ocupação</summary>
            <form
              className="r4-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const r = await saveOccupancyThresholdAction(
                    Number(threshold) / 100,
                  );
                  setNotice(r.ok ? "Critério salvo." : r.error);
                  if (r.ok) await load();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Alertar abaixo de (%)
                <input
                  aria-label="Limite de baixa ocupação"
                  type="number"
                  min="0"
                  max="100"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </label>
              <Button disabled={busy}>Salvar critério</Button>
            </form>
          </Expandable>
          <Expandable>
            <summary>Conversas anteriores · somente leitura</summary>
            <p>
              Arquivo legado preservado. O Raio-X atual não utiliza conversas
              nem faz chamadas de geração.
            </p>
            <Button
              variant="secondary"
              onClick={async () => setLegacy(await legacyHistoryAction())}
            >
              Consultar arquivo legado
            </Button>
            {legacy &&
              (legacy.ok ? (
                legacy.messages.map((m) => (
                  <p key={m.id}>
                    {m.role === "user" ? "Você" : "Resposta anterior"}:{" "}
                    {m.content}
                  </p>
                ))
              ) : (
                <p role="alert">{legacy.error}</p>
              ))}
          </Expandable>
          <p className="text-sm text-text-muted">
            Atualizado em{" "}
            {new Date(d.generatedAt).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
            .{" "}
            <button onClick={load} disabled={busy}>
              Atualizar dados
            </button>
          </p>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </Workspace>
  );
}

function LegacyReport({ payload }: { payload: unknown }) {
  const data =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const fields = [
    ["bookings", "Marcados"],
    ["completed", "Concluídos"],
    ["cancelled", "Cancelamentos"],
    ["income", "Recebido"],
    ["forecast", "Previsão"],
    ["balance", "Saldo registrado"],
    ["expenses", "Despesas"],
    ["refunds", "Estornos"],
  ] as const;
  const available = fields.filter(([key]) => typeof data[key] === "number");
  return (
    <div>
      <p>Relatório anterior preservado.</p>
      {available.length ? (
        <dl className="r4-operations">
          {available.map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                {[
                  "income",
                  "forecast",
                  "balance",
                  "expenses",
                  "refunds",
                ].includes(key)
                  ? money(Number(data[key]))
                  : String(data[key])}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>Este formato anterior não possui os indicadores do Raio-X 4.0.</p>
      )}
    </div>
  );
}
