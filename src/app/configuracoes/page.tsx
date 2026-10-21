"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Scissors,
  Settings,
  ChevronLeft,
  Save,
  Check,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { updateSiteSettingsAction } from "@/app/actions/admin-actions";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Campos de Configuração
  const [brandName, setBrandName] = useState("");
  const [brandTagline, setBrandTagline] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [accentColor, setAccentColor] = useState("#F59E0B");
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

      const shopId = member.barbershop_id;
      setBarbershopId(shopId);

      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("barbershop_id", shopId)
        .maybeSingle();

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else if (data) {
        setBrandName(data.brand_name || "");
        setBrandTagline(data.brand_tagline || "");
        setHeroTitle(data.hero_title || "");
        setHeroSubtitle(data.hero_subtitle || "");
        setAccentColor(data.accent_color || "#F59E0B");
        setDepositPct(String(data.deposit_percentage || 50));
        setCancelHours(String(data.cancellation_notice_hours || 24));
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao carregar configurações." });
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
      setMessage({ type: "success", text: "Configurações salvas com sucesso no banco de dados!" });
    } else {
      setMessage({ type: "error", text: res.error || "Erro ao salvar alterações." });
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      <header className="h-16 border-b border-border bg-surface px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-text-muted hover:text-text flex items-center gap-1.5 text-xs font-semibold"
          >
            <ChevronLeft className="w-4 h-4 text-accent" />
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-[1px] bg-border" />
          <h1 className="font-serif text-lg font-bold text-text">Configurações da Barbearia</h1>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
            <p className="text-sm">Carregando parâmetros do estabelecimento...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 bg-surface border border-border p-6 rounded-sm">
            {message && (
              <div
                className={`p-4 rounded-sm text-xs flex items-center gap-2 ${
                  message.type === "success"
                    ? "bg-status-success/15 border border-status-success/30 text-status-success"
                    : "bg-status-danger/15 border border-status-danger/30 text-status-danger"
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

            <div className="border-b border-border pb-4">
              <h2 className="font-serif text-base font-bold text-text">Identidade da Marca</h2>
              <p className="text-xs text-text-muted">
                Esses dados alimentam diretamente a landing page do cliente via views públicas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Nome da Barbearia
                </label>
                <input
                  type="text"
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Slogan / Tagline
                </label>
                <input
                  type="text"
                  value={brandTagline}
                  onChange={(e) => setBrandTagline(e.target.value)}
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Título Principal (Hero)
                </label>
                <input
                  type="text"
                  required
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Subtítulo (Hero)
                </label>
                <textarea
                  rows={2}
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="border-b border-border pb-4 pt-2">
              <h2 className="font-serif text-base font-bold text-text">Regras de Agendamento & Pagamento</h2>
              <p className="text-xs text-text-muted">
                Políticas financeiras aplicadas no checkout e cálculo de retenção.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Sinal Pix Obrigatório (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={depositPct}
                  onChange={(e) => setDepositPct(e.target.value)}
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Aviso para Cancelar (Horas)
                </label>
                <input
                  type="number"
                  min="1"
                  max="72"
                  required
                  value={cancelHours}
                  onChange={(e) => setCancelHours(e.target.value)}
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Cor Destaque (Hex)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="flex-1 bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-border">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-accent hover:bg-accent-hover text-accent-contrast px-6 py-2.5 text-xs font-bold rounded-sm shadow-premium flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Configurações</span>
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
