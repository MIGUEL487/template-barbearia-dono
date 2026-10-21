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
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

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

      const shopId = member.barbershop_id;

      // Buscar clientes e seus bookings
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
            (b: any) => b.status === "completed"
          );
          const totalSpent = completedBookings.reduce(
            (acc: number, b: any) => acc + Number(b.total_price || 0),
            0
          );
          const sortedBookings = [...(c.bookings || [])].sort(
            (a: any, b: any) =>
              new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
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
      setErrorMsg(err.message || "Erro ao carregar lista de clientes.");
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
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      {/* Header */}
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
          <h1 className="font-serif text-lg font-bold text-text">Gestão de Clientes & CRM</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-surface-2 border border-border pl-9 pr-4 py-1.5 text-xs rounded-sm focus:border-accent focus:outline-none w-64"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {errorMsg && (
          <div className="bg-status-danger/10 border border-status-danger/30 rounded-sm p-4 text-xs text-status-danger mb-6">
            {errorMsg}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
            <p className="text-sm">Carregando carteira de clientes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface border border-border p-12 text-center rounded-sm">
            <p className="text-sm text-text-muted mb-2">Nenhum cliente encontrado.</p>
            <p className="text-xs text-text-muted">
              Novos clientes aparecem aqui automaticamente a cada agendamento.
            </p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-text-muted uppercase text-[10px] font-bold tracking-wider">
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Contato</th>
                    <th className="p-4 text-center">Visitas</th>
                    <th className="p-4 text-right">Total Investido</th>
                    <th className="p-4">Último Atendimento</th>
                    <th className="p-4">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-2/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-text text-sm">{c.name}</div>
                            <div className="text-[11px] text-text-muted">
                              Cliente desde {new Date(c.created_at).toLocaleDateString("pt-BR")}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-1.5 text-text font-mono">
                          <Phone className="w-3.5 h-3.5 text-accent shrink-0" />
                          <span>{c.phone}</span>
                        </div>
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            <span>{c.email}</span>
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded bg-surface-2 border border-border font-bold text-accent">
                          {c.visits_count} {c.visits_count === 1 ? "visita" : "visitas"}
                        </span>
                      </td>

                      <td className="p-4 text-right font-mono font-bold text-text text-sm">
                        {formatCurrency(c.total_spent)}
                      </td>

                      <td className="p-4 text-text-muted">
                        {c.last_visit ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-accent" />
                            <span>{new Date(c.last_visit).toLocaleDateString("pt-BR")}</span>
                          </div>
                        ) : (
                          <span className="text-text-muted/60">Sem visitas concluídas</span>
                        )}
                      </td>

                      <td className="p-4 text-text-muted max-w-xs truncate">
                        {c.notes || <span className="text-text-muted/40 italic">Sem notas</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
