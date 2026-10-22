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
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Users,
  DollarSign,
  Settings,
  BarChart3,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import {
  createQuickBookingAction,
  completeBookingAction,
  cancelBookingAction,
  logoutAction,
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

      const shopId = (member as any).barbershop_id;
      setBarbershopId(shopId);

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
          booking_items (
            service_name
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
            b.booking_items && b.booking_items.length > 0
              ? b.booking_items.map((bs: any) => bs.service_name).filter(Boolean).join(", ")
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
    if (confirm("Marcar este atendimento como Concluído?")) {
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

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
  };

  const timeSlots = [
    "08:00", "08:45", "09:30", "10:15", "11:00", "11:45",
    "13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15", "19:00",
  ];

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/agenda", label: "Agenda", icon: Calendar, active: true },
    { href: "/equipe", label: "Equipe & Horários", icon: Clock },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/servicos", label: "Serviços", icon: Scissors },
    { href: "/financeiro", label: "Financeiro", icon: DollarSign },
    { href: "/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col md:flex-row p-4 md:p-6 gap-6">
      {/* Menu Lateral Arredondado */}
      <aside className="w-full md:w-64 bg-surface rounded-[32px] p-6 shadow-soft flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center">
              <Scissors className="w-4 h-4 rotate-45" />
            </div>
            <div>
              <h2 className="font-serif text-base font-bold text-text truncate max-w-[140px]">Agenda</h2>
              <span className="text-[10px] text-accent uppercase tracking-wider font-bold">Por Barbeiro</span>
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

      {/* Área Principal */}
      <main className="flex-1 space-y-6">
        {/* Barra Superior em Pílula */}
        <header className="bg-surface rounded-full px-6 py-3 flex items-center justify-between shadow-soft">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-surface-2 px-4 py-1.5 rounded-full text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-text border-none focus:outline-none text-xs cursor-pointer"
              />
            </div>
          </div>

          <button
            onClick={() => setShowQuickModal(true)}
            className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-contrast px-5 py-2 rounded-full text-xs font-bold shadow-glow transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agendamento Rápido</span>
          </button>
        </header>

        {errorMsg && (
          <div className="p-4 rounded-[20px] bg-danger/10 text-danger text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Faixas Arredondadas por Barbeiro (Sem grade dura) */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
            <p className="text-sm">Carregando horários em tempo real...</p>
          </div>
        ) : barbers.length === 0 ? (
          <div className="bg-surface rounded-[32px] p-12 text-center text-text-muted text-xs shadow-soft">
            Nenhum barbeiro ativo cadastrado nesta barbearia.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {barbers.map((barber) => {
              const barberBookings = bookings.filter((b) => b.barber_id === barber.id);

              return (
                <div key={barber.id} className="bg-surface rounded-[32px] p-6 shadow-soft space-y-6">
                  {/* Cabeçalho do Barbeiro */}
                  <div className="flex items-center gap-3 pb-4 border-b border-hairline">
                    <div className="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center font-serif text-lg font-bold">
                      {barber.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-text text-base">{barber.name}</h3>
                      <span className="text-[11px] text-text-muted">
                        {barberBookings.length} {barberBookings.length === 1 ? "atendimento" : "atendimentos"} hoje
                      </span>
                    </div>
                  </div>

                  {/* Lista Respirada de Horários do Barbeiro */}
                  <div className="space-y-2.5">
                    {timeSlots.map((time) => {
                      const slotBooking = barberBookings.find((b) => {
                        const bTime = new Date(b.starts_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        return bTime === time;
                      });

                      if (!slotBooking) {
                        return (
                          <div
                            key={time}
                            className="bg-surface-2/40 hover:bg-surface-2 rounded-full px-4 py-2.5 flex items-center justify-between text-xs transition-colors"
                          >
                            <span className="font-mono text-text-muted/60 text-[11px]">{time}</span>
                            <span className="text-[11px] text-text-muted/50">Disponível</span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={slotBooking.id}
                          className={`rounded-2xl p-4 flex flex-col gap-2 transition-all shadow-sm ${
                            slotBooking.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : slotBooking.status === "cancelled"
                              ? "bg-danger/10 text-danger line-through opacity-60"
                              : "bg-accent-soft text-text"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-accent">{time}</span>
                            <span className="font-serif font-bold text-xs">
                              {formatCurrency(slotBooking.total_price)}
                            </span>
                          </div>

                          <div>
                            <strong className="text-text block text-sm font-serif">
                              {slotBooking.customer_name}
                            </strong>
                            <span className="text-xs text-text-muted">{slotBooking.service_name}</span>
                          </div>

                          {slotBooking.status === "confirmed" && (
                            <div className="flex items-center gap-2 pt-2 border-t border-hairline justify-end">
                              <button
                                onClick={() => handleComplete(slotBooking.id)}
                                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>Concluir</span>
                              </button>
                              <button
                                onClick={() => handleCancel(slotBooking.id)}
                                className="bg-danger/20 hover:bg-danger/30 text-danger px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                <span>Cancelar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de Agendamento Rápido com Raio Grande e Campos em Pílula */}
      {showQuickModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-[32px] max-w-md w-full p-8 shadow-soft animate-in zoom-in-95 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-hairline">
              <h2 className="font-serif text-xl font-bold text-text">Novo Agendamento Rápido</h2>
              <button
                onClick={() => setShowQuickModal(false)}
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

            <form onSubmit={handleCreateQuickBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-2">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  required
                  value={modalCustomer}
                  onChange={(e) => setModalCustomer(e.target.value)}
                  placeholder="Nome do cliente"
                  className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-2">
                  WhatsApp / Telefone
                </label>
                <input
                  type="text"
                  required
                  value={modalPhone}
                  onChange={(e) => setModalPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-2">
                    Barbeiro
                  </label>
                  <select
                    value={modalBarberId}
                    onChange={(e) => setModalBarberId(e.target.value)}
                    className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
                  >
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-2">
                    Horário
                  </label>
                  <select
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
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
                <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-2">
                  Serviço
                </label>
                <select
                  value={modalServiceId}
                  onChange={(e) => setModalServiceId(e.target.value)}
                  className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {formatCurrency(s.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setShowQuickModal(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-text-muted hover:text-text"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-accent hover:bg-accent-hover text-accent-contrast px-6 py-2.5 rounded-full text-xs font-bold shadow-glow disabled:opacity-50"
                >
                  {isSubmitting ? "Agendando..." : "Confirmar Agendamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
