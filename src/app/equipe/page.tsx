"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Trash2,
  UserCheck,
  UserX,
  Power,
  CalendarOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
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

export default function EquipePage() {
  const router = useRouter();
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState("Barbearia");
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Fechamento de Hoje / Recessos
  const [isClosedToday, setIsClosedToday] = useState(false);
  const [closedReason, setClosedReason] = useState("");
  const [closedDaysList, setClosedDaysList] = useState<Array<{ id: string; date: string; reason: string | null }>>([]);

  // 2. Barbeiros
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newBarberName, setNewBarberName] = useState("");
  const [newBarberBio, setNewBarberBio] = useState("");
  const [newBarberAvatar, setNewBarberAvatar] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 3. Expediente & Horários
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [isSavingHours, setIsSavingHours] = useState(false);

  // 4. Serviços por Barbeiro
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [barberSelectedServices, setBarberSelectedServices] = useState<string[]>([]);
  const [isSavingServices, setIsSavingServices] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setStatusMsg(null);

    try {
      const supabase = createClient();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();

      if (userErr || !user) {
        router.push("/login");
        return;
      }

      const { data: member, error: memErr } = await supabase
        .from("shop_members")
        .select("barbershop_id, barbershops(name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memErr || !member) {
        router.push("/login");
        return;
      }

      const shopId = (member as any).barbershop_id;
      setBarbershopId(shopId);
      if ((member as any).barbershops?.name) {
        setShopName((member as any).barbershops.name);
      }

      const todayStr = new Date().toISOString().split("T")[0];

      // Buscar closed_days
      const { data: closedData } = await supabase
        .from("closed_days")
        .select("id, date, reason")
        .eq("barbershop_id", shopId)
        .order("date", { ascending: true });

      if (closedData) {
        setClosedDaysList(closedData);
        const closedNow = closedData.some((cd) => cd.date === todayStr);
        setIsClosedToday(closedNow);
      }

      // Buscar barbeiros
      const { data: barbData } = await supabase
        .from("barbers")
        .select("id, name, bio, avatar_url, is_active")
        .eq("barbershop_id", shopId)
        .order("name");

      if (barbData) {
        setBarbers(barbData);
        if (barbData.length > 0 && !selectedBarberId) {
          setSelectedBarberId(barbData[0].id);
        }
      }

      // Buscar serviços
      const { data: srvData } = await supabase
        .from("services")
        .select("id, name, price")
        .eq("barbershop_id", shopId)
        .eq("is_active", true)
        .order("name");

      if (srvData) setAllServices(srvData);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Erro ao carregar dados" });
    } finally {
      setIsLoading(false);
    }
  }, [router, selectedBarberId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Carregar working_hours e serviços quando o barbeiro selecionado muda
  useEffect(() => {
    if (!selectedBarberId) return;

    async function loadBarberDetails() {
      try {
        const supabase = createClient();

        // Working hours
        const { data: whData } = await supabase
          .from("working_hours")
          .select("day_of_week, start_time, end_time, is_off")
          .eq("barber_id", selectedBarberId)
          .order("day_of_week");

        if (whData && whData.length > 0) {
          const map: WorkingHour[] = [];
          for (let i = 0; i < 7; i++) {
            const found = whData.find((w) => w.day_of_week === i);
            if (found) {
              map.push({
                day_of_week: i,
                start_time: found.start_time.slice(0, 5),
                end_time: found.end_time.slice(0, 5),
                is_off: found.is_off,
              });
            } else {
              map.push({
                day_of_week: i,
                start_time: "09:00",
                end_time: "19:00",
                is_off: i === 0, // Domingo folga
              });
            }
          }
          setWorkingHours(map);
        } else {
          // Padrão
          const defaultList = Array.from({ length: 7 }, (_, i) => ({
            day_of_week: i,
            start_time: "09:00",
            end_time: "19:00",
            is_off: i === 0,
          }));
          setWorkingHours(defaultList);
        }

        // Barber services
        const { data: bsData } = await supabase
          .from("barber_services")
          .select("service_id")
          .eq("barber_id", selectedBarberId);

        if (bsData) {
          setBarberSelectedServices(bsData.map((bs) => bs.service_id));
        }
      } catch (err: any) {
        console.error(err);
      }
    }

    loadBarberDetails();
  }, [selectedBarberId]);

  // Handlers
  const handleToggleClosedToday = async () => {
    if (!barbershopId) return;
    const nextState = !isClosedToday;
    setIsLoading(true);

    const res = await toggleShopClosedTodayAction(
      barbershopId,
      nextState,
      new Date().toISOString().split("T")[0],
      closedReason || (nextState ? "Fechado pelo proprietário" : undefined)
    );

    if (res.success) {
      setIsClosedToday(nextState);
      setStatusMsg({
        type: "success",
        text: nextState
          ? "Barbearia marcada como FECHADA para hoje com sucesso. Nenhum cliente conseguirá agendar para hoje."
          : "Barbearia REABERTA para hoje com sucesso!",
      });
      loadData();
    } else {
      setStatusMsg({ type: "error", text: res.error || "Erro ao alterar status de hoje" });
      setIsLoading(false);
    }
  };

  const handleAddBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbershopId || !newBarberName.trim()) return;

    setIsSubmitting(true);
    const res = await createBarberAction(barbershopId, {
      name: newBarberName.trim(),
      bio: newBarberBio.trim() || undefined,
      avatar_url: newBarberAvatar.trim() || undefined,
    });

    if (res.success) {
      setStatusMsg({ type: "success", text: `Barbeiro "${newBarberName}" cadastrado com sucesso!` });
      setNewBarberName("");
      setNewBarberBio("");
      setNewBarberAvatar("");
      setIsAddModalOpen(false);
      loadData();
    } else {
      setStatusMsg({ type: "error", text: res.error || "Erro ao criar barbeiro" });
    }
    setIsSubmitting(false);
  };

  const handleToggleBarberActive = async (barber: Barber) => {
    if (!barbershopId) return;
    const res = await toggleBarberActiveAction(barbershopId, barber.id, barber.is_active);
    if (res.success) {
      setStatusMsg({
        type: "success",
        text: `Barbeiro ${barber.name} ${barber.is_active ? "pausado" : "ativado"} com sucesso.`,
      });
      loadData();
    } else {
      setStatusMsg({ type: "error", text: res.error || "Erro ao atualizar status" });
    }
  };

  const handleDeleteBarber = async (barber: Barber) => {
    if (!confirm(`Deseja realmente excluir o barbeiro ${barber.name}?`)) return;
    if (!barbershopId) return;

    const res = await deleteBarberAction(barbershopId, barber.id);
    if (res.success) {
      setStatusMsg({ type: "success", text: `Barbeiro ${barber.name} excluído.` });
      if (selectedBarberId === barber.id) setSelectedBarberId(null);
      loadData();
    } else {
      setStatusMsg({ type: "error", text: res.error || "Erro ao excluir barbeiro" });
    }
  };

  const handleSaveHours = async () => {
    if (!barbershopId || !selectedBarberId) return;
    setIsSavingHours(true);

    const res = await saveWorkingHoursAction(barbershopId, selectedBarberId, workingHours);
    if (res.success) {
      setStatusMsg({ type: "success", text: "Expediente e horários salvos com sucesso!" });
    } else {
      setStatusMsg({ type: "error", text: res.error || "Erro ao salvar horários" });
    }
    setIsSavingHours(false);
  };

  const handleSaveServices = async () => {
    if (!barbershopId || !selectedBarberId) return;
    setIsSavingServices(true);

    const res = await saveBarberServicesAction(barbershopId, selectedBarberId, barberSelectedServices);
    if (res.success) {
      setStatusMsg({ type: "success", text: "Especialidades do profissional atualizadas com sucesso!" });
    } else {
      setStatusMsg({ type: "error", text: res.error || "Erro ao salvar especialidades" });
    }
    setIsSavingServices(false);
  };

  const toggleServiceCheckbox = (serviceId: string) => {
    if (barberSelectedServices.includes(serviceId)) {
      setBarberSelectedServices(barberSelectedServices.filter((id) => id !== serviceId));
    } else {
      setBarberSelectedServices([...barberSelectedServices, serviceId]);
    }
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/agenda", label: "Agenda", icon: Calendar },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/servicos", label: "Serviços", icon: Scissors },
    { href: "/equipe", label: "Equipe & Horários", icon: Clock, active: true },
    { href: "/financeiro", label: "Financeiro", icon: DollarSign },
    { href: "/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col md:flex-row p-4 md:p-6 gap-6">
      {/* Menu Lateral Arredondado (Trilho / Dock) */}
      <aside className="w-full md:w-64 bg-surface rounded-[32px] p-6 flex flex-col justify-between shadow-soft shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center">
              <Scissors className="w-4 h-4 rotate-45" />
            </div>
            <div>
              <span className="font-serif text-base font-bold text-text block leading-tight">{shopName}</span>
              <span className="text-[10px] text-accent uppercase tracking-wider font-semibold">Painel Dono</span>
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

        <div className="pt-6 border-t border-hairline">
          <button
            onClick={() => logoutAction()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-full text-xs font-bold text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 space-y-6">
        {/* Header Superior */}
        <header className="bg-surface rounded-[28px] px-8 py-5 flex items-center justify-between shadow-soft">
          <div>
            <h1 className="font-serif text-2xl font-bold text-text">Equipe & Expediente</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Gerencie abertura diária, horários de funcionamento, barbeiros e especialidades
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
              <span className="text-[10px] uppercase font-bold tracking-wider text-accent block mb-1">
                Controle Rápido
              </span>
              <h2 className="font-serif text-xl font-bold text-text">Status de Abertura da Barbearia</h2>
              <p className="text-xs text-text-muted mt-1">
                Precisa folgar hoje ou fechar por imprevisto? Clique no botão para bloquear agendamentos no site do cliente.
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
                <span className="text-text-muted text-[11px] block">Status Atual de Hoje</span>
                <strong className={`font-serif text-sm ${isClosedToday ? "text-danger" : "text-emerald-400"}`}>
                  {isClosedToday ? "Fechada para agendamentos hoje" : "Aberta normalmente hoje"}
                </strong>
              </div>
            </div>

            <div className="bg-surface-2 rounded-2xl p-4">
              <span className="text-text-muted text-[11px] block">Data Selecionada</span>
              <strong className="text-text font-mono text-sm">
                {new Date().toLocaleDateString("pt-BR", { dateStyle: "full" })}
              </strong>
            </div>
          </div>
        </section>

        {/* 2. SEÇÃO: BARBEIROS (EQUIPE) */}
        <section className="bg-surface rounded-[32px] p-8 shadow-soft space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-hairline">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-accent block mb-1">Profissionais</span>
              <h2 className="font-serif text-xl font-bold text-text">Equipe de Barbeiros</h2>
            </div>
            <span className="text-xs text-text-muted font-mono">{barbers.length} profissionais</span>
          </div>

          {barbers.length === 0 ? (
            <div className="bg-surface-2 p-8 rounded-2xl text-center text-xs text-text-muted">
              Nenhum barbeiro cadastrado. Clique no botão &quot;Adicionar Barbeiro&quot; acima para cadastrar seu time.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {barbers.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBarberId(b.id)}
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
                        <img src={b.avatar_url} alt={b.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{b.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif font-bold text-sm text-text truncate">{b.name}</h3>
                      <p className="text-[11px] text-text-muted truncate">{b.bio || "Especialista em Cortes"}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-hairline text-xs">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleBarberActive(b);
                      }}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${
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
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. SEÇÃO: EXPEDIENTE & HORÁRIOS DO BARBEIRO SELECIONADO */}
        {selectedBarberId && (
          <section className="bg-surface rounded-[32px] p-8 shadow-soft space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-hairline">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-accent block mb-1">
                  Horários de Trabalho
                </span>
                <h2 className="font-serif text-xl font-bold text-text">
                  Expediente de {barbers.find((b) => b.id === selectedBarberId)?.name}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Configure a hora que o profissional entra, sai e quais dias ele folga
                </p>
              </div>

              <button
                onClick={handleSaveHours}
                disabled={isSavingHours}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-contrast px-6 py-2.5 rounded-full font-bold text-xs shadow-glow transition-all active:scale-95 disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{isSavingHours ? "Salvando..." : "Salvar Horários"}</span>
              </button>
            </div>

            <div className="space-y-2">
              {workingHours.map((wh, idx) => (
                <div
                  key={wh.day_of_week}
                  className="bg-surface-2 px-6 py-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                >
                  <div className="w-36 font-semibold text-text">
                    {DAYS_NAMES[wh.day_of_week]}
                  </div>

                  <div className="flex items-center gap-6">
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
                      <span className={wh.is_off ? "text-danger font-semibold" : "text-text-muted"}>
                        {wh.is_off ? "Dia de Folga" : "Dia de Trabalho"}
                      </span>
                    </label>

                    {!wh.is_off && (
                      <div className="flex items-center gap-2">
                        <span className="text-text-muted text-[11px]">Entrada:</span>
                        <input
                          type="time"
                          value={wh.start_time}
                          onChange={(e) => {
                            const updated = [...workingHours];
                            updated[idx].start_time = e.target.value;
                            setWorkingHours(updated);
                          }}
                          className="bg-surface rounded-full px-3 py-1 text-xs text-text focus:ring-1 focus:ring-accent focus:outline-none"
                        />
                        <span className="text-text-muted text-[11px]">Saída:</span>
                        <input
                          type="time"
                          value={wh.end_time}
                          onChange={(e) => {
                            const updated = [...workingHours];
                            updated[idx].end_time = e.target.value;
                            setWorkingHours(updated);
                          }}
                          className="bg-surface rounded-full px-3 py-1 text-xs text-text focus:ring-1 focus:ring-accent focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 4. SEÇÃO: SERVIÇOS QUE O BARBEIRO FAZ (ESPECIALIDADES) */}
        {selectedBarberId && (
          <section className="bg-surface rounded-[32px] p-8 shadow-soft space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-hairline">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-accent block mb-1">
                  Especialidades
                </span>
                <h2 className="font-serif text-xl font-bold text-text">
                  Serviços Realizados por {barbers.find((b) => b.id === selectedBarberId)?.name}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Marque apenas os procedimentos que este barbeiro está apto a realizar
                </p>
              </div>

              <button
                onClick={handleSaveServices}
                disabled={isSavingServices}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-contrast px-6 py-2.5 rounded-full font-bold text-xs shadow-glow transition-all active:scale-95 disabled:opacity-50"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>{isSavingServices ? "Salvando..." : "Salvar Especialidades"}</span>
              </button>
            </div>

            {allServices.length === 0 ? (
              <div className="bg-surface-2 p-6 rounded-2xl text-xs text-text-muted text-center">
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
                      className={`p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all border ${
                        isChecked
                          ? "bg-accent-soft border-accent/40 text-text"
                          : "bg-surface-2 border-hairline text-text-muted hover:text-text"
                      }`}
                    >
                      <div className="text-xs font-semibold">{srv.name}</div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleServiceCheckbox(srv.id)}
                        className="rounded accent-accent pointer-events-none"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* MODAL: ADICIONAR BARBEIRO */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-[32px] max-w-md w-full p-8 shadow-soft animate-in zoom-in-95 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-hairline">
              <h2 className="font-serif text-xl font-bold text-text">Novo Barbeiro</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-2 text-text-muted hover:text-text flex items-center justify-center"
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
                  className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
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
                  className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
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
                  className="w-full bg-surface-2 rounded-full px-5 py-3 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none"
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
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-accent hover:bg-accent-hover text-accent-contrast px-6 py-2.5 rounded-full text-xs font-bold shadow-glow disabled:opacity-50"
                >
                  {isSubmitting ? "Salvando..." : "Cadastrar Barbeiro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
