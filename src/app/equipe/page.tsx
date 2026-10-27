"use client";

import { AdminSkeleton } from "@/components/admin/skeleton";
import { AdminNavigation } from "@/components/admin/navigation";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scissors,
  Calendar,
  Users,
  DollarSign,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  Plus,
  Clock,
  Coffee,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Trash2,
  UserCheck,
  UserX,
  Power,
  CalendarOff,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { fixMojibake } from "@/lib/utils";
import {
  logoutAction,
  toggleShopClosedTodayAction,
  createBarberAction,
  toggleBarberActiveAction,
  deleteBarberAction,
  saveWorkingHoursAction,
  saveBarberServicesAction,
} from "@/app/actions/admin-actions";

interface Barber {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

interface WorkingHour {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_off: boolean;
  lunch_start?: string;
  lunch_end?: string;
}

const DAYS_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

import { useTeamManager } from "./use-team-manager";

export default function EquipePage() {
  const state = useTeamManager();
  const {
    router,
    barbershopId,
    setBarbershopId,
    shopName,
    setShopName,
    isLoading,
    setIsLoading,
    statusMsg,
    setStatusMsg,
    isClosedToday,
    setIsClosedToday,
    closedReason,
    setClosedReason,
    closedDaysList,
    setClosedDaysList,
    barbers,
    setBarbers,
    isAddModalOpen,
    setIsAddModalOpen,
    newBarberName,
    setNewBarberName,
    newBarberBio,
    setNewBarberBio,
    newBarberAvatar,
    setNewBarberAvatar,
    isSubmitting,
    setIsSubmitting,
    selectedBarberId,
    setSelectedBarberId,
    workingHours,
    setWorkingHours,
    isSavingHours,
    setIsSavingHours,
    allServices,
    setAllServices,
    barberSelectedServices,
    setBarberSelectedServices,
    isSavingServices,
    setIsSavingServices,
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
    <div className="admin-page min-h-screen bg-bg text-text flex flex-col md:flex-row p-4 md:p-6 gap-6">
      {/* Menu Lateral Arredondado (Trilho / Dock) */}
      <AdminNavigation />

      {/* Conteúdo Principal */}
      <main className="admin-content flex-1 space-y-6">
        {/* Header Superior */}
        <header className="bg-surface rounded-[28px] px-8 py-5 flex items-center justify-between shadow-soft">
          <div>
            <h1 className="font-serif text-2xl font-bold text-text">
              Equipe & Expediente
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Gerencie abertura diária, horários de funcionamento, barbeiros e
              especialidades
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-contrast px-6 py-2.5 rounded-full font-bold text-xs shadow-glow transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Barbeiro</span>
          </button>
        </header>

        {/* Feedback de Status */}
        {statusMsg && (
          <div
            className={`p-4 rounded-[20px] text-xs flex items-center gap-2.5 ${
              statusMsg.type === "success"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-danger/10 text-danger"
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

        {/* 1. SEÇÃO: CONTROLE DE ABERTURA HOJE (FECHAR / ABRIR BARBEARIA) */}
        <section className="bg-surface rounded-[32px] p-8 shadow-soft space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-hairline">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-accent block mb-1">
                Controle Rápido
              </span>
              <h2 className="font-serif text-xl font-bold text-text">
                Status de Abertura da Barbearia
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Precisa folgar hoje ou fechar por imprevisto? Clique no botão
                para bloquear agendamentos no site do cliente.
              </p>
            </div>

            <button
              onClick={handleToggleClosedToday}
              className={`px-6 py-3.5 rounded-full font-bold text-xs transition-all flex items-center gap-2.5 active:scale-95 ${
                isClosedToday
                  ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 ring-1 ring-emerald-500/30"
                  : "bg-danger/15 hover:bg-danger/25 text-danger ring-1 ring-danger/30"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-surface-2 rounded-2xl p-4 flex items-center gap-3">
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  isClosedToday ? "bg-danger" : "bg-emerald-400"
                } animate-pulse`}
              />
              <div>
                <span className="text-text-muted text-xs block">
                  Status Atual de Hoje
                </span>
                <strong
                  className={`font-serif text-sm ${isClosedToday ? "text-danger" : "text-emerald-400"}`}
                >
                  {isClosedToday
                    ? "Fechada para agendamentos hoje"
                    : "Aberta normalmente hoje"}
                </strong>
              </div>
            </div>

            <div className="bg-surface-2 rounded-2xl p-4">
              <span className="text-text-muted text-xs block">
                Data Selecionada
              </span>
              <strong className="text-text font-mono text-sm">
                {new Date().toLocaleDateString("pt-BR", { dateStyle: "full" })}
              </strong>
            </div>
          </div>
        </section>

        {/* 2. SEÇÃO: BARBEIROS (EQUIPE) */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-surface rounded-[32px] p-8 shadow-soft space-y-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-hairline">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-accent block mb-1">
                Profissionais
              </span>
              <h2 className="font-serif text-xl font-bold text-text">
                Equipe de Barbeiros
              </h2>
            </div>
            <span className="text-xs text-text-muted font-mono">
              {barbers.length} profissionais
            </span>
          </div>

          {barbers.length === 0 ? (
            <div className="bg-surface-2 p-8 rounded-2xl text-center text-xs text-text-muted">
              Nenhum barbeiro cadastrado. Clique no botão &quot;Adicionar
              Barbeiro&quot; acima para cadastrar seu time.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {barbers.map((b) => (
                <motion.div
                  key={b.id}
                  onClick={() => setSelectedBarberId(b.id)}
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className={`bg-surface-2 p-5 rounded-[24px] cursor-pointer transition-all border ${
                    selectedBarberId === b.id
                      ? "ring-2 ring-accent border-accent/40 bg-surface-2"
                      : "border-hairline hover:bg-surface-3"
                  }`}
                >
                  <div className="flex items-center gap-3.5 mb-3">
                    <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-accent overflow-hidden font-serif font-bold text-base border border-hairline shrink-0">
                      {b.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={b.avatar_url}
                          alt={b.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{b.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif font-bold text-sm text-text truncate">
                        {b.name}
                      </h3>
                      <p className="text-xs text-text-muted truncate">
                        {b.bio || "Especialista em Cortes"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-hairline text-xs">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleBarberActive(b);
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-colors ${
                        b.is_active
                          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                          : "bg-surface text-text-muted hover:text-text"
                      }`}
                    >
                      {b.is_active ? "Ativo" : "Pausado"}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBarber(b);
                      }}
                      className="text-text-muted hover:text-danger p-1 transition-colors"
                      title="Excluir Barbeiro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        {/* 3. SEÇÃO: EXPEDIENTE, HORÁRIOS & ALMOÇO DO BARBEIRO SELECIONADO */}
        {selectedBarberId && (
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="bg-surface rounded-[32px] p-8 shadow-soft space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-hairline">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-accent block mb-1">
                  Horários & Intervalo de Almoço
                </span>
                <h2 className="font-serif text-xl font-bold text-text">
                  Expediente de{" "}
                  {barbers.find((b) => b.id === selectedBarberId)?.name}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Configure o horário de entrada, saída, intervalo de almoço do
                  profissional e dias de folga
                </p>
              </div>

              <motion.button
                onClick={handleSaveHours}
                disabled={isSavingHours}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-contrast px-6 py-2.5 rounded-full font-bold text-xs shadow-glow transition-all disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{isSavingHours ? "Salvando..." : "Salvar Horários"}</span>
              </motion.button>
            </div>

            <div className="space-y-2.5">
              {workingHours.map((wh, idx) => (
                <motion.div
                  key={wh.day_of_week}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="bg-surface-2 px-6 py-4 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs border border-transparent hover:border-hairline transition-all"
                >
                  <div className="w-36 font-semibold text-text flex items-center gap-2">
                    <span>{DAYS_NAMES[wh.day_of_week]}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 sm:gap-6">
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
                          wh.is_off
                            ? "text-danger font-semibold"
                            : "text-text-muted"
                        }
                      >
                        {wh.is_off ? "Dia de Folga" : "Dia de Trabalho"}
                      </span>
                    </label>

                    {!wh.is_off && (
                      <div className="flex flex-wrap items-center gap-4">
                        {/* Entrada e Saída */}
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted text-xs">
                            Entrada:
                          </span>
                          <input aria-label={`${DAYS_NAMES[wh.day_of_week]} — Entrada`}
                            type="time"
                            value={wh.start_time}
                            onChange={(e) => {
                              const updated = [...workingHours];
                              updated[idx].start_time = e.target.value;
                              setWorkingHours(updated);
                            }}
                            className="bg-surface rounded-full px-3 py-1 text-xs text-text border border-hairline focus:ring-1 focus:ring-accent focus:outline-none"
                          />
                          <span className="text-text-muted text-xs">
                            Saída:
                          </span>
                          <input aria-label={`${DAYS_NAMES[wh.day_of_week]} — Saída`}
                            type="time"
                            value={wh.end_time}
                            onChange={(e) => {
                              const updated = [...workingHours];
                              updated[idx].end_time = e.target.value;
                              setWorkingHours(updated);
                            }}
                            className="bg-surface rounded-full px-3 py-1 text-xs text-text border border-hairline focus:ring-1 focus:ring-accent focus:outline-none"
                          />
                        </div>

                        {/* Intervalo de Almoço */}
                        <div className="flex items-center gap-2 pl-3 border-l border-hairline">
                          <Coffee className="w-3.5 h-3.5 text-accent shrink-0" />
                          <span className="text-text-muted text-xs">
                            Almoço:
                          </span>
                          <input aria-label={`${DAYS_NAMES[wh.day_of_week]} — Início do almoço`}
                            type="time"
                            value={wh.lunch_start || "12:00"}
                            onChange={(e) => {
                              const updated = [...workingHours];
                              updated[idx].lunch_start = e.target.value;
                              setWorkingHours(updated);
                            }}
                            className="bg-surface rounded-full px-3 py-1 text-xs text-text border border-hairline focus:ring-1 focus:ring-accent focus:outline-none"
                          />
                          <span className="text-text-muted text-xs">às</span>
                          <input aria-label={`${DAYS_NAMES[wh.day_of_week]} — Fim do almoço`}
                            type="time"
                            value={wh.lunch_end || "13:00"}
                            onChange={(e) => {
                              const updated = [...workingHours];
                              updated[idx].lunch_end = e.target.value;
                              setWorkingHours(updated);
                            }}
                            className="bg-surface rounded-full px-3 py-1 text-xs text-text border border-hairline focus:ring-1 focus:ring-accent focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* 4. SEÇÃO: SERVIÇOS QUE O BARBEIRO FAZ (ESPECIALIDADES) */}
        {selectedBarberId && (
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-surface rounded-[32px] p-8 shadow-soft space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-hairline">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-accent block mb-1">
                  Especialidades
                </span>
                <h2 className="font-serif text-xl font-bold text-text">
                  Serviços Realizados por{" "}
                  {barbers.find((b) => b.id === selectedBarberId)?.name}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Marque apenas os procedimentos que este barbeiro está apto a
                  realizar
                </p>
              </div>

              <motion.button
                onClick={handleSaveServices}
                disabled={isSavingServices}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-contrast px-6 py-2.5 rounded-full font-bold text-xs shadow-glow transition-all disabled:opacity-50"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>
                  {isSavingServices ? "Salvando..." : "Salvar Especialidades"}
                </span>
              </motion.button>
            </div>

            {allServices.length === 0 ? (
              <div className="bg-surface-2 p-6 rounded-2xl text-xs text-text-muted text-center">
                Nenhum serviço cadastrado na barbearia. Cadastre serviços na aba
                &quot;Serviços&quot;.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {allServices.map((srv) => {
                  const isChecked = barberSelectedServices.includes(srv.id);
                  return (
                    <motion.div
                      key={srv.id}
                      onClick={() => toggleServiceCheckbox(srv.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all border ${
                        isChecked
                          ? "bg-accent-soft border-accent/40 text-text shadow-sm"
                          : "bg-surface-2 border-hairline text-text-muted hover:text-text hover:bg-surface-3"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                            isChecked
                              ? "bg-accent border-accent text-accent-contrast"
                              : "border-text-muted/40"
                          }`}
                        >
                          {isChecked && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                        <span className="font-semibold text-xs">
                          {srv.name}
                        </span>
                      </div>
                      <span className="font-mono text-xs opacity-70">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(srv.price)}
                      </span>
                    </motion.div>
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-surface rounded-[32px] max-w-md w-full p-8 shadow-soft space-y-6 border border-hairline"
            >
              <div className="flex items-center justify-between pb-4 border-b border-hairline">
                <h2 className="font-serif text-xl font-bold text-text">
                  Novo Barbeiro
                </h2>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-surface-2 text-text-muted hover:text-text flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddBarber} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={newBarberName}
                    onChange={(e) => setNewBarberName(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text border border-hairline focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-2">
                    Especialidade / Bio
                  </label>
                  <input
                    type="text"
                    value={newBarberBio}
                    onChange={(e) => setNewBarberBio(e.target.value)}
                    placeholder="Ex: Mestre em degradê e visagismo"
                    className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text border border-hairline focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-2">
                    URL da Foto (opcional)
                  </label>
                  <input
                    type="url"
                    value={newBarberAvatar}
                    onChange={(e) => setNewBarberAvatar(e.target.value)}
                    placeholder="https://exemplo.com/foto.jpg"
                    className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text border border-hairline focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-hairline">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-5 py-2.5 rounded-full text-xs font-bold text-text-muted hover:text-text"
                  >
                    Cancelar
                  </button>
                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="bg-accent hover:bg-accent-hover text-accent-contrast px-6 py-2.5 rounded-full text-xs font-bold shadow-glow disabled:opacity-50"
                  >
                    {isSubmitting ? "Salvando..." : "Cadastrar Barbeiro"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
