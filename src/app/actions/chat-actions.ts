"use server";
import { resolveCurrentShop } from "@/lib/current-shop";
import { loadIntelligence, Filter } from "@/lib/saas2/source";
import {
  localDate,
  shiftDate,
  money,
  analyze,
  dayStart,
} from "@/lib/saas2/analytics";
import { diagnose } from "@/lib/saas2/diagnosis";
import { geminiKey } from "@/lib/runtime-secret";
import { cachedInterpretation } from "@/lib/saas2/gemini";
import { pendingSchema } from "@/lib/saas3/ledger";
import { cleanQuestion, questionRange } from "@/lib/saas3/questions";
import { z } from "zod";
const uuid = z
  .string()
  .regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
export interface ChatPayload {
  mode: "deterministic" | "gemini";
  start: string;
  end: string;
  scope: string;
  income: number;
  expenses: number;
  refunds: number;
  balance: number;
  forecast: number;
  bookings: number;
  completed: number;
  goal: number | null;
  slots: string[];
  slotError: string | null;
  services: { name: string; count: number; total: number }[];
  daily: { date: string; income: number; forecast: number; bookings: number }[];
  retention: { label: string; count: number }[];
  notice?: string;
}
export async function chatStateAction(conversation?: string) {
  try {
    const { db, shop, user } = await resolveCurrentShop();
    const { data: threads, error } = await db
      .from("raiox_conversations")
      .select("id,title,created_at")
      .eq("barbershop_id", shop)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      if (pendingSchema(error))
        return {
          ok: true as const,
          compatible: false,
          threads: [],
          messages: [],
          reports: [],
        };
      throw Error("Não foi possível consultar o histórico.");
    }
    let messages: {
      id: string;
      role: string;
      content: string;
      payload: ChatPayload;
      created_at: string;
    }[] = [];
    if (conversation) {
      uuid.parse(conversation);
      if (!threads?.some((t) => t.id === conversation))
        throw Error("Conversa não autorizada ou fora do histórico recente.");
      const result = await db
        .from("raiox_messages")
        .select("id,role,content,payload,created_at")
        .eq("conversation_id", conversation)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(200);
      if (result.error) throw Error("Histórico indisponível.");
      messages = (result.data || []).reverse();
    }
    const { data: reports, error: reportError } = await db
      .from("raiox_reports")
      .select("id,date,kind,payload,generated_at")
      .eq("barbershop_id", shop)
      .order("date", { ascending: false })
      .order("kind")
      .limit(30);
    if (reportError) throw Error("Relatórios indisponíveis.");
    return {
      ok: true as const,
      compatible: true,
      threads: threads || [],
      messages,
      reports: reports || [],
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Histórico indisponível.",
    };
  }
}
export async function createConversationAction(title = "Nova conversa") {
  try {
    const { db, shop, user } = await resolveCurrentShop();
    const { data, error } = await db
      .from("raiox_conversations")
      .insert({
        barbershop_id: shop,
        user_id: user.id,
        title: z.string().trim().min(1).max(80).parse(title),
      })
      .select("id")
      .single();
    if (error)
      throw Error(
        "Histórico indisponível. Aplique a migration SaaS 3.0 para salvar conversas.",
      );
    return { ok: true as const, id: data.id as string };
  } catch (e) {
    return {
      ok: false as const,
      error:
        e instanceof Error ? e.message : "Não foi possível criar conversa.",
    };
  }
}
export async function manageConversationAction(
  id: string,
  title: string | null,
) {
  try {
    uuid.parse(id);
    const { db, shop, user } = await resolveCurrentShop();
    if (title === null) {
      const { error } = await db.rpc("delete_raiox_conversation", {
        p_shop: shop,
        p_conversation: id,
      });
      if (error) throw error;
    } else {
      const { data, error } = await db
        .from("raiox_conversations")
        .update({ title: z.string().trim().min(1).max(80).parse(title) })
        .eq("id", id)
        .eq("barbershop_id", shop)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw Error("Conversa não autorizada.");
    }
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error:
        e instanceof Error
          ? e.message
          : "Não foi possível atualizar a conversa.",
    };
  }
}
export async function askRaioXAction(raw: {
  question: string;
  conversation: string | null;
  request: string;
}) {
  let claimed = false;
  let request = "";
  let conversation: string | null = null;
  try {
    const question = cleanQuestion(
      z.string().min(2).max(1000).parse(raw.question),
    );
    request = uuid.parse(raw.request);
    conversation = raw.conversation ? uuid.parse(raw.conversation) : null;
    const auth = await resolveCurrentShop();
    let previous: { start: string; end: string } | undefined;
    if (conversation) {
      const { data: thread, error } = await auth.db
        .from("raiox_conversations")
        .select("id")
        .eq("id", conversation)
        .eq("barbershop_id", auth.shop)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error || !thread) throw Error("Conversa não autorizada.");
      const { data: last } = await auth.db
        .from("raiox_messages")
        .select("payload")
        .eq("conversation_id", conversation)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1);
      const range = last?.[0]?.payload;
      if (
        range &&
        Filter.safeParse({ start: range.start, end: range.end, barber: null })
          .success
      )
        previous = { start: range.start, end: range.end };
      const { data: claim, error: claimError } = await auth.db
        .from("raiox_messages")
        .upsert(
          {
            conversation_id: conversation,
            request_id: request,
            role: "user",
            content: question,
          },
          {
            onConflict: "conversation_id,request_id,role",
            ignoreDuplicates: true,
          },
        )
        .select("id");
      if (claimError) throw Error("Não foi possível registrar a pergunta.");
      if (!claim?.length) {
        const { data: answer } = await auth.db
          .from("raiox_messages")
          .select("content,payload")
          .eq("conversation_id", conversation)
          .eq("request_id", request)
          .eq("role", "assistant")
          .maybeSingle();
        if (answer)
          return {
            ok: true as const,
            text: answer.content as string,
            payload: answer.payload as ChatPayload,
          };
        throw Error(
          "Esta pergunta já está em processamento. Atualize o histórico antes de reenviar.",
        );
      }
      claimed = true;
    }
    const range = questionRange(question, localDate(), previous),
      {
        db,
        shop,
        current: c,
        previous: basePrevious,
        source,
      } = await loadIntelligence({
        start: range.start,
        end: range.end,
        barber: null,
      });
    // Calendar-week comparisons use the actual previous week, labelled as partial/current.
    const calendarComparison =
      /compar|anterior/.test(question.toLowerCase()) &&
      /esta semana|semana atual/.test(question.toLowerCase());
    const comparisonRange = calendarComparison
      ? {
          start: shiftDate(range.start, -7),
          end: shiftDate(range.start, -1),
          barber: null,
        }
      : null;
    const p = comparisonRange
      ? (await loadIntelligence(comparisonRange)).current
      : basePrevious;
    const comparisonLabel = comparisonRange
      ? `semana anterior completa (${comparisonRange.start} a ${comparisonRange.end}); semana atual parcial até ${range.end}`
      : `período anterior de mesma duração`;
    const { data: goalData, error: goalError } = await db
      .from("daily_goals")
      .select("amount")
      .eq("barbershop_id", shop)
      .gte("date", range.start)
      .lte("date", range.end);
    if (goalError)
      throw Error("Não foi possível consultar as metas do período.");
    const goal = goalData?.length
      ? goalData.reduce(
          (total, item) => total + Math.round(Number(item.amount) * 100),
          0,
        )
      : null;
    let slots: string[] = [],
      slotError: string | null = null;
    if (range.scope === "availability") {
      const svc = source.services
        .filter((s) => s.is_active)
        .sort(
          (a, b) =>
            a.duration_minutes +
            a.buffer_minutes -
            (b.duration_minutes + b.buffer_minutes),
        )[0];
      if (svc) {
        const { data, error } = await db.rpc("get_availability", {
          p_barbershop_id: shop,
          p_barber_id: null,
          p_date: range.end,
          p_service_ids: [svc.id],
        });
        if (error) slotError = "Consulta real de disponibilidade indisponível.";
        else
          slots = (data || []).map(
            (s: { start_time: string; barber_id: string }) =>
              new Date(s.start_time).toLocaleTimeString("pt-BR", {
                timeZone: "America/Sao_Paulo",
                hour: "2-digit",
                minute: "2-digit",
              }) +
              " · " +
              (source.barbers.find((b) => b.id === s.barber_id)?.name ||
                "Profissional"),
          );
        slotError =
          slotError ||
          `Referência: ${svc.name}, ${svc.duration_minutes + svc.buffer_minutes} min com preparação. Inícios podem se sobrepor.`;
      } else slotError = "Não há serviço ativo para consultar vagas.";
    }
    const payload: ChatPayload = {
      mode: "deterministic",
      ...range,
      income: c.income,
      expenses: c.expenses,
      refunds: c.refunds,
      balance: c.registeredBalance,
      forecast: c.expected,
      bookings: c.valid,
      completed: c.completed,
      goal,
      slots,
      slotError,
      services: c.services.slice(0, 6),
      daily: c.daily,
      retention: [
        "Dentro do intervalo habitual",
        "Próximo do retorno esperado",
        "Retorno atrasado",
        "Dados insuficientes",
      ].map((label) => ({
        label,
        count: c.retention.filter((r) => r.category === label).length,
      })),
    };
    let text = `Período: ${range.start.split("-").reverse().join("/")} a ${range.end.split("-").reverse().join("/")}.\n`;
    if (range.scope === "finance")
      text += `Entradas recebidas: ${money(c.income)}. Despesas: ${money(c.expenses)}. Estornos: ${money(c.refunds)}. Saldo registrado: ${money(c.registeredBalance)}. Este saldo não é lucro contábil.`;
    else if (range.scope === "goal")
      text +=
        goal === null
          ? "Não há meta cadastrada para esta data."
          : `Meta: ${money(goal)}. Recebimentos: ${money(c.income)}. Faltam ${money(Math.max(0, goal - c.income))}.`;
    else if (range.scope === "availability")
      text += `${slots.length} início(s) disponível(is) em ${range.end.split("-").reverse().join("/")}. ${slotError || ""}`;
    else
      text += diagnose(c, p, range.start === range.end ? goal : null)
        .join("\n")
        .replaceAll("dia anterior", comparisonLabel)
        .replaceAll("O dia anterior", "O " + comparisonLabel);
    if (range.scope === "services")
      text +=
        "\n" +
        (c.services.length
          ? c.services
              .slice(0, 5)
              .map(
                (s) =>
                  `${s.name}: ${s.count} item(ns), ${money(s.total)} em serviços concluídos.`,
              )
              .join("\n")
          : "Nenhum serviço concluído no período.");
    if (range.scope === "retention")
      text +=
        "\n" +
        payload.retention.map((r) => `${r.label}: ${r.count}.`).join(" ") +
        " Classificações históricas, sem expor nomes/contatos nem presumir intenção.";
    const key = geminiKey();
    if (key && conversation) {
      try {
        const interpreted = await cachedInterpretation(
          shop,
          key,
          {
            question,
            date: range.end,
            periodStart: range.start,
            scope: range.scope,
            receivedCents: c.income,
            forecastCents: c.expected,
            expensesCents: c.expenses,
            refundsCents: c.refunds,
            balanceCents: c.registeredBalance,
            completed: c.completed,
            bookings: c.valid,
            goalCents: goal,
            availableStarts: slots.length,
            occupancy: c.occupancy,
            previousReceivedCents: p.income,
            comparisonLabel,
            relevantDetail: JSON.stringify(
              range.scope === "services"
                ? payload.services
                : range.scope === "retention"
                  ? payload.retention
                  : range.scope === "availability"
                    ? { reference: slotError, starts: slots.slice(0, 40) }
                    : {},
            ),
          },
          async () => {
            const { data, error } = await db.rpc("consume_raiox_ai_quota", {
              p_barbershop_id: shop,
            });
            if (error || !data)
              throw Error("Cota generativa indisponível ou esgotada.");
          },
        );
        text +=
          "\n\n" + interpreted.summary + "\n" + interpreted.actions.join("\n");
        payload.mode = "gemini";
      } catch {
        payload.notice =
          "Gemini indisponível ou cota esgotada. Resposta calculada pelo sistema.";
      }
    } else
      payload.notice = conversation
        ? "Gemini não configurado. Resposta calculada pelo sistema."
        : "Prévia calculada sem histórico: aplique a migration SaaS 3.0 para salvar e habilitar Gemini.";
    if (conversation) {
      const { error } = await db.from("raiox_messages").insert({
        conversation_id: conversation,
        request_id: request,
        role: "assistant",
        content: text.slice(0, 12000),
        payload,
      });
      if (error)
        throw Error(
          "Resposta calculada, mas não foi possível salvar. Atualize o histórico.",
        );
    }
    return { ok: true as const, text, payload };
  } catch (e) {
    if (claimed && conversation) {
      try {
        const { db } = await resolveCurrentShop();
        await db.from("raiox_messages").insert({
          conversation_id: conversation,
          request_id: request,
          role: "assistant",
          content:
            "Não foi possível consultar os dados para esta pergunta. Tente novamente com um período válido.",
          payload: {
            mode: "deterministic",
            notice: "Consulta indisponível",
            failed: true,
          },
        });
      } catch {}
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Não foi possível responder.",
    };
  }
}
export async function ensureOperationalReportsAction() {
  try {
    const today = localDate(),
      start = shiftDate(today, -7),
      { source, db, shop } = await loadIntelligence({
        start,
        end: today,
        barber: null,
      });
    const { data: existing, error } = await db
      .from("raiox_reports")
      .select("date,kind")
      .eq("barbershop_id", shop)
      .gte("date", start)
      .lte("date", today);
    if (error) {
      if (pendingSchema(error))
        return { ok: true as const, compatible: false, created: 0 };
      throw error;
    }
    const now = Date.now(),
      dates = [today];
    for (let i = 1; i <= 7; i++) {
      const d = shiftDate(today, -i);
      if (
        source.hours.some(
          (h) =>
            !h.is_off && h.day_of_week === new Date(d + "T12:00Z").getUTCDay(),
        ) &&
        !source.closed.some((c) => c.date === d)
      ) {
        dates.push(d);
        break;
      }
    }
    let created = 0;
    for (const date of dates) {
      if (source.closed.some((c) => c.date === date)) continue;
      const hours = source.hours.filter(
        (h) =>
          !h.is_off &&
          h.day_of_week === new Date(date + "T12:00Z").getUTCDay() &&
          source.barbers.some((b) => b.id === h.barber_id && b.is_active),
      );
      if (!hours.length) continue;
      const opens = Math.min(
          ...hours.map((h) =>
            Date.parse(date + "T" + h.start_time.slice(0, 8) + "-03:00"),
          ),
        ),
        closes = Math.max(
          ...hours.map((h) =>
            Date.parse(date + "T" + h.end_time.slice(0, 8) + "-03:00"),
          ),
        );
      for (const kind of ["briefing", "closing"] as const) {
        if (
          now < (kind === "briefing" ? opens : closes) ||
          existing?.some((r) => r.date === date && r.kind === kind)
        )
          continue;
        if (date !== today && kind === "briefing") continue;
        const c = analyze(source, date, date, null, now),
          p = analyze(
            source,
            shiftDate(date, -1),
            shiftDate(date, -1),
            null,
            now,
          );
        const { data: goalData } = await db
          .from("daily_goals")
          .select("amount")
          .eq("barbershop_id", shop)
          .eq("date", date)
          .maybeSingle();
        const goal = goalData
          ? Math.round(Number(goalData.amount) * 100)
          : null;
        const payload = {
          mode: "deterministic",
          date,
          kind,
          bookings: c.valid,
          completed: c.completed,
          cancelled: c.cancelled,
          noShow: c.noShow,
          income: c.income,
          forecast: c.expected,
          expenses: c.expenses,
          refunds: c.refunds,
          balance: c.registeredBalance,
          goal,
          occupied: c.occupancy,
          previousIncome: p.income,
          services: c.services,
          attention: diagnose(c, p, goal),
          generation:
            "Primeira abertura após o horário; sem job em segundo plano.",
          partial: kind === "briefing",
          availableStarts: null,
        };
        const service = source.services
          .filter((s) => s.is_active)
          .sort(
            (a, b) =>
              a.duration_minutes +
              a.buffer_minutes -
              (b.duration_minutes + b.buffer_minutes),
          )[0];
        if (kind === "briefing" && date === today && service) {
          const result = await db.rpc("get_availability", {
            p_barbershop_id: shop,
            p_barber_id: null,
            p_date: date,
            p_service_ids: [service.id],
          });
          Object.assign(payload, {
            availableStarts: result.error ? null : result.data?.length || 0,
            referenceService: service.name,
          });
        }
        const { data, error: saveError } = await db
          .from("raiox_reports")
          .upsert(
            { barbershop_id: shop, date, kind, payload },
            { onConflict: "barbershop_id,date,kind", ignoreDuplicates: true },
          )
          .select("id");
        if (saveError) throw saveError;
        created += data?.length || 0;
      }
    }
    return { ok: true as const, compatible: true, created };
  } catch {
    return {
      ok: false as const,
      error:
        "Não foi possível gerar os relatórios. Confira conexão e migration SaaS 3.0.",
    };
  }
}
