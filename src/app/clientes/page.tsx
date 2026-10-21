"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Scissors,
  Users,
  Search,
  ChevronLeft,
  Calendar,
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
import { formatCurrency } from "@/lib/utils";
import { logoutAction } from "@/app/actions/admin-actions";

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
            name: c.name,
            phone: c.phone,
            email: c.email,
            notes: c.notes,
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
    { href: "/clientes", label: "Clientes", icon: Users, active: true },
    { href: "/servicos", label: "Serviços", icon: Scissors },
    { href: "/financeiro", label: "Financeiro", icon: DollarSign },
    { href: "/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col md:flex-row p-4 md:p-6 gap-6">
      <aside className="w-full md:w-64 bg-surface rounded-[32px] p-6 shadow-soft flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center">
              <Scissors className="w-4 h-4 rotate-45" />
            </div>
            <div>
              <h2 className="font-serif text-base font-bold text-text truncate max-w-[140px]">Clientes</h2>
              <span className="text-[10px] text-accent uppercase tracking-wider font-bold">Gestão & CRM</span>
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

      <main className="flex-1 space-y-6">
        <header className="bg-surface rounded-full px-6 py-3 flex items-center justify-between shadow-soft">
          <h1 className="font-serif text-lg font-bold text-text">Carteira de Clientes</h1>

          <div className="relative">
            <Search className="w-4 h-4 text-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-surface-2 rounded-full pl-10 pr-5 py-2 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none w-64 md:w-80"
            />
          </div>
        </header>

        {errorMsg && (
          <div className="p-4 rounded-[20px] bg-danger/10 text-danger text-xs">
            {errorMsg}
          </div>
        )}

        <div className="bg-surface rounded-[32px] p-8 shadow-soft">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-text-muted">
              <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
              <p className="text-sm">Carregando carteira de clientes...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-xs text-text-muted">
              Nenhum cliente localizado na pesquisa.
            </div>
          ) : (
            <div className="space-y-3">
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
                      <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                        <span className="font-mono">{c.phone}</span>
                        {c.email && <span>· {c.email}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-hairline">
                    <span className="px-3.5 py-1.5 rounded-full bg-surface text-accent text-xs font-bold">
                      {c.visits_count} {c.visits_count === 1 ? "visita" : "visitas"}
                    </span>
                    <div className="text-right">
                      <span className="text-[10px] text-text-muted block">Investido</span>
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
