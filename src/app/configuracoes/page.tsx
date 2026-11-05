"use client";
import { currentMembership } from "@/lib/browser-shop";

import Link from "next/link";
import { Support } from "@/components/saas2/support";
import { AdminSkeleton } from "@/components/admin/skeleton";
import { ManagementLayout } from "@/components/admin/management-layout";
import { NotificationControls } from "@/components/admin/notification-controls";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Save,
  Check,
  AlertCircle,
  Loader2,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  updateSiteSettingsAction,
  logoutAction,
} from "@/app/actions/admin-actions";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Campos
  const [depositPct, setDepositPct] = useState("50");
  const [cancelHours, setCancelHours] = useState("24");

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        router.push("/login");
        return;
      }

      const { data: member, error: memErr } = await currentMembership(
        supabase,
        user.id,
        "barbershop_id",
      );

      if (memErr || !member) {
        setMessage({ type: "error", text: "Acesso não autorizado." });
        setIsLoading(false);
        return;
      }

      const shopId = (member as any).barbershop_id;
      setBarbershopId(shopId);

      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("barbershop_id", shopId)
        .maybeSingle();

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else if (data) {
        setDepositPct(String(data.deposit_percentage ?? 50));
        setCancelHours(String(data.cancellation_notice_hours ?? 24));
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Erro ao carregar configurações.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbershopId) return;

    setIsSaving(true);
    setMessage(null);

    const res = await updateSiteSettingsAction(barbershopId, {
      deposit_percentage: depositPct.trim() === "" ? NaN : Number(depositPct),
      cancellation_notice_hours:
        cancelHours.trim() === "" ? NaN : Number(cancelHours),
    });

    setIsSaving(false);

    if (res.success) {
      setMessage({
        type: "success",
        text: "Configurações salvas e sincronizadas com sucesso!",
      });
    } else {
      setMessage({
        type: "error",
        text: res.error || "Erro ao salvar alterações.",
      });
    }
  };

  return (
    <ManagementLayout
      title="Configurações"
      subtitle="Operação, agendamentos, pagamentos e notificações."
    >
      <div className="mg-settings-layout">
        <nav className="mg-settings-nav" aria-label="Seções de configurações">
          <a href="#funcionamento">Funcionamento</a>
          <a href="#avisos">Notificações</a>
          <a href="#pagamentos">Agendamentos e pagamentos</a>
          <a href="/suporte">Central de ajuda ↗</a>
        </nav>
        <div className="mg-settings-panels">
          <section
            className="bg-surface border border-border rounded-2xl p-6 space-y-4"
            id="funcionamento"
            aria-label="Funcionamento"
          >
            <h2>Funcionamento</h2>
            <p className="text-sm text-text-muted">
              Expediente, almoço, folgas e bloqueios ficam nas áreas
              operacionais, sem duplicar configurações.
            </p>
            <div className="flex gap-4">
              <Link className="text-accent-light" href="/equipe">
                Configurar expediente →
              </Link>
              <Link className="text-accent-light" href="/agenda">
                Gerenciar agenda →
              </Link>
            </div>
          </section>
          <section id="avisos" aria-label="Notificações">
            <NotificationControls />
          </section>

          {isLoading ? (
            <AdminSkeleton />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {message && (
                <div
                  className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
                    message.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                      : "bg-danger/10 border-danger/25 text-danger"
                  }`}
                >
                  {message.type === "success" ? (
                    <Check className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              <span id="pagamentos" />
              {/* Section 2: Políticas Financeiras & Agendamento */}
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-soft space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-hairline">
                  <CreditCard className="w-4 h-4 text-accent-light" />
                  <h2 className="text-base font-bold text-text">
                    Agendamentos e pagamentos
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5">
                      Sinal Pix Obrigatório (%)
                    </label>
                    <input
                      aria-label="Percentual do sinal"
                      step="0.01"
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={depositPct}
                      onChange={(e) => setDepositPct(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5">
                      Aviso Mínimo Cancelamento (Horas)
                    </label>
                    <input
                      aria-label="Antecedência mínima para cancelamento em horas"
                      type="number"
                      min="0"
                      max="8760"
                      required
                      value={cancelHours}
                      onChange={(e) => setCancelHours(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-accent hover:bg-accent-hover text-white px-6 py-2.5 rounded-xl text-xs font-semibold shadow-glow flex items-center gap-2 disabled:opacity-50 transition-all active:scale-[0.99]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando alterações...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
          {!isLoading && <Support />}
        </div>
      </div>
    </ManagementLayout>
  );
}
