"use client";

import {ManagementDate} from "@/components/admin/management-date";
import { AdminSkeleton } from "@/components/admin/skeleton";
import { AdminNavigation } from "@/components/admin/navigation";
import { BarberPhotoEditor } from "@/components/admin/barber-photo-editor";
import { BarberPhoto } from "@/components/barber-photo";
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Scissors,
  Plus,
  Clock,
  Coffee,
  CheckCircle2,
  Trash2,
  CalendarOff,
  AlertCircle,
  Save,
  Loader2,
  X,
  User,
  ShieldAlert,
} from "lucide-react";
import { useTeamManager } from "./use-team-manager";

const DAYS_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export default function EquipePage() {
  const state = useTeamManager();
  const {
    barbershopId,
    isLoading,
    statusMsg,
    isClosedToday,
    barbers,
    isAddModalOpen,
    setIsAddModalOpen,
    newBarberName,
    setNewBarberName,
    newBarberBio,
    setNewBarberBio,
    newBarberAvatar,
    setNewBarberAvatar,
    isSubmitting,
    selectedBarberId,
    setSelectedBarberId,
    workingHours,
    setWorkingHours,
    isSavingHours,
    allServices,
    barberSelectedServices,
    isSavingServices,
    loadData,
    handleToggleClosedToday,
    handleAddBarber,
    handleToggleBarberActive,
    handleDeleteBarber,
    handleSaveHours,
    handleSaveServices,
    toggleServiceCheckbox,
  } = state;

  return (
    <div className="admin-page min-h-screen bg-bg text-text flex flex-col lg:flex-row p-4 lg:p-6 gap-6">
      <AdminNavigation />

      <main className="admin-content flex-1 space-y-6 max-w-5xl">
        {/* Header Bar */}
        <header className="bg-surface border border-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-soft">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-text">
                Equipe & Expediente
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-2 text-text-muted border border-hairline">
                {barbers.length} profissionais
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Gerencie disponibilidade diária, horários de trabalho, almoço e especialidades
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-glow transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Barbeiro</span>
          </button>
        </header>

        {/* Feedback Alert */}
        {statusMsg && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
              statusMsg.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                : "bg-danger/10 border-danger/25 text-danger"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* 1. SEÇÃO: CONTROLE DE ABERTURA HOJE */}
        <section className="bg-surface border border-border rounded-2xl p-6 shadow-soft space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-hairline">
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-accent-light block mb-1">
                Controle Imediato
              </span>
              <h2 className="text-base font-bold text-text">
                Status de Abertura da Barbearia
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Precisa fechar por imprevisto? Alterne o status para bloquear instantaneamente novos agendamentos no site.
              </p>
            </div>

            <button
              onClick={handleToggleClosedToday}
              className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 active:scale-95 shrink-0 !min-h-0 ${
                isClosedToday
                  ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30"
                  : "bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30"
              }`}
            >
              {isClosedToday ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Reabrir Barbearia Hoje</span>
                </>
              ) : (
                <>
                  <CalendarOff className="w-4 h-4" />
                  <span>Fechar Barbearia Hoje</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-surface-2 border border-hairline rounded-xl p-3.5 flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  isClosedToday ? "bg-danger" : "bg-emerald-400"
                } animate-pulse shrink-0`}
              />
              <div>
                <span className="text-text-muted text-[11px] block">Status de Hoje</span>
                <strong
                  className={`text-xs font-semibold ${
                    isClosedToday ? "text-danger" : "text-emerald-400"
                  }`}
                >
                  {isClosedToday
                    ? "Fechada para agendamentos hoje"
                    : "Aberta normalmente hoje"}
                </strong>
              </div>
            </div>

            <div className="bg-surface-2 border border-hairline rounded-xl p-3.5 flex items-center gap-3">
              <Clock className="w-4 h-4 text-accent-light shrink-0" />
              <div>
                <span className="text-text-muted text-[11px] block">Data Atual</span>
                <strong className="text-text font-mono text-xs">
                  <ManagementDate/>
                </strong>
              </div>
            </div>
          </div>
        </section>

        {/* 2. SEÇÃO: BARBEIROS (EQUIPE) */}
        <section className="bg-surface border border-border rounded-2xl p-6 shadow-soft space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-hairline">
            <div>
              <h2 className="text-base font-bold text-text">
                Profissionais Cadastrados
              </h2>
              <span className="text-xs text-text-muted">
                Selecione um profissional para configurar horários de expediente e especialidades
              </span>
            </div>
            <span className="text-xs text-text-muted font-mono">
              {barbers.length} barbeiros
            </span>
          </div>

          {isLoading ? (
            <AdminSkeleton />
          ) : barbers.length === 0 ? (
            <div className="bg-surface-2 border border-hairline p-8 rounded-xl text-center text-xs text-text-muted">
              Nenhum barbeiro cadastrado. Clique no botão &quot;Adicionar Barbeiro&quot; acima para cadastrar seu time.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {barbers.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBarberId(b.id)}
                  className={`p-5 rounded-xl cursor-pointer transition-all border ${
                    selectedBarberId === b.id
                      ? "ring-2 ring-accent border-accent bg-surface-2 shadow-sm"
                      : "bg-surface-2/60 border-hairline/60 hover:border-hairline hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center gap-3.5 mb-3">
                    <BarberPhoto
                      url={b.avatar_url}
                      name={b.name}
                      className="barber-photo-compact shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-text truncate">
                        {b.name}
                      </h3>
                      <p className="text-xs text-text-muted truncate">
                        {b.bio || "Especialista em Cortes"}
                      </p>
                    </div>
                  </div>

                  {barbershopId && (
                    <BarberPhotoEditor
                      shopId={barbershopId}
                      barber={b}
                      onSaved={loadData}
                    />
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-hairline/60 text-xs mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleBarberActive(b);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors !min-h-0 ${
                        b.is_active
                          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/25"
                          : "bg-surface text-text-muted hover:text-text border border-hairline"
                      }`}
                    >
                      {b.is_active ? "Ativo" : "Pausado"}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBarber(b);
                      }}
                      className="text-text-muted hover:text-danger p-1.5 rounded-lg hover:bg-danger/10 transition-colors !min-h-0"
                      title="Excluir Barbeiro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. SEÇÃO: EXPEDIENTE, HORÁRIOS & ALMOÇO DO BARBEIRO SELECIONADO */}
        {selectedBarberId && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface border border-border rounded-2xl p-6 shadow-soft space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-hairline">
              <div>
                <span className="text-[11px] uppercase font-bold tracking-wider text-accent-light block mb-1">
                  Grade Semanal
                </span>
                <h2 className="text-base font-bold text-text">
                  Expediente de {barbers.find((b) => b.id === selectedBarberId)?.name}
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  Configure entrada, saída, intervalo de almoço e dias de folga
                </p>
              </div>

              <button
                onClick={handleSaveHours}
                disabled={isSavingHours}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-glow transition-all disabled:opacity-50 !min-h-0 shrink-0"
              >
                {isSavingHours ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSavingHours ? "Salvando..." : "Salvar Horários"}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {workingHours.map((wh, idx) => (
                <div
                  key={wh.day_of_week}
                  className="bg-surface-2 px-4 py-3 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs border border-hairline/60"
                >
                  <div className="w-36 font-semibold text-text flex items-center gap-2">
                    <span>{DAYS_NAMES[wh.day_of_week]}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wh.is_off}
                        onChange={(e) => {
                          const updated = [...workingHours];
                          updated[idx].is_off = e.target.checked;
                          setWorkingHours(updated);
                        }}
                        className="rounded accent-accent"
                      />
                      <span
                        className={
                          wh.is_off ? "text-danger font-semibold" : "text-text-muted"
                        }
                      >
                        {wh.is_off ? "Dia de Folga" : "Trabalha"}
                      </span>
                    </label>

                    {!wh.is_off && (
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-text-muted text-[11px]">Entrada:</span>
                          <input
                            aria-label={`${DAYS_NAMES[wh.day_of_week]} — Entrada`}
                            type="time"
                            value={wh.start_time}
                            onChange={(e) => {
                              const updated = [...workingHours];
                              updated[idx].start_time = e.target.value;
                              setWorkingHours(updated);
                            }}
                            className="bg-bg rounded-lg px-2.5 py-1 text-xs text-text border border-border focus:border-accent focus:outline-none !min-h-0"
                          />
                          <span className="text-text-muted text-[11px]">Saída:</span>
                          <input
                            aria-label={`${DAYS_NAMES[wh.day_of_week]} — Saída`}
                            type="time"
                            value={wh.end_time}
                            onChange={(e) => {
                              const updated = [...workingHours];
                              updated[idx].end_time = e.target.value;
                              setWorkingHours(updated);
                            }}
                            className="bg-bg rounded-lg px-2.5 py-1 text-xs text-text border border-border focus:border-accent focus:outline-none !min-h-0"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 pl-3 border-l border-hairline">
                          <Coffee className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-text-muted text-[11px]">Almoço:</span>
                          <input
                            aria-label={`${DAYS_NAMES[wh.day_of_week]} — Início do almoço`}
                            type="time"
                            value={wh.lunch_start || "12:00"}
                            onChange={(e) => {
                              const updated = [...workingHours];
                              updated[idx].lunch_start = e.target.value;
                              setWorkingHours(updated);
                            }}
                            className="bg-bg rounded-lg px-2.5 py-1 text-xs text-text border border-border focus:border-accent focus:outline-none !min-h-0"
                          />
                          <span className="text-text-muted text-[11px]">às</span>
                          <input
                            aria-label={`${DAYS_NAMES[wh.day_of_week]} — Fim do almoço`}
                            type="time"
                            value={wh.lunch_end || "13:00"}
                            onChange={(e) => {
                              const updated = [...workingHours];
                              updated[idx].lunch_end = e.target.value;
                              setWorkingHours(updated);
                            }}
                            className="bg-bg rounded-lg px-2.5 py-1 text-xs text-text border border-border focus:border-accent focus:outline-none !min-h-0"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* 4. SEÇÃO: SERVIÇOS QUE O BARBEIRO FAZ */}
        {selectedBarberId && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface border border-border rounded-2xl p-6 shadow-soft space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-hairline">
              <div>
                <span className="text-[11px] uppercase font-bold tracking-wider text-accent-light block mb-1">
                  Especialidades
                </span>
                <h2 className="text-base font-bold text-text">
                  Serviços Realizados por {barbers.find((b) => b.id === selectedBarberId)?.name}
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  Marque os procedimentos que este profissional executa na barbearia
                </p>
              </div>

              <button
                onClick={handleSaveServices}
                disabled={isSavingServices}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-glow transition-all disabled:opacity-50 !min-h-0 shrink-0"
              >
                {isSavingServices ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Scissors className="w-4 h-4" />
                )}
                <span>{isSavingServices ? "Salvando..." : "Salvar Especialidades"}</span>
              </button>
            </div>

            {allServices.length === 0 ? (
              <div className="bg-surface-2 border border-hairline p-6 rounded-xl text-xs text-text-muted text-center">
                Nenhum serviço cadastrado na barbearia. Cadastre serviços na aba &quot;Serviços&quot;.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {allServices.map((srv) => {
                  const isChecked = barberSelectedServices.includes(srv.id);
                  return (
                    <div
                      key={srv.id}
                      onClick={() => toggleServiceCheckbox(srv.id)}
                      className={`p-3.5 rounded-xl flex items-center justify-between cursor-pointer transition-all border ${
                        isChecked
                          ? "bg-accent-soft border-accent/40 text-text shadow-sm"
                          : "bg-surface-2 border-hairline/60 text-text-muted hover:text-text hover:bg-surface-3"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                            isChecked
                              ? "bg-accent border-accent text-white"
                              : "border-text-muted/40"
                          }`}
                        >
                          {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                        <span className="font-semibold text-xs text-text truncate">
                          {srv.name}
                        </span>
                      </div>
                      <span className="font-mono text-xs opacity-70 shrink-0">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(srv.price)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.section>
        )}
      </main>

      {/* MODAL: ADICIONAR BARBEIRO */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-soft space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-hairline">
                <h2 className="text-lg font-bold text-text">Novo Barbeiro</h2>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-surface-2 text-text-muted hover:text-text flex items-center justify-center transition-colors !min-h-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddBarber} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={newBarberName}
                    onChange={(e) => setNewBarberName(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Especialidade / Bio
                  </label>
                  <input
                    type="text"
                    value={newBarberBio}
                    onChange={(e) => setNewBarberBio(e.target.value)}
                    placeholder="Ex: Especialista em degradê e visagismo"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    URL da Foto (opcional)
                  </label>
                  <input
                    type="url"
                    value={newBarberAvatar}
                    onChange={(e) => setNewBarberAvatar(e.target.value)}
                    placeholder="https://exemplo.com/foto.jpg"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-hairline">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
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
                    <span>{isSubmitting ? "Salvando..." : "Cadastrar Barbeiro"}</span>
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
