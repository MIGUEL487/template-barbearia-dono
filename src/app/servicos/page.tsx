"use client";
import { Metric } from "@/components/saas3/shell";
import { Button } from "@/components/ui/button";
import { DialogPanel } from "@/components/ui/dialog-panel";
import { currentMembership } from "@/lib/browser-shop";

import { AdminSkeleton } from "@/components/admin/skeleton";
import { ManagementLayout } from "@/components/admin/management-layout";
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

      const { data: member, error: memErr } = await currentMembership(
        supabase,
        user.id,
        "barbershop_id",
      );

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
    <ManagementLayout
      title="Serviços"
      subtitle="Seu catálogo, preços e tempo de cada atendimento."
      actions={
        <>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-glow transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Serviço</span>
          </button>
        </>
      }
    >
      <div className="s3-kpis mg-kpis-three">
        <Metric
          label="Serviços cadastrados"
          value={isLoading || errorMsg ? "—" : String(services.length)}
          tip="Procedimentos existentes no catálogo desta barbearia."
        />
        <Metric
          label="Ativos no site"
          value={isLoading || errorMsg ? "—" : String(activeCount)}
          tip="Serviços ativos que podem aparecer no agendamento público."
        />
        <Metric
          label="Categorias"
          value={isLoading || errorMsg ? "—" : String(categoriesCount)}
          tip="Categorias distintas do catálogo atual."
        />
      </div>
      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2"
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Services List Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <h2 className="text-base font-bold text-text">Todos os Serviços</h2>
          <span className="text-xs text-text-muted">
            Clique em Ativar/Desativar para controlar visibilidade
          </span>
        </div>

        {isLoading ? (
          <AdminSkeleton />
        ) : services.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-hairline text-text-muted mx-auto flex items-center justify-center">
              <Scissors className="w-6 h-6" />
            </div>
            <p className="text-xs text-text-muted">
              Nenhum serviço cadastrado ainda.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 text-xs text-accent-light hover:underline font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar primeiro serviço
            </button>
          </div>
        ) : (
          <div className="s3-table-wrap">
            <table className="mg-data-table">
              <thead>
                <tr>
                  <th>Procedimento</th>
                  <th>Categoria</th>
                  <th>Duração</th>
                  <th>Preço</th>
                  <th>Visibilidade</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <strong>{service.name}</strong>
                      <small className="mg-cell-detail">
                        {service.description || "Sem descrição informada."}
                      </small>
                    </td>
                    <td>
                      <span className="mg-status">{service.category}</span>
                    </td>
                    <td>{formatDuration(service.duration_minutes)}</td>
                    <td>{formatCurrency(service.price)}</td>
                    <td>
                      <Button
                        size="sm"
                        variant={service.is_active ? "outline" : "secondary"}
                        aria-pressed={service.is_active}
                        onClick={() => handleToggleActive(service)}
                      >
                        {service.is_active ? "Ativo no Site" : "Inativo"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Novo Serviço */}
      <AnimatePresence>
        <DialogPanel
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          titleId="service-title"
        >
          <div className="flex items-center justify-between pb-3 border-b border-hairline">
            <h2 id="service-title" className="text-lg font-bold text-text">
              Cadastrar Novo Serviço
            </h2>
            <button
              aria-label="Fechar cadastro"
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
                aria-label="Nome do serviço"
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
                  aria-label="Preço do serviço"
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
                  aria-label="Duração do serviço"
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
                aria-label="Descrição do serviço"
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
                {isSubmitting && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>{isSubmitting ? "Salvando..." : "Salvar Serviço"}</span>
              </button>
            </div>
          </form>
        </DialogPanel>
      </AnimatePresence>
    </ManagementLayout>
  );
}
