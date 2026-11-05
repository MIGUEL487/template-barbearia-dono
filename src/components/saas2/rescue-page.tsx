"use client";
import { AnimatedSelect } from "@/components/ui/animated-select";
import { Expandable } from "@/components/ui/expandable";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ManagementLayout } from "@/components/admin/management-layout";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { localDate } from "@/lib/saas2/analytics";
import {
  rescueAction,
  assistantAvailabilityAction,
} from "@/app/actions/commercial-actions";
export function RescuePage() {
  const [date, setDate] = useState(""),
    [result, setResult] = useState<Awaited<
      ReturnType<typeof rescueAction>
    > | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [input, setInput] = useState("Tem horário amanhã depois das 18h?"),
    [service, setService] = useState(""),
    [barber, setBarber] = useState(""),
    [assistant, setAssistant] = useState<Awaited<
      ReturnType<typeof assistantAvailabilityAction>
    > | null>(null);
  useEffect(() => setDate(localDate()), []);
  useEffect(() => {
    if (!date) return;
    let alive = true;
    setBusy(true);
    rescueAction(date).then((r) => {
      if (!alive) return;
      setResult(r);
      if (r.ok) {
        setMessage(r.message);
        setService(r.services[0]?.id || "");
      }
      setBusy(false);
    });
    return () => {
      alive = false;
    };
  }, [date]);
  const d = result?.ok ? result : null;
  return (
    <ManagementLayout
      title="Modo Resgate"
      subtitle="Oportunidades reais e campanhas em demonstração."
    >
      <Card>
        <label>
          Data de referência
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {busy && <p role="status">Consultando oportunidades…</p>}
      </Card>
      {result && !result.ok && <Card role="alert">{result.error}</Card>}
      {d && (
        <>
          <section className="s3-action-list">
            <article className="s3-opportunity">
              <div>
                <h2>Preencher a agenda</h2>
                <p>
                  {Math.round(d.current.freeMinutes)} minutos livres na
                  capacidade cadastrada. Verifique os serviços que cabem.
                </p>
              </div>
              <Link className="text-accent-light" href="/raio-x">
                Consultar horários →
              </Link>
            </article>
            <article className="s3-opportunity">
              <div>
                <h2>Reavaliar cancelamentos</h2>
                <p>
                  {d.current.cancelled} cancelamento(s) na data. A fila mantém
                  prioridade e regras de encaixe.
                </p>
              </div>
              <Link className="text-accent-light" href="/fila-de-espera">
                Abrir fila →
              </Link>
            </article>
            <article className="s3-opportunity">
              <div>
                <h2>Preparar um retorno</h2>
                <p>
                  {d.eligible} cliente(s) com sinal de atraso e consentimento
                  vigente. Envio em demonstração.
                </p>
              </div>
              <a
                className="text-accent-light"
                href="#rescue-campaign"
                onClick={() => {
                  const el = document.getElementById(
                    "rescue-campaign",
                  ) as HTMLDetailsElement | null;
                  el?.dispatchEvent(new Event("expand"));
                }}
              >
                Ver prévia →
              </a>
            </article>
          </section>
          <Expandable className="bg-surface border border-border rounded-2xl p-6">
            <summary>Entender as oportunidades</summary>
            <Card>
              <CardTitle>Oportunidades de agenda</CardTitle>
              <p className="mt-4">
                {Math.round(d.current.freeMinutes)} minutos livres ·{" "}
                {d.current.cancelled} cancelamento(s) ·{" "}
                {d.current.occupancy === null
                  ? "Sem expediente"
                  : (d.current.occupancy * 100).toFixed(1) + "% de ocupação"}
                .
              </p>
              <p className="text-text-muted mt-4">
                Capacidade livre não equivale a serviços que cabem. Confirme os
                inícios disponíveis no Raio-X ou na fila de espera.
                Cancelamentos são agrupados pela data do atendimento; não há
                histórico de quando ocorreram.
              </p>
            </Card>
          </Expandable>
          <Expandable
            id="rescue-campaign"
            className="bg-surface border border-border rounded-2xl p-6"
          >
            <summary>Preparar campanha · somente demonstração</summary>
            <Card>
              <CardTitle>
                Campanha de retorno · Demonstração — integração futura
              </CardTitle>
              <p className="mt-4">
                Público sugerido: clientes além do intervalo habitual com
                consentimento de WhatsApp vigente. {d.eligible} cliente(s)
                elegível(is) no histórico analisado.
              </p>
              <label className="block mt-4">
                Prévia da mensagem
                <textarea
                  className="w-full mt-2"
                  rows={4}
                  value={message}
                  maxLength={1000}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>
              <p className="text-text-muted mt-4">
                {d.warning} Não há disparo, fila ativa ou desconto aplicado.
                Revise preferências e consentimentos antes de qualquer contato
                manual.
              </p>
            </Card>
          </Expandable>
          <Card>
            <CardTitle>Retenção de clientes</CardTitle>
            <p className="text-text-muted mt-4">
              Três visitas em dias diferentes são necessárias. Próximo: a partir
              de 80% do intervalo médio; atrasado: acima de 125%. Redução de
              frequência: último intervalo acima de 125% dos anteriores, com
              pelo menos quatro visitas. São sinais históricos, não certezas de
              intenção.
            </p>
            {!d.retention.length ? (
              <p className="mt-4">
                Nenhum atendimento concluído no histórico disponível.
              </p>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Visitas</th>
                      <th>Intervalo habitual</th>
                      <th>Dias desde a visita</th>
                      <th>Sinal histórico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.retention.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.visits}</td>
                        <td>
                          {r.usual === null
                            ? "Insuficiente"
                            : r.usual.toFixed(0) + " dias"}
                        </td>
                        <td>{Math.floor(r.elapsed)}</td>
                        <td>
                          {r.category}
                          {r.slowing ? " · Frequência diminuindo" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card>
            <CardTitle>
              Assistente Inteligente · demonstração de texto
            </CardTitle>
            <p className="text-text-muted mt-4">
              Reconhece apenas hoje/amanhã e “depois das HHh”. Consulta horários
              reais, sem criar reserva. Áudio é uma integração futura.
            </p>
            <div className="flex flex-wrap gap-4 mt-4">
              {[
                "Tem horário amanhã depois das 18h?",
                "Tem horário hoje depois das 15h?",
              ].map((s) => (
                <Button variant="secondary" key={s} onClick={() => setInput(s)}>
                  {s}
                </Button>
              ))}
            </div>
            <label className="block mt-4">
              Pedido
              <input
                className="w-full mt-2"
                value={input}
                maxLength={500}
                onChange={(e) => setInput(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-4 mt-4">
              <label>
                Serviço
                <AnimatedSelect
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                >
                  {d.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </AnimatedSelect>
              </label>
              {d.barbers.length > 1 && (
                <label>
                  Profissional
                  <AnimatedSelect
                    value={barber}
                    onChange={(e) => setBarber(e.target.value)}
                  >
                    <option value="">Sem preferência</option>
                    {d.barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </AnimatedSelect>
                </label>
              )}
              <Button
                disabled={busy || !service}
                onClick={async () => {
                  setBusy(true);
                  setAssistant(
                    await assistantAvailabilityAction(
                      input,
                      service,
                      barber ||
                        (d.barbers.length === 1 && d.barbers[0].id) ||
                        null,
                    ),
                  );
                  setBusy(false);
                }}
              >
                Consultar sem reservar
              </Button>
            </div>
            {assistant && (
              <div className="mt-4" role="status">
                {assistant.ok ? (
                  <>
                    <p>
                      Interpretação: {assistant.service},{" "}
                      {assistant.date.split("-").reverse().join("/")} após{" "}
                      {assistant.after}.
                    </p>
                    <p>
                      Consulta real:{" "}
                      {assistant.slots.length
                        ? assistant.slots
                            .map((s) =>
                              new Date(s.start_time).toLocaleTimeString(
                                "pt-BR",
                                {
                                  timeZone: "America/Sao_Paulo",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              ),
                            )
                            .join(", ")
                        : "nenhum horário disponível."}
                    </p>
                    <p className="text-text-muted">{assistant.notice}</p>
                  </>
                ) : (
                  assistant.error
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </ManagementLayout>
  );
}
