"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Scissors,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  ChevronRight,
  AlertCircle,
  Layers,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { completeBookingAction, cancelBookingAction, logoutAction } from "@/app/actions/admin-actions";

interface DashboardBooking {
  id: string;
  starts_at: string;
  status: string;
  total_price: number;
  customers: { name: string; phone: string } | null;
  barbers: { name: string } | null;
  payments: { status: string; method: string }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<"hoje" | "semana" | "mes">("hoje");
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>("Barbearia");
  const [isLoading, setIsLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Métricas Reais
  const [revenueReceived, setRevenueReceived] = useState<number>(0);
  const [revenuePending, setRevenuePending] = useState<number>(0);
  const [bookingsToday, setBookingsToday] = useState<DashboardBooking[]>([]);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();

      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        router.push("/login");
        return;
      }

      const { data: member, error: memErr } = await supabase
        .from("shop_members")
        .select("barbershop_id, role, barbershops(name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memErr || !member) {
        setNoAccess(true);
        setIsLoading(false);
        return;
      }

      const shopId = (member as any).barbershop_id;
      setBarbershopId(shopId);
      const bShop = (member as any).barbershops;
      if (bShop?.name) setShopName(bShop.name);

      const { data: txData } = await supabase
        .from("financial_transactions")
        .select("amount")
        .eq("barbershop_id", shopId)
        .eq("type", "income");

      const totalReceived = (txData || []).reduce((acc: number, cur: any) => acc + Number(cur.amount), 0);
      setRevenueReceived(totalReceived);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: bData, error: bErr } = await supabase
        .from("bookings")
        .select(`
          id,
          starts_at,
          status,
          total_price,
          customers (name, phone),
          barbers (name),
          payments (status, method)
        `)
        .eq("barbershop_id", shopId)
        .gte("starts_at", todayStart.toISOString())
        .lte("starts_at", todayEnd.toISOString())
        .order("starts_at", { ascending: true });

      if (bErr) {
        setErrorMsg(bErr.message);
      } else if (bData) {
        const mapped: DashboardBooking[] = bData.map((b: any) => ({
          id: b.id,
          starts_at: b.starts_at,
          status: b.status,
          total_price: Number(b.total_price),
          customers: b.customers,
          barbers: b.barbers,
          payments: (b.payments || []).map((p: any) => ({
            status: p.status,
            method: p.method,
          })),
        }));
        setBookingsToday(mapped);

        const pending = mapped
          .filter((b) => b.status === "confirmed" || b.status === "hold")
          .reduce((acc, cur) => acc + cur.total_price, 0);
        setRevenuePending(pending);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao carregar dados do dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleCompleteBooking = async (bookingId: string) => {
    if (!barbershopId) return;
    const res = await completeBookingAction(barbershopId, bookingId, true);
    if (res.success) {
      loadDashboardData();
    } else {
      alert(res.error || "Erro ao concluir atendimento");
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!barbershopId) return;
    const res = await cancelBookingAction(barbershopId, bookingId, "Cancelado no dashboard");
    if (res.success) {
      loadDashboardData();
    } else {
      alert(res.error || "Erro ao cancelar agendamento");
    }
  };

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
  };

  if (noAccess) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center p-4">
        <div className="bg-surface rounded-[32px] p-10 max-w-md w-full text-center shadow-soft space-y-4">
          <div className="w-16 h-16 rounded-full bg-danger/10 text-danger mx-auto flex items-center justify-center">
            <XCircle className="w-8 h-8" />
          </div>
          <h1 className="font-serif text-2xl font-bold">Acesso Não Autorizado</h1>
          <p className="text-xs text-text-muted">
            Seu usuário autenticado não possui vínculo ativo em <code>shop_members</code> nesta barbearia.
          </p>
          <button
            onClick={handleLogout}
            className="bg-accent text-accent-contrast px-6 py-2.5 rounded-full text-xs font-bold shadow-glow"
          >
            Fazer Login com Outra Conta
          </button>
        </div>
      </div>
    );
  }

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3, active: true },
    { href: "/agenda", label: "Agenda", icon: Calendar },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/servicos", label: "Serviços", icon: Scissors },
    { href: "/equipe", label: "Equipe & Horários", icon: Clock },
    { href: "/financeiro", label: "Financeiro", icon: DollarSign },
    { href: "/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col md:flex-row p-4 md:p-6 gap-6">
      {/* Menu Lateral Arredondado (Trilho / Dock) */}
      <aside className="w-full md:w-64 bg-surface rounded-[32px] p-6 shadow-soft flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          {/* Marca */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center">
              <Scissors className="w-4 h-4 rotate-45" />
            </div>
            <div>
              <h2 className="font-serif text-base font-bold text-text truncate max-w-[140px]">{shopName}</h2>
              <span className="text-[10px] text-accent uppercase tracking-wider font-bold">Gestão</span>
            </div>
          </div>

          {/* Links do Menu */}
          <nav className="space-y-1.5">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-full text-xs font-bold transition-all ${
                  item.active
                    ? "bg-accent-soft text-accent shadow-sm"
                    : "text-text-muted hover:text-text hover:bg-surface-2"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Rodapé do Menu */}
        <div className="pt-6 border-t border-hairline px-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-text-muted hover:text-danger px-3 py-2 rounded-full text-xs font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 space-y-6">
        {/* Barra Superior */}
        <header className="bg-surface rounded-full px-6 py-3 flex items-center justify-between shadow-soft">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-lg font-bold text-text">Visão Geral</h1>
            <span className="text-xs text-text-muted hidden sm:inline">· Métricas em tempo real</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de Período em Pílula */}
            <div className="bg-surface-2 p-1 rounded-full flex gap-1 text-xs">
              {(["hoje", "semana", "mes"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 rounded-full capitalize font-semibold transition-all ${
                    period === p ? "bg-accent text-accent-contrast shadow-sm" : "text-text-muted hover:text-text"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <Link
              href="/agenda"
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-contrast px-5 py-2 rounded-full text-xs font-bold shadow-glow transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Agendamento</span>
            </Link>
          </div>
        </header>

        {errorMsg && (
          <div className="p-4 rounded-[20px] bg-danger/10 text-danger text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Superfícies Tonais de Métricas (Sem bordas de 1px) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-surface rounded-[28px] p-6 shadow-soft space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Receita Liquidada</span>
              <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </span>
            </div>
            <div className="font-serif text-3xl font-bold text-emerald-400">
              {formatCurrency(revenueReceived)}
            </div>
            <p className="text-[11px] text-text-muted">Total de pagamentos concluídos e compensados</p>
          </div>

          <div className="bg-surface rounded-[28px] p-6 shadow-soft space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Aguardando no Balcão</span>
              <span className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="font-serif text-3xl font-bold text-accent">
              {formatCurrency(revenuePending)}
            </div>
            <p className="text-[11px] text-text-muted">Valores a receber de agendamentos de hoje</p>
          </div>

          <div className="bg-surface rounded-[28px] p-6 shadow-soft space-y-2 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Atendimentos Hoje</span>
              <span className="w-8 h-8 rounded-full bg-surface-2 text-text flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </span>
            </div>
            <div className="font-serif text-3xl font-bold text-text">
              {bookingsToday.length}
            </div>
            <p className="text-[11px] text-text-muted">Clientes agendados na grade do dia</p>
          </div>
        </div>

        {/* Linhas Respiradas de Agendamentos de Hoje (Sem caixas de grade) */}
        <div className="bg-surface rounded-[32px] p-8 shadow-soft space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-hairline">
            <h2 className="font-serif text-xl font-bold text-text">Grade de Atendimentos de Hoje</h2>
            <Link href="/agenda" className="text-xs text-accent hover:underline font-semibold flex items-center gap-1">
              <span>Abrir Agenda Completa</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <span className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bookingsToday.length === 0 ? (
            <div className="text-center py-12 text-xs text-text-muted">
              Nenhum agendamento agendado para o dia de hoje.
            </div>
          ) : (
            <div className="space-y-3">
              {bookingsToday.map((b) => (
                <div
                  key={b.id}
                  className="bg-surface-2 hover:bg-surface-3/70 rounded-2xl md:rounded-full px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-surface flex flex-col items-center justify-center font-mono text-xs font-bold text-accent shrink-0">
                      <span>{new Date(b.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-text text-sm">{b.customers?.name || "Cliente"}</h4>
                      <p className="text-xs text-text-muted">
                        Profissional: {b.barbers?.name || "Barbeiro"} · {b.customers?.phone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-hairline">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        b.status === "completed"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : b.status === "confirmed"
                          ? "bg-accent-soft text-accent"
                          : "bg-danger/15 text-danger"
                      }`}
                    >
                      {b.status}
                    </span>

                    <span className="font-serif font-bold text-sm text-text">
                      {formatCurrency(b.total_price)}
                    </span>

                    {b.status === "confirmed" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCompleteBooking(b.id)}
                          className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                        >
                          Concluir
                        </button>
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          className="bg-danger/15 hover:bg-danger/25 text-danger px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
