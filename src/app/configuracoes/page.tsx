"use client";

import { AdminSkeleton } from "@/components/admin/skeleton";
import { AdminNavigation } from "@/components/admin/navigation";
import { NotificationControls } from "@/components/admin/notification-controls";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Save,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Palette,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { fixMojibake } from "@/lib/utils";
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
  const [brandName, setBrandName] = useState("");
  const [brandTagline, setBrandTagline] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [accentColor, setAccentColor] = useState("#7C3AED");
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

      const { data: member, error: memErr } = await supabase
        .from("shop_members")
        .select("barbershop_id")
        .eq("user_id", user.id)
        .maybeSingle();

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
        setBrandName(fixMojibake(data.brand_name) || "");
        setBrandTagline(fixMojibake(data.brand_tagline) || "");
        setHeroTitle(fixMojibake(data.hero_title) || "");
        setHeroSubtitle(fixMojibake(data.hero_subtitle) || "");
        setAccentColor(data.accent_color || "#7C3AED");
        setDepositPct(String(data.deposit_percentage || 50));
        setCancelHours(String(data.cancellation_notice_hours || 24));
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
      brand_name: brandName,
      brand_tagline: brandTagline,
      hero_title: heroTitle,
      hero_subtitle: heroSubtitle,
      accent_color: accentColor,
      deposit_percentage: parseFloat(depositPct) || 50,
      cancellation_notice_hours: parseInt(cancelHours, 10) || 24,
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
    <div className="admin-page min-h-screen bg-bg text-text flex flex-col lg:flex-row p-4 lg:p-6 gap-6">
      <AdminNavigation />

      <main className="admin-content flex-1 space-y-6 max-w-5xl">
        {/* Header Bar */}
        <header className="bg-surface border border-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-soft">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              Configurações do Sistema
            </h1>
            <p className="text-xs text-text-muted mt-1">
              Personalização da marca, avisos do site, regras de cancelamento e notificações push
            </p>
          </div>
        </header>

        <NotificationControls />

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

            {/* Section 1: Identidade da Marca */}
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-soft space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-hairline">
                <Sparkles className="w-4 h-4 text-accent-light" />
                <h2 className="text-base font-bold text-text">
                  Identidade da Marca & Textos do Site
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Nome da Barbearia
                  </label>
                  <input
                    aria-label="Nome da barbearia"
                    type="text"
                    required
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Slogan / Tagline
                  </label>
                  <input
                    aria-label="Subtítulo da marca"
                    type="text"
                    value={brandTagline}
                    onChange={(e) => setBrandTagline(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Título Principal do Site (Hero)
                  </label>
                  <input
                    aria-label="Título principal do site"
                    type="text"
                    required
                    value={heroTitle}
                    onChange={(e) => setHeroTitle(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Subtítulo / Descrição da Landing Page
                  </label>
                  <textarea
                    aria-label="Descrição principal do site"
                    rows={2}
                    value={heroSubtitle}
                    onChange={(e) => setHeroSubtitle(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Políticas Financeiras & Agendamento */}
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-soft space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-hairline">
                <CreditCard className="w-4 h-4 text-accent-light" />
                <h2 className="text-base font-bold text-text">
                  Políticas Financeiras & Regras de Agendamento
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Sinal Pix Obrigatório (%)
                  </label>
                  <input
                    aria-label="Percentual do sinal"
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
                    min="1"
                    max="72"
                    required
                    value={cancelHours}
                    onChange={(e) => setCancelHours(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Cor de Destaque da Marca
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="Cor de destaque"
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-9 h-9 rounded-xl cursor-pointer bg-transparent border-0 p-0"
                    />
                    <input
                      aria-label="Cor de destaque em hexadecimal"
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="flex-1 bg-bg border border-border rounded-xl px-3 py-2 text-xs text-text focus:border-accent focus:outline-none font-mono"
                    />
                  </div>
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
      </main>
    </div>
  );
}
