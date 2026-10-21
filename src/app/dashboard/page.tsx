"use client";

import React, { useState, useEffect } from "react";
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

  const loadDashboardData = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();

      // 1. Obter usuário autenticado
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        router.push("/login");
        return;
      }

      // 2. Obter vínculo em shop_members
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

      const shopId = member.barbershop_id;
      setBarbershopId(shopId);
      const bShop = member.barbershops as any;
      if (bShop?.name) setShopName(bShop.name);

      // 3. Obter Transações Financeiras Efetivamente Aprovadas (Receita Real)
      const { data: txData } = await supabase
        .from("financial_transactions")
        .select("amount")
        .eq("barbershop_id", shopId)
        .eq("type", "income");

      const totalReceived = (txData || []).reduce((acc, cur) => acc + Number(cur.amount), 0);
      setRevenueReceived(totalReceived);

      // 4. Obter Agendamentos de Hoje
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: bData, error: bErr } = await supabase
        .from("bookings")
        .select(`
          id, starts_at, status, total_price,
          customers (name, phone),
          barbers (name),
          payments (status, method)
        `)
        .eq("barbershop_id", shopId)
        .gte("starts_at", todayStart.toISOString())
        .lte("starts_at", todayEnd.toISOString())
        .order("starts_at", { ascending: true });

      if (bErr) throw bErr;

      const list = (bData as any as DashboardBooking[]) || [];
      setBookingsToday(list);

      // Calcular pendente apenas para bookings confirmados com pagamento não aprovado
      const pendingSum = list
        .filter((b) => b.status === "confirmed" && b.payments?.some((p) => p.status !== "approved"))
        .reduce((acc, cur) => acc + Number(cur.total_price), 0);

      setRevenuePending(pendingSum);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar dados do dashboard";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleComplete = async (bookingId: string) => {
    if (!barbershopId) return;
    const res = await completeBookingAction(barbershopId, bookingId, true);
    if (!res.success) {
      alert(res.error || "Erro ao concluir");
    } else {
      loadDashboardData();
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!barbershopId) return;
    if (!confirm("Deseja cancelar este agendamento?")) return;
    const res = await cancelBookingAction(barbershopId, bookingId, "Cancelado no painel do dono");
    if (!res.success) {
      alert(res.error || "Erro ao cancelar");
    } else {
      loadDashboardData();
    }
  };

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
  };

  if (noAccess) {
    return (
      <main className="min-h-screen bg-bg text-text flex items-center justify-center p-4">
        <div className="bg-surface border border-danger/40 p-8 rounded-lg max-w-md text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-danger mx-auto" />
          <h2 className="font-serif text-2xl font-bold">Acesso Restrito</h2>
          <p className="text-xs text-text-muted">
            Sua conta está autenticada, mas você não possui autorização em <code>shop_members</code> para gerenciar nenhuma barbearia.
          </p>
          <button
            onClick={handleLogout}
            className="bg-surface-2 hover:bg-surface border border-border px-4 py-2 rounded-sm text-xs font-semibold"
          >
            Sair e trocar de conta
          </button>
        </div>
      </main>
    );
  }

  const completedCount = bookingsToday.filter((b) => b.status === "completed").length;
  const cancelledCount = bookingsToday.filter((b) => b.status === "cancelled").length;

  return (
    <div className="min-h-screen bg-bg text-text flex">
      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-border hidden md:flex flex-col justify-between shrink-0">
        <div>
          <div className="h-16 border-b border-border flex items-center gap-3 px-6">
            <div className="w-8 h-8 rounded-sm bg-surface-2 border border-accent/40 flex items-center justify-center text-accent">
              <Scissors className="w-4 h-4 rotate-45" />
            </div>
            <div>
              <span className="font-serif font-bold text-sm text-text block truncate max-w-[140px]">{shopName}</span>
              <span className="text-[10px] text-text-muted uppercase tracking-wider">Painel do Dono</span>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-sm bg-accent/15 text-accent font-semibold text-sm border border-accent/30"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/agenda"
              className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-text-muted hover:text-text hover:bg-surface-2 text-sm font-medium transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span>Agenda por Barbeiro</span>
            </Link>

            <Link
              href="/clientes"
              className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-text-muted hover:text-text hover:bg-surface-2 text-sm font-medium transition-colors"
            >
              <Users className="w-4 h-4" />
              <span>Clientes (CRM)</span>
            </Link>

            <Link
              href="/servicos"
              className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-text-muted hover:text-text hover:bg-surface-2 text-sm font-medium transition-colors"
            >
              <Scissors className="w-4 h-4" />
              <span>Serviços & Preços</span>
            </Link>

            <Link
              href="/financeiro"
              className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-text-muted hover:text-text hover:bg-surface-2 text-sm font-medium transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              <span>Financeiro</span>
            </Link>

            <Link
              href="/configuracoes"
              className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-text-muted hover:text-text hover:bg-surface-2 text-sm font-medium transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Configurações do Site</span>
            </Link>
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-sm text-text-muted hover:text-danger text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-border bg-surface/50 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
          <h1 className="font-serif text-lg font-bold text-text">Visão Geral do Negócio</h1>

          <div className="flex items-center gap-3">
            <Link
              href="/agenda?novo=true"
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-contrast px-3.5 py-1.5 rounded-sm text-xs font-bold transition-all shadow-premium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agendamento Rápido</span>
            </Link>
          </div>
        </header>

        <main className="p-6 space-y-6 max-w-7xl">
          {errorMsg && (
            <div className="p-3 bg-danger/10 border border-danger/30 text-danger text-xs rounded-sm">
              {errorMsg}
            </div>
          )}

          {/* Cartões de Métricas Reais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface border border-border p-5 rounded-md shadow-card">
              <div className="flex justify-between items-start text-xs text-text-muted mb-2">
                <span>Receita Confirmada</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="font-serif text-2xl font-bold text-emerald-400">
                {formatCurrency(revenueReceived)}
              </div>
              <span className="text-[11px] text-text-muted mt-1 block">Receita real lançada no caixa</span>
            </div>

            <div className="bg-surface border border-border p-5 rounded-md shadow-card">
              <div className="flex justify-between items-start text-xs text-text-muted mb-2">
                <span>Pendente no Balcão</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="font-serif text-2xl font-bold text-amber-400">
                {formatCurrency(revenuePending)}
              </div>
              <span className="text-[11px] text-text-muted mt-1 block">A receber nos atendimentos de hoje</span>
            </div>

            <div className="bg-surface border border-border p-5 rounded-md shadow-card">
              <div className="flex justify-between items-start text-xs text-text-muted mb-2">
                <span>Agendamentos Hoje</span>
                <Calendar className="w-4 h-4 text-accent" />
              </div>
              <div className="font-serif text-2xl font-bold text-text">
                {completedCount} / {bookingsToday.length}
              </div>
              <span className="text-[11px] text-text-muted mt-1 block">
                {completedCount} concluídos • {cancelledCount} cancelados
              </span>
            </div>

            <div className="bg-surface border border-border p-5 rounded-md shadow-card">
              <div className="flex justify-between items-start text-xs text-text-muted mb-2">
                <span>Faturamento Total Projetado</span>
                <TrendingUp className="w-4 h-4 text-sky-400" />
              </div>
              <div className="font-serif text-2xl font-bold text-text">
                {formatCurrency(revenueReceived + revenuePending)}
              </div>
              <span className="text-[11px] text-text-muted mt-1 block">Recebido + Pendente</span>
            </div>
          </div>

          {/* Lista de Agendamentos de Hoje Reais */}
          <div className="bg-surface border border-border rounded-md shadow-card overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-base text-text">Agendamentos de Hoje</h3>
                <p className="text-xs text-text-muted mt-0.5">Sincronizado em tempo real com o banco de dados</p>
              </div>

              <Link
                href="/agenda"
                className="text-xs text-accent hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Ver Grade Completa</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {isLoading ? (
              <div className="p-8 text-center">
                <span className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin inline-block" />
              </div>
            ) : bookingsToday.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                Nenhum agendamento registrado para hoje até o momento.
              </div>
            ) : (
              <div className="divide-y divide-border overflow-x-auto">
                {bookingsToday.map((item) => {
                  const timeStr = new Date(item.starts_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isPaid = item.payments?.some((p) => p.status === "approved");

                  return (
                    <div key={item.id} className="p-4 flex items-center justify-between gap-4 hover:bg-surface-2/40 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 text-center font-mono font-bold text-sm text-accent">
                          {timeStr}
                        </div>

                        <div>
                          <h4 className="font-semibold text-sm text-text">{item.customers?.name || "Cliente"}</h4>
                          <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                            <span>{item.barbers?.name || "Sem profissional"}</span>
                            <span>•</span>
                            <span>{item.customers?.phone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-sm font-bold text-text block">{formatCurrency(item.total_price)}</span>
                          <span className={`text-[10px] font-semibold ${isPaid ? "text-emerald-400" : "text-amber-400"}`}>
                            {isPaid ? "Pago Online" : "Pendente no Balcão"}
                          </span>
                        </div>

                        <div className="w-28 text-center">
                          {item.status === "completed" && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Concluído</span>
                            </span>
                          )}

                          {item.status === "confirmed" && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleComplete(item.id)}
                                className="text-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-sm font-semibold transition-colors"
                              >
                                Concluir
                              </button>
                              <button
                                onClick={() => handleCancel(item.id)}
                                className="text-[10px] bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 px-2 py-1 rounded-sm font-semibold transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}

                          {item.status === "cancelled" && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger bg-danger/10 px-2 py-0.5 rounded-sm border border-danger/20">
                              <XCircle className="w-3 h-3" />
                              <span>Cancelado</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
