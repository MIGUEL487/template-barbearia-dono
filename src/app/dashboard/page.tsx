"use client";
import { Metric } from "@/components/saas3/shell";
import { readLedger, settled } from "@/lib/saas3/ledger";
import { currentMembership } from "@/lib/browser-shop";

import { AdminSkeleton } from "@/components/admin/skeleton";
import { ManagementLayout } from "@/components/admin/management-layout";
import { AnimatedNumber } from "@/components/admin/animated-number";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { BookingActions } from "@/components/admin/booking-actions";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  BarChart3,
  ChevronRight,
  AlertCircle,
  ArrowUpRight,
  Sparkles,
  Phone,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency, fixMojibake } from "@/lib/utils";
import {
  completeBookingAction,
  cancelBookingAction,
  logoutAction,
} from "@/app/actions/admin-actions";
import { motion } from "motion/react";

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
  const [revenueEntries, setRevenueEntries] = useState<
    { created_at: string; amount: number }[]
  >([]);
  const [revenueReceived, setRevenueReceived] = useState<number>(0);
  const [revenuePending, setRevenuePending] = useState<number>(0);
  const [bookingsToday, setBookingsToday] = useState<DashboardBooking[]>([]);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

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
        "barbershop_id, role, barbershops(name)",
      );

      if (memErr || !member) {
        setNoAccess(true);
        setIsLoading(false);
        return;
      }

      const shopId = (member as any).barbershop_id;
      setBarbershopId(shopId);
      const bShop = (member as any).barbershops;
      if (bShop?.name) setShopName(bShop.name);

      const periodStart = new Date();
      periodStart.setHours(0, 0, 0, 0);
      if (period === "semana") periodStart.setDate(periodStart.getDate() - 6);
      if (period === "mes") periodStart.setDate(1);
      const periodEnd = new Date();
      periodEnd.setHours(23, 59, 59, 999);
      const { entries: periodLedger } = await readLedger(
        supabase,
        shopId,
        periodStart.toISOString(),
        new Date(periodEnd.getTime() + 1).toISOString(),
      );
      const txData = periodLedger.filter(
        (e) => e.type === "income" && settled(e),
      );
      const totalReceived = (txData || []).reduce(
        (acc: number, cur: any) => acc + Number(cur.amount),
        0,
      );
      setRevenueReceived(totalReceived);
      const chartStart = new Date();
      chartStart.setHours(0, 0, 0, 0);
      chartStart.setDate(chartStart.getDate() - 6);
      const { entries: seriesLedger } = await readLedger(
        supabase,
        shopId,
        chartStart.toISOString(),
        new Date(Date.now() + 86400000).toISOString(),
      );
      setRevenueEntries(
        seriesLedger
          .filter((e) => e.type === "income" && settled(e))
          .map((e) => ({ created_at: e.created_at, amount: Number(e.amount) })),
      );

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: bData, error: bErr } = await supabase
        .from("bookings")
        .select(
          `
          id,
          starts_at,
          status,
          total_price,
          customers (name, phone),
          barbers (name),
          payments (status, method)
        `,
        )
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
  }, [router, period]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
  };

  if (noAccess) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-2xl p-8 max-w-md w-full text-center shadow-soft space-y-4">
          <div className="w-16 h-16 rounded-full bg-danger/10 text-danger mx-auto flex items-center justify-center">
            <XCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-text">Acesso Não Autorizado</h1>
          <p className="text-xs text-text-muted">
            Seu usuário autenticado não possui vínculo ativo em{" "}
            <code className="text-accent-light">shop_members</code> nesta
            barbearia.
          </p>
          <button
            onClick={handleLogout}
            className="w-full bg-accent hover:bg-accent-hover text-white py-2.5 rounded-lg text-xs font-semibold shadow-glow transition-colors"
          >
            Fazer Login com Outra Conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <ManagementLayout
      title="Painel"
      subtitle={`${shopName} · Visão operacional da barbearia`}
      actions={
        <>
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* Period selector pill tabs */}
            <div className="bg-surface-2 p-1 rounded-xl flex gap-1 border border-hairline">
              {(["hoje", "semana", "mes"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    period === p
                      ? "bg-accent text-white shadow-sm"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <Link
              href="/agenda"
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-glow transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Agendamento</span>
            </Link>
          </div>
        </>
      }
    >
      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="s3-kpis mg-kpis-three">
        <Metric
          label="Receita recebida"
          value={isLoading || errorMsg ? "—" : formatCurrency(revenueReceived)}
          previous="Caixa efetivado no período"
          tip="Recebimentos registrados no livro-caixa, conforme o período escolhido."
        />
        <Metric
          label="A receber hoje"
          value={isLoading || errorMsg ? "—" : formatCurrency(revenuePending)}
          previous="Agendamentos confirmados"
          tip="Saldo calculado dos atendimentos confirmados de hoje; não é receita já recebida."
        />
        <Metric
          label="Atendimentos de hoje"
          value={isLoading || errorMsg ? "—" : String(bookingsToday.length)}
          previous="Agenda operacional"
          tip="Reservas carregadas para o dia de hoje. Consulte a agenda para ver status e disponibilidade."
        />
      </div>
      <div className="mg-dashboard-overview">
        <RevenueChart entries={revenueEntries} />
        <section className="mg-panel mg-day-summary">
          <p className="mg-overline">Sua operação</p>
          <h2>Hoje na Auto Stilo</h2>
          <strong>{bookingsToday.length}</strong>
          <p>atendimentos na agenda</p>
          <dl>
            <div>
              <dt>Confirmados</dt>
              <dd>
                {bookingsToday.filter((b) => b.status === "confirmed").length}
              </dd>
            </div>
            <div>
              <dt>Pré-reservas</dt>
              <dd>{bookingsToday.filter((b) => b.status === "hold").length}</dd>
            </div>
            <div>
              <dt>Concluídos</dt>
              <dd>
                {bookingsToday.filter((b) => b.status === "completed").length}
              </dd>
            </div>
          </dl>
          <Link href="/agenda">Organizar meu dia ↗</Link>
        </section>
      </div>
      {/* Revenue Chart Component */}

      {/* Today's Bookings Section */}
      <section className="bg-surface border border-border rounded-2xl p-6 shadow-soft space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-hairline">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-text">
              Atendimentos de Hoje
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-2 text-text-muted border border-hairline">
              {bookingsToday.length}{" "}
              {bookingsToday.length === 1 ? "agendamento" : "agendamentos"}
            </span>
          </div>

          <Link
            href="/agenda"
            className="text-xs text-accent-light hover:text-white font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <span>Abrir Agenda Completa</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <AdminSkeleton />
        ) : bookingsToday.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-hairline text-text-muted mx-auto flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <p className="text-xs text-text-muted">
              Nenhum agendamento marcado para o dia de hoje.
            </p>
            <Link
              href="/agenda"
              className="inline-flex items-center gap-1.5 text-xs text-accent-light hover:underline font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar na agenda
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bookingsToday.map((b, idx) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-surface-2 hover:bg-surface-3/60 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all border border-hairline/60 hover:border-hairline"
              >
                {/* Left: Time + Customer Info */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-surface flex flex-col items-center justify-center font-mono text-xs font-bold text-accent-light shrink-0 border border-hairline">
                    <span>
                      {new Date(b.starts_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-semibold text-text text-sm">
                      {fixMojibake(b.customers?.name) || "Cliente"}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-text-muted/70" />
                        {fixMojibake(b.barbers?.name) || "Profissional"}
                      </span>
                      {b.customers?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-text-muted/70" />
                          {b.customers.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Status badge, Price & Actions */}
                <div className="booking-row-status flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-hairline/60">
                  {/* Status Pill Badge */}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      b.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : b.status === "confirmed"
                          ? "bg-accent/15 text-accent-light border border-accent/25"
                          : b.status === "hold"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-danger/10 text-danger border border-danger/20"
                    }`}
                  >
                    {(
                      {
                        confirmed: "Confirmado",
                        completed: "Concluído",
                        hold: "Pré-reserva",
                        cancelled: "Cancelado",
                        no_show: "Faltou",
                        expired: "Expirado",
                      } as Record<string, string>
                    )[b.status] || b.status}
                  </span>

                  <span className="font-bold text-sm text-text min-w-[70px] text-right">
                    {formatCurrency(b.total_price)}
                  </span>

                  {b.status === "confirmed" && barbershopId && (
                    <BookingActions
                      shopId={barbershopId}
                      bookingId={b.id}
                      onUpdated={loadDashboardData}
                    />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </ManagementLayout>
  );
}
