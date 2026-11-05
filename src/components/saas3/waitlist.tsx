"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Workspace } from "./shell";
import { Button } from "@/components/ui/button";
import { localDate } from "@/lib/saas2/analytics";
import { waitlistState } from "@/lib/saas2/waitlist";
import {
  listWaitlistAction,
  waitlistSlotsAction,
  offerWaitlistAction,
  cancelWaitlistAction,
} from "@/app/actions/commercial-actions";
export function Waitlist3() {
  const [date, setDate] = useState(""),
    [result, setResult] = useState<Awaited<
      ReturnType<typeof listWaitlistAction>
    > | null>(null),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("waiting"),
    [notice, setNotice] = useState(""),
    [candidates, setCandidates] = useState<
      Record<string, Awaited<ReturnType<typeof waitlistSlotsAction>>>
    >({}),
    [selection, setSelection] = useState<Record<string, string>>({}),
    [offer, setOffer] = useState<Awaited<
      ReturnType<typeof offerWaitlistAction>
    > | null>(null);
  const revision = useRef(0);
  useEffect(() => setDate(localDate()), []);
  async function load() {
    if (!date) return;
    const v = ++revision.current;
    setBusy(true);
    const r = await listWaitlistAction(date);
    if (v !== revision.current) return;
    setResult(r);
    setSelection({});
    setCandidates({});
    setBusy(false);
  }
  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [date]);
  const d = result?.ok ? result : null,
    waiting = d?.entries.filter((e) => waitlistState(e).canOffer) || [],
    entries =
      d?.entries.filter(
        (e) =>
          filter === "all" ||
          (filter === "waiting"
            ? waitlistState(e).canOffer
            : !waitlistState(e).canOffer),
      ) || [];
  return (
    <Workspace
      title="Fila de espera"
      subtitle="Encontre o encaixe certo, respeitando quem chegou primeiro."
      actions={
        <div className="s3-inline">
          <label className="text-xs text-text-muted">
            Data desejada
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <Button variant="secondary" disabled={busy} onClick={load}>
            Atualizar fila
          </Button>
        </div>
      }
    >
      <div className="s3-mini-stats s3-panel">
        <span>
          <strong>{d ? waiting.length : "—"}</strong>aguardando ou reavaliar
        </span>
        <span>
          <strong>
            {d
              ? d.entries.filter(
                  (e) => e.status === "offered" && !waitlistState(e).canOffer,
                ).length
              : "—"}
          </strong>
          ofertas em acompanhamento
        </span>
        <span>
          <strong>15 min</strong>validade normal do hold
        </span>
        <span>
          <strong>Manual</strong>contato autorizado
        </span>
      </div>
      <section className="s3-panel">
        <div className="s3-section-title">
          <div>
            <h2>Ordem de chegada</h2>
            <p>
              Consulte as vagas compatíveis antes de oferecer. Prioridade e
              concorrência são conferidas novamente no banco.
            </p>
          </div>
          <select
            aria-label="Status da fila"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="waiting">Aguardando / reavaliar</option>
            <option value="offered">Em acompanhamento / retirados</option>
            <option value="all">Todos os registros</option>
          </select>
        </div>
        {busy && (
          <p role="status" className="s3-updating">
            Consultando fila…
          </p>
        )}
        {result && !result.ok && (
          <p className="s3-error" role="alert">
            {result.error}
          </p>
        )}
        {d && !entries.length && (
          <div className="s3-empty">
            <h3>Ninguém neste filtro.</h3>
            <p>
              As preferências registradas pelo site aparecerão aqui. Nenhuma
              reserva é criada ao entrar na fila.
            </p>
          </div>
        )}
        {entries.map((e) => {
          const state = waitlistState(e),
            c = candidates[e.id],
            slots = c?.ok ? c.slots : [],
            elapsed = Math.max(
              0,
              Math.floor((Date.now() - Date.parse(e.created_at)) / 60000),
            );
          return (
            <article className="s3-wait-row" key={e.id}>
              <div>
                <h3>
                  {d!.entries.indexOf(e) + 1}. {e.customer_name}
                </h3>
                <p>
                  {e.service_ids
                    .map(
                      (id) =>
                        d!.services.find((s) => s.id === id)?.name ||
                        "Serviço indisponível",
                    )
                    .join(", ")}
                </p>
                <p>
                  {d!.barbers.find((b) => b.id === e.barber_id)?.name ||
                    "Sem preferência"}{" "}
                  · {e.window_start.slice(0, 5)}–{e.window_end.slice(0, 5)}
                </p>
                <small className="text-text-muted">
                  {elapsed < 60
                    ? `${elapsed} min`
                    : elapsed < 1440
                      ? `${Math.floor(elapsed / 60)} h`
                      : `${Math.floor(elapsed / 1440)} dia(s)`}{" "}
                  na fila · solicitado em{" "}
                  {new Date(e.created_at).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </small>
              </div>
              <div>
                <span className="s3-status">{state.label}</span>
                {c?.ok && (
                  <p className="mt-2 text-accent-light">
                    {slots.length
                      ? `${slots.length} vaga(s) compatível(is)`
                      : "Nenhuma vaga compatível agora"}
                  </p>
                )}
                <details className="mt-4 text-xs text-text-muted">
                  <summary>Contato manual autorizado</summary>
                  <p>{e.contact_channel === "email" ? e.email : e.phone}</p>
                  <p>WhatsApp automático é integração futura.</p>
                </details>
              </div>
              <div className="s3-inline">
                {state.canOffer ? (
                  <>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        const r = await waitlistSlotsAction(e.id);
                        setCandidates((prev) => ({ ...prev, [e.id]: r }));
                        if (!r.ok) setNotice(r.error);
                        setBusy(false);
                      }}
                    >
                      Consultar vagas
                    </Button>
                    {slots.length > 0 && (
                      <>
                        <select
                          aria-label={"Vaga para " + e.customer_name}
                          value={selection[e.id] || ""}
                          onChange={(ev) =>
                            setSelection((prev) => ({
                              ...prev,
                              [e.id]: ev.target.value,
                            }))
                          }
                        >
                          <option value="">Escolher encaixe</option>
                          {slots.map((s) => (
                            <option
                              key={s.barber_id + s.start_time}
                              value={s.barber_id + "|" + s.start_time}
                            >
                              {new Date(s.start_time).toLocaleTimeString(
                                "pt-BR",
                                {
                                  timeZone: "America/Sao_Paulo",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}{" "}
                              ·{" "}
                              {
                                d!.barbers.find((b) => b.id === s.barber_id)
                                  ?.name
                              }
                            </option>
                          ))}
                        </select>
                        <Button
                          disabled={busy || !selection[e.id]}
                          onClick={async () => {
                            if (
                              !confirm(
                                "Criar pré-reserva de 15 minutos para esta oferta? Nenhuma mensagem será enviada automaticamente.",
                              )
                            )
                              return;
                            setBusy(true);
                            const [barber, start] = selection[e.id].split("|"),
                              r = await offerWaitlistAction(
                                e.id,
                                barber,
                                start,
                              );
                            setOffer(r);
                            setNotice(
                              r.ok
                                ? r.data.already_offered
                                  ? "Esta solicitação já tem reserva. Confira a agenda."
                                  : "Pré-reserva criada. Entre em contato manualmente para concluir."
                                : r.error,
                            );
                            await load();
                            setBusy(false);
                          }}
                        >
                          Oferecer encaixe
                        </Button>
                      </>
                    )}
                    {state.canRemove && (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={async () => {
                          if (!confirm("Retirar esta solicitação da fila?"))
                            return;
                          const r = await cancelWaitlistAction(e.id);
                          setNotice(r.ok ? "Solicitação retirada." : r.error);
                          await load();
                        }}
                      >
                        Retirar
                      </Button>
                    )}
                  </>
                ) : e.offered_booking_id ? (
                  <Link className="text-accent-light" href="/agenda">
                    Ver na agenda →
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
      {notice && (
        <p role="status" className="s3-notice">
          {notice}
          {offer?.ok && offer.data.cancellation_token && (
            <span className="block mt-2">
              Acompanhamento no site do cliente: /meu-agendamento?token=
              <code className="break-all select-all">
                {offer.data.cancellation_token}
              </code>
              . Compartilhe somente com este cliente.
            </span>
          )}
        </p>
      )}
      <p className="s3-note">
        Consultar vagas não garante o encaixe. A oferta transacional respeita
        expediente, almoço, duração, buffer, bloqueios, reservas e a ordem entre
        solicitações elegíveis.
      </p>
    </Workspace>
  );
}
