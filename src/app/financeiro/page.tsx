"use client";

import React, { useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function FinanceiroPage() {
  const [methodFilter, setMethodFilter] = useState<string>("all");

  const transactions = [
    { id: "tx-1", date: "21/10/2026 09:00", customer: "Guilherme Siqueira", service: "Corte Clássico", amount: 60.0, method: "pix", status: "approved" },
    { id: "tx-2", date: "21/10/2026 09:40", customer: "Rodrigo Mattos", service: "Barba Terapia", amount: 55.0, method: "credit_card", status: "approved" },
    { id: "tx-3", date: "21/10/2026 10:30", customer: "Marcos Vinicius", service: "Combo Completo", amount: 105.0, method: "pix", status: "approved" },
    { id: "tx-4", date: "21/10/2026 14:00", customer: "André Duarte", service: "Corte Clássico", amount: 30.0, method: "pix", status: "approved", note: "Sinal de 50%" },
    { id: "tx-5", date: "21/10/2026 14:45", customer: "Felipe Nogueira", service: "Barba Terapia", amount: 55.0, method: "cash", status: "pending", note: "Pagar no Balcão" },
    { id: "tx-6", date: "21/10/2026 15:30", customer: "Thiago Rocha", service: "Corte Degradê", amount: 65.0, method: "credit_card", status: "approved" },
  ];

  const filtered = transactions.filter((t) => methodFilter === "all" || t.method === methodFilter);

  const totalReceived = transactions
    .filter((t) => t.status === "approved")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPending = transactions
    .filter((t) => t.status === "pending")
    .reduce((sum, t) => sum + t.amount, 0);

  const exportCSV = () => {
    const headers = "ID,Data,Cliente,Servico,Valor,Metodo,Status,Observacao\n";
    const rows = filtered
      .map(
        (t) =>
          `"${t.id}","${t.date}","${t.customer}","${t.service}",${t.amount},"${t.method}","${t.status}","${t.note || ""}"`
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

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <header className="h-16 border-b border-border bg-surface px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-text-muted hover:text-text flex items-center gap-1.5 text-xs font-semibold">
            <ChevronLeft className="w-4 h-4 text-accent" />
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-[1px] bg-border" />
          <h1 className="font-serif text-lg font-bold text-text">Livro Caixa & Financeiro</h1>
        </div>

        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 bg-surface hover:bg-surface-2 border border-border px-3.5 py-1.5 rounded-sm text-xs font-semibold text-text transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-accent" />
          <span>Exportar CSV</span>
        </button>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Totais do Caixa */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface border border-border p-5 rounded-md shadow-card">
            <span className="text-xs text-text-muted block mb-1">Total Efetivamente Recebido</span>
            <div className="font-serif text-2xl font-bold text-emerald-400">
              {formatCurrency(totalReceived)}
            </div>
            <span className="text-[11px] text-text-muted mt-1 block">Pagamentos online aprovados + balcão recebido</span>
          </div>

          <div className="bg-surface border border-border p-5 rounded-md shadow-card">
            <span className="text-xs text-text-muted block mb-1">Total Pendente</span>
            <div className="font-serif text-2xl font-bold text-amber-400">
              {formatCurrency(totalPending)}
            </div>
            <span className="text-[11px] text-text-muted mt-1 block">Valores a receber no balcão hoje</span>
          </div>

          <div className="bg-surface border border-border p-5 rounded-md shadow-card">
            <span className="text-xs text-text-muted block mb-1">Faturamento Bruto Projetado</span>
            <div className="font-serif text-2xl font-bold text-text">
              {formatCurrency(totalReceived + totalPending)}
            </div>
            <span className="text-[11px] text-text-muted mt-1 block">Considerando 100% de comparecimento</span>
          </div>
        </div>

        {/* Tabela de Transações */}
        <div className="bg-surface border border-border rounded-md shadow-card overflow-hidden">
          <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif font-bold text-base text-text">Extrato de Lançamentos</h3>
              <p className="text-xs text-text-muted mt-0.5">Auditoria contábil discriminada por forma de pagamento.</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="bg-surface-2 border border-border rounded-sm px-3 py-1.5 text-xs text-text outline-none focus:border-accent"
              >
                <option value="all">Todas as Formas</option>
                <option value="pix">Somente Pix</option>
                <option value="credit_card">Cartão de Crédito</option>
                <option value="cash">Dinheiro / Balcão</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-border overflow-x-auto">
            {filtered.map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between gap-4 hover:bg-surface-2/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-sm bg-surface-2 border border-border flex items-center justify-center text-accent">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-text">{tx.customer}</h4>
                    <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                      <span>{tx.service}</span>
                      <span>•</span>
                      <span>{tx.date}</span>
                      {tx.note && <span className="text-accent italic">• {tx.note}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-right">
                  <div>
                    <span className="font-serif font-bold text-base text-text block">{formatCurrency(tx.amount)}</span>
                    <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                      {tx.method === "pix" ? "Pix Mercado Pago" : tx.method === "credit_card" ? "Cartão Online" : "Presencial"}
                    </span>
                  </div>

                  <div className="w-24 text-center">
                    {tx.status === "approved" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Recebido</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-sm border border-amber-500/20">
                        <Clock className="w-3 h-3" />
                        <span>Pendente</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
