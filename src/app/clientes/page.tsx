"use client";

import {AdminSkeleton} from "@/components/admin/skeleton";
import {AdminNavigation} from "@/components/admin/navigation";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Scissors,
  Users,
  Search,
  ChevronLeft,
  Calendar,
  Clock,
  DollarSign,
  ShieldCheck,
  Phone,
  Mail,
  UserCheck,
  Loader2,
  FileText,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency, fixMojibake } from "@/lib/utils";
import { logoutAction } from "@/app/actions/admin-actions";
import { motion } from "motion/react";

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
  visits_count: number;
  total_spent: number;
  last_visit: string | null;
}

export default function ClientesPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);

  const loadCustomers = useCallback(async () => {
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

      const { data: custData, error: custErr } = await supabase
        .from("customers")
        .select(`
          id,
          name,
          phone,
          email,
          notes,
          created_at,
          bookings (
            id,
            starts_at,
            status,
            total_price
          )
        `)
        .eq("barbershop_id", shopId)
        .order("name");

      if (custErr) {
        setErrorMsg(custErr.message);
      } else if (custData) {
        const mapped: CustomerRecord[] = custData.map((c: any) => {
          const completedBookings = (c.bookings || []).filter((b: any) => b.status === "completed");
          const totalSpent = completedBookings.reduce((acc: number, b: any) => acc + Number(b.total_price || 0), 0);
          const sortedBookings = [...(c.bookings || [])].sort(
            (a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
          );
          const lastVisit = sortedBookings.length > 0 ? sortedBookings[0].starts_at : null;

          return {
            id: c.id,
            name: fixMojibake(c.name),
            phone: c.phone,
            email: c.email,
            notes: c.notes ? fixMojibake(c.notes) : null,
            created_at: c.created_at,
            visits_count: completedBookings.length,
            total_spent: totalSpent,
            last_visit: lastVisit,
          };
        });
        setCustomers(mapped);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao carregar clientes.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/agenda", label: "Agenda", icon: Calendar },
    { href: "/equipe", label: "Equipe & Horários", icon: Clock },
    { href: "/clientes", label: "Clientes", icon: Users, active: true },
    { href: "/servicos", label: "Serviços", icon: Scissors },
    { href: "/financeiro", label: "Financeiro", icon: DollarSign },
    { href: "/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="admin-page min-h-screen bg-bg text-text flex flex-col md:flex-row p-4 md:p-6 gap-6">
      <AdminNavigation />

      <main className="admin-content flex-1 space-y-6">
        <header className="bg-surface rounded-full px-6 py-4 flex items-center justify-between shadow-soft">
          <h1 className="font-serif text-lg font-bold text-text">Carteira de Clientes</h1>

          <div className="relative">
            <Search className="w-4 h-4 text-text-muted absolute left-4 top-2/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-surface-2 rounded-full pl-10 pr-6 py-2 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none w-64 md:w-80"
            />
          </div>
        </header>

        {errorMsg && (
          <div className="p-4 rounded-[20px] bg-danger/10 text-danger text-xs">
            {errorMsg}
          </div>
        )}

        <div className="bg-surface rounded-[32px] p-8 shadow-soft">
          {isLoading ? (<AdminSkeleton/>
) : filtered.length === 0 ? (
            <div className="text-center py-12 text-xs text-text-muted">
              Nenhum cliente localizado na pesquisa.
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="bg-surface-2 hover:bg-surface-3/60 rounded-2xl md:rounded-full px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center font-bold font-serif text-sm shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-text text-sm">{c.name}</h3>
                      <div className="flex items-center gap-4 text-xs text-text-muted mt-2">
                        <span className="font-mono">{c.phone}</span>
                        {c.email && <span>· {c.email}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-hairline">
                    <span className="px-4 py-2 rounded-full bg-surface text-accent text-xs font-bold">
                      {c.visits_count} {c.visits_count === 1 ? "visita" : "visitas"}
                    </span>
                    <div className="text-right">
                      <span className="text-xs text-text-muted block">Investido</span>
                      <strong className="font-serif font-bold text-sm text-text">
                        {formatCurrency(c.total_spent)}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
