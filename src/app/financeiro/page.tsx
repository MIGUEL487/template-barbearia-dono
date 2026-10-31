"use client";

import { AdminSkeleton } from "@/components/admin/skeleton";
import { AdminNavigation } from "@/components/admin/navigation";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Download,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  CreditCard,
  QrCode,
  Banknote,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency, fixMojibake } from "@/lib/utils";
import { motion } from "motion/react";

interface PaymentRecord {
  id: string;
  created_at: string;
  customer_name: string;
  amount: number;
  payment_method: string;
  status: "pending" | "approved" | "rejected" | "refunded";
  external_payment_id: string | null;
}

export default function FinanceiroPage() {
  const router = useRouter();
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  const loadFinancialData = useCallback(async () => {
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

      const { data: member, error: memErr } = await supabase
        .from("shop_members")
        .select("barbershop_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memErr || !member) {
        setErrorMsg("Acesso não autorizado.");
        setIsLoading(false);
        return;
      }

      const shopId = (member as any).barbershop_id;

      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          payment_method,
          status,
          external_payment_id,
          created_at,
          bookings (
            customers (name)
          )
        `)
        .eq("barbershop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        const mapped: PaymentRecord[] = data.map((p: any) => ({
          id: p.id,
          created_at: p.created_at,
          customer_name:
            fixMojibake((p.bookings as any)?.customers?.name) ||
            "Cliente Balcão",
          amount: Number(p.amount),
          payment_method: p.payment_method,
          status: p.status,
          external_payment_id: p.external_payment_id,
        }));
        setPayments(mapped);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao carregar dados financeiros.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadFinancialData();
  }, [loadFinancialData]);

  const filtered = payments.filter((p) => {
    const matchesMethod =
      methodFilter === "all" || p.payment_method === methodFilter;
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesMethod && matchesStatus;
  });

  const totalReceived = payments
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = payments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  const exportCSV = () => {
    const headers =
      "ID,Data,Cliente,Valor,Metodo,Status,ReferenciaExterna\n";
    const rows = filtered
      .map(
        (t) =>
          `"${t.id}","${new Date(t.created_at).toLocaleString("pt-BR")}","${t.customer_name}",${t.amount},"${t.payment_method}","${t.status}","${t.external_payment_id || ""}"`,
      )
      .join("\n");

    const blob = new Blob([headers + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `financeiro-autostilo-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="admin-page min-h-screen bg-bg text-text flex flex-col lg:flex-row p-4 lg:p-6 gap-6">
      <AdminNavigation />

      <main className="admin-content flex-1 space-y-6">
        {/* Header Bar */}
        <header className="bg-surface border border-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-soft">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-text">
                Financeiro & Transações
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-2 text-text-muted border border-hairline">
                {payments.length} transações
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Fluxo de caixa, histórico de pagamentos aprovados e pendências de balcão
            </p>
          </div>

          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 bg-surface-2 hover:bg-surface-3 text-text border border-hairline px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Download className="w-4 h-4 text-accent-light" />
            <span>Exportar CSV</span>
          </button>
        </header>

        {/* 2 Main KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface border border-border hover:border-emerald-500/30 rounded-2xl p-6 shadow-soft space-y-3 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Total Aprovado / Liquidado
              </span>
              <span className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </span>
            </div>
            <div className="text-3xl font-bold text-emerald-400">
              {formatCurrency(totalReceived)}
            </div>
            <p className="text-xs text-text-muted pt-1 border-t border-hairline/60">
              Pagamentos confirmados via Pix, Cartão ou Dinheiro
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-surface border border-border hover:border-amber-500/30 rounded-2xl p-6 shadow-soft space-y-3 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Total Pendente / Em Aberto
              </span>
              <span className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="text-3xl font-bold text-amber-400">
              {formatCurrency(totalPending)}
            </div>
            <p className="text-xs text-text-muted pt-1 border-t border-hairline/60">
              Valores aguardando confirmação ou liquidação no balcão
            </p>
          </motion.div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs">
            {errorMsg}
          </div>
        )}

        {/* Transactions Table / List Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-soft space-y-5">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-hairline">
            <h2 className="text-base font-bold text-text">Extrato de Pagamentos</h2>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Method filter */}
              <div className="bg-surface-2 p-1 rounded-xl flex gap-1 border border-hairline text-xs">
                {(["all", "pix", "credit_card", "money"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethodFilter(m)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all !min-h-0 ${
                      methodFilter === m
                        ? "bg-accent text-white shadow-sm"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    {{
                      all: "Todos",
                      pix: "Pix",
                      credit_card: "Cartão",
                      money: "Dinheiro",
                    }[m]}
                  </button>
                ))}
              </div>

              {/* Status filter */}
              <div className="bg-surface-2 p-1 rounded-xl flex gap-1 border border-hairline text-xs">
                {(["all", "approved", "pending"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all !min-h-0 ${
                      statusFilter === s
                        ? "bg-accent text-white shadow-sm"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    {{
                      all: "Status: Todos",
                      approved: "Aprovados",
                      pending: "Pendentes",
                    }[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading ? (
            <AdminSkeleton />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-hairline text-text-muted mx-auto flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <p className="text-xs text-text-muted">
                Nenhuma transação localizada com os filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((t, idx) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="bg-surface-2 hover:bg-surface-3/70 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all border border-hairline/60 hover:border-hairline"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-surface border border-hairline flex items-center justify-center text-text-muted shrink-0">
                      {t.payment_method === "pix" ? (
                        <QrCode className="w-5 h-5 text-emerald-400" />
                      ) : t.payment_method === "credit_card" ? (
                        <CreditCard className="w-5 h-5 text-accent-light" />
                      ) : (
                        <Banknote className="w-5 h-5 text-amber-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-text text-sm">
                        {t.customer_name}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-text-muted mt-1 flex-wrap font-mono">
                        <span>
                          {new Date(t.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {t.external_payment_id && (
                          <span className="text-[11px] text-text-muted/60">
                            Ref: {t.external_payment_id.slice(0, 14)}…
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-hairline/60">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        t.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : t.status === "pending"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-danger/10 text-danger border border-danger/20"
                      }`}
                    >
                      {(
                        {
                          approved: "Aprovado",
                          pending: "Pendente",
                          rejected: "Rejeitado",
                          refunded: "Estornado",
                        } as Record<string, string>
                      )[t.status] || t.status}
                    </span>

                    <span
                      className={`font-bold text-base min-w-[80px] text-right ${
                        t.status === "approved"
                          ? "text-emerald-400"
                          : t.status === "pending"
                            ? "text-amber-400"
                            : "text-danger"
                      }`}
                    >
                      {formatCurrency(t.amount)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
