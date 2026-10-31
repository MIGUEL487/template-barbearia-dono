"use client";

import { useRef, useState } from "react";
import {
  completeBookingAction,
  cancelBookingAction,
  markNoShowAction,
} from "@/app/actions/admin-actions";
import { Check, X, AlertTriangle, MoreVertical, Loader2 } from "lucide-react";

export function BookingActions({
  shopId,
  bookingId,
  onUpdated,
}: {
  shopId: string;
  bookingId: string;
  onUpdated: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");

  async function execute() {
    setBusy(true);
    setError("");
    try {
      const result =
        action === "Concluir"
          ? await completeBookingAction(shopId, bookingId)
          : action === "Cancelar"
            ? await cancelBookingAction(shopId, bookingId, reason)
            : await markNoShowAction(shopId, bookingId);

      if (!result.success) {
        setError(result.error || "Não foi possível atualizar.");
        return;
      }
      await onUpdated();
      dialog.current?.close();
    } catch {
      setError("Não foi possível atualizar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="row-action inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-white bg-surface-2 hover:bg-surface-3 rounded-lg border border-hairline transition-colors"
        onClick={() => dialog.current?.showModal()}
      >
        <MoreVertical className="w-3.5 h-3.5" />
        <span>Gerenciar</span>
      </button>

      <dialog
        ref={dialog}
        className="booking-sheet bg-surface border border-border text-text rounded-2xl p-6 shadow-soft max-w-md w-full"
        aria-labelledby={`booking-title-${bookingId}`}
        onClose={() => {
          setAction("");
          setError("");
        }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-hairline mb-4">
          <h2 id={`booking-title-${bookingId}`} className="text-lg font-bold text-text">
            Gerenciar Atendimento
          </h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors !min-h-0 !w-auto"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-text-muted mb-4">
          Selecione a ação para atualizar o status deste agendamento:
        </p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            type="button"
            aria-pressed={action === "Concluir"}
            onClick={() => setAction("Concluir")}
            className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all !min-h-0 ${
              action === "Concluir"
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                : "bg-surface-2 border-hairline text-text-muted hover:text-text hover:bg-surface-3"
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Concluir</span>
          </button>

          <button
            type="button"
            aria-pressed={action === "Marcar falta"}
            onClick={() => setAction("Marcar falta")}
            className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all !min-h-0 ${
              action === "Marcar falta"
                ? "bg-amber-500/20 border-amber-500 text-amber-400"
                : "bg-surface-2 border-hairline text-text-muted hover:text-text hover:bg-surface-3"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Faltou</span>
          </button>

          <button
            type="button"
            aria-pressed={action === "Cancelar"}
            onClick={() => setAction("Cancelar")}
            className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all !min-h-0 ${
              action === "Cancelar"
                ? "bg-danger/20 border-danger text-danger"
                : "bg-surface-2 border-hairline text-text-muted hover:text-text hover:bg-surface-3"
            }`}
          >
            <X className="w-4 h-4" />
            <span>Cancelar</span>
          </button>
        </div>

        {action === "Cancelar" && (
          <label className="block text-xs font-medium text-text-muted mb-4">
            Motivo do cancelamento (opcional)
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Cliente solicitou reagendamento"
              maxLength={500}
              className="mt-1.5 w-full bg-bg border border-border rounded-lg p-2.5 text-xs text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
            />
          </label>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs mb-4">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-hairline">
          <button
            type="button"
            disabled={!action || busy}
            onClick={execute}
            className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-lg text-xs font-semibold shadow-glow transition-all flex items-center justify-center gap-2 !min-h-0"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{busy ? "Salvando…" : action ? `Confirmar ${action}` : "Escolha uma ação"}</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => dialog.current?.close()}
            className="py-2.5 px-4 rounded-lg text-xs font-semibold bg-surface-2 hover:bg-surface-3 text-text border border-hairline transition-colors !min-h-0"
          >
            Voltar
          </button>
        </div>
      </dialog>
    </>
  );
}
