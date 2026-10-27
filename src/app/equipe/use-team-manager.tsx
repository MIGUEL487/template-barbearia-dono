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

export function useTeamManager() {
  const router = useRouter();
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState("Barbearia");
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 1. Fechamento de Hoje / Recessos
  const [isClosedToday, setIsClosedToday] = useState(false);
  const [closedReason, setClosedReason] = useState("");
  const [closedDaysList, setClosedDaysList] = useState<
    Array<{ id: string; date: string; reason: string | null }>
  >([]);

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
  const [barberSelectedServices, setBarberSelectedServices] = useState<
    string[]
  >([]);
  const [isSavingServices, setIsSavingServices] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setStatusMsg(null);

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
        const cleaned = barbData.map((b) => ({
          ...b,
          name: fixMojibake(b.name),
          bio: b.bio ? fixMojibake(b.bio) : null,
        }));
        setBarbers(cleaned);
        if (cleaned.length > 0 && !selectedBarberId) {
          setSelectedBarberId(cleaned[0].id);
        }
      }

      // Buscar serviços
      const { data: srvData } = await supabase
        .from("services")
        .select("id, name, price")
        .eq("barbershop_id", shopId)
        .eq("is_active", true)
        .order("name");

      if (srvData) {
        setAllServices(
          srvData.map((s) => ({
            ...s,
            name: fixMojibake(s.name),
          })),
        );
      }
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err.message || "Erro ao carregar dados",
      });
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

        // Working hours (incluindo horário de almoço)
        const { data: whData } = await supabase
          .from("working_hours")
          .select(
            "day_of_week, start_time, end_time, is_off, lunch_start, lunch_end",
          )
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
                lunch_start: found.lunch_start
                  ? found.lunch_start.slice(0, 5)
                  : "12:00",
                lunch_end: found.lunch_end
                  ? found.lunch_end.slice(0, 5)
                  : "13:00",
              });
            } else {
              map.push({
                day_of_week: i,
                start_time: "09:00",
                end_time: "19:00",
                is_off: i === 0, // Domingo folga
                lunch_start: "12:00",
                lunch_end: "13:00",
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
            lunch_start: "12:00",
            lunch_end: "13:00",
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
      closedReason || (nextState ? "Fechado pelo proprietário" : undefined),
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
      setStatusMsg({
        type: "error",
        text: res.error || "Erro ao alterar status de hoje",
      });
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
      setStatusMsg({
        type: "success",
        text: `Barbeiro "${newBarberName}" cadastrado com sucesso!`,
      });
      setNewBarberName("");
      setNewBarberBio("");
      setNewBarberAvatar("");
      setIsAddModalOpen(false);
      loadData();
    } else {
      setStatusMsg({
        type: "error",
        text: res.error || "Erro ao criar barbeiro",
      });
    }
    setIsSubmitting(false);
  };

  const handleToggleBarberActive = async (barber: Barber) => {
    if (!barbershopId) return;
    const res = await toggleBarberActiveAction(
      barbershopId,
      barber.id,
      barber.is_active,
    );
    if (res.success) {
      setStatusMsg({
        type: "success",
        text: `Barbeiro ${barber.name} ${barber.is_active ? "pausado" : "ativado"} com sucesso.`,
      });
      loadData();
    } else {
      setStatusMsg({
        type: "error",
        text: res.error || "Erro ao atualizar status",
      });
    }
  };

  const handleDeleteBarber = async (barber: Barber) => {
    if (!confirm(`Deseja realmente excluir o barbeiro ${barber.name}?`)) return;
    if (!barbershopId) return;

    const res = await deleteBarberAction(barbershopId, barber.id);
    if (res.success) {
      setStatusMsg({
        type: "success",
        text: `Barbeiro ${barber.name} excluído.`,
      });
      if (selectedBarberId === barber.id) setSelectedBarberId(null);
      loadData();
    } else {
      setStatusMsg({
        type: "error",
        text: res.error || "Erro ao excluir barbeiro",
      });
    }
  };

  const handleSaveHours = async () => {
    if (!barbershopId || !selectedBarberId) return;
    setIsSavingHours(true);

    const res = await saveWorkingHoursAction(
      barbershopId,
      selectedBarberId,
      workingHours,
    );
    if (res.success) {
      setStatusMsg({
        type: "success",
        text: "Expediente e horários salvos com sucesso!",
      });
    } else {
      setStatusMsg({
        type: "error",
        text: res.error || "Erro ao salvar horários",
      });
    }
    setIsSavingHours(false);
  };

  const handleSaveServices = async () => {
    if (!barbershopId || !selectedBarberId) return;
    setIsSavingServices(true);

    const res = await saveBarberServicesAction(
      barbershopId,
      selectedBarberId,
      barberSelectedServices,
    );
    if (res.success) {
      setStatusMsg({
        type: "success",
        text: "Especialidades do profissional atualizadas com sucesso!",
      });
    } else {
      setStatusMsg({
        type: "error",
        text: res.error || "Erro ao salvar especialidades",
      });
    }
    setIsSavingServices(false);
  };

  const toggleServiceCheckbox = (serviceId: string) => {
    if (barberSelectedServices.includes(serviceId)) {
      setBarberSelectedServices(
        barberSelectedServices.filter((id) => id !== serviceId),
      );
    } else {
      setBarberSelectedServices([...barberSelectedServices, serviceId]);
    }
  };

  return {
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
  };
}
