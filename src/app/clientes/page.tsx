"use client";
import { Metric } from "@/components/saas3/shell";
import { DialogPanel } from "@/components/ui/dialog-panel";
import { Button } from "@/components/ui/button";
import { currentMembership } from "@/lib/browser-shop";

import { AdminSkeleton } from "@/components/admin/skeleton";
import { ManagementLayout } from "@/components/admin/management-layout";
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
  history: {
    id: string;
    starts_at: string;
    status: string;
    total_price: number;
  }[];
}

export default function ClientesPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerRecord | null>(null);
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

      const { data: member, error: memErr } = await currentMembership(
        supabase,
        user.id,
        "barbershop_id",
      );

      if (memErr || !member) {
        setErrorMsg("Acesso não autorizado.");
        setIsLoading(false);
        return;
      }

      const shopId = (member as any).barbershop_id;

      const { data: custData, error: custErr } = await supabase
        .from("customers")
        .select(
          `
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
        `,
        )
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
          const lastBooking = (c.bookings || []).sort(
            (a: any, b: any) =>
              new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
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
            history: c.bookings || [],
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
    <ManagementLayout
      title="Clientes"
      subtitle="Relacionamento, histórico e informações da sua carteira."
      actions={
        <>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Buscar clientes"
              placeholder="Buscar por nome, telefone ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl pl-10 pr-4 py-2 text-xs text-text focus:border-accent focus:outline-none transition-all placeholder:text-text-muted/50"
            />
          </div>
        </>
      }
    >
      <div className="s3-kpis mg-kpis-three">
        <Metric
          label="Clientes cadastrados"
          value={isLoading || errorMsg ? "—" : String(customers.length)}
          tip="Contatos da barbearia autorizada."
        />
        <Metric
          label="Clientes recorrentes"
          value={isLoading || errorMsg ? "—" : String(repeatClients)}
          tip="Clientes com mais de um atendimento concluído."
        />
        <Metric
          label="Serviços concluídos"
          value={isLoading || errorMsg ? "—" : formatCurrency(totalSpentAll)}
          tip="Soma do preço dos serviços concluídos por estes clientes; não é saldo de caixa."
        />
      </div>
      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs"
        >
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
          <div className="s3-table-wrap">
            <table className="mg-data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Visitas</th>
                  <th>Serviços concluídos</th>
                  <th>Último atendimento</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="mg-person">
                        <span className="mg-avatar">
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                        <strong>{c.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span>{c.phone}</span>
                      {c.email && (
                        <small className="mg-cell-detail">{c.email}</small>
                      )}
                    </td>
                    <td>
                      <span className="mg-status">
                        {c.visits_count} visitas
                      </span>
                    </td>
                    <td>{formatCurrency(c.total_spent)}</td>
                    <td>
                      {c.last_visit
                        ? new Date(c.last_visit).toLocaleDateString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                          })
                        : "Sem atendimento"}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedCustomer(c)}
                      >
                        Ver perfil
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DialogPanel
        open={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        titleId="customer-profile-title"
        className="mg-profile-dialog"
      >
        <div className="mg-section-heading">
          <div>
            <p className="mg-overline">Perfil do cliente</p>
            <h2 id="customer-profile-title">
              {selectedCustomer?.name || "Cliente"}
            </h2>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedCustomer(null)}
          >
            Fechar perfil
          </Button>
        </div>
        {selectedCustomer && (
          <>
            <dl className="mg-profile-fields">
              <div>
                <dt>Telefone</dt>
                <dd>{selectedCustomer.phone}</dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>{selectedCustomer.email || "Não informado"}</dd>
              </div>
              <div>
                <dt>Visitas concluídas</dt>
                <dd>{selectedCustomer.visits_count}</dd>
              </div>
              <div>
                <dt>Serviços concluídos</dt>
                <dd>{formatCurrency(selectedCustomer.total_spent)}</dd>
              </div>
            </dl>
            {selectedCustomer.notes && (
              <section className="mg-panel">
                <h3>Observações</h3>
                <p>{selectedCustomer.notes}</p>
              </section>
            )}
            <section>
              <h3>Histórico de atendimentos</h3>
              {selectedCustomer.history.length ? (
                <div className="s3-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Status</th>
                        <th>Valor dos serviços</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCustomer.history.map((b) => (
                        <tr key={b.id}>
                          <td>
                            {new Date(b.starts_at).toLocaleString("pt-BR", {
                              timeZone: "America/Sao_Paulo",
                            })}
                          </td>
                          <td>{b.status}</td>
                          <td>{formatCurrency(Number(b.total_price))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="s3-note">
                  Nenhum atendimento registrado para este contato.
                </p>
              )}
            </section>
          </>
        )}
      </DialogPanel>
    </ManagementLayout>
  );
}
