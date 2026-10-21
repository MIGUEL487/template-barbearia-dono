"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Loader2,
  X,
  ShieldAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { createServiceAction, toggleServiceActiveAction } from "@/app/actions/admin-actions";

interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  category: string;
}

export default function ServicosPage() {
  const router = useRouter();
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal Novo Serviço
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("50");
  const [newDuration, setNewDuration] = useState("30");
  const [newCategory, setNewCategory] = useState("Cabelo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
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
      setBarbershopId(shopId);

      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("barbershop_id", shopId)
        .order("name");

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        setServices(
          data.map((s: any) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            duration_minutes: s.duration_minutes,
            price: Number(s.price),
            is_active: s.is_active,
            category: s.category || "Geral",
          }))
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao carregar serviços.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleToggleActive = async (service: ServiceItem) => {
    if (!barbershopId) return;
    const res = await toggleServiceActiveAction(barbershopId, service.id, service.is_active);
    if (res.success) {
      await loadServices();
    } else {
      alert(res.error || "Erro ao alterar visibilidade");
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbershopId) return;

    setIsSubmitting(true);
    setModalError(null);

    const priceNum = parseFloat(newPrice);
    const durationNum = parseInt(newDuration, 10);

    if (isNaN(priceNum) || priceNum <= 0) {
      setModalError("Informe um preço válido.");
      setIsSubmitting(false);
      return;
    }

    if (isNaN(durationNum) || durationNum <= 0) {
      setModalError("Informe uma duração válida em minutos.");
      setIsSubmitting(false);
      return;
    }

    const res = await createServiceAction(barbershopId, {
      name: newName,
      description: newDesc,
      price: priceNum,
      duration_minutes: durationNum,
      category: newCategory,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setModalError(res.error || "Erro ao cadastrar serviço.");
      return;
    }

    setShowAddModal(false);
    setNewName("");
    setNewDesc("");
    setNewPrice("50");
    setNewDuration("30");
    await loadServices();
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
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
          <h1 className="font-serif text-lg font-bold text-text">Catálogo de Serviços</h1>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-contrast px-4 py-2 rounded-sm text-xs font-bold transition-all shadow-premium"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Serviço</span>
        </button>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {errorMsg && (
          <div className="bg-status-danger/10 border border-status-danger/30 rounded-sm p-4 text-xs text-status-danger mb-6">
            {errorMsg}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
            <p className="text-sm">Carregando catálogo de serviços...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="bg-surface border border-border p-12 text-center rounded-sm">
            <p className="text-sm text-text-muted mb-4">Nenhum serviço cadastrado.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 bg-accent text-accent-contrast px-4 py-2 rounded-sm text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Primeiro Serviço</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                className={`bg-surface border p-5 rounded-sm flex flex-col justify-between transition-all ${
                  service.is_active ? "border-border shadow-sm" : "border-border/40 opacity-60"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="text-[10px] font-bold text-accent uppercase tracking-wider block mb-1">
                        {service.category}
                      </span>
                      <h3 className="font-serif font-bold text-text text-base">{service.name}</h3>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        service.is_active
                          ? "bg-status-success/15 text-status-success"
                          : "bg-surface-2 text-text-muted"
                      }`}
                    >
                      {service.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <p className="text-xs text-text-muted mb-4 line-clamp-2">
                    {service.description || "Sem descrição informada."}
                  </p>
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-text-muted">
                      <Clock className="w-3.5 h-3.5 text-accent" />
                      <span>{formatDuration(service.duration_minutes)}</span>
                    </div>
                    <div className="font-mono font-bold text-sm text-text">
                      {formatCurrency(service.price)}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleActive(service)}
                    className={`text-xs px-2.5 py-1 rounded font-semibold transition-colors ${
                      service.is_active
                        ? "bg-surface-2 text-text-muted hover:text-status-danger"
                        : "bg-status-success/20 text-status-success hover:bg-status-success/30"
                    }`}
                  >
                    {service.is_active ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Novo Serviço */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-sm max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <h2 className="font-serif text-lg font-bold text-text">Cadastrar Novo Serviço</h2>
              <button onClick={() => setShowAddModal(false)} className="text-text-muted hover:text-text p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="bg-status-danger/10 border border-status-danger/30 rounded-sm p-3 mb-4 text-xs text-status-danger flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Nome do Serviço
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Corte Degradê + Barba"
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Categoria
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                >
                  <option value="Cabelo">Cabelo</option>
                  <option value="Barba">Barba</option>
                  <option value="Combo">Combo</option>
                  <option value="Tratamento">Tratamento</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                    Duração (minutos)
                  </label>
                  <input
                    type="number"
                    step="5"
                    required
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Ex: Lavagem com shampoo especial, toalha quente e finalização com pomada."
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-text-muted hover:text-text"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-accent hover:bg-accent-hover text-accent-contrast px-5 py-2 text-xs font-bold rounded-sm shadow-premium flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Serviço</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
