"use client";
import { useEffect, useRef, useState } from "react";
import { AdminNavigation } from "@/components/admin/navigation";
import { AdminSkeleton } from "@/components/admin/skeleton";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bars } from "./charts";
import { analyticsAction } from "@/app/actions/intelligence-actions";
import { localDate, shiftDate, money } from "@/lib/saas2/analytics";
export function AnalyticsPage() {
  const revision = useRef(0);
  const [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [barber, setBarber] = useState(""),
    [result, setResult] = useState<Awaited<
      ReturnType<typeof analyticsAction>
    > | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const today = localDate();
    setStart(shiftDate(today, -6));
    setEnd(today);
  }, []);
  async function load() {
    const version = ++revision.current;
    setBusy(true);
    const r = await analyticsAction({ start, end, barber: barber || null });
    if (version !== revision.current) return;
    setResult(r);
    setBusy(false);
  }
  useEffect(() => {
    if (start && end) void load(); /* explicit apply for custom edits */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, barber]);
  const data = result?.ok ? result : null,
    c = data?.current;
  function preset(value: string) {
    const t = localDate();
    setEnd(value === "yesterday" ? shiftDate(t, -1) : t);
    setStart(
      value === "today"
        ? t
        : value === "yesterday"
          ? shiftDate(t, -1)
          : value === "month"
            ? t.slice(0, 8) + "01"
            : shiftDate(t, value === "30" ? -29 : -6),
    );
  }
  return (
    <div className="admin-page min-h-screen bg-bg text-text flex flex-col lg:flex-row p-4 lg:p-6 gap-6">
      <AdminNavigation />
      <main className="admin-content flex-1 space-y-6">
        <header>
          <h1>Análises</h1>
          <p>
            Resultados registrados, previsão e capacidade · America/Sao_Paulo
          </p>
        </header>
        <Card>
          <div className="flex flex-wrap gap-4">
            <label>
              Período
              <select
                aria-label="Período"
                defaultValue="7"
                onChange={(e) => {
                  if (e.target.value !== "custom") preset(e.target.value);
                }}
              >
                <option value="today">Hoje</option>
                <option value="yesterday">Ontem</option>
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="month">Mês atual</option>
                <option value="custom">Personalizado</option>
              </select>
            </label>
            <label>
              Início
              <input
                aria-label="Início"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Fim
              <input
                aria-label="Fim"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            {data && data.barbers.length > 1 && (
              <label>
                Profissional
                <select
                  value={barber}
                  onChange={(e) => setBarber(e.target.value)}
                >
                  <option value="">Todos</option>
                  {data.barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button onClick={load} disabled={busy}>
              Atualizar
            </Button>
          </div>
        </Card>
        {busy && <p role="status">Atualizando indicadores…</p>}
        {result && !result.ok && (
          <Card role="alert">Não foi possível carregar: {result.error}</Card>
        )}
        {c && (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                ["Receita realizada", money(c.income)],
                ["Receita prevista", money(c.expected)],
                ["Saldo registrado", money(c.registeredBalance)],
                ["Agendamentos", c.bookings],
                ["Concluídos", c.completed],
                ["Cancelamentos", c.cancelled],
                ["Faltas registradas", c.noShow],
                [
                  "Ticket dos concluídos",
                  c.ticket === null ? "Sem dados" : money(c.ticket),
                ],
                [
                  "Ocupação",
                  c.occupancy === null
                    ? "Sem expediente"
                    : (c.occupancy * 100).toFixed(1) + "%",
                ],
                ["Capacidade livre", Math.round(c.freeMinutes) + " min"],
                ["Clientes novos", c.fresh],
                ["Clientes recorrentes", c.returning],
              ].map(([label, value]) => (
                <Card key={label}>
                  <p className="text-text-muted text-sm">{label}</p>
                  <strong className="block text-xl mt-2">{value}</strong>
                </Card>
              ))}
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <Bars
                title="Receita recebida por dia"
                rows={c.daily.map((d) => ({
                  label: d.date.split("-").reverse().join("/"),
                  value: d.income,
                  detail: `Previsão de serviços: ${money(d.forecast)}`,
                }))}
                format={money}
              />
              <Bars
                title="Agendamentos por dia"
                rows={c.daily.map((d) => ({
                  label: d.date,
                  value: d.bookings,
                }))}
              />
              <Bars
                title="Ocupação por horário"
                rows={c.hourly.map((h) => ({
                  label: h.hour,
                  value: Math.round((h.occupied / h.minutes) * 100),
                  detail: `${Math.round(h.occupied)} de ${Math.round(h.minutes)} minutos disponíveis no expediente.`,
                }))}
                format={(n) => n + "%"}
              />
              <Bars
                title="Serviços realizados"
                rows={c.services.map((s) => ({
                  label: s.name,
                  value: s.count,
                  detail: `Valor de serviços: ${money(s.total)}; não representa recebimentos.`,
                }))}
              />
              <Bars
                title="Comparativo de recebimentos"
                rows={[
                  {
                    label: "Período anterior de mesma duração",
                    value: data!.previous.income,
                  },
                  { label: "Período selecionado", value: c.income },
                ]}
                format={money}
              />
              <Bars
                title="Clientes atendidos no período"
                rows={[
                  { label: "Novos", value: c.fresh },
                  { label: "Recorrentes", value: c.returning },
                ]}
              />
              <Bars
                title="Desempenho por profissional"
                rows={c.professionals.map((p) => ({
                  label: p.name,
                  value: p.completed,
                  detail: `Valor dos serviços concluídos: ${money(p.serviceValue)}`,
                }))}
              />
              <Card>
                <CardTitle>Retenção</CardTitle>
                {[
                  "Dentro do intervalo habitual",
                  "Próximo do retorno esperado",
                  "Retorno atrasado",
                  "Dados insuficientes",
                ].map((label) => (
                  <p className="mt-4" key={label}>
                    {label}:{" "}
                    <strong>
                      {c.retention.filter((r) => r.category === label).length}
                    </strong>
                  </p>
                ))}
                <p className="mt-4 text-sm text-text-muted">
                  Histórico de atendimentos concluídos. São necessárias três
                  visitas em dias diferentes para estimar o intervalo habitual;
                  categorias não expressam intenção do cliente.
                </p>
              </Card>
            </div>
            <Card>
              <CardTitle>Como interpretar</CardTitle>
              {c.notes.map((note) => (
                <p key={note} className="mt-4 text-sm text-text-muted">
                  {note}
                </p>
              ))}
              <p className="mt-4 text-sm text-text-muted">
                Com filtro de profissional, lançamentos sem reserva vinculada
                ficam fora da receita. Horários livres para um serviço
                específico estão no Raio-X.
              </p>
              <p className="mt-4 text-xs">
                Atualizado:{" "}
                {new Date(data!.generatedAt).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
              </p>
            </Card>
            <Card>
              <CardTitle>Google Analytics · não configurado</CardTitle>
              <p className="mt-4 text-text-muted">
                Não foi encontrada integração de navegação autorizada neste
                projeto. Visitantes, origens e conversões dependem dessa
                configuração e não compõem os valores financeiros acima.
              </p>
            </Card>
          </>
        )}
        {!result && busy && <AdminSkeleton />}
      </main>
    </div>
  );
}
