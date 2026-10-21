"use client";

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
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

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

      const shopId = member.barbershop_id;

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
          customer_name: (p.bookings as any)?.customers?.name || "Cliente Balcão",
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
    link.setAttribute(
      "download",
      `relatorio-financeiro-${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      {/* Header */}
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
          <h1 className="font-serif text-lg font-bold text-text">Fluxo Financeiro & Recebíveis</h1>
        </div>

        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface border border-border px-3 py-1.5 rounded-sm text-xs font-bold transition-all disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5 text-accent" />
          <span>Exportar Relatório CSV</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {errorMsg && (
          <div className="bg-status-danger/10 border border-status-danger/30 rounded-sm p-4 text-xs text-status-danger">
            {errorMsg}
          </div>
        )}

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface border border-border p-5 rounded-sm">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
              Receita Liquidada (Aprovada)
            </span>
            <div className="font-mono text-2xl font-bold text-status-success">
              {formatCurrency(totalReceived)}
            </div>
            <p className="text-[11px] text-text-muted mt-2">
              Total de pagamentos já compensados e confirmados.
            </p>
          </div>

          <div className="bg-surface border border-border p-5 rounded-sm">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
              Aguardando Liquidação (Pendente)
            </span>
            <div className="font-mono text-2xl font-bold text-accent">
              {formatCurrency(totalPending)}
            </div>
            <p className="text-[11px] text-text-muted mt-2">
              Sinais Pix abertos ou pagamentos a receber no balcão.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-border p-4 rounded-sm">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-text-muted uppercase">Filtrar Método:</span>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="bg-surface-2 border border-border px-3 py-1 text-xs rounded-sm focus:border-accent focus:outline-none"
            >
              <option value="all">Todos os Métodos</option>
              <option value="pix">Pix</option>
              <option value="credit_card">Cartão de Crédito</option>
              <option value="debit_card">Cartão de Débito</option>
              <option value="cash">Dinheiro no Balcão</option>
              <option value="in_person">Balcão Geral</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-text-muted uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-2 border border-border px-3 py-1 text-xs rounded-sm focus:border-accent focus:outline-none"
            >
              <option value="all">Todos os Status</option>
              <option value="approved">Aprovados</option>
              <option value="pending">Pendentes</option>
              <option value="rejected">Rejeitados</option>
              <option value="refunded">Estornados</option>
            </select>
          </div>
        </div>

        {/* Tabela de Transações */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
            <p className="text-sm">Carregando movimentações financeiras...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface border border-border p-12 text-center rounded-sm">
            <p className="text-sm text-text-muted mb-2">Nenhuma transação financeira encontrada.</p>
            <p className="text-xs text-text-muted">
              Pagamentos de agendamentos e sinais aparecerão aqui em tempo real.
            </p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-text-muted uppercase text-[10px] font-bold tracking-wider">
                    <th className="p-4">Data/Hora</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Método</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((tx) => (
                    <tr key={tx.id} className="hover:bg-surface-2/50 transition-colors">
                      <td className="p-4 font-mono text-text-muted">
                        {new Date(tx.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-4 font-bold text-text">{tx.customer_name}</td>
                      <td className="p-4 uppercase text-[11px] font-bold text-text-muted">
                        {tx.payment_method}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            tx.status === "approved"
                              ? "bg-status-success/15 text-status-success"
                              : tx.status === "pending"
                              ? "bg-accent/15 text-accent"
                              : "bg-status-danger/15 text-status-danger"
                          }`}
                        >
                          {tx.status === "approved"
                            ? "Aprovado"
                            : tx.status === "pending"
                            ? "Pendente"
                            : tx.status}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-text text-sm">
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
