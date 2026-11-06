"use client";
import { useEffect, useState } from "react";
import {
  reportPreferencesAction,
  saveReportPreferencesAction,
} from "@/app/actions/operational-actions";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNotifications } from "./notification-provider";
import { createClient } from "@/lib/supabase";
export function ReportNotificationControls() {
  const notifications = useNotifications(),
    [morning, setMorning] = useState(false),
    [evening, setEvening] = useState(false),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void reportPreferencesAction().then((r) => {
      if (!active) return;
      if (r.ok) {
        setMorning(r.morning);
        setEvening(r.evening);
        setReady(true);
      } else setMessage(r.error);
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <Card id="relatorios" className="space-y-4">
      <CardTitle>Relatórios e notificações</CardTitle>
      <p className="text-sm text-text-muted">
        Horário baseado no expediente: primeiro início e último encerramento dos
        profissionais ativos, descontando dias fechados e folgas. Fuso: São
        Paulo.
      </p>
      <form
        className="r4-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await saveReportPreferencesAction({ morning, evening });
            setMessage(
              r.ok
                ? "Preferências salvas para sua conta nesta barbearia."
                : r.error,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="r4-toggle">
          <input
            type="checkbox"
            checked={morning}
            disabled={!ready}
            onChange={(e) => setMorning(e.target.checked)}
          />
          Receber briefing matinal
        </label>
        <label className="r4-toggle">
          <input
            type="checkbox"
            checked={evening}
            disabled={!ready}
            onChange={(e) => setEvening(e.target.checked)}
          />
          Receber fechamento diário
        </label>
        <Button disabled={!ready || busy} type="submit">
          Salvar preferências
        </Button>
      </form>
      <p>
        Status deste aparelho:{" "}
        {notifications?.pushEnabled
          ? "ativado"
          : "não ativado — use Ativar notificações acima"}
        .
      </p>
      <Button
        variant="secondary"
        disabled={!ready || busy || !notifications?.pushEnabled}
        onClick={async () => {
          setBusy(true);
          try {
            const identity = notifications?.identity;
            if (!identity) throw Error("Sessão indisponível");
            const { data, error } = await createClient().functions.invoke(
              "send-booking-push",
              { body: { type: "RAIOX_TEST", barbershop_id: identity.shopId } },
            );
            if (error) throw error;
            setMessage(
              data?.sent
                ? "Teste aceito pelo serviço de push. Confira o aparelho."
                : data?.alreadySent
                  ? "Um teste já foi enviado neste minuto."
                  : "Nenhum aparelho elegível recebeu o teste. Confira a assinatura.",
            );
          } catch {
            setMessage(
              "Não foi possível enviar o teste. Confira o deploy da função de push e a instalação SQL.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Testar notificação
      </Button>
      <p className="text-sm text-text-muted">
        A entrega depende da rotina agendada ativa, conexão e permissões do
        navegador. No iPhone, use o app instalado. Não é necessário manter o
        painel aberto.
      </p>
      {message && <p role="status">{message}</p>}
    </Card>
  );
}
