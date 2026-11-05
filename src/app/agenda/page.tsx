"use client";
import { DialogPanel } from "@/components/ui/dialog-panel";
import { currentMembership } from "@/lib/browser-shop";

import { AdminSkeleton } from "@/components/admin/skeleton";
import { ManagementLayout } from "@/components/admin/management-layout";
import { BookingActions } from "@/components/admin/booking-actions";
import { NotificationControls } from "@/components/admin/notification-controls";
import { PremiumDatePicker } from "@/components/admin/premium-date-picker";
import { CustomSelect } from "@/components/admin/custom-select";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Scissors,
  Calendar,
  Clock,
  User,
  Plus,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Users,
  DollarSign,
  Coffee,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency, fixMojibake } from "@/lib/utils";
import {
  createQuickBookingAction,
  completeBookingAction,
  cancelBookingAction,
  logoutAction,
} from "@/app/actions/admin-actions";
import { motion, AnimatePresence } from "motion/react";
import {
  agendaGrid,
  blocks,
  dayBounds,
  isExpired,
  saoPauloDate,
  weekday,
  type WorkingHours,
  type TimeOff,
} from "@/lib/agenda-grid";

interface Barber {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface BookingSlot {
  id: string;
  barber_id: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  starts_at: string;
  ends_at: string;
  hold_expires_at: string | null;
  status: "hold" | "confirmed" | "completed" | "cancelled" | "no_show";
  total_price: number;
}

export default function AgendaPage() {
  const router = useRouter();
  const [calendarMounted, setCalendarMounted] = useState(false);
  useEffect(() => setCalendarMounted(true), []);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return saoPauloDate();
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dados do banco
  const [activeBarber, setActiveBarber] = useState<string>("all");
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<BookingSlot[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [closed, setClosed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const loadVersion = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Modal Agendamento Rápido
  const [showQuickModal, setShowQuickModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalCustomer, setModalCustomer] = useState<string>("");
  const [modalPhone, setModalPhone] = useState<string>("");
  const [modalBarberId, setModalBarberId] = useState<string>("");
  const [modalServiceId, setModalServiceId] = useState<string>("");
  const [modalTime, setModalTime] = useState<string>("10:00");
  const [modalNotes, setModalNotes] = useState<string>("");
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = useCallback(
    async (silent = false) => {
      const version = ++loadVersion.current;
      if (!silent) setIsLoading(true);
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

        if (version !== loadVersion.current) return;
        if (memErr || !member) {
          setErrorMsg("Acesso não autorizado para esta barbearia.");
          setIsLoading(false);
          return;
        }

        const shopId = (member as any).barbershop_id;
        setBarbershopId(shopId);

        const { data: bData, error: barberError } = await supabase
          .from("barbers")
          .select("id, name")
          .eq("barbershop_id", shopId)
          .eq("is_active", true)
          .order("name");

        if (version !== loadVersion.current) return;
        if (barberError) throw barberError;

        if (bData) {
          const cleaned = bData.map((b) => ({
            ...b,
            name: fixMojibake(b.name),
          }));
          setBarbers(cleaned);
          if (cleaned.length > 0 && !modalBarberId) {
            setModalBarberId(cleaned[0].id);
          }
        }

        const { data: sData } = await supabase
          .from("services")
          .select("id, name, price, duration_minutes")
          .eq("barbershop_id", shopId)
          .eq("is_active", true)
          .order("name");

        if (version !== loadVersion.current) return;
        if (sData) {
          const cleaned = sData.map((s) => ({
            ...s,
            name: fixMojibake(s.name),
          }));
          setServices(cleaned);
          if (cleaned.length > 0 && !modalServiceId) {
            setModalServiceId(cleaned[0].id);
          }
        }

        const { start: dayStart, end: dayEnd } = dayBounds(selectedDate);
        const ids = (bData || []).map((b) => b.id);
        const [hours, absences, closures] = await Promise.all([
          ids.length
            ? supabase
                .from("working_hours")
                .select(
                  "barber_id,day_of_week,start_time,end_time,lunch_start,lunch_end,is_off",
                )
                .in("barber_id", ids)
                .eq("day_of_week", weekday(selectedDate))
            : Promise.resolve({ data: [], error: null }),
          ids.length
            ? supabase
                .from("time_off")
                .select("barber_id,starts_at,ends_at,reason")
                .in("barber_id", ids)
                .lt("starts_at", dayEnd)
                .gt("ends_at", dayStart)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("closed_days")
            .select("date")
            .eq("barbershop_id", shopId)
            .eq("date", selectedDate),
        ]);

        if (version !== loadVersion.current) return;
        if (hours.error || absences.error || closures.error)
          throw hours.error || absences.error || closures.error;

        setWorkingHours(hours.data || []);
        setTimeOff(absences.data || []);
        setClosed(!!closures.data?.length);
        setNow(Date.now());

        const { data: bookData, error: bookErr } = await supabase
          .from("bookings")
          .select(
            `
            id,
            barber_id,
            starts_at,
            ends_at,
            hold_expires_at,
            status,
            total_price,
            customers (name, phone),
            booking_items (
              service_name
            )
          `,
          )
          .eq("barbershop_id", shopId)
          .lt("starts_at", dayEnd)
          .gt("ends_at", dayStart)
          .order("starts_at");

        if (version !== loadVersion.current) return;
        if (bookErr) {
          setErrorMsg(bookErr.message);
        } else if (bookData) {
          const mapped: BookingSlot[] = bookData.map((b: any) => {
            const sName =
              b.booking_items && b.booking_items.length > 0
                ? b.booking_items
                    .map((bs: any) => fixMojibake(bs.service_name))
                    .filter(Boolean)
                    .join(", ")
                : "Serviço";
            return {
              id: b.id,
              barber_id: b.barber_id,
              customer_name:
                fixMojibake(b.customers?.name) ||
                (b.status === "hold" ? "Pré-reserva" : "Cliente"),
              customer_phone: b.customers?.phone || "",
              service_name: sName,
              starts_at: b.starts_at,
              ends_at: b.ends_at,
              hold_expires_at: b.hold_expires_at,
              status: b.status,
              total_price: Number(b.total_price),
            };
          });
          setBookings(mapped);
        }
      } catch (err: any) {
        if (version === loadVersion.current)
          setErrorMsg(err.message || "Erro ao carregar dados da agenda.");
      } finally {
        if (version === loadVersion.current) setIsLoading(false);
      }
    },
    [router, selectedDate, modalBarberId, modalServiceId],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void loadData(true), 300);
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("auto-stilo:bookings-changed", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("auto-stilo:bookings-changed", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [loadData]);

  const handleCreateQuickBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbershopId || !modalBarberId || !modalServiceId) return;

    setIsSubmitting(true);
    setModalError(null);

    const startsAt = `${selectedDate}T${modalTime}:00-03:00`;

    const res = await createQuickBookingAction({
      barbershop_id: barbershopId,
      barber_id: modalBarberId,
      starts_at: startsAt,
      service_ids: [modalServiceId],
      customer_name: modalCustomer,
      customer_phone: modalPhone,
      notes: modalNotes,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setModalError(res.error || "Erro ao criar agendamento.");
      return;
    }

    setShowQuickModal(false);
    setModalCustomer("");
    setModalPhone("");
    setModalNotes("");
    await loadData();
  };

  const changeDateByDays = (delta: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const timeSlots = agendaGrid(
    selectedDate,
    modalBarberId,
    workingHours,
    bookings,
    timeOff,
    closed,
    now,
  )
    .filter((r) => r.available)
    .map((r) => r.time);

  return (
    <ManagementLayout
      title="Agenda"
      subtitle="Atendimentos, disponibilidade e bloqueios em um só lugar."
      actions={
        <>
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <PremiumDatePicker
              value={selectedDate}
              onChange={setSelectedDate}
            />

            <button
              onClick={() => setShowQuickModal(true)}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-glow transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Agendamento Rápido</span>
            </button>
          </div>
        </>
      }
      status={
        closed && (
          <span className="mg-status mg-status-danger">Fechado nesta data</span>
        )
      }
    >
      <div className="mg-schedule-summary">
        <div>
          <p className="mg-overline">Seu dia organizado</p>
          <strong>
            {calendarMounted
              ? new Date(selectedDate + "T12:00:00-03:00").toLocaleDateString(
                  "pt-BR",
                  {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    timeZone: "America/Sao_Paulo",
                  },
                )
              : "Data selecionada"}
          </strong>
        </div>
        <div>
          <span>Profissionais</span>
          <strong>{barbers.length}</strong>
        </div>
        <div>
          <span>Reservas válidas</span>
          <strong>
            {
              bookings.filter((b) => blocks(b, now) && !isExpired(b, now))
                .length
            }
          </strong>
        </div>
        <div>
          <span>Operação</span>
          <strong>{closed ? "Fechada" : "Conforme expediente"}</strong>
        </div>
      </div>
      <NotificationControls compact />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Barber Filter Pill Tabs */}
      <div
        className="barber-tabs flex items-center gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label="Filtrar profissional"
      >
        <button
          aria-pressed={activeBarber === "all"}
          onClick={() => setActiveBarber("all")}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition-all shrink-0 ${
            activeBarber === "all"
              ? "bg-accent text-white shadow-sm"
              : "bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-2"
          }`}
        >
          Todos os Profissionais ({barbers.length})
        </button>

        {barbers.map((b) => {
          const count = bookings.filter(
            (book) =>
              book.barber_id === b.id &&
              !isExpired(book, now) &&
              blocks(book, now),
          ).length;
          return (
            <button
              key={b.id}
              aria-pressed={activeBarber === b.id}
              onClick={() => setActiveBarber(b.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-2 ${
                activeBarber === b.id
                  ? "bg-accent text-white shadow-sm"
                  : "bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-2"
              }`}
            >
              <span>{b.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeBarber === b.id
                    ? "bg-white/20 text-white"
                    : "bg-surface-2 text-text-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Schedule Grid Area */}
      {isLoading ? (
        <AdminSkeleton />
      ) : errorMsg ? null : barbers.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center text-text-muted text-xs shadow-soft">
          Nenhum barbeiro ativo cadastrado nesta barbearia.
        </div>
      ) : (
        <div className="agenda-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {barbers
            .filter((b) => activeBarber === "all" || b.id === activeBarber)
            .map((barber) => {
              const barberBookings = bookings.filter(
                (b) => b.barber_id === barber.id && !isExpired(b, now),
              );
              const rows = agendaGrid(
                selectedDate,
                barber.id,
                workingHours,
                barberBookings,
                timeOff,
                closed,
                now,
              );

              const activeCount = barberBookings.filter((b) =>
                blocks(b, now),
              ).length;

              return (
                <div
                  key={barber.id}
                  className="bg-surface border border-border rounded-2xl p-5 shadow-soft flex flex-col space-y-4"
                >
                  {/* Barber Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-hairline">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent-light border border-accent/25 flex items-center justify-center font-bold text-sm shrink-0">
                        {barber.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-text text-sm">
                          {barber.name}
                        </h3>
                        <span className="text-[11px] text-text-muted">
                          {activeCount}{" "}
                          {activeCount === 1 ? "atendimento" : "atendimentos"}{" "}
                          marcados
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Ativo
                    </span>
                  </div>

                  {/* Barber Schedule Timeline Slots */}
                  <div className="space-y-2 overflow-y-auto max-h-[70vh] pr-1">
                    {rows
                      .flatMap<{
                        time: string;
                        slotBooking: BookingSlot | undefined;
                        state: string;
                      }>((row) =>
                        row.bookings.length
                          ? row.bookings.map((slotBooking) => ({
                              time: row.time,
                              slotBooking,
                              state: row.state,
                            }))
                          : [
                              {
                                time: row.time,
                                slotBooking: undefined,
                                state: row.state,
                              },
                            ],
                      )
                      .map(({ time, slotBooking, state }) => {
                        if (!slotBooking) {
                          const isLunch = state
                            .toLowerCase()
                            .includes("almoço");
                          const isOff =
                            state.toLowerCase().includes("folga") ||
                            state.toLowerCase().includes("fechado");

                          return (
                            <div
                              key={time}
                              data-agenda-time={time}
                              className={`rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs transition-colors border ${
                                isLunch
                                  ? "bg-amber-500/5 border-amber-500/15 text-amber-300/80"
                                  : isOff
                                    ? "bg-danger/5 border-danger/15 text-danger/70"
                                    : "bg-surface-2/40 hover:bg-surface-2 border-hairline/40 text-text-muted hover:text-text"
                              }`}
                            >
                              <span className="font-mono text-xs font-semibold">
                                {time}
                              </span>
                              <div className="flex items-center gap-1.5 text-[11px]">
                                {isLunch && (
                                  <Coffee className="w-3 h-3 text-amber-400" />
                                )}
                                <span>{state}</span>
                              </div>
                            </div>
                          );
                        }

                        const isConfirmed = slotBooking.status === "confirmed";
                        const isCompleted = slotBooking.status === "completed";
                        const isHold = slotBooking.status === "hold";
                        const isCancelled = slotBooking.status === "cancelled";

                        return (
                          <motion.div
                            key={`${time}-${slotBooking.id}`}
                            data-agenda-time={time}
                            data-booking-id={slotBooking.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`rounded-xl p-3.5 flex flex-col gap-2.5 transition-all border shadow-sm ${
                              isCompleted
                                ? "bg-emerald-500/10 border-emerald-500/25 text-text"
                                : isCancelled
                                  ? "bg-danger/10 border-danger/25 text-danger line-through opacity-60"
                                  : isHold
                                    ? "bg-amber-500/10 border-amber-500/25 text-text"
                                    : "bg-surface-2 hover:bg-surface-3/70 border-accent/30 text-text"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-accent-light">
                                {time}
                              </span>
                              <span className="font-bold text-xs text-text">
                                {formatCurrency(slotBooking.total_price)}
                              </span>
                            </div>

                            <div>
                              <strong className="text-text block text-sm font-semibold">
                                {slotBooking.customer_name}
                              </strong>
                              <div className="flex items-center justify-between text-xs text-text-muted mt-0.5">
                                <span>{slotBooking.service_name}</span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                    isCompleted
                                      ? "bg-emerald-500/20 text-emerald-400"
                                      : isHold
                                        ? "bg-amber-500/20 text-amber-400"
                                        : isConfirmed
                                          ? "bg-accent/20 text-accent-light"
                                          : "bg-danger/20 text-danger"
                                  }`}
                                >
                                  {(
                                    {
                                      hold: "Pré-reserva",
                                      confirmed: "Confirmado",
                                      cancelled: "Cancelado",
                                      completed: "Concluído",
                                      no_show: "Faltou",
                                    } as const
                                  )[slotBooking.status] || slotBooking.status}
                                </span>
                              </div>
                            </div>

                            {isConfirmed &&
                              rows.find((row) =>
                                row.bookings.some(
                                  (b) => b.id === slotBooking.id,
                                ),
                              )?.time === time &&
                              barbershopId && (
                                <div className="pt-2 border-t border-hairline/60 flex justify-end">
                                  <BookingActions
                                    shopId={barbershopId}
                                    bookingId={slotBooking.id}
                                    onUpdated={loadData}
                                  />
                                </div>
                              )}
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Quick Booking Modal */}
      <DialogPanel
        open={showQuickModal}
        onClose={() => setShowQuickModal(false)}
        titleId="quick-title"
      >
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <h2 id="quick-title" className="text-lg font-bold text-text">
            Novo Agendamento Rápido
          </h2>
          <button
            aria-label="Fechar cadastro"
            onClick={() => setShowQuickModal(false)}
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

        <form onSubmit={handleCreateQuickBooking} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Nome do Cliente
            </label>
            <input
              aria-label="Nome do cliente"
              type="text"
              required
              value={modalCustomer}
              onChange={(e) => setModalCustomer(e.target.value)}
              placeholder="Nome do cliente"
              className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              WhatsApp / Telefone
            </label>
            <input
              aria-label="WhatsApp do cliente"
              type="text"
              required
              value={modalPhone}
              onChange={(e) => setModalPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <CustomSelect
                label="Barbeiro"
                value={modalBarberId}
                onChange={setModalBarberId}
                options={barbers.map((b) => ({ value: b.id, label: b.name }))}
                aria-label="Profissional do agendamento"
              />
            </div>

            <div>
              <CustomSelect
                label="Horário"
                value={modalTime}
                onChange={setModalTime}
                options={timeSlots.map((t) => ({ value: t, label: t }))}
                aria-label="Horário do agendamento"
              />
            </div>
          </div>

          <div>
            <CustomSelect
              label="Serviço"
              value={modalServiceId}
              onChange={setModalServiceId}
              options={services.map((s) => ({
                value: s.id,
                label: s.name,
                subtitle: formatCurrency(s.price),
              }))}
              aria-label="Serviço do agendamento"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-hairline">
            <button
              type="button"
              onClick={() => setShowQuickModal(false)}
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
              <span>
                {isSubmitting ? "Agendando..." : "Confirmar Agendamento"}
              </span>
            </button>
          </div>
        </form>
      </DialogPanel>
    </ManagementLayout>
  );
}
