"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Scissors,
  Calendar,
  Clock,
  User,
  Plus,
  Filter,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface BarberColumn {
  id: string;
  name: string;
  avatar_url?: string;
}

interface Slot {
  id: string;
  barberId: string;
  time: string;
  customer?: string;
  service?: string;
  status: "free" | "confirmed" | "completed" | "blocked";
  price?: number;
}

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState<string>("Hoje, 21 de Outubro");
  const [showQuickModal, setShowQuickModal] = useState<boolean>(false);

  // Formulário do Agendamento Rápido
  const [modalCustomer, setModalCustomer] = useState<string>("");
  const [modalPhone, setModalPhone] = useState<string>("");
  const [modalService, setModalService] = useState<string>("Corte Clássico");
  const [modalBarber, setModalBarber] = useState<string>("Carlos Oliveira");
  const [modalTime, setModalTime] = useState<string>("15:00");

  const barbers: BarberColumn[] = [
    { id: "b1", name: "Carlos Oliveira" },
    { id: "b2", name: "Lucas Mendes" },
    { id: "b3", name: "Rafael Santos" },
    { id: "b4", name: "Mateus Costa" },
  ];

  const timeSlots = [
    "09:00", "09:40", "10:30", "11:15", "12:00",
    "13:30", "14:15", "15:00", "15:45", "16:30", "17:15", "18:00"
  ];

  // Simulação de agendamentos distribuídos na grade
  const scheduleData: Record<string, Slot> = {
    "b1-09:00": { id: "s1", barberId: "b1", time: "09:00", customer: "Guilherme S.", service: "Corte Clássico", status: "completed", price: 60 },
    "b1-10:30": { id: "s2", barberId: "b1", time: "10:30", customer: "Marcos V.", service: "Combo Completo", status: "completed", price: 105 },
    "b1-15:00": { id: "s3", barberId: "b1", time: "15:00", customer: "Thiago R.", service: "Degradê Navalhado", status: "confirmed", price: 65 },
    "b2-09:40": { id: "s4", barberId: "b2", time: "09:40", customer: "Rodrigo M.", service: "Barba Terapia", status: "completed", price: 55 },
    "b2-14:15": { id: "s5", barberId: "b2", time: "14:15", customer: "Felipe N.", service: "Barba Alinhada", status: "confirmed", price: 55 },
    "b3-12:00": { id: "s6", barberId: "b3", time: "12:00", status: "blocked", service: "Horário de Almoço" },
    "b4-16:30": { id: "s7", barberId: "b4", time: "16:30", customer: "Leonardo F.", service: "Corte + Barba", status: "confirmed", price: 105 },
  };

  const handleCreateQuickBooking = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Agendamento Rápido criado com sucesso para ${modalCustomer} com ${modalBarber}!`);
    setShowQuickModal(false);
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      {/* Header da Agenda */}
      <header className="h-16 border-b border-border bg-surface px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-text-muted hover:text-text flex items-center gap-1.5 text-xs font-semibold">
            <ChevronLeft className="w-4 h-4 text-accent" />
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-[1px] bg-border" />
          <h1 className="font-serif text-lg font-bold text-text">Grade de Agenda por Barbeiro</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-2 border border-border px-3 py-1.5 rounded-sm text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5 text-accent" />
            <span>{selectedDate}</span>
          </div>

          <button
            onClick={() => setShowQuickModal(true)}
            className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-contrast px-4 py-2 rounded-sm text-xs font-bold transition-all shadow-premium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agendamento Rápido</span>
          </button>
        </div>
      </header>

      {/* Grade de 4 Colunas */}
      <main className="flex-1 p-6 overflow-x-auto">
        <div className="min-w-[900px] bg-surface border border-border rounded-md shadow-card overflow-hidden">
          {/* Header dos Barbeiros */}
          <div className="grid grid-cols-5 border-b border-border bg-surface-2 text-center text-xs font-bold">
            <div className="p-3 border-r border-border text-text-muted uppercase tracking-wider flex items-center justify-center">
              Horário
            </div>
            {barbers.map((barber) => (
              <div key={barber.id} className="p-3 border-r border-border last:border-r-0 flex items-center justify-center gap-2">
                <div className="w-6 h-6 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center text-accent text-[10px]">
                  <User className="w-3 h-3" />
                </div>
                <span className="font-serif text-text text-sm">{barber.name}</span>
              </div>
            ))}
          </div>

          {/* Linhas de Horário */}
          <div className="divide-y divide-border">
            {timeSlots.map((time) => (
              <div key={time} className="grid grid-cols-5 text-xs">
                {/* Coluna de Horário */}
                <div className="p-3 border-r border-border bg-surface-2/40 font-mono font-bold text-accent flex items-center justify-center">
                  {time}
                </div>

                {/* Slots para cada Barbeiro */}
                {barbers.map((barber) => {
                  const key = `${barber.id}-${time}`;
                  const slot = scheduleData[key];

                  if (!slot || slot.status === "free") {
                    return (
                      <div
                        key={barber.id}
                        onClick={() => {
                          setModalBarber(barber.name);
                          setModalTime(time);
                          setShowQuickModal(true);
                        }}
                        className="p-3 border-r border-border last:border-r-0 hover:bg-accent/5 cursor-pointer transition-colors flex items-center justify-center text-text-muted/40 hover:text-accent"
                      >
                        <span className="text-[11px] font-medium">+ Disponível</span>
                      </div>
                    );
                  }

                  if (slot.status === "completed") {
                    return (
                      <div key={barber.id} className="p-2.5 border-r border-border last:border-r-0 bg-emerald-500/10 border-l-2 border-l-emerald-500">
                        <strong className="text-emerald-400 font-semibold block truncate">{slot.customer}</strong>
                        <span className="text-[10px] text-text-muted block truncate">{slot.service}</span>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-400/80">Concluído</span>
                      </div>
                    );
                  }

                  if (slot.status === "confirmed") {
                    return (
                      <div key={barber.id} className="p-2.5 border-r border-border last:border-r-0 bg-accent/10 border-l-2 border-l-accent">
                        <strong className="text-accent font-semibold block truncate">{slot.customer}</strong>
                        <span className="text-[10px] text-text-muted block truncate">{slot.service}</span>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-accent/80">Confirmado</span>
                      </div>
                    );
                  }

                  if (slot.status === "blocked") {
                    return (
                      <div key={barber.id} className="p-2.5 border-r border-border last:border-r-0 bg-surface-2 text-text-muted/60 italic flex items-center justify-center">
                        <span>{slot.service}</span>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Modal Agendamento Rápido */}
      {showQuickModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface border border-accent/40 rounded-lg p-6 shadow-premium relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowQuickModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-serif text-xl font-bold text-text mb-1">Agendamento Rápido</h3>
            <p className="text-xs text-text-muted mb-5">Cadastro manual para clientes de balcão ou telefone.</p>

            <form onSubmit={handleCreateQuickBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  placeholder="Nome do cliente"
                  value={modalCustomer}
                  onChange={(e) => setModalCustomer(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-sm px-3.5 py-2 text-sm text-text outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Telefone / WhatsApp *
                </label>
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={modalPhone}
                  onChange={(e) => setModalPhone(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-sm px-3.5 py-2 text-sm text-text outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Barbeiro
                  </label>
                  <select
                    value={modalBarber}
                    onChange={(e) => setModalBarber(e.target.value)}
                    className="w-full bg-surface-2 border border-border focus:border-accent rounded-sm px-3 py-2 text-xs text-text outline-none"
                  >
                    {barbers.map((b) => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Horário
                  </label>
                  <input
                    type="time"
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full bg-surface-2 border border-border focus:border-accent rounded-sm px-3 py-2 text-xs text-text outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Serviço
                </label>
                <select
                  value={modalService}
                  onChange={(e) => setModalService(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-sm px-3 py-2 text-xs text-text outline-none"
                >
                  <option value="Corte Clássico">Corte Clássico — R$ 60,00 (40 min)</option>
                  <option value="Barba Terapia">Barba Terapia — R$ 55,00 (35 min)</option>
                  <option value="Combo Cabelo + Barba">Combo Cabelo + Barba — R$ 105,00 (70 min)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowQuickModal(false)}
                  className="px-4 py-2 rounded-sm border border-border text-xs font-semibold hover:bg-surface-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-accent hover:bg-accent-hover text-accent-contrast px-5 py-2 rounded-sm text-xs font-bold shadow-premium"
                >
                  Salvar Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
