"use client";
import { Expandable } from "@/components/ui/expandable";
import { useAnimatedDialog } from "@/components/ui/use-animated-dialog";
import { AnimatedSelect } from "@/components/ui/animated-select";
import { useEffect, useRef, useState } from "react";
import { Workspace, Metric } from "./shell";
import { PeriodControl, periodFor, type PeriodValue } from "./period";
import { Button } from "@/components/ui/button";
import {
  financeAction,
  saveFinanceAction,
  voidFinanceAction,
} from "@/app/actions/finance-actions";
import { money, localDate, daysIn } from "@/lib/saas2/analytics";
import { brazilMoney, safeCsv, settled, type Entry } from "@/lib/saas3/ledger";
const defaults = {
  type: "expense" as "income" | "expense",
  description: "",
  category: "Outras despesas",
  amount: "",
  date: "",
  method: "Pix",
  status: "settled" as "settled" | "pending",
  notes: "",
  quantity: "",
  unitPrice: "",
  supplier: "",
  booking: "",
};
const currencyInput = (n: number) =>
  n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function Finance3() {
  const [period, setPeriod] = useState<PeriodValue | null>(null),
    [result, setResult] = useState<Awaited<
      ReturnType<typeof financeAction>
    > | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [type, setType] = useState(""),
    [status, setStatus] = useState(""),
    [sort, setSort] = useState("date"),
    [page, setPage] = useState(0),
    [form, setForm] = useState(defaults),
    [editing, setEditing] = useState<Entry | null>(null),
    [mode, setMode] = useState("Movimentação"),
    [error, setError] = useState("");
  const {
    ref: dialog,
    show: showDialog,
    close: closeDialog,
  } = useAnimatedDialog();
  const request = useRef(""),
    revision = useRef(0);
  useEffect(() => setPeriod(periodFor("7")), []);
  async function load() {
    if (!period) return;
    const v = ++revision.current;
    setBusy(true);
    const r = await financeAction({
      start: period.start,
      end: period.end,
      barber: null,
    }).catch(() => ({
      ok: false as const,
      error: "Não foi possível conectar ao livro-caixa.",
    }));
    if (v !== revision.current) return;
    setResult(r);
    setBusy(false);
  }
  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [period]);
  useEffect(() => setPage(0), [search, category, type, status, sort, period]);
  const d = result?.ok ? result : null,
    entries = d?.entries || [],
    paid = entries.filter(settled),
    income = paid
      .filter((e) => e.type === "income")
      .reduce((n, e) => n + Math.round(Number(e.amount) * 100), 0),
    out = paid
      .filter((e) => ["expense", "refund"].includes(e.type))
      .reduce((n, e) => n + Math.round(Number(e.amount) * 100), 0),
    receivable = entries
      .filter((e) => e.entry_status === "pending" && e.type === "income")
      .reduce((n, e) => n + Math.round(Number(e.amount) * 100), 0);
  let filtered = entries.filter(
    (e) =>
      (!search ||
        e.description
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase())) &&
      (!category || (e.category || "Outros") === category) &&
      (!type || e.type === type) &&
      (!status || (e.entry_status || "settled") === status),
  );
  filtered = [...filtered].sort((a, b) =>
    sort === "amount"
      ? Number(b.amount) - Number(a.amount)
      : b.created_at.localeCompare(a.created_at),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 25)),
    shown = filtered.slice(
      Math.min(page, pages - 1) * 25,
      (Math.min(page, pages - 1) + 1) * 25,
    ),
    series = period
      ? daysIn(period.start, period.end).map((date) => ({
          date,
          income: paid
            .filter(
              (e) =>
                localDate(new Date(e.created_at)) === date &&
                e.type === "income",
            )
            .reduce((n, e) => n + Math.round(Number(e.amount) * 100), 0),
          forecast: paid
            .filter(
              (e) =>
                localDate(new Date(e.created_at)) === date &&
                e.type !== "income",
            )
            .reduce((n, e) => n + Math.round(Number(e.amount) * 100), 0),
        }))
      : [];
  function open(kind: string, entry?: Entry) {
    request.current = crypto.randomUUID();
    setMode(kind);
    setError("");
    setEditing(entry || null);
    setForm(
      entry
        ? {
            type: entry.type === "income" ? "income" : "expense",
            description: entry.description,
            category: entry.category || "Outros",
            amount: currencyInput(Number(entry.amount)),
            date: localDate(new Date(entry.created_at)),
            method: entry.payment_label || "Pix",
            status: entry.entry_status === "pending" ? "pending" : "settled",
            notes: String(entry.metadata?.notes || ""),
            quantity: String(entry.metadata?.quantity || ""),
            unitPrice: entry.metadata?.unit_price
              ? currencyInput(Number(entry.metadata.unit_price))
              : "",
            supplier: String(entry.metadata?.supplier || ""),
            booking: "",
          }
        : {
            ...defaults,
            date: localDate(),
            type: kind === "Venda" ? "income" : "expense",
            category:
              kind === "Compra"
                ? "Compra de produtos"
                : kind === "Venda"
                  ? "Venda de produtos"
                  : "Outras despesas",
          },
    );
    showDialog();
  }
  function field<K extends keyof typeof defaults>(
    key: K,
    value: (typeof defaults)[K],
  ) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (
        (key === "quantity" || key === "unitPrice") &&
        next.quantity &&
        next.unitPrice
      ) {
        try {
          next.amount = currencyInput(
            Math.round(
              Number(next.quantity) * brazilMoney(next.unitPrice) * 100,
            ) / 100,
          );
        } catch {}
      }
      return next;
    });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (
      editing &&
      settled(editing) &&
      !window.confirm(
        "Editar este lançamento manual já registrado? A alteração ficará no histórico financeiro.",
      )
    )
      return;
    setBusy(true);
    try {
      const r = await saveFinanceAction({
        request: request.current,
        id: editing?.id || null,
        type: form.type,
        description: form.description,
        category: form.category,
        amount: brazilMoney(form.amount),
        date: form.date,
        method: form.method,
        status: form.status,
        notes: form.notes,
        quantity: form.quantity ? Number(form.quantity) : null,
        unitPrice: form.unitPrice ? brazilMoney(form.unitPrice) : null,
        supplier: form.supplier,
        booking: form.booking || null,
      });
      if (!r.ok) throw Error(r.error);
      setNotice(
        r.data.reused
          ? "Recebimento existente reutilizado. Nenhuma receita adicional foi criada. Confira a data original no livro-caixa."
          : r.data.duplicate
            ? "Esta solicitação já foi registrada. Atualize para editar."
            : "Movimentação salva no livro-caixa.",
      );
      void closeDialog();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  function csv() {
    const rows = [
      [
        "Data",
        "Descrição",
        "Categoria",
        "Tipo",
        "Forma",
        "Valor (R$)",
        "Status",
      ],
      ...filtered.map((e) => [
        new Date(e.created_at).toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
        e.description,
        e.category || "Outros",
        e.type === "income"
          ? "Entrada"
          : e.type === "refund"
            ? "Estorno"
            : "Saída",
        e.payment_label || "Não informado",
        currencyInput(Number(e.amount)),
        e.entry_status || "settled",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\ufeff" + rows.map((r) => r.map(safeCsv).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "auto-stilo-movimentacoes.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Workspace
      title="Financeiro"
      subtitle="Seu livro-caixa, com entradas e saídas no mesmo lugar."
      actions={
        <div className="s3-inline">
          <Button
            variant="secondary"
            disabled={!d?.compatible || busy}
            onClick={() => open("Compra")}
          >
            Registrar compra
          </Button>
          <Button
            variant="secondary"
            disabled={!d?.compatible || busy}
            onClick={() => open("Venda")}
          >
            Registrar venda
          </Button>
          <Button
            disabled={!d?.compatible || busy}
            onClick={() => open("Movimentação")}
          >
            + Nova movimentação
          </Button>
        </div>
      }
    >
      {period && <PeriodControl value={period} onChange={setPeriod} />}
      <div className="s3-kpis">
        <Metric
          label="↗ Entradas recebidas"
          value={d ? money(income) : "—"}
          tip="Somente lançamentos efetivados. Pendências e anulados ficam fora."
        />
        <Metric
          label="↘ Saídas registradas"
          value={d ? money(out) : "—"}
          tip="Despesas e estornos efetivados no período."
        />
        <Metric
          label="Saldo de caixa registrado"
          value={d ? money(income - out) : "—"}
          tip="Entradas menos despesas e estornos registrados. Não é lucro contábil."
        />
        <Metric
          label="A receber registrado"
          value={d?.compatible ? money(receivable) : "Não disponível"}
          tip="Apenas entradas manuais pendentes cadastradas. Não usa a previsão de reservas."
        />
      </div>
      {busy && (
        <p role="status" className="s3-updating">
          Atualizando o livro-caixa…
        </p>
      )}
      {result && !result.ok && (
        <p className="s3-error" role="alert">
          {result.error}
        </p>
      )}
      {d && !d.compatible && (
        <p className="s3-notice" role="status">
          Livro-caixa existente em leitura. Aplique a migration SaaS 3.0 para
          registrar movimentações, categorias e pendências com histórico.
        </p>
      )}
      {notice && (
        <p className="s3-notice" role="status">
          {notice}
        </p>
      )}
      <section className="s3-panel">
        <div className="s3-section-title">
          <div>
            <h2>Movimentações financeiras</h2>
            <p>Um só livro-caixa. Recebimentos conciliados ficam protegidos.</p>
          </div>
          <Button variant="ghost" onClick={csv} disabled={!filtered.length}>
            Exportar CSV
          </Button>
        </div>
        <div className="s3-ledger-tools s3-filters">
          <input
            className="s3-search"
            aria-label="Pesquisar movimentações"
            placeholder="Pesquisar descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <AnimatedSelect
            aria-label="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Todas as categorias</option>
            {[...new Set(entries.map((e) => e.category || "Outros"))]
              .sort()
              .map((c) => (
                <option key={c}>{c}</option>
              ))}
          </AnimatedSelect>
          <AnimatedSelect
            aria-label="Tipo de movimentação"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Entradas e saídas</option>
            <option value="income">Entrada</option>
            <option value="expense">Saída</option>
            <option value="refund">Estorno</option>
          </AnimatedSelect>
          <AnimatedSelect
            aria-label="Status financeiro"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="settled">Pago / recebido</option>
            <option value="pending">Pendente</option>
            <option value="void">Anulado</option>
          </AnimatedSelect>
          <AnimatedSelect
            aria-label="Ordenar movimentações"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="date">Mais recentes</option>
            <option value="amount">Maior valor</option>
          </AnimatedSelect>
        </div>
        <div className="s3-table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Data",
                  "Descrição",
                  "Categoria",
                  "Tipo",
                  "Forma",
                  "Valor",
                  "Status",
                  "Ações",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id}>
                  <td>
                    {new Date(e.created_at).toLocaleDateString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </td>
                  <td>{e.description}</td>
                  <td>{e.category || "Outros"}</td>
                  <td>
                    {e.type === "income"
                      ? "Entrada"
                      : e.type === "refund"
                        ? "Estorno"
                        : "Saída"}
                  </td>
                  <td>{e.payment_label || "Não informado"}</td>
                  <td>
                    {money(Math.round(Number(e.amount) * 100))}
                    {e.entry_status !== "void" && (
                      <span
                        aria-hidden="true"
                        title="Valor em relação ao maior movimento deste filtro"
                        className="s3-amount-bar"
                        style={{
                          width: `${Math.max(2, (Number(e.amount) / Math.max(1, ...filtered.map((x) => Number(x.amount)))) * 96)}px`,
                        }}
                      />
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        "s3-status s3-status-" + (e.entry_status || "settled")
                      }
                    >
                      {e.entry_status === "pending"
                        ? "Pendente"
                        : e.entry_status === "void"
                          ? "Anulado"
                          : e.type === "income"
                            ? "Recebido"
                            : "Pago"}
                    </span>
                  </td>
                  <td>
                    {e.entry_origin === "manual" &&
                    e.entry_status !== "void" &&
                    !e.booking_id &&
                    !e.payment_id ? (
                      <div className="s3-inline">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => open("Editar movimentação", e)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            if (
                              !confirm(
                                "Anular este lançamento manual? O registro e seu histórico serão preservados.",
                              )
                            )
                              return;
                            setBusy(true);
                            const r = await voidFinanceAction(e.id);
                            setNotice(
                              r.ok
                                ? "Lançamento anulado; histórico preservado."
                                : r.error,
                            );
                            await load();
                            setBusy(false);
                          }}
                        >
                          Anular
                        </button>
                      </div>
                    ) : (
                      <small>
                        {e.entry_status === "void"
                          ? "Histórico preservado"
                          : "Conciliado / automático"}
                      </small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d && !shown.length && (
          <div className="s3-empty">
            <h3>Nenhuma movimentação neste filtro.</h3>
            <p>
              Recebimentos de atendimentos aparecem aqui pelo fluxo de
              pagamento. Compras e despesas podem ser registradas pelo botão
              acima.
            </p>
          </div>
        )}
        <div className="s3-ledger-tools s3-note">
          <span>
            {filtered.length} registro(s) · página{" "}
            {Math.min(page, pages - 1) + 1} de {pages}
          </span>
          <div className="s3-inline">
            <Button
              variant="ghost"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="ghost"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </section>
      <p className="s3-note">
        Neste período, suas entradas registradas foram {money(income)} e suas
        saídas foram {money(out)}. Saldo registrado: {money(income - out)}.
        Custos não cadastrados não entram no cálculo. Não há alteração
        automática de estoque.
      </p>
      <dialog
        onCancel={(e) => {
          e.preventDefault();
          void closeDialog();
        }}
        ref={dialog}
        className="s3-dialog"
        aria-labelledby="entry-title"
      >
        <form onSubmit={save}>
          <div className="s3-section-title">
            <h2 id="entry-title">
              {mode === "Editar movimentação"
                ? mode
                : "Registrar " + mode.toLowerCase()}
            </h2>
            <button
              type="button"
              aria-label="Fechar movimentação"
              onClick={() => void closeDialog()}
            >
              ×
            </button>
          </div>
          <div className="s3-form-grid">
            <div className="s3-form-caption">Identificação do lançamento</div>
            <label>
              Tipo
              <AnimatedSelect
                value={form.type}
                onChange={(e) =>
                  field("type", e.target.value as typeof form.type)
                }
              >
                <option value="income">Entrada</option>
                <option value="expense">Saída</option>
              </AnimatedSelect>
            </label>
            <label>
              Status
              <AnimatedSelect
                aria-label="Status"
                value={form.status}
                onChange={(e) =>
                  field("status", e.target.value as typeof form.status)
                }
              >
                <option value="settled">Pago / recebido</option>
                <option value="pending">Pendente</option>
              </AnimatedSelect>
            </label>
            <label className="s3-form-full">
              Descrição
              <input
                value={form.description}
                maxLength={200}
                minLength={2}
                required
                onChange={(e) => field("description", e.target.value)}
                placeholder={
                  mode === "Compra"
                    ? "Ex.: Pomadas para revenda"
                    : "Descreva a movimentação"
                }
              />
            </label>
            <label>
              Categoria
              <input
                value={form.category}
                list="financial-categories"
                minLength={2}
                maxLength={60}
                required
                onChange={(e) => field("category", e.target.value)}
              />
              <datalist id="financial-categories">
                {[
                  "Serviços realizados",
                  "Venda de produtos",
                  "Outras receitas",
                  "Compra de produtos",
                  "Materiais de trabalho",
                  "Aluguel",
                  "Energia",
                  "Água",
                  "Internet",
                  "Manutenção",
                  "Marketing",
                  "Comissões",
                  "Outras despesas",
                  ...entries.map((e) => e.category || "Outros"),
                ]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map((c) => (
                    <option key={c} value={c} />
                  ))}
              </datalist>
            </label>
            <div className="s3-form-caption">Valor e pagamento</div>
            <label>
              Valor total (R$)
              <input
                inputMode="decimal"
                value={form.amount}
                placeholder="0,00"
                required
                onChange={(e) => field("amount", e.target.value)}
              />
            </label>
            <label>
              Data
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => field("date", e.target.value)}
              />
            </label>
            <label>
              Forma de pagamento
              <AnimatedSelect
                value={form.method}
                onChange={(e) => field("method", e.target.value)}
              >
                {[
                  "Pix",
                  "Dinheiro",
                  "Crédito",
                  "Débito",
                  "Transferência",
                  "Outro",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </AnimatedSelect>
            </label>
            {(mode === "Compra" || mode === "Venda" || form.quantity) && (
              <>
                <label>
                  Quantidade (opcional)
                  <input
                    type="number"
                    min="0.001"
                    max="9999"
                    step="0.001"
                    value={form.quantity}
                    onChange={(e) => field("quantity", e.target.value)}
                  />
                </label>
                <label>
                  Valor unitário (R$)
                  <input
                    inputMode="decimal"
                    value={form.unitPrice}
                    onChange={(e) => field("unitPrice", e.target.value)}
                    placeholder="0,00"
                  />
                </label>
              </>
            )}
            {mode === "Compra" && (
              <label className="s3-form-full">
                Fornecedor (opcional)
                <input
                  value={form.supplier}
                  maxLength={120}
                  onChange={(e) => field("supplier", e.target.value)}
                />
              </label>
            )}
            <Expandable className="s3-form-full">
              <summary>Observação e vínculo (opcionais)</summary>
              <div className="s3-form-grid">
                {" "}
                {form.type === "income" && !editing && (
                  <label className="s3-form-full">
                    Vincular recebimento de agendamento
                    <AnimatedSelect
                      value={form.booking}
                      onChange={(e) => {
                        field("booking", e.target.value);
                        const b = d?.bookings.find(
                          (b) => b.id === e.target.value,
                        );
                        if (b) {
                          field(
                            "description",
                            "Recebimento de agendamento existente",
                          );
                          field("category", "Serviços realizados");
                          field("amount", currencyInput(Number(b.total_price)));
                        }
                      }}
                    >
                      <option value="">Sem vínculo · receita manual</option>
                      {d?.bookings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {new Date(b.starts_at).toLocaleString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                          })}{" "}
                          · {money(Math.round(Number(b.total_price) * 100))}
                        </option>
                      ))}
                    </AnimatedSelect>
                    <small>
                      Com vínculo, reutilizamos uma receita conciliada
                      existente. Sem ela, use o fluxo de pagamento; não criamos
                      receita duplicada.
                    </small>
                  </label>
                )}
                <label className="s3-form-full">
                  Observação (opcional)
                  <textarea
                    value={form.notes}
                    maxLength={500}
                    onChange={(e) => field("notes", e.target.value)}
                  />
                </label>
              </div>
            </Expandable>
          </div>
          {error && (
            <p role="alert" className="s3-error">
              {error}
            </p>
          )}
          <div className="s3-inline">
            <Button
              variant="secondary"
              type="button"
              onClick={() => void closeDialog()}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              Salvar movimentação
            </Button>
          </div>
        </form>
      </dialog>
    </Workspace>
  );
}
