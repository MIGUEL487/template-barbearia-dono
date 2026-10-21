"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Scissors,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Filter,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const [period, setPeriod] = useState<"hoje" | "semana" | "mes">("hoje");

  // Métricas de Demonstração (Conforme regra: Faturamento != Pendente != Agendado)
  const metrics = {
    revenueReceived: 1420.0, // Apenas pagamentos efetivamente aprovados / recebidos
    revenuePending: 380.0, // Sinal pago ou pagamento pendente no balcão
    totalBookingsToday: 18,
    completedToday: 12,
    cancelledToday: 1,
    noShowToday: 0,
    averageTicket: 78.88,
  };

  const todaysBookings = [
    { id: "b1", time: "09:00", customer: "Guilherme Siqueira", service: "Corte Clássico", barber: "Carlos Oliveira", status: "completed", price: 60, paid: true },
    { id: "b2", time: "09:40", customer: "Rodrigo Mattos", service: "Barba Terapia", barber: "Lucas Mendes", status: "completed", price: 55, paid: true },
    { id: "b3", time: "10:30", customer: "Marcos Vinicius", service: "Combo Cabelo + Barba", barber: "Carlos Oliveira", status: "completed", price: 105, paid: true },
    { id: "b4", time: "14:00", customer: "André Duarte", service: "Corte Clássico", barber: "Rafael Santos", status: "confirmed", price: 60, paid: true },
    { id: "b5", time: "14:45", customer: "Felipe Nogueira", service: "Barba Terapia", barber: "Lucas Mendes", status: "confirmed", price: 55, paid: false },
    { id: "b6", time: "15:30", customer: "Thiago Rocha", service: "Corte Degradê", barber: "Carlos Oliveira", status: "confirmed", price: 65, paid: true },
    { id: "b7", time: "16:15", customer: "Bruno Alcantara", service: "Combo Cabelo + Barba", barber: "Rafael Santos", status: "cancelled", price: 105, paid: false },
  ];

  return (
    <div className="min-h-screen bg-bg text-text flex">
      {/* Sidebar de Navegação */}
      <aside className="w-64 bg-surface border-r border-border hidden md:flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="h-16 border-b border-border flex items-center gap-3 px-6">
            <div className="w-8 h-8 rounded-sm bg-surface-2 border border-accent/40 flex items-center justify-center text-accent">
              <Scissors className="w-4 h-4 rotate-45" />
            </div>
            <div>
              <span className="font-serif font-bold text-sm text-text block">Barbearia Premium</span>
              <span className="text-[10px] text-text-muted uppercase tracking-wider">Painel do Dono</span>
            </div>
          </div>

          {/* Menus */}
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
              href="/automacoes"
              className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-text-muted hover:text-text hover:bg-surface-2 text-sm font-medium transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span>Automações</span>
            </Link>

            <Link
              href="/configuracoes"
              className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-text-muted hover:text-text hover:bg-surface-2 text-sm font-medium transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Configurações</span>
            </Link>
          </nav>
        </div>

        {/* Rodapé do Menu */}
        <div className="p-4 border-t border-border">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-sm text-text-muted hover:text-danger text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do Painel</span>
          </Link>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-surface/50 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
          <h1 className="font-serif text-lg font-bold text-text">Visão Geral do Negócio</h1>

          <div className="flex items-center gap-3">
            {/* Seletor de Período */}
            <div className="bg-surface-2 border border-border rounded-sm p-1 flex items-center text-xs">
              <button
                onClick={() => setPeriod("hoje")}
                className={`px-3 py-1 rounded-sm font-semibold transition-colors ${
                  period === "hoje" ? "bg-accent text-accent-contrast" : "text-text-muted hover:text-text"
                }`}
              >
                Hoje
              </button>
              <button
                onClick={() => setPeriod("semana")}
                className={`px-3 py-1 rounded-sm font-semibold transition-colors ${
                  period === "semana" ? "bg-accent text-accent-contrast" : "text-text-muted hover:text-text"
                }`}
              >
                Esta Semana
              </button>
              <button
                onClick={() => setPeriod("mes")}
                className={`px-3 py-1 rounded-sm font-semibold transition-colors ${
                  period === "mes" ? "bg-accent text-accent-contrast" : "text-text-muted hover:text-text"
                }`}
              >
                Este Mês
              </button>
            </div>

            <Link
              href="/agenda?novo=true"
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-contrast px-3.5 py-1.5 rounded-sm text-xs font-bold transition-all shadow-premium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agendamento Rápido</span>
            </Link>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="p-6 space-y-6 max-w-7xl">
          {/* Cartões de Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface border border-border p-5 rounded-md shadow-card">
              <div className="flex justify-between items-start text-xs text-text-muted mb-2">
                <span>Receita Confirmada</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="font-serif text-2xl font-bold text-emerald-400">
                {formatCurrency(metrics.revenueReceived)}
              </div>
              <span className="text-[11px] text-text-muted mt-1 block">Apenas pagamentos aprovados/recebidos</span>
            </div>

            <div className="bg-surface border border-border p-5 rounded-md shadow-card">
              <div className="flex justify-between items-start text-xs text-text-muted mb-2">
                <span>Pendente / Sinal</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="font-serif text-2xl font-bold text-amber-400">
                {formatCurrency(metrics.revenuePending)}
              </div>
              <span className="text-[11px] text-text-muted mt-1 block">A receber no balcão hoje</span>
            </div>

            <div className="bg-surface border border-border p-5 rounded-md shadow-card">
              <div className="flex justify-between items-start text-xs text-text-muted mb-2">
                <span>Agendamentos Hoje</span>
                <Calendar className="w-4 h-4 text-accent" />
              </div>
              <div className="font-serif text-2xl font-bold text-text">
                {metrics.completedToday} / {metrics.totalBookingsToday}
              </div>
              <span className="text-[11px] text-text-muted mt-1 block">
                {metrics.completedToday} concluídos • {metrics.cancelledToday} cancelados
              </span>
            </div>

            <div className="bg-surface border border-border p-5 rounded-md shadow-card">
              <div className="flex justify-between items-start text-xs text-text-muted mb-2">
                <span>Ticket Médio</span>
                <TrendingUp className="w-4 h-4 text-sky-400" />
              </div>
              <div className="font-serif text-2xl font-bold text-text">
                {formatCurrency(metrics.averageTicket)}
              </div>
              <span className="text-[11px] text-emerald-400 mt-1 block">+12% em relação à semana anterior</span>
            </div>
          </div>

          {/* Lista de Agendamentos de Hoje */}
          <div className="bg-surface border border-border rounded-md shadow-card overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-base text-text">Agendamentos de Hoje</h3>
                <p className="text-xs text-text-muted mt-0.5">Operação em tempo real e controle de comparecimento</p>
              </div>

              <Link
                href="/agenda"
                className="text-xs text-accent hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Ver Grade Completa</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-border overflow-x-auto">
              {todaysBookings.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between gap-4 hover:bg-surface-2/40 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 text-center font-mono font-bold text-sm text-accent">
                      {item.time}
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm text-text">{item.customer}</h4>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span>{item.service}</span>
                        <span>•</span>
                        <span className="text-text-muted/80">{item.barber}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-sm font-bold text-text block">{formatCurrency(item.price)}</span>
                      <span className={`text-[10px] font-semibold ${item.paid ? "text-emerald-400" : "text-amber-400"}`}>
                        {item.paid ? "Pago Online" : "Pendente no Balcão"}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="w-28 text-center">
                      {item.status === "completed" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Concluído</span>
                        </span>
                      )}

                      {item.status === "confirmed" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-sm border border-accent/20">
                          <Clock className="w-3 h-3" />
                          <span>Aguardando</span>
                        </span>
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
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
