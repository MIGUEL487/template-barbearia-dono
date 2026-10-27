"use client";

import {AdminSkeleton} from "@/components/admin/skeleton";
import {AdminNavigation} from "@/components/admin/navigation";
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
  BarChart3,
  Calendar,
  Clock,
  Users,
  DollarSign,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { fixMojibake } from "@/lib/utils";
import { updateSiteSettingsAction, logoutAction } from "@/app/actions/admin-actions";
import { motion } from "framer-motion";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Campos
  const [brandName, setBrandName] = useState("");
  const [brandTagline, setBrandTagline] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [accentColor, setAccentColor] = useState("#F5A524");
  const [depositPct, setDepositPct] = useState("50");
  const [cancelHours, setCancelHours] = useState("24");

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();

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
        setAccentColor(data.accent_color || "#F5A524");
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
      setMessage({ type: "success", text: "Configurações salvas e propagadas para o site do cliente!" });
    } else {
      setMessage({ type: "error", text: res.error || "Erro ao salvar alterações." });
    }
  };

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/agenda", label: "Agenda", icon: Calendar },
    { href: "/equipe", label: "Equipe & Horários", icon: Clock },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/servicos", label: "Serviços", icon: Scissors },
    { href: "/financeiro", label: "Financeiro", icon: DollarSign },
    { href: "/configuracoes", label: "Configurações", icon: Settings, active: true },
  ];

  return (
    <div className="admin-page min-h-screen bg-bg text-text flex flex-col md:flex-row p-4 md:p-6 gap-6">
      <AdminNavigation />

      <main className="admin-content flex-1 space-y-6 max-w-4xl">
        <header className="bg-surface rounded-full px-6 py-4 flex items-center justify-between shadow-soft">
          <h1 className="font-serif text-lg font-bold text-text">Parâmetros da Barbearia</h1>
        </header>

        {isLoading ? (<AdminSkeleton/>
) : (
          <form onSubmit={handleSubmit} className="bg-surface rounded-[32px] p-8 shadow-soft space-y-8">
            {message && (
              <div
                className={`p-4 rounded-[20px] text-xs flex items-center gap-2 ${
                  message.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {message.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}

            <div>
              <h2 className="font-serif text-lg font-bold text-text">Identidade da Marca</h2>
              <p className="text-xs text-text-muted mt-2">
                Altera o nome, slogan e cores exibidos na landing page do cliente em tempo real.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-2 ml-2">
                  Nome da Barbearia
                </label>
                <input aria-label="Nome da barbearia"
                  type="text"
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full bg-surface-2 rounded-full px-6 py-4 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-2 ml-2">
                  Slogan / Tagline
                </label>
                <input aria-label="Subtítulo da marca"
                  type="text"
                  value={brandTagline}
                  onChange={(e) => setBrandTagline(e.target.value)}
                  className="w-full bg-surface-2 rounded-full px-6 py-4 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-2 ml-2">
                  Título Principal (Hero)
                </label>
                <input aria-label="Título principal do site"
                  type="text"
                  required
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  className="w-full bg-surface-2 rounded-full px-6 py-4 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-2 ml-2">
                  Subtítulo (Hero)
                </label>
                <textarea aria-label="Descrição principal do site"
                  rows={2}
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  className="w-full bg-surface-2 rounded-2xl px-6 py-4 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-hairline">
              <h2 className="font-serif text-lg font-bold text-text">Políticas Financeiras</h2>
              <p className="text-xs text-text-muted mt-2">
                Regras aplicadas no checkout de agendamento online.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-2 ml-2">
                  Sinal Pix Obrigatório (%)
                </label>
                <input aria-label="Percentual do sinal"
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={depositPct}
                  onChange={(e) => setDepositPct(e.target.value)}
                  className="w-full bg-surface-2 rounded-full px-6 py-4 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-2 ml-2">
                  Aviso para Cancelar (Horas)
                </label>
                <input aria-label="Antecedência mínima para cancelamento em horas"
                  type="number"
                  min="1"
                  max="72"
                  required
                  value={cancelHours}
                  onChange={(e) => setCancelHours(e.target.value)}
                  className="w-full bg-surface-2 rounded-full px-6 py-4 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-2 ml-2">
                  Cor Destaque (Hex)
                </label>
                <div className="flex items-center gap-2">
                  <input aria-label="Cor de destaque"
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-10 h-10 rounded-full cursor-pointer bg-transparent border-0"
                  />
                  <input aria-label="Cor de destaque em hexadecimal"
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="flex-1 bg-surface-2 rounded-full px-6 py-4 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-6 border-t border-hairline">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-accent hover:bg-accent-hover text-accent-contrast px-8 py-4 rounded-full text-xs font-bold shadow-glow flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
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
