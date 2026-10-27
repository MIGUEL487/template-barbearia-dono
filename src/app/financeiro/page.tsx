"use client";

import {AdminSkeleton} from "@/components/admin/skeleton";
import {AdminNavigation} from "@/components/admin/navigation";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Scissors,
  DollarSign,
  Calendar,
  Download,
  Filter,
  ChevronLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BarChart3,
  Users,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency, fixMojibake } from "@/lib/utils";
import { logoutAction } from "@/app/actions/admin-actions";
import { motion } from "framer-motion";

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
          customer_name: fixMojibake((p.bookings as any)?.customers?.name) || "Cliente Balcão",
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

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
  };

  const filtered = payments.filter((p) => {
    const matchesMethod = methodFilter === "all" || p.payment_method === methodFilter;
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
    const headers = "ID,Data,Cliente,Valor,Metodo,Status,ReferenciaExterna\n";
    const rows = filtered
      .map(
        (t) =>
          `"${t.id}","${new Date(t.created_at).toLocaleString("pt-BR")}","${t.customer_name}",${
            t.amount
          },"${t.payment_method}","${t.status}","${t.external_payment_id || ""}"`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `relatorio-financeiro-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/agenda", label: "Agenda", icon: Calendar },
    { href: "/equipe", label: "Equipe & Horários", icon: Clock },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/servicos", label: "Serviços", icon: Scissors },
    { href: "/financeiro", label: "Financeiro", icon: DollarSign, active: true },
    { href: "/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="admin-page min-h-screen bg-bg text-text flex flex-col md:flex-row p-4 md:p-6 gap-6">
      <AdminNavigation />

      <main className="admin-content flex-1 space-y-6">
        <header className="bg-surface rounded-full px-6 py-3 flex items-center justify-between shadow-soft">
          <h1 className="font-serif text-lg font-bold text-text">Fluxo Financeiro</h1>

          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-text px-5 py-2 rounded-full text-xs font-bold transition-all disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-accent" />
            <span>Exportar CSV</span>
          </button>
        </header>

        {errorMsg && (
          <div className="p-4 rounded-[20px] bg-danger/10 text-danger text-xs">
            {errorMsg}
          </div>
        )}

        {/* Resumo Financeiro em Superfícies Tonais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-surface rounded-[28px] p-6 shadow-soft space-y-2">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">
              Receita Liquidada (Compensada)
            </span>
            <div className="font-serif text-3xl font-bold text-emerald-400">
              {formatCurrency(totalReceived)}
            </div>
            <p className="text-xs text-text-muted">Total de pagamentos já aprovados e recebidos</p>
          </div>

          <div className="bg-surface rounded-[28px] p-6 shadow-soft space-y-2">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">
              Aguardando Liquidação
            </span>
            <div className="font-serif text-3xl font-bold text-accent">
              {formatCurrency(totalPending)}
            </div>
            <p className="text-xs text-text-muted">Sinais Pix abertos ou pagamentos a receber no balcão</p>
          </div>
        </div>

        {/* Filtros em Pílulas */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface rounded-full px-6 py-3 shadow-soft text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-accent" />
            <span className="text-text-muted font-bold uppercase text-xs">Método:</span>
            <select aria-label="Filtrar método de pagamento"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="bg-surface-2 text-text rounded-full px-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">Todos os Métodos</option>
              <option value="pix">Pix</option>
              <option value="credit_card">Cartão de Crédito</option>
              <option value="debit_card">Cartão de Débito</option>
              <option value="cash">Dinheiro no Balcão</option>
              <option value="in_person">Balcão Geral</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-text-muted font-bold uppercase text-xs">Status:</span>
            <select aria-label="Filtrar status de pagamento"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-2 text-text rounded-full px-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">Todos os Status</option>
              <option value="approved">Aprovados</option>
              <option value="pending">Pendentes</option>
              <option value="rejected">Rejeitados</option>
            </select>
          </div>
        </div>

        {/* Tabela em Linhas Respiradas */}
        <div className="bg-surface rounded-[32px] p-8 shadow-soft">
          {isLoading ? (<AdminSkeleton/>
) : filtered.length === 0 ? (
            <div className="text-center py-12 text-xs text-text-muted">
              Nenhuma movimentação financeira encontrada com estes filtros.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-surface-2 hover:bg-surface-3/60 rounded-2xl md:rounded-full px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-accent font-bold text-xs shrink-0">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-text text-sm">{tx.customer_name}</h3>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span className="font-mono text-xs">{new Date(tx.created_at).toLocaleString("pt-BR")}</span>
                        <span>· {tx.payment_method.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-hairline">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        tx.status === "approved"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : tx.status === "pending"
                          ? "bg-accent-soft text-accent"
                          : "bg-danger/15 text-danger"
                      }`}
                    >
                      {tx.status}
                    </span>

                    <strong className="font-serif font-bold text-base text-text">
                      {formatCurrency(tx.amount)}
                    </strong>
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
