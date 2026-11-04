"use server";
import { z } from "zod";
import { requireShopClient, requireBarberInShop } from "@/lib/authorization";
import { loadIntelligence, all, Filter } from "@/lib/saas2/source";
import { localDate, shiftDate } from "@/lib/saas2/analytics";
const uuid = z
  .string()
  .regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
export async function rescueAction(date: string) {
  try {
    const { current, previous, source, db, shop } = await loadIntelligence({
      start: date,
      end: date,
      barber: null,
    });
    const customers = await all<{ id: string; name: string }>((a, b) =>
      db
        .from("customers")
        .select("id,name")
        .eq("barbershop_id", shop)
        .order("id")
        .range(a, b),
    );
    const names = new Map(customers.map((c) => [c.id, c.name]));
    const consents = await all<{
      customer_id: string;
      consent_given: boolean;
      revoked_at: string | null;
      given_at: string;
    }>((a, b) =>
      db
        .from("consents")
        .select("customer_id,consent_given,revoked_at,given_at")
        .eq("barbershop_id", shop)
        .order("id")
        .range(a, b),
    );
    const latest = new Map<string, boolean>();
    for (const consent of [...consents].sort((a, b) =>
      b.given_at.localeCompare(a.given_at),
    ))
      if (!latest.has(consent.customer_id))
        latest.set(
          consent.customer_id,
          consent.consent_given && !consent.revoked_at,
        );
    const retention = current.retention.map((r) => ({
      ...r,
      name: names.get(r.id) || "Cliente cadastrado",
      consent: latest.get(r.id) === true,
    }));
    const delayed = retention.filter((r) => r.category === "Retorno atrasado"),
      eligible = delayed.filter((r) => r.consent).length;
    return {
      ok: true as const,
      current,
      previous,
      retention,
      eligible,
      services: source.services.filter((s) => s.is_active),
      barbers: source.barbers.filter((b) => b.is_active),
      message: `Olá! Já pensou no seu próximo cuidado na Auto Stilo? Consulte os serviços e os horários disponíveis. Se preferir, fale com a equipe.`,
      warning:
        "Demonstração — integração futura. Nenhuma mensagem enviada ou colocada em fila.",
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível consultar as oportunidades.",
    };
  }
}
export async function assistantAvailabilityAction(
  input: string,
  serviceId: string,
  barberId: string | null,
) {
  try {
    const shop = process.env.NEXT_PUBLIC_BARBERSHOP_ID;
    if (!shop) throw Error("Barbearia não configurada.");
    const db = await requireShopClient(shop, ["owner", "admin"]);
    uuid.parse(serviceId);
    if (barberId) await requireBarberInShop(db, shop, uuid.parse(barberId));
    const text = z.string().min(2).max(500).parse(input).toLowerCase();
    if (!/(hoje|amanh[ãa])/.test(text))
      throw Error(
        "Na demonstração, use “hoje” ou “amanhã depois das 18h”. Áudio ainda não está disponível.",
      );
    const date = shiftDate(localDate(), /amanh[ãa]/.test(text) ? 1 : 0),
      match = text.match(
        /(?:depois\s+d[ae]s?|ap[óo]s)\s*(\d{1,2})(?::(\d{2}))?/,
      );
    const hour = match ? Number(match[1]) : 0,
      minute = match?.[2] ? Number(match[2]) : 0;
    if (hour > 23 || minute > 59) throw Error("Horário não reconhecido.");
    const { data: service, error: serviceError } = await db
      .from("services")
      .select("name")
      .eq("id", serviceId)
      .eq("barbershop_id", shop)
      .eq("is_active", true)
      .maybeSingle();
    if (serviceError || !service)
      throw Error("Selecione um serviço ativo da loja.");
    const { data, error } = await db.rpc("get_availability", {
      p_barbershop_id: shop,
      p_barber_id: barberId,
      p_date: date,
      p_service_ids: [serviceId],
    });
    if (error) throw error;
    const slots = (
      (data || []) as { start_time: string; barber_id: string }[]
    ).filter((s) => {
      const t = new Date(s.start_time).toLocaleTimeString("en-GB", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      });
      return (
        t >=
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
      );
    });
    return {
      ok: true as const,
      date,
      service: service.name,
      after: `${hour}:${String(minute).padStart(2, "0")}`,
      slots,
      notice:
        "Interpretação limitada a exemplos de texto; disponibilidade consultada de verdade. Nenhuma reserva foi criada.",
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "Não foi possível consultar.",
    };
  }
}
export async function listWaitlistAction(date: string) {
  try {
    Filter.parse({ start: date, end: date, barber: null });
    const shop = process.env.NEXT_PUBLIC_BARBERSHOP_ID;
    if (!shop) throw Error("Barbearia não configurada.");
    const db = await requireShopClient(shop, ["owner", "admin"]);
    const entries = await all<{
      id: string;
      barber_id: string | null;
      service_ids: string[];
      customer_name: string;
      phone: string;
      email: string | null;
      contact_channel: string;
      date: string;
      window_start: string;
      window_end: string;
      status: string;
      offer_expires_at: string | null;
      offered_booking_id: string | null;
      offered_booking: {
        status: string;
        hold_expires_at: string | null;
      } | null;
      created_at: string;
    }>(
      (a, b) =>
        db
          .from("waitlist_entries")
          .select(
            "id,barber_id,service_ids,customer_name,phone,email,contact_channel,date,window_start,window_end,status,offer_expires_at,offered_booking_id,created_at,offered_booking:bookings(status,hold_expires_at)",
          )
          .eq("barbershop_id", shop)
          .eq("date", date)
          .order("created_at")
          .order("id")
          .range(a, b),
      500,
    );
    const { data: barbers, error: barberError } = await db
      .from("barbers")
      .select("id,name")
      .eq("barbershop_id", shop)
      .order("name");
    if (barberError) throw barberError;
    const { data: services, error: serviceError } = await db
      .from("services")
      .select("id,name")
      .eq("barbershop_id", shop);
    if (serviceError) throw serviceError;
    return {
      ok: true as const,
      entries,
      barbers: barbers || [],
      services: services || [],
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a fila. Confira a migration SaaS 2.0.",
    };
  }
}
export async function waitlistSlotsAction(id: string) {
  try {
    const shop = process.env.NEXT_PUBLIC_BARBERSHOP_ID;
    if (!shop) throw Error("Barbearia não configurada.");
    const db = await requireShopClient(shop, ["owner", "admin"]);
    uuid.parse(id);
    const { data: entry, error: eError } = await db
      .from("waitlist_entries")
      .select("date,barber_id,service_ids,window_start,window_end")
      .eq("barbershop_id", shop)
      .eq("id", id)
      .maybeSingle();
    if (eError || !entry) throw Error("Solicitação não encontrada.");
    const { data, error } = await db.rpc("get_group_availability", {
      p_barbershop_id: shop,
      p_barber_id: entry.barber_id,
      p_date: entry.date,
      p_service_ids: entry.service_ids,
    });
    if (error) throw error;
    const slots = (
      (data || []) as { start_time: string; barber_id: string }[]
    ).filter((s) => {
      const time = new Date(s.start_time).toLocaleTimeString("en-GB", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return time >= entry.window_start && time < entry.window_end;
    });
    return { ok: true as const, slots };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Disponibilidade indisponível.",
    };
  }
}

export async function offerWaitlistAction(
  id: string,
  barber: string,
  startsAt: string,
) {
  try {
    const shop = process.env.NEXT_PUBLIC_BARBERSHOP_ID;
    if (!shop) throw Error("Barbearia não configurada.");
    const db = await requireShopClient(shop, ["owner", "admin"]);
    uuid.parse(id);
    await requireBarberInShop(db, shop, uuid.parse(barber));
    z.string().datetime({ offset: true }).parse(startsAt);
    const { data, error } = await db.rpc("offer_waitlist", {
      p_barbershop_id: shop,
      p_entry_id: id,
      p_barber_id: barber,
      p_starts_at: startsAt,
    });
    if (error) throw error;
    return {
      ok: true as const,
      data: data as {
        booking_id: string;
        cancellation_token?: string;
        hold_expires_at: string;
        already_offered?: boolean;
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível criar a oferta. Nenhum encaixe foi confirmado.",
    };
  }
}
export async function cancelWaitlistAction(id: string) {
  try {
    const shop = process.env.NEXT_PUBLIC_BARBERSHOP_ID;
    if (!shop) throw Error("Barbearia não configurada.");
    const db = await requireShopClient(shop, ["owner", "admin"]);
    uuid.parse(id);
    const { error } = await db.rpc("cancel_waitlist", {
      p_barbershop_id: shop,
      p_entry_id: id,
    });
    if (error) throw error;
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "Não foi possível retirar.",
    };
  }
}
export async function upsellAction(shop: string, bookingId: string) {
  try {
    const db = await requireShopClient(shop, [
      "owner",
      "admin",
      "barber",
      "receptionist",
    ]);
    uuid.parse(bookingId);
    const { data: booking, error: bError } = await db
      .from("bookings")
      .select("id,booking_items(service_id)")
      .eq("barbershop_id", shop)
      .eq("id", bookingId)
      .maybeSingle();
    if (bError || !booking) throw Error("Reserva não encontrada.");
    const used = new Set(
      (booking.booking_items || []).map(
        (i: { service_id: string }) => i.service_id,
      ),
    );
    const { data, error } = await db
      .from("services")
      .select("id,name,price,duration_minutes")
      .eq("barbershop_id", shop)
      .eq("is_active", true)
      .order("name")
      .limit(30);
    if (error) throw error;
    return {
      ok: true as const,
      services: (data || []).filter((s) => !used.has(s.id)).slice(0, 4),
    };
  } catch {
    return {
      ok: false as const,
      error:
        "Sugestões indisponíveis. A conclusão do atendimento continua disponível.",
    };
  }
}
