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
  BarChart3,
  Calendar,
  Users,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { createServiceAction, toggleServiceActiveAction, logoutAction } from "@/app/actions/admin-actions";

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

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/agenda", label: "Agenda", icon: Calendar },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/servicos", label: "Serviços", icon: Scissors, active: true },
    { href: "/financeiro", label: "Financeiro", icon: DollarSign },
    { href: "/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col md:flex-row p-4 md:p-6 gap-6">
      <aside className="w-full md:w-64 bg-surface rounded-[32px] p-6 shadow-soft flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center">
              <Scissors className="w-4 h-4 rotate-45" />
            </div>
            <div>
              <h2 className="font-serif text-base font-bold text-text truncate max-w-[140px]">Serviços</h2>
              <span className="text-[10px] text-accent uppercase tracking-wider font-bold">Catálogo</span>
            </div>
          </div>

          <nav className="space-y-1.5">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-full text-xs font-bold transition-all ${
                  item.active
                    ? "bg-accent-soft text-accent shadow-sm"
                    : "text-text-muted hover:text-text hover:bg-surface-2"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-hairline px-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-text-muted hover:text-danger px-3 py-2 rounded-full text-xs font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 space-y-6">
        <header className="bg-surface rounded-full px-6 py-3 flex items-center justify-between shadow-soft">
          <h1 className="font-serif text-lg font-bold text-text">Catálogo de Serviços</h1>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-contrast px-5 py-2 rounded-full text-xs font-bold shadow-glow transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Serviço</span>
          </button>
        </header>

        {errorMsg && (
          <div className="p-4 rounded-[20px] bg-danger/10 text-danger text-xs">
            {errorMsg}
          </div>
        )}

        <div className="bg-surface rounded-[32px] p-8 shadow-soft">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-text-muted">
              <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
              <p className="text-sm">Carregando serviços...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12 text-xs text-text-muted">
              Nenhum serviço cadastrado ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  className={`rounded-2xl md:rounded-full px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    service.is_active ? "bg-surface-2 hover:bg-surface-3/70" : "bg-surface-2/40 opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-accent shrink-0">
                      <Scissors className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-bold text-text text-sm">{service.name}</h3>
                        <span className="text-[10px] text-accent uppercase font-bold tracking-wider">
                          · {service.category}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted line-clamp-1 mt-0.5">
                        {service.description || "Sem descrição informada."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-hairline">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Clock className="w-3.5 h-3.5 text-accent" />
                      <span>{formatDuration(service.duration_minutes)}</span>
                    </div>

                    <div className="font-serif font-bold text-base text-accent">
                      {formatCurrency(service.price)}
                    </div>

                    <button
                      onClick={() => handleToggleActive(service)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        service.is_active
                          ? "bg-surface text-text-muted hover:text-danger"
                          : "bg-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      {service.is_active ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal Novo Serviço com Raio Grande */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-[32px] max-w-md w-full p-8 shadow-soft animate-in zoom-in-95 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-hairline">
              <h2 className="font-serif text-xl font-bold text-text">Cadastrar Novo Serviço</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-surface-2 text-text-muted hover:text-text flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="bg-danger/10 rounded-[20px] p-3 text-xs text-danger flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-2">
                  Nome do Serviço
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Corte Degradê + Barba"
                  className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-2">
                  Categoria
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
                >
                  <option value="Cabelo">Cabelo</option>
                  <option value="Barba">Barba</option>
                  <option value="Combo">Combo</option>
                  <option value="Tratamento">Tratamento</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-2">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-2">
                    Duração (minutos)
                  </label>
                  <input
                    type="number"
                    step="5"
                    required
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-2">
                  Descrição
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Produtos utilizados e detalhes do procedimento..."
                  className="w-full bg-surface-2 rounded-2xl px-5 py-3 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-text-muted hover:text-text"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-accent hover:bg-accent-hover text-accent-contrast px-6 py-2.5 rounded-full text-xs font-bold shadow-glow disabled:opacity-50"
                >
                  {isSubmitting ? "Salvando..." : "Salvar Serviço"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
