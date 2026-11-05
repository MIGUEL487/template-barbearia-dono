"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Workspace } from "./shell";
import { Button } from "@/components/ui/button";
import { LineChart } from "./line-chart";
import {
  chatStateAction,
  createConversationAction,
  manageConversationAction,
  askRaioXAction,
  ensureOperationalReportsAction,
  type ChatPayload,
} from "@/app/actions/chat-actions";
import { money, localDate } from "@/lib/saas2/analytics";
import { saveGoalAction } from "@/app/actions/intelligence-actions";
import Link from "next/link";
interface Message {
  id: string;
  role: string;
  content: string;
  payload: Partial<ChatPayload>;
  created_at?: string;
}
function RichAnswer({ payload: p }: { payload: Partial<ChatPayload> }) {
  if (!Number.isFinite(p.income) || !Number.isFinite(p.forecast)) return null;
  return (
    <>
      <div className="s3-message-metrics">
        <span>
          <strong>{money(p.income!)}</strong>recebido
        </span>
        <span>
          <strong>{money(p.forecast!)}</strong>valor programado
        </span>
        <span>
          <strong>{p.bookings}</strong>reservas válidas
        </span>
        {p.scope === "finance" && (
          <>
            <span>
              <strong>{money(p.expenses || 0)}</strong>despesas
            </span>
            <span>
              <strong>{money(p.balance || 0)}</strong>saldo registrado
            </span>
          </>
        )}
        {p.scope === "goal" && (
          <span>
            <strong>
              {p.goal === null ? "Não definida" : money(p.goal || 0)}
            </strong>
            meta do período
          </span>
        )}
      </div>
      {p.scope === "finance" &&
        Array.isArray(p.daily) &&
        p.daily.length > 1 && <LineChart rows={p.daily} />}{" "}
      {p.scope === "availability" && (
        <div className="s3-shortcuts mt-4">
          {p.slots?.slice(0, 40).map((s, i) => (
            <span className="s3-status" key={s + i}>
              {s}
            </span>
          ))}
          {p.slotError && <small>{p.slotError}</small>}
        </div>
      )}
      {p.scope === "services" && p.services?.length && (
        <div className="s3-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Itens</th>
                <th>Valor de serviços</th>
              </tr>
            </thead>
            <tbody>
              {p.services.map((s, i) => (
                <tr key={s.name + i}>
                  <td>{s.name}</td>
                  <td>{s.count}</td>
                  <td>{money(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {p.scope === "retention" &&
        p.retention?.map((r) => (
          <p key={r.label}>
            {r.label}: {r.count}
          </p>
        ))}
    </>
  );
}
export function Chat3() {
  const [state, setState] = useState<Awaited<
      ReturnType<typeof chatStateAction>
    > | null>(null),
    [thread, setThread] = useState<string | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [reportView, setReportView] = useState(false),
    [goal, setGoal] = useState("");
  const end = useRef<HTMLDivElement>(null),
    reduced = useReducedMotion(),
    revision = useRef(0);
  async function load(id = thread) {
    const v = ++revision.current;
    let result: Awaited<ReturnType<typeof chatStateAction>>;
    try {
      result = await chatStateAction(id || undefined);
    } catch {
      result = {
        ok: false,
        error: "Não foi possível conectar ao histórico. Tente novamente.",
      };
    }
    if (v !== revision.current) return;
    setState(result);
    if (result.ok && id) setMessages(result.messages as Message[]);
  }
  useEffect(() => {
    let alive = true;
    void ensureOperationalReportsAction()
      .catch(() => {
        if (alive)
          setNotice("Não foi possível verificar relatórios nesta abertura.");
      })
      .then(() => {
        if (alive) void load(null);
      });
    return () => {
      alive = false;
    }; /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);
  const s = state?.ok ? state : null;
  async function send(question = input) {
    if (busy || !s || !question.trim()) return;
    setBusy(true);
    setNotice("");
    let id = thread;
    try {
      if (s?.compatible && !id) {
        const created = await createConversationAction(
          question.trim().slice(0, 80),
        );
        if (!created.ok) throw Error(created.error);
        id = created.id;
        setThread(id);
      }
      const request = crypto.randomUUID();
      setInput("");
      setReportView(false);
      setMessages((prev) => [
        ...prev,
        { id: request + "-u", role: "user", content: question, payload: {} },
      ]);
      const result = await askRaioXAction({
        question,
        conversation: id,
        request,
      });
      if (!result.ok) throw Error(result.error);
      setMessages((prev) => [
        ...prev,
        {
          id: request + "-a",
          role: "assistant",
          content: result.text,
          payload: result.payload,
        },
      ]);
      if (id) await load(id);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível responder.");
    } finally {
      setBusy(false);
      setTimeout(
        () =>
          end.current?.scrollIntoView({
            behavior: reduced ? "auto" : "smooth",
            block: "nearest",
          }),
        100,
      );
    }
  }
  return (
    <Workspace
      title="Raio-X"
      subtitle="Seu assistente inteligente de gestão."
      actions={
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setThread(null);
            setMessages([]);
            setInput("");
            setNotice("");
            setReportView(false);
          }}
        >
          + Nova conversa
        </Button>
      }
    >
      <div className="s3-chat-layout">
        <aside className="s3-history" aria-label="Histórico do Raio-X">
          <h2>Sua inteligência</h2>
          <button
            type="button"
            aria-current={reportView ? "true" : undefined}
            onClick={() => setReportView(!reportView)}
          >
            ◷ Relatórios do expediente
          </button>
          <details open>
            <summary className="text-xs text-text-muted p-2">
              Conversas recentes
            </summary>
            <div className="s3-thread-list">
              {s?.threads.map((t) => (
                <button
                  className="block w-full"
                  disabled={busy}
                  key={t.id}
                  aria-current={thread === t.id ? "true" : undefined}
                  onClick={async () => {
                    setBusy(true);
                    setThread(t.id);
                    setReportView(false);
                    try {
                      await load(t.id);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t.title}
                </button>
              ))}
            </div>
            {s && !s.threads.length && (
              <p className="text-xs text-text-muted p-2">
                Suas conversas aparecerão aqui.
              </p>
            )}
          </details>
          <details>
            <summary className="text-xs text-text-muted p-2">
              Meta e opções
            </summary>
            <label className="text-xs block p-2">
              Meta de hoje (R$)
              <input
                className="w-full"
                type="number"
                min="0"
                step="0.01"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </label>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                const result = await saveGoalAction(
                  localDate(),
                  goal.trim() ? Number(goal) : NaN,
                );
                setNotice(result.ok ? "Meta salva para hoje." : result.error);
              }}
            >
              Salvar meta
            </Button>
            {thread && (
              <>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={async () => {
                    const title = prompt("Novo nome da conversa:");
                    if (!title) return;
                    const r = await manageConversationAction(thread, title);
                    setNotice(r.ok ? "Conversa renomeada." : r.error);
                    await load(thread);
                  }}
                >
                  Renomear conversa
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !confirm(
                        "Excluir esta conversa e suas mensagens? Relatórios da loja serão preservados.",
                      )
                    )
                      return;
                    const r = await manageConversationAction(thread, null);
                    if (r.ok) {
                      setThread(null);
                      setMessages([]);
                      await load(null);
                    }
                    setNotice(r.ok ? "Conversa excluída." : r.error);
                  }}
                >
                  Excluir conversa
                </Button>
              </>
            )}
            <Link
              className="block text-xs p-2 text-accent-light"
              href="/analises"
            >
              Abrir Análises →
            </Link>
          </details>
        </aside>
        <section className="s3-conversation" aria-label="Conversa com Raio-X">
          {state && !state.ok && (
            <p role="alert" className="s3-error">
              {state.error}
            </p>
          )}
          {s && !s.compatible && (
            <p className="s3-notice" role="status">
              Histórico aguardando a migration SaaS 3.0. Você pode consultar uma
              prévia calculada; mensagens não serão salvas e Gemini não será
              chamado neste modo.
            </p>
          )}
          {reportView ? (
            <div className="s3-messages">
              {!s?.reports.length && (
                <div className="s3-empty">
                  <h2>Seu expediente, em perspectiva.</h2>
                  <p>
                    Briefing e fechamento são salvos uma vez por data após o
                    horário cadastrado, na primeira abertura. Não há job em
                    segundo plano configurado.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const r = await ensureOperationalReportsAction();
                      setNotice(
                        r.ok
                          ? "Relatórios verificados, sem duplicações."
                          : r.error,
                      );
                      await load(thread);
                    }}
                  >
                    Verificar relatórios
                  </Button>
                </div>
              )}
              {s?.reports.map((r) => {
                const p = r.payload as Record<string, unknown>;
                return (
                  <article className="s3-message" key={r.id}>
                    <div className="s3-message-label">
                      <span>
                        ◷{" "}
                        {r.kind === "briefing"
                          ? "Briefing do Dia"
                          : "Fechamento do Dia"}
                      </span>
                      <span>{r.date.split("-").reverse().join("/")}</span>
                    </div>
                    <p>
                      {r.kind === "briefing"
                        ? "Um retrato do dia na abertura do painel."
                        : "Resultado dos registros disponíveis após o expediente."}
                    </p>
                    <div className="s3-message-metrics">
                      {[
                        ["income", "Recebido"],
                        ["forecast", "Programado"],
                        ["expenses", "Despesas"],
                        ["balance", "Saldo registrado"],
                      ].map(([key, label]) => (
                        <span key={key}>
                          <strong>
                            {Number.isFinite(p[key])
                              ? money(Number(p[key]))
                              : "Não disponível"}
                          </strong>
                          {label}
                        </span>
                      ))}
                    </div>
                    <p className="mt-4">
                      Agendados: {String(p.bookings ?? "—")} · Inícios
                      disponíveis:{" "}
                      {String(p.availableStarts ?? "Não consultados")} ·
                      Concluídos: {String(p.completed ?? "—")} · Cancelamentos:{" "}
                      {String(p.cancelled ?? "—")} · Faltas:{" "}
                      {String(p.noShow ?? "—")} · Meta:{" "}
                      {typeof p.goal === "number"
                        ? money(p.goal)
                        : "Não definida"}
                    </p>
                    <p className="text-sm mt-2">
                      Recebido no dia anterior:{" "}
                      {typeof p.previousIncome === "number"
                        ? money(p.previousIncome)
                        : "Sem base"}
                      .{" "}
                      {typeof p.goal === "number" && p.goal > 0
                        ? `Meta atingida em ${((Number(p.income || 0) / p.goal) * 100).toFixed(1)}%.`
                        : "Sem meta para comparar."}
                    </p>
                    {typeof p.referenceService === "string" && (
                      <p className="text-xs text-text-muted">
                        Vagas consultadas para {p.referenceService}; inícios
                        podem se sobrepor e não equivalem a atendimentos
                        adicionais.
                      </p>
                    )}
                    {Array.isArray(p.attention) && (
                      <ul className="space-y-2 mt-4 text-sm">
                        {p.attention
                          .filter(
                            (line): line is string => typeof line === "string",
                          )
                          .map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                      </ul>
                    )}
                    <small>
                      {String(p.generation || "Gerado na abertura do painel.")}{" "}
                      {p.partial
                        ? "Parcial até o instante de geração."
                        : "Não representa fechamento contábil."}{" "}
                      ·{" "}
                      {new Date(r.generated_at).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </small>
                  </article>
                );
              })}
            </div>
          ) : (
            <>
              <div
                className="s3-messages"
                role="log"
                aria-label="Mensagens do Raio-X"
              >
                {!messages.length && (
                  <div className="s3-empty">
                    <p className="s3-eyebrow">Clareza para o próximo passo</p>
                    <h2>O que você quer entender hoje?</h2>
                    <p>
                      Converse sobre agenda, receitas, despesas, serviços e
                      metas. Os números são consultados com as permissões da sua
                      loja.
                    </p>
                    <div className="s3-shortcuts mt-6">
                      {[
                        "Resumo de hoje",
                        "Horários disponíveis",
                        "Analisar despesas",
                        "Minha meta",
                        "Como melhorar a agenda?",
                        "Compare esta semana com a anterior.",
                      ].map((q) => (
                        <button
                          disabled={busy || !s}
                          key={q}
                          onClick={() => void send(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                    {s?.reports.slice(0, 1).map((r) => (
                      <button
                        key={r.id}
                        className="s3-message mt-6 text-left w-full"
                        onClick={() => setReportView(true)}
                      >
                        <span className="s3-message-label">
                          ◷{" "}
                          {r.kind === "briefing"
                            ? "Briefing do Dia"
                            : "Fechamento do Dia"}{" "}
                          · {r.date.split("-").reverse().join("/")}
                        </span>
                        <p>
                          Seu relatório do expediente está disponível. Abrir →
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {messages.map((m) => (
                  <motion.article
                    key={m.id}
                    className={
                      "s3-message " +
                      (m.role === "user" ? "s3-message-user" : "")
                    }
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="s3-message-label">
                      <span>
                        {m.role === "user"
                          ? "Você"
                          : m.payload.mode === "gemini"
                            ? "Raio-X · dados calculados + Gemini"
                            : "Raio-X · resumo calculado"}
                      </span>
                      {m.payload.start && (
                        <small>
                          {m.payload.start} → {m.payload.end}
                        </small>
                      )}
                    </div>
                    <p>{m.content}</p>
                    {m.role === "assistant" && (
                      <>
                        <RichAnswer payload={m.payload} />
                        {m.payload.notice && (
                          <p className="s3-note">{m.payload.notice}</p>
                        )}
                      </>
                    )}
                  </motion.article>
                ))}
                {busy && (
                  <div role="status" className="s3-message">
                    <span className="s3-message-label">Raio-X</span>
                    <p>Consultando os registros da sua loja…</p>
                  </div>
                )}
                <div ref={end} />
              </div>
              <form
                className="s3-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <label className="sr-only" htmlFor="raiox-question">
                  Mensagem para o Raio-X
                </label>
                <textarea
                  id="raiox-question"
                  placeholder="Pergunte sobre os números e a agenda…"
                  maxLength={1000}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim()) void send();
                    }
                  }}
                />
                <div className="s3-composer-footer">
                  <small>
                    Sem contatos pessoais. Respostas generativas podem conter
                    erros.
                  </small>
                  <Button
                    type="submit"
                    disabled={busy || !s || input.trim().length < 2}
                  >
                    Enviar ↗
                  </Button>
                </div>
              </form>
            </>
          )}
          {notice && (
            <p role="status" className="s3-notice">
              {notice}
            </p>
          )}
        </section>
      </div>
    </Workspace>
  );
}
