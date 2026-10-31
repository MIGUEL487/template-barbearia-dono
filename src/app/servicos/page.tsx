"use client";

import { AdminSkeleton } from "@/components/admin/skeleton";
import { AdminNavigation } from "@/components/admin/navigation";
import { CustomSelect } from "@/components/admin/custom-select";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Scissors,
  Plus,
  Clock,
  DollarSign,
  Check,
  Loader2,
  X,
  ShieldAlert,
  Layers,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency, formatDuration, fixMojibake } from "@/lib/utils";
import {
  createServiceAction,
  toggleServiceActiveAction,
  logoutAction,
} from "@/app/actions/admin-actions";
import { motion, AnimatePresence } from "motion/react";

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
            name: fixMojibake(s.name),
            description: s.description ? fixMojibake(s.description) : null,
            duration_minutes: s.duration_minutes,
            price: Number(s.price),
            is_active: s.is_active,
            category: s.category ? fixMojibake(s.category) : "Geral",
          })),
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
    const res = await toggleServiceActiveAction(
      barbershopId,
      service.id,
      service.is_active,
    );
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

  const activeCount = services.filter((s) => s.is_active).length;
  const categoriesCount = new Set(services.map((s) => s.category)).size;

  return (
    <div className="admin-page min-h-screen bg-bg text-text flex flex-col lg:flex-row p-4 lg:p-6 gap-6">
      <AdminNavigation />

      <main className="admin-content flex-1 space-y-6">
        {/* Header Bar */}
        <header className="bg-surface border border-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-soft">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-text">
                Catálogo de Serviços
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-2 text-text-muted border border-hairline">
                {services.length} serviços
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Cadastre e gerencie os procedimentos, preços e durações oferecidos na barbearia
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-glow transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Serviço</span>
          </button>
        </header>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-xl p-4 shadow-soft">
            <span className="text-xs text-text-muted">Total de Procedimentos</span>
            <div className="text-2xl font-bold text-text mt-1">{services.length}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 shadow-soft">
            <span className="text-xs text-text-muted">Serviços Ativos no Site</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{activeCount}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 shadow-soft">
            <span className="text-xs text-text-muted">Categorias Distintas</span>
            <div className="text-2xl font-bold text-accent-light mt-1">{categoriesCount}</div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Services List Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-hairline">
            <h2 className="text-base font-bold text-text">Todos os Serviços</h2>
            <span className="text-xs text-text-muted">Clique em Ativar/Desativar para controlar visibilidade</span>
          </div>

          {isLoading ? (
            <AdminSkeleton />
          ) : services.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-hairline text-text-muted mx-auto flex items-center justify-center">
                <Scissors className="w-6 h-6" />
              </div>
              <p className="text-xs text-text-muted">Nenhum serviço cadastrado ainda.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 text-xs text-accent-light hover:underline font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar primeiro serviço
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service, idx) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all border ${
                    service.is_active
                      ? "bg-surface-2 hover:bg-surface-3/70 border-hairline/60 hover:border-hairline"
                      : "bg-surface-2/30 border-hairline/30 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-accent-soft text-accent-light border border-accent/20 flex items-center justify-center shrink-0">
                      <Scissors className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-text text-sm">{service.name}</h3>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-surface text-accent-light border border-hairline">
                          {service.category}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted line-clamp-1 mt-1">
                        {service.description || "Sem descrição informada."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-hairline/60">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted font-mono">
                      <Clock className="w-3.5 h-3.5 text-accent-light" />
                      <span>{formatDuration(service.duration_minutes)}</span>
                    </div>

                    <div className="font-bold text-sm text-text min-w-[70px] text-right">
                      {formatCurrency(service.price)}
                    </div>

                    <button
                      onClick={() => handleToggleActive(service)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all !min-h-0 ${
                        service.is_active
                          ? "bg-emerald-500/10 text-emerald-400 hover:bg-danger/10 hover:text-danger border border-emerald-500/25"
                          : "bg-surface text-text-muted hover:text-emerald-400 border border-hairline"
                      }`}
                    >
                      {service.is_active ? "Ativo no Site" : "Inativo"}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal Novo Serviço */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-soft space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-hairline">
                <h2 className="text-lg font-bold text-text">Cadastrar Novo Serviço</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-lg bg-surface-2 text-text-muted hover:text-text flex items-center justify-center transition-colors !min-h-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {modalError && (
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 text-xs text-danger flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleCreateService} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Nome do Serviço
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Corte Degradê + Barboterapia"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <CustomSelect
                    label="Categoria"
                    value={newCategory}
                    onChange={setNewCategory}
                    options={[
                      { value: "Cabelo", label: "Cabelo" },
                      { value: "Barba", label: "Barba" },
                      { value: "Combo", label: "Combo" },
                      { value: "Tratamento", label: "Tratamento" },
                    ]}
                    aria-label="Categoria do serviço"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5">
                      Preço (R$)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      required
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5">
                      Duração (minutos)
                    </label>
                    <input
                      type="number"
                      step="5"
                      required
                      value={newDuration}
                      onChange={(e) => setNewDuration(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Descrição (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Produtos e detalhes inclusos no atendimento..."
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-hairline">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text bg-surface-2 hover:bg-surface-3 transition-colors !min-h-0"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-accent hover:bg-accent-hover text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-glow disabled:opacity-50 transition-all !min-h-0 flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSubmitting ? "Salvando..." : "Salvar Serviço"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
