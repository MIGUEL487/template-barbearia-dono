"use client";
import {AnimatedSelect} from "@/components/ui/animated-select";
import { waitlistState } from "@/lib/saas2/waitlist";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminNavigation } from "@/components/admin/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { localDate } from "@/lib/saas2/analytics";
import {
  listWaitlistAction,
  offerWaitlistAction,
  cancelWaitlistAction,
  waitlistSlotsAction,
} from "@/app/actions/commercial-actions";
export function WaitlistPage() {
  const revision = useRef(0);
  const [date, setDate] = useState(""),
    [result, setResult] = useState<Awaited<
      ReturnType<typeof listWaitlistAction>
    > | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [selection, setSelection] = useState<Record<string, string>>({}),
    [candidates, setCandidates] = useState<
      Record<string, Awaited<ReturnType<typeof waitlistSlotsAction>>>
    >({}),
    [offer, setOffer] = useState<Awaited<
      ReturnType<typeof offerWaitlistAction>
    > | null>(null);
  useEffect(() => setDate(localDate()), []);
  async function load() {
    const version = ++revision.current;
    setBusy(true);
    const r = await listWaitlistAction(date);
    if (version !== revision.current) return;
    setResult(r);
    setSelection({});
    setCandidates({});
    setBusy(false);
  }
  useEffect(() => {
    if (date) void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);
  const d = result?.ok ? result : null;
  return (
    <div className="admin-page min-h-screen bg-bg text-text flex flex-col lg:flex-row p-4 lg:p-6 gap-6">
      <AdminNavigation />
      <main className="admin-content flex-1 space-y-6">
        <header>
          <h1>Fila de espera</h1>
          <p>
            Preferências, ordem de chegada e encaixes com disponibilidade real.
          </p>
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
            <Button disabled={busy} onClick={load}>
              Atualizar fila
            </Button>
          </div>
          <p className="text-sm text-text-muted mt-4">
            Nenhum aviso automático ou envio por WhatsApp está ativo. A oferta
            cria uma pré-reserva normal de 15 minutos, sujeita à confirmação.
            Entre clientes que podem usar a mesma vaga, a ordem é validada no
            banco.
          </p>
        </Card>
        {busy && <p role="status">Consultando fila e horários…</p>}
        {result && !result.ok && <Card role="alert">{result.error}</Card>}
        {d && !d.entries.length && (
          <Card>Nenhuma solicitação para esta data.</Card>
        )}
        {d?.entries.map((e, index) => {
          const state = waitlistState(e);
          return (
            <Card key={e.id}>
              <CardTitle>
                {index + 1}. {e.customer_name}
              </CardTitle>
              <p className="mt-4">
                {e.service_ids
                  .map(
                    (id) =>
                      d.services.find((s) => s.id === id)?.name ||
                      "Serviço indisponível",
                  )
                  .join(", ")}{" "}
                ·{" "}
                {d.barbers.find((b) => b.id === e.barber_id)?.name ||
                  "Sem preferência"}
              </p>
              <p>
                {e.window_start.slice(0, 5)}–{e.window_end.slice(0, 5)} ·{" "}
                {state.label}
              </p>
              <p className="text-text-muted text-sm">
                Solicitado em{" "}
                {new Date(e.created_at).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
                . Contato manual autorizado:{" "}
                {e.contact_channel === "email" ? e.email : e.phone}.
              </p>
              {state.canOffer && (
                <div className="flex flex-wrap gap-4 mt-4">
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
                    Consultar vagas compatíveis
                  </Button>
                  <AnimatedSelect
                    aria-label={"Encaixe para " + e.customer_name}
                    value={selection[e.id] || ""}
                    onChange={(ev) =>
                      setSelection((previous) => ({
                        ...previous,
                        [e.id]: ev.target.value,
                      }))
                    }
                  >
                    <option value="">
                      {candidates[e.id]?.ok
                        ? "Escolha uma vaga real"
                        : "Consulte a disponibilidade"}
                    </option>
                    {(candidates[e.id]?.ok
                      ? (
                          candidates[e.id] as {
                            ok: true;
                            slots: { start_time: string; barber_id: string }[];
                          }
                        ).slots
                      : []
                    ).map((s) => (
                      <option
                        key={s.barber_id + s.start_time}
                        value={s.barber_id + "|" + s.start_time}
                      >
                        {new Date(s.start_time).toLocaleTimeString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {d.barbers.find((b) => b.id === s.barber_id)?.name}
                      </option>
                    ))}
                  </AnimatedSelect>
                  <Button
                    disabled={busy || !selection[e.id]}
                    onClick={async () => {
                      const [barber, start] = selection[e.id].split("|");
                      setBusy(true);
                      const r = await offerWaitlistAction(e.id, barber, start);
                      setOffer(r);
                      setNotice(
                        r.ok
                          ? r.data.already_offered
                            ? "Esta solicitação já tem reserva; consulte a agenda."
                            : "Pré-reserva criada. Entre em contato manualmente para concluir."
                          : r.error,
                      );
                      await load();
                      setBusy(false);
                    }}
                  >
                    Criar pré-reserva para oferta
                  </Button>
                  {state.canRemove && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        const r = await cancelWaitlistAction(e.id);
                        setNotice(r.ok ? "Solicitação retirada." : r.error);
                        await load();
                        setBusy(false);
                      }}
                    >
                      Retirar da fila
                    </Button>
                  )}
                </div>
              )}
              {e.offered_booking_id && (
                <Link className="text-accent-light block mt-4" href="/agenda">
                  Gerenciar reserva na agenda →
                </Link>
              )}
            </Card>
          );
        })}
        {notice && (
          <Card role="status">
            {notice}
            {offer?.ok && offer.data.cancellation_token && (
              <p>
                Token de acompanhamento gerado. Abra o site do cliente em
                /meu-agendamento?token=
                <code className="break-all select-all">
                  {offer.data.cancellation_token}
                </code>
                . Compartilhe somente com este cliente.
              </p>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
