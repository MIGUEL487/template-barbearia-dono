"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Loader2,
  Phone,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import {
  createQuickBookingAction,
  completeBookingAction,
  cancelBookingAction,
} from "@/app/actions/admin-actions";

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
  status: "hold" | "confirmed" | "completed" | "cancelled" | "no_show";
  total_price: number;
}

export default function AgendaPage() {
  const router = useRouter();
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dados do banco
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<BookingSlot[]>([]);

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

  const loadData = useCallback(async () => {
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
        setErrorMsg("Acesso não autorizado para esta barbearia.");
        setIsLoading(false);
        return;
      }

      const shopId = member.barbershop_id;
      setBarbershopId(shopId);

      // Carregar Barbeiros
      const { data: bData } = await supabase
        .from("barbers")
        .select("id, name")
        .eq("barbershop_id", shopId)
        .eq("is_active", true)
        .order("name");

      if (bData) {
        setBarbers(bData);
        if (bData.length > 0 && !modalBarberId) {
          setModalBarberId(bData[0].id);
        }
      }

      // Carregar Serviços
      const { data: sData } = await supabase
        .from("services")
        .select("id, name, price, duration_minutes")
        .eq("barbershop_id", shopId)
        .eq("is_active", true)
        .order("name");

      if (sData) {
        setServices(sData);
        if (sData.length > 0 && !modalServiceId) {
          setModalServiceId(sData[0].id);
        }
      }

      // Carregar Bookings do dia
      const dayStart = `${selectedDate}T00:00:00`;
      const dayEnd = `${selectedDate}T23:59:59`;

      const { data: bookData, error: bookErr } = await supabase
        .from("bookings")
        .select(`
          id,
          barber_id,
          starts_at,
          status,
          total_price,
          customers (name, phone),
          booking_services (
            services (name)
          )
        `)
        .eq("barbershop_id", shopId)
        .gte("starts_at", dayStart)
        .lte("starts_at", dayEnd)
        .order("starts_at");

      if (bookErr) {
        setErrorMsg(bookErr.message);
      } else if (bookData) {
        const mapped: BookingSlot[] = bookData.map((b: any) => {
          const sName =
            b.booking_services && b.booking_services.length > 0
              ? b.booking_services.map((bs: any) => bs.services?.name).filter(Boolean).join(", ")
              : "Serviço";
          return {
            id: b.id,
            barber_id: b.barber_id,
            customer_name: b.customers?.name || "Cliente",
            customer_phone: b.customers?.phone || "",
            service_name: sName,
            starts_at: b.starts_at,
            status: b.status,
            total_price: Number(b.total_price),
          };
        });
        setBookings(mapped);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao carregar dados da agenda.");
    } finally {
      setIsLoading(false);
    }
  }, [router, selectedDate, modalBarberId, modalServiceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateQuickBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbershopId || !modalBarberId || !modalServiceId) return;

    setIsSubmitting(true);
    setModalError(null);

    const startsAt = `${selectedDate}T${modalTime}:00`;

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

  const handleComplete = async (bookingId: string) => {
    if (!barbershopId) return;
    if (confirm("Deseja marcar este agendamento como Concluído?")) {
      const res = await completeBookingAction(barbershopId, bookingId);
      if (res.success) {
        await loadData();
      } else {
        alert(res.error || "Erro ao concluir agendamento");
      }
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!barbershopId) return;
    const reason = prompt("Motivo do cancelamento (opcional):");
    if (reason !== null) {
      const res = await cancelBookingAction(barbershopId, bookingId, reason || undefined);
      if (res.success) {
        await loadData();
      } else {
        alert(res.error || "Erro ao cancelar agendamento");
      }
    }
  };

  const timeSlots = [
    "08:00", "08:45", "09:30", "10:15", "11:00", "11:45",
    "13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15", "19:00",
  ];

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      {/* Header da Agenda */}
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
          <h1 className="font-serif text-lg font-bold text-text">Grade de Agenda por Barbeiro</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-2 border border-border px-3 py-1.5 rounded-sm text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5 text-accent" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-text border-none focus:outline-none text-xs cursor-pointer"
            />
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

      {/* Alerta de Erro se houver */}
      {errorMsg && (
        <div className="m-6 bg-status-danger/10 border border-status-danger/30 rounded-sm p-4 text-xs text-status-danger flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid View */}
      <main className="flex-1 p-6 overflow-x-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
            <p className="text-sm">Carregando dados da agenda em tempo real...</p>
          </div>
        ) : barbers.length === 0 ? (
          <div className="bg-surface border border-border p-12 text-center rounded-sm">
            <p className="text-sm text-text-muted mb-2">Nenhum barbeiro ativo cadastrado nesta barbearia.</p>
            <p className="text-xs text-text-muted">Cadastre profissionais no banco para visualizar a grade.</p>
          </div>
        ) : (
          <div className="min-w-[800px] bg-surface border border-border rounded-sm overflow-hidden">
            {/* Cabeçalho das Colunas (Barbeiros) */}
            <div
              className="grid border-b border-border bg-surface-2 text-xs font-bold text-text-muted uppercase tracking-wider"
              style={{
                gridTemplateColumns: `80px repeat(${barbers.length}, minmax(180px, 1fr))`,
              }}
            >
              <div className="p-3 border-r border-border text-center">Horário</div>
              {barbers.map((b) => (
                <div key={b.id} className="p-3 border-r border-border last:border-r-0 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] font-bold">
                    {b.name.charAt(0)}
                  </div>
                  <span className="text-text font-serif truncate">{b.name}</span>
                </div>
              ))}
            </div>

            {/* Linhas de Horário */}
            <div className="divide-y divide-border">
              {timeSlots.map((time) => (
                <div
                  key={time}
                  className="grid min-h-[70px]"
                  style={{
                    gridTemplateColumns: `80px repeat(${barbers.length}, minmax(180px, 1fr))`,
                  }}
                >
                  {/* Coluna de Horário */}
                  <div className="p-3 border-r border-border text-xs font-mono text-text-muted flex items-start justify-center pt-2">
                    {time}
                  </div>

                  {/* Células por Barbeiro */}
                  {barbers.map((barber) => {
                    const slotBookings = bookings.filter((b) => {
                      if (b.barber_id !== barber.id) return false;
                      const bTime = new Date(b.starts_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return bTime === time;
                    });

                    return (
                      <div
                        key={`${barber.id}-${time}`}
                        className="p-2 border-r border-border last:border-r-0 flex flex-col justify-center relative hover:bg-surface-2/40 transition-colors"
                      >
                        {slotBookings.map((b) => (
                          <div
                            key={b.id}
                            className={`p-2.5 rounded-sm border text-xs flex flex-col justify-between mb-1 last:mb-0 shadow-sm ${
                              b.status === "completed"
                                ? "bg-status-success/10 border-status-success/30 text-status-success"
                                : b.status === "cancelled"
                                ? "bg-status-danger/10 border-status-danger/30 text-status-danger line-through opacity-70"
                                : "bg-accent/10 border-accent/30 text-text"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span className="font-bold truncate text-[13px]">{b.customer_name}</span>
                              <span className="font-mono text-[11px] font-semibold">
                                {formatCurrency(b.total_price)}
                              </span>
                            </div>
                            <div className="text-[11px] text-text-muted truncate mb-2">{b.service_name}</div>

                            {b.status === "confirmed" && (
                              <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
                                <button
                                  onClick={() => handleComplete(b.id)}
                                  className="px-2 py-0.5 rounded bg-status-success/20 hover:bg-status-success/30 text-status-success text-[10px] font-bold flex items-center gap-1"
                                  title="Marcar Concluído"
                                >
                                  <Check className="w-3 h-3" />
                                  Concluir
                                </button>
                                <button
                                  onClick={() => handleCancel(b.id)}
                                  className="px-2 py-0.5 rounded bg-status-danger/20 hover:bg-status-danger/30 text-status-danger text-[10px] font-bold flex items-center gap-1"
                                  title="Cancelar"
                                >
                                  <X className="w-3 h-3" />
                                  Cancelar
                                </button>
                              </div>
                            )}

                            {b.status === "completed" && (
                              <span className="text-[10px] font-semibold text-status-success">✓ Atendido</span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal de Agendamento Rápido */}
      {showQuickModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-sm max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <h2 className="font-serif text-lg font-bold text-text">Novo Agendamento Rápido</h2>
              <button
                onClick={() => setShowQuickModal(false)}
                className="text-text-muted hover:text-text p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="bg-status-danger/10 border border-status-danger/30 rounded-sm p-3 mb-4 text-xs text-status-danger flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateQuickBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  required
                  value={modalCustomer}
                  onChange={(e) => setModalCustomer(e.target.value)}
                  placeholder="Ex: Carlos Santana"
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  WhatsApp / Telefone
                </label>
                <input
                  type="text"
                  required
                  value={modalPhone}
                  onChange={(e) => setModalPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                    Barbeiro
                  </label>
                  <select
                    value={modalBarberId}
                    onChange={(e) => setModalBarberId(e.target.value)}
                    className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                  >
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                    Horário
                  </label>
                  <select
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                  >
                    {timeSlots.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Serviço
                </label>
                <select
                  value={modalServiceId}
                  onChange={(e) => setModalServiceId(e.target.value)}
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {formatCurrency(s.price)} ({s.duration_minutes} min)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Observações (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Ex: Cliente tem preferência por máquina zero na nuca."
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs rounded-sm focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowQuickModal(false)}
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
                      <span>Agendando...</span>
                    </>
                  ) : (
                    <span>Confirmar Agendamento</span>
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
