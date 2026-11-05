"use client";
import {currentMembership} from "@/lib/browser-shop";

import { AdminSkeleton } from "@/components/admin/skeleton";
import { AdminNavigation } from "@/components/admin/navigation";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  UserCheck,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency, fixMojibake } from "@/lib/utils";
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
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        router.push("/login");
        return;
      }

      const {data:member,error:memErr}=await currentMembership(supabase,user.id,"barbershop_id");

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
          const completedBookings = (c.bookings || []).filter(
            (b: any) => b.status === "completed",
          );
          const totalSpent = completedBookings.reduce(
            (sum: number, b: any) => sum + Number(b.total_price),
            0,
          );
          const lastBooking = (c.bookings || [])
            .sort(
              (a: any, b: any) =>
                new Date(b.starts_at).getTime() -
                new Date(a.starts_at).getTime(),
            )[0];

          return {
            id: c.id,
            name: fixMojibake(c.name) || "Sem nome",
            phone: c.phone || "Sem telefone",
            email: c.email || null,
            notes: c.notes ? fixMojibake(c.notes) : null,
            created_at: c.created_at,
            visits_count: completedBookings.length,
            total_spent: totalSpent,
            last_visit: lastBooking ? lastBooking.starts_at : null,
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

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const totalSpentAll = customers.reduce((sum, c) => sum + c.total_spent, 0);
  const repeatClients = customers.filter((c) => c.visits_count > 1).length;

  return (
    <div className="admin-page min-h-screen bg-bg text-text flex flex-col lg:flex-row p-4 lg:p-6 gap-6">
      <AdminNavigation />

      <main className="admin-content flex-1 space-y-6">
        {/* Header Bar */}
        <header className="bg-surface border border-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-soft">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-text">
                Carteira de Clientes
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-2 text-text-muted border border-hairline">
                {customers.length} clientes
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Histórico de visitas, contatos e faturamento por cliente
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl pl-10 pr-4 py-2 text-xs text-text focus:border-accent focus:outline-none transition-all placeholder:text-text-muted/50"
            />
          </div>
        </header>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-xl p-4 shadow-soft">
            <span className="text-xs text-text-muted">Clientes Cadastrados</span>
            <div className="text-2xl font-bold text-text mt-1">{customers.length}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 shadow-soft">
            <span className="text-xs text-text-muted">Clientes Recorrentes</span>
            <div className="text-2xl font-bold text-accent-light mt-1">{repeatClients}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 shadow-soft">
            <span className="text-xs text-text-muted">Faturamento Total Gerado</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {formatCurrency(totalSpentAll)}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs">
            {errorMsg}
          </div>
        )}

        {/* Customers List Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-hairline">
            <h2 className="text-base font-bold text-text">Lista de Contatos</h2>
            <span className="text-xs text-text-muted font-mono">
              Exibindo {filtered.length} de {customers.length}
            </span>
          </div>

          {isLoading ? (
            <AdminSkeleton />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-hairline text-text-muted mx-auto flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-xs text-text-muted">
                Nenhum cliente localizado na pesquisa.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((c, idx) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="bg-surface-2 hover:bg-surface-3/70 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all border border-hairline/60 hover:border-hairline"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-accent-soft text-accent-light border border-accent/20 flex items-center justify-center font-bold text-sm shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-text text-sm">{c.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-text-muted mt-1 flex-wrap">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-text-muted/70" />
                          {c.phone}
                        </span>
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-text-muted/70" />
                            {c.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-hairline/60">
                    <span className="px-3 py-1 rounded-full bg-surface text-accent-light text-xs font-semibold border border-hairline">
                      {c.visits_count} {c.visits_count === 1 ? "visita" : "visitas"}
                    </span>
                    <div className="text-right min-w-[90px]">
                      <span className="text-[11px] text-text-muted block">Investimento</span>
                      <strong className="font-bold text-sm text-emerald-400">
                        {formatCurrency(c.total_spent)}
                      </strong>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
