"use client";
import { useEffect, useRef, useState } from "react";
import { analyticsAction } from "@/app/actions/intelligence-actions";
import { Workspace, Metric } from "./shell";
import { PeriodControl, periodFor, type PeriodValue } from "./period";
import { LineChart } from "./line-chart";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/saas2/analytics";
import Link from "next/link";
const change = (current: number, previous: number) =>
  previous
    ? `${current >= previous ? "↗" : "↘"} ${Math.abs((current / previous - 1) * 100).toFixed(1)}% · período anterior`
    : "Sem base anterior para comparar";
export function Analytics3() {
  const [period, setPeriod] = useState<PeriodValue | null>(null),
    [barber, setBarber] = useState(""),
    [data, setData] = useState<Awaited<
      ReturnType<typeof analyticsAction>
    > | null>(null),
    [busy, setBusy] = useState(false);
  const version = useRef(0);
  useEffect(() => setPeriod(periodFor("7")), []);
  async function load() {
    if (!period) return;
    const id = ++version.current;
    setBusy(true);
    const result = await analyticsAction({
      start: period.start,
      end: period.end,
      barber: barber || null,
    }).catch(() => ({
      ok: false as const,
      error: "Não foi possível conectar às análises.",
    }));
    if (id !== version.current) return;
    setData(result);
    setBusy(false);
  }
  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [period, barber]);
  const d = data?.ok ? data : null,
    c = d?.current,
    p = d?.previous;
  const cols = [...new Set(c?.heatmap.map((h) => h.hour) || [])].sort(),
    days = [...new Set(c?.heatmap.map((h) => h.date) || [])];
  return (
    <Workspace
      title="Análises"
      subtitle="Entenda o desempenho da sua barbearia."
      actions={period && <PeriodControl value={period} onChange={setPeriod} />}
    >
      {busy && (
        <p role="status" className="s3-updating">
          Atualizando os indicadores…
        </p>
      )}
      {data && !data.ok && <Card role="alert">{data.error}</Card>}
      {d && c && p && (
        <>
          <div className="s3-kpis">
            <Metric
              label="Faturamento realizado"
              value={money(c.income)}
              previous={change(c.income, p.income)}
              tip="Entradas efetivamente registradas no livro-caixa. Não soma pagamentos novamente."
            />
            <Metric
              label="Faturamento previsto"
              value={money(c.expected)}
              previous={change(c.expected, p.expected)}
              tip="Valor integral de serviços em reservas válidas. Pode incluir dinheiro já recebido; não é saldo a receber."
            />
            <Metric
              label="Agendamentos"
              value={String(c.bookings)}
              previous={change(c.bookings, p.bookings)}
              tip="Todos os agendamentos do período. Cancelamentos e faltas aparecem no resumo operacional."
            />
            <Metric
              label="Ticket médio"
              value={c.ticket === null ? "Sem concluídos" : money(c.ticket)}
              previous={
                c.ticket !== null && p.ticket !== null
                  ? change(c.ticket, p.ticket)
                  : undefined
              }
              tip="Valor dos serviços concluídos dividido por atendimentos concluídos; não é ticket de recebimentos."
            />
          </div>
          <section className="s3-panel">
            <div className="s3-section-title">
              <div>
                <h2>Evolução da receita</h2>
                <p>
                  Caixa recebido e valor dos serviços programados · valores em
                  reais
                </p>
              </div>
              <div className="s3-inline">
                {d.barbers.length > 1 && (
                  <select
                    aria-label="Profissional nas análises"
                    value={barber}
                    onChange={(e) => setBarber(e.target.value)}
                  >
                    <option value="">Toda a equipe</option>
                    {d.barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
                <Button variant="ghost" disabled={busy} onClick={load}>
                  Atualizar
                </Button>
              </div>
            </div>
            <LineChart rows={c.daily} />
            {!c.bookings && !c.income && (
              <div className="s3-empty">
                <h3>Sua história começa com os registros.</h3>
                <p>
                  À medida que atendimentos e recebimentos forem registrados,
                  você verá tendências aqui. Nenhum valor de demonstração foi
                  incluído.
                </p>
                <Link href="/agenda">Abrir agenda →</Link>
              </div>
            )}
          </section>
          <div className="s3-analytics-grid">
            <section className="s3-panel">
              <div className="s3-section-title">
                <div>
                  <h2>Ritmo da agenda</h2>
                  <p>
                    Ocupação por dia e horário, descontando almoço e bloqueios.
                  </p>
                </div>
                <strong>
                  {c.occupancy === null
                    ? "Sem expediente"
                    : (c.occupancy * 100).toFixed(1) + "%"}
                </strong>
              </div>
              {days.length ? (
                <div className="s3-heat-scroll">
                  <div
                    className="s3-heat"
                    style={{
                      gridTemplateColumns: `80px repeat(${cols.length},minmax(32px,1fr))`,
                    }}
                  >
                    <span />
                    {cols.map((h) => (
                      <span key={h}>{h.slice(0, 2)}h</span>
                    ))}
                    {days.map((date) => (
                      <div className="s3-heat-row" key={date}>
                        <span>
                          {date.slice(5).split("-").reverse().join("/")}
                        </span>
                        {cols.map((hour) => {
                          const h = c.heatmap.find(
                              (x) => x.date === date && x.hour === hour,
                            ),
                            ratio = h ? h.occupied / h.minutes : 0;
                          const title = h
                            ? `${date} ${hour}: ${(ratio * 100).toFixed(0)}%, ${Math.round(h.occupied)} de ${Math.round(h.minutes)} min.`
                            : `${date} ${hour}: sem capacidade cadastrada`;
                          return (
                            <button
                              key={hour}
                              type="button"
                              title={title}
                              aria-label={title}
                              className={!h ? "s3-closed" : ""}
                              style={
                                h
                                  ? {
                                      background: `color-mix(in srgb,var(--accent) ${Math.round(8 + ratio * 72)}%,var(--surface-2))`,
                                    }
                                  : undefined
                              }
                              onClick={(e) => {
                                const output = e.currentTarget
                                  .closest(".s3-panel")
                                  ?.querySelector("output");
                                if (output) output.textContent = title;
                              }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="s3-empty">
                  Cadastre o expediente para visualizar a capacidade.
                </p>
              )}
              <output className="s3-chart-caption">
                Toque ou passe o cursor em uma célula para consultar.
              </output>
              <p className="s3-note">
                Histórico estimado com o expediente e os bloqueios atuais.
                Capacidade livre: {Math.round(c.freeMinutes)} min.
              </p>
            </section>
            <section className="s3-panel">
              <div className="s3-section-title">
                <div>
                  <h2>Serviços mais realizados</h2>
                  <p>Itens de atendimentos concluídos, com quantidades.</p>
                </div>
              </div>
              {!c.services.length ? (
                <p className="s3-empty">
                  Nenhum serviço concluído neste período.
                </p>
              ) : (
                <div className="s3-service-ranking">
                  {c.services.slice(0, 8).map((s, i) => (
                    <div key={s.name + i}>
                      <div>
                        <span>{s.name}</span>
                        <strong>{s.count}</strong>
                      </div>
                      <div className="s3-rank-track">
                        <span
                          style={{
                            width:
                              (s.count /
                                Math.max(
                                  1,
                                  ...c.services.map((s) => s.count),
                                )) *
                                100 +
                              "%",
                          }}
                        />
                      </div>
                      <small>
                        {(
                          (s.count /
                            c.services.reduce((n, s) => n + s.count, 0)) *
                          100
                        ).toFixed(1)}
                        % dos itens · {money(s.total)} em serviços
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
          <section className="s3-panel">
            <div className="s3-section-title">
              <div>
                <h2>Clientes que voltam</h2>
                <p>Visitas concluídas, sem presumir intenção de retorno.</p>
              </div>
              <Link href="/resgate">Explorar retenção →</Link>
            </div>
            <div className="s3-mini-stats">
              <span>
                <strong>{c.fresh}</strong>novos no período
              </span>
              <span>
                <strong>{c.returning}</strong>já haviam visitado
              </span>
              <span>
                <strong>
                  {c.retention.filter((r) => r.usual !== null).length
                    ? `${(c.retention.filter((r) => r.usual !== null).reduce((n, r) => n + r.usual!, 0) / c.retention.filter((r) => r.usual !== null).length).toFixed(0)} dias`
                    : "Sem base"}
                </strong>
                intervalo médio histórico
              </span>
              <span>
                <strong>
                  {c.cancelled} / {c.noShow}
                </strong>
                cancelamentos / faltas
              </span>
            </div>
            {c.daily.some((d) => d.newCustomers || d.returningCustomers) && (
              <LineChart
                monetary={false}
                first="Primeira visita"
                secondary="Já visitavam"
                rows={c.daily.map((d) => ({
                  date: d.date,
                  income: d.newCustomers,
                  forecast: d.returningCustomers,
                }))}
              />
            )}
            <p className="s3-note">
              O intervalo exige pelo menos três visitas em dias diferentes.
              Retenção histórica detalhada fica em Modo Resgate; não há uma
              série de churn confiável sem acompanhamento de coortes.
            </p>
          </section>
          <details className="s3-panel">
            <summary>Como interpretar os cálculos</summary>
            {c.notes.map((n) => (
              <p className="s3-note" key={n}>
                {n}
              </p>
            ))}
            <p className="s3-note">
              Comparação com período imediatamente anterior de mesma duração.
              Com filtro de profissional, lançamentos sem reserva vinculada
              ficam fora da receita. Datas em America/Sao_Paulo. Google
              Analytics não configurado no código: navegação e caixa não são
              misturados.
            </p>
          </details>
        </>
      )}
    </Workspace>
  );
}
