"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Scissors,
  Plus,
  Clock,
  DollarSign,
  ChevronLeft,
  Check,
  Edit2,
  Trash2,
  UserCheck,
} from "lucide-react";
import { formatCurrency, formatDuration } from "@/lib/utils";

export default function ServicosPage() {
  const [services, setServices] = useState([
    {
      id: "s1",
      name: "Corte Clássico",
      duration_minutes: 40,
      price: 60.0,
      is_active: true,
      barbers: ["Carlos Oliveira", "Lucas Mendes", "Rafael Santos", "Mateus Costa"],
    },
    {
      id: "s2",
      name: "Barba Terapia Completa",
      duration_minutes: 35,
      price: 55.0,
      is_active: true,
      barbers: ["Carlos Oliveira", "Lucas Mendes", "Rafael Santos"],
    },
    {
      id: "s3",
      name: "Combo Cabelo + Barba",
      duration_minutes: 70,
      price: 105.0,
      is_active: true,
      barbers: ["Carlos Oliveira", "Lucas Mendes", "Rafael Santos"],
    },
    {
      id: "s4",
      name: "Acabamento / Pezinho",
      duration_minutes: 20,
      price: 30.0,
      is_active: true,
      barbers: ["Carlos Oliveira", "Lucas Mendes", "Rafael Santos", "Mateus Costa"],
    },
  ]);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <header className="h-16 border-b border-border bg-surface px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-text-muted hover:text-text flex items-center gap-1.5 text-xs font-semibold">
            <ChevronLeft className="w-4 h-4 text-accent" />
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-[1px] bg-border" />
          <h1 className="font-serif text-lg font-bold text-text">Serviços & Profissionais</h1>
        </div>

        <button
          onClick={() => alert("Modal de criação de novo serviço")}
          className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-contrast px-4 py-2 rounded-sm text-xs font-bold transition-all shadow-premium"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Serviço</span>
        </button>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((service) => (
            <div key={service.id} className="bg-surface border border-border p-6 rounded-md shadow-card space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-serif text-lg font-bold text-text">{service.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-accent" />
                      <span>{formatDuration(service.duration_minutes)}</span>
                    </span>
                    <span>•</span>
                    <span className="text-accent font-semibold">{formatCurrency(service.price)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="p-1.5 rounded-sm hover:bg-surface-2 text-text-muted hover:text-text">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Barbeiros que Executam */}
              <div className="pt-3 border-t border-border">
                <span className="text-[11px] uppercase tracking-wider text-text-muted block mb-2 font-medium">
                  Profissionais Habilitados ({service.barbers.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {service.barbers.map((barber) => (
                    <span
                      key={barber}
                      className="inline-flex items-center gap-1 text-[11px] bg-surface-2 border border-border px-2.5 py-1 rounded-sm text-text"
                    >
                      <UserCheck className="w-3 h-3 text-accent" />
                      <span>{barber}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
