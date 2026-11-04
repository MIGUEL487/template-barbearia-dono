"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminNavigation } from "@/components/admin/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { localDate, money } from "@/lib/saas2/analytics";
import {
  raioXAction,
  saveGoalAction,
  closeDayAction,
  generateAiAction,
} from "@/app/actions/intelligence-actions";
export function RaioXPage() {
  const revision = useRef(0);
  const [date, setDate] = useState(""),
    [service, setService] = useState(""),
    [barber, setBarber] = useState(""),
    [result, setResult] = useState<Awaited<
      ReturnType<typeof raioXAction>
    > | null>(null),
    [goal, setGoal] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [ai, setAi] = useState<Awaited<ReturnType<typeof generateAiAction>> | null>(
      null,
    );
  useEffect(() => setDate(localDate()), []);
  async function load() {
    const version = ++revision.current;
    setBusy(true);
    const r = await raioXAction(
      { start: date, end: date, barber: barber || null },
      service || undefined,
    );
    if (version !== revision.current) return;
    setResult(r);
    if (r.ok) setGoal(r.goal === null ? "" : String(r.goal / 100));
    setBusy(false);
  }
  useEffect(() => {
    if (date) {
      setAi(null);
      void load();
    } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, barber, service]);
  const d = result?.ok ? result : null,
    c = d?.current;
  async function saveGoal() {
    setBusy(true);
    const r = await saveGoalAction(date, goal.trim() ? Number(goal) : NaN);
    setNotice(r.ok ? "Meta salva." : r.error);
    if (r.ok) await load();
    setBusy(false);
  }
  async function close() {
    setBusy(true);
    const r = await closeDayAction(date);
    setNotice(
      r.ok
        ? "Relatório salvo para a loja inteira. Regenerar atualiza o mesmo relatório, sem duplicá-lo."
        : r.error,
    );
    if (r.ok) await load();
    setBusy(false);
  }
  return (
    <div className="admin-page min-h-screen bg-bg text-text flex flex-col lg:flex-row p-4 lg:p-6 gap-6">
      <AdminNavigation />
      <main className="admin-content flex-1 space-y-6">
        <header>
          <h1>Raio-X</h1>
          <p>Entenda seu dia a partir dos registros da barbearia.</p>
        </header>
        <Card>
          <div className="flex flex-wrap gap-4 items-end">
            <label>
              Data
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            {d && d.barbers.length > 1 && (
              <label>
                Profissional
                <select
                  value={barber}
                  onChange={(e) => setBarber(e.target.value)}
                >
                  <option value="">Todos</option>
                  {d.barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button disabled={busy} onClick={load}>
              Atualizar
            </Button>
          </div>
        </Card>
        {busy && <p role="status">Atualizando diagnóstico…</p>}
        {result && !result.ok && <Card role="alert">{result.error}</Card>}
        {d && c && (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {[
                ["Atendimentos marcados", c.valid],
                ["Atendimentos restantes", d.remainingAppointments],
                [
                  "Horários vagos para o serviço",
                  d.availabilityError ? "Indisponível" : d.slots.length,
                ],
                ["Receita prevista", money(c.expected)],
                ["Receita realizada", money(c.income)],
                ["Saldo registrado", money(c.registeredBalance)],
                [
                  "Meta do dia (loja)",
                  d.goal === null ? "Não definida" : money(d.goal),
                ],
              ].map(([label, value]) => (
                <Card key={label}>
                  <p className="text-sm text-text-muted">{label}</p>
                  <strong className="text-xl block mt-2">{value}</strong>
                </Card>
              ))}
            </div>
            {d.schemaError && (
              <Card role="alert">
                Metas/encerramento aguardam a migration SaaS 2.0:{" "}
                {d.schemaError}. As análises existentes continuam disponíveis.
              </Card>
            )}
            <Card>
              <CardTitle>Raio-X do seu dia</CardTitle>
              <ul className="space-y-4 mt-4">
                {d.diagnosis.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="text-sm text-text-muted mt-4">
                Diagnóstico determinístico. Saldo registrado deduz somente
                despesas e estornos conhecidos; lucro líquido não disponível sem
                todos os custos.{" "}
                {barber &&
                  "Meta e encerramento são sempre da loja inteira; limpe o filtro para acompanhar o progresso da meta."}
              </p>
            </Card>
            <Card>
              <CardTitle>Horários realmente disponíveis</CardTitle>
              <label className="block mt-4">
                Serviço de referência
                <select
                  value={service || d.serviceId}
                  onChange={(e) => setService(e.target.value)}
                >
                  {d.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.duration_minutes + s.buffer_minutes} min com
                      preparação
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-text-muted mt-4">
                Inícios possíveis, consultados no get_availability. Alternativas
                sobrepostas não são capacidade adicional. Considera duração,
                buffer, almoço, folgas, bloqueios e reservas.
              </p>
              {d.availabilityError ? (
                <p role="alert">Consulta indisponível: {d.availabilityError}</p>
              ) : (
                <div className="flex flex-wrap gap-4 mt-4">
                  {d.slots.map((s) => (
                    <span
                      className="border border-border rounded-xl p-2 text-sm"
                      key={s.barber_id + s.start_time}
                    >
                      {new Date(s.start_time).toLocaleTimeString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {d.barbers.find((b) => b.id === s.barber_id)?.name}
                    </span>
                  ))}
                  {!d.slots.length && (
                    <p>Nenhum início disponível nesta combinação.</p>
                  )}
                </div>
              )}
            </Card>
            <Card>
              <CardTitle>Meta e encerramento</CardTitle>
              <div className="flex flex-wrap gap-4 items-end mt-4">
                <label>
                  Meta diária da loja (R$)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </label>
                <Button disabled={busy} onClick={saveGoal}>
                  Salvar meta
                </Button>
                <Button variant="secondary" disabled={busy} onClick={close}>
                  Gerar encerramento manual
                </Button>
              </div>
              <p className="text-sm text-text-muted mt-4">
                Não há job agendado configurado. O relatório é gerado por
                solicitação e usa a data de Brasília. Não altera reservas nem
                lança recebimentos.
              </p>
              {d.closing && (
                <div className="mt-4">
                  <h3>
                    Último encerramento
                    {d.closing.report.isPartial
                      ? " · parcial, antes do fim do expediente"
                      : ""}
                  </h3>
                  <p>
                    {new Date(d.closing.generated_at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </p>
                  <dl className="grid grid-cols-2 gap-4 mt-4">
                    {Object.entries(d.closing.report as Record<string, unknown>)
                      .filter(([k]) =>
                        [
                          "bookings",
                          "completed",
                          "cancelled",
                          "noShow",
                          "forecast",
                          "received",
                          "difference",
                          "registeredBalance",
                          "occupancy",
                        ].includes(k),
                      )
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt>
                            {
                              (
                                {
                                  bookings: "Agendamentos registrados",
                                  completed: "Concluídos",
                                  cancelled: "Cancelamentos",
                                  noShow: "Faltas",
                                  forecast: "Previsão",
                                  received: "Recebido",
                                  difference: "Recebido menos previsão",
                                  registeredBalance: "Saldo registrado",
                                  occupancy: "Ocupação",
                                } as Record<string, string>
                              )[k]
                            }
                          </dt>
                          <dd>
                            {[
                              "forecast",
                              "received",
                              "difference",
                              "registeredBalance",
                            ].includes(k)
                              ? money(Number(v))
                              : k === "occupancy"
                                ? v === null
                                  ? "Indisponível"
                                  : (Number(v) * 100).toFixed(1) + "%"
                                : String(v)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>
              )}
            </Card>
            <Card>
              <CardTitle>Interpretação com IA · opcional</CardTitle>
              <p className="mt-4 text-text-muted">
                {d.aiConfigured
                  ? "Envia somente indicadores agregados. Até cinco solicitações por loja/dia, com resposta limitada; nenhuma ação automática."
                  : "Provedor generativo não configurado. O diagnóstico acima funciona sem IA."}
              </p>
              <Button
                className="mt-4"
                disabled={busy || !d.aiConfigured}
                onClick={async () => {
                  setBusy(true);
                  setAi(await generateAiAction(date));
                  setBusy(false);
                }}
              >
                Interpretar indicadores
              </Button>
              {ai &&
                (ai.ok ? (
                  <div className="mt-4">
                    <p>{ai.output.summary}</p>
                    <ul>
                      {ai.output.actions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-text-muted">
                      Interpretação generativa, sujeita a erro. Valores oficiais
                      são os indicadores calculados.
                    </p>
                  </div>
                ) : (
                  <p role="status" className="mt-4">
                    {ai.error}
                  </p>
                ))}
            </Card>
            <Link href="/resgate" className="text-accent-light">
              Ver oportunidades e retenção →
            </Link>
          </>
        )}
        {notice && <Card role="status">{notice}</Card>}
      </main>
    </div>
  );
}
