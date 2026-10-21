"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Scissors,
  Users,
  Search,
  ChevronLeft,
  Calendar,
  DollarSign,
  ShieldCheck,
  Phone,
  Mail,
  UserCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const customers = [
    {
      id: "c1",
      name: "Guilherme Siqueira",
      phone: "(11) 98888-1111",
      email: "guilherme.s@email.com",
      visits: 8,
      totalSpent: 480.0,
      lastVisit: "Hoje, 09:00",
      marketingConsent: true,
      notes: "Prefere navalha quente e corte degradê 0.5 nas laterais.",
    },
    {
      id: "c2",
      name: "Rodrigo Mattos",
      phone: "(11) 97777-2222",
      email: "rodrigo.m@email.com",
      visits: 12,
      totalSpent: 720.0,
      lastVisit: "Hoje, 09:40",
      marketingConsent: true,
      notes: "Barba alinhada com toalha aromática.",
    },
    {
      id: "c3",
      name: "Marcos Vinicius",
      phone: "(11) 96666-3333",
      email: "marcos.v@email.com",
      visits: 3,
      totalSpent: 315.0,
      lastVisit: "Hoje, 10:30",
      marketingConsent: false, // Sem consentimento LGPD -> não entra em campanhas
      notes: "Atendimento somente nos finais de semana.",
    },
    {
      id: "c4",
      name: "André Duarte",
      phone: "(11) 95555-4444",
      email: "andre.d@email.com",
      visits: 5,
      totalSpent: 300.0,
      lastVisit: "18/10/2026",
      marketingConsent: true,
      notes: "Cliente frequente de quarta-feira à tarde.",
    },
  ];

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <header className="h-16 border-b border-border bg-surface px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-text-muted hover:text-text flex items-center gap-1.5 text-xs font-semibold">
            <ChevronLeft className="w-4 h-4 text-accent" />
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-[1px] bg-border" />
          <h1 className="font-serif text-lg font-bold text-text">Gestão de Clientes (CRM)</h1>
        </div>

        <div className="relative w-72">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-2 border border-border focus:border-accent rounded-sm pl-9 pr-4 py-1.5 text-xs text-text outline-none"
          />
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        <div className="bg-surface border border-border rounded-md shadow-card overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-serif font-bold text-base text-text">Base de Clientes Cadastrados</h3>
              <p className="text-xs text-text-muted mt-0.5">Histórico de frequência, total investido e controle de consentimento LGPD.</p>
            </div>
            <span className="text-xs text-accent font-semibold">{filtered.length} clientes encontrados</span>
          </div>

          <div className="divide-y divide-border">
            {filtered.map((customer) => (
              <div key={customer.id} className="p-5 hover:bg-surface-2/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h4 className="font-serif font-bold text-base text-text">{customer.name}</h4>
                    {customer.marketingConsent ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm border border-emerald-500/20 font-semibold">
                        <ShieldCheck className="w-3 h-3" />
                        <span>LGPD Ativo</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-text-muted bg-surface-2 px-2 py-0.5 rounded-sm border border-border">
                        <span>Sem Marketing</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-accent" />
                      <span>{customer.phone}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-accent" />
                      <span>{customer.email}</span>
                    </span>
                  </div>

                  {customer.notes && (
                    <p className="text-xs text-text-muted/80 italic mt-1">Obs: {customer.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-6 text-xs text-right">
                  <div>
                    <span className="text-text-muted block text-[11px]">Total Gasto</span>
                    <strong className="text-sm font-bold text-accent">{formatCurrency(customer.totalSpent)}</strong>
                  </div>

                  <div>
                    <span className="text-text-muted block text-[11px]">Visitas</span>
                    <strong className="text-sm font-bold text-text">{customer.visits} atendimentos</strong>
                  </div>

                  <div>
                    <span className="text-text-muted block text-[11px]">Última Visita</span>
                    <strong className="text-xs font-medium text-text">{customer.lastVisit}</strong>
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
