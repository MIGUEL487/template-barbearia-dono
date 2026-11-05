"use server";
import { resolveCurrentShop } from "@/lib/current-shop";
import { Filter } from "@/lib/saas2/source";
import { dayStart, shiftDate } from "@/lib/saas2/analytics";
import { readLedger } from "@/lib/saas3/ledger";
import { z } from "zod";
const uuid = z
  .string()
  .regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
export async function financeAction(filter: unknown) {
  try {
    const f = Filter.parse(filter);
    if (f.start > f.end || dayStart(f.end) - dayStart(f.start) > 92 * 86400000)
      throw Error("Selecione até 93 dias.");
    const { db, shop } = await resolveCurrentShop();
    const result = await readLedger(
      db,
      shop,
      new Date(dayStart(f.start)).toISOString(),
      new Date(dayStart(shiftDate(f.end, 1))).toISOString(),
    );
    const { data: bookings, error } = await db
      .from("bookings")
      .select("id,starts_at,total_price,status")
      .eq("barbershop_id", shop)
      .gte("starts_at", new Date(dayStart(f.start)).toISOString())
      .lt("starts_at", new Date(dayStart(shiftDate(f.end, 1))).toISOString())
      .order("starts_at", { ascending: false })
      .limit(100);
    if (error)
      throw Error("Não foi possível consultar agendamentos do período.");
    return { ok: true as const, ...result, bookings: bookings || [] };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Livro-caixa indisponível.",
    };
  }
}
const entrySchema = z
  .object({
    request: uuid,
    id: uuid.nullable(),
    type: z.enum(["income", "expense"]),
    description: z.string().trim().min(2).max(200),
    category: z.string().trim().min(2).max(60),
    amount: z.number().finite().positive().lt(1e8).multipleOf(0.01),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    method: z.string().max(40),
    status: z.enum(["settled", "pending"]),
    notes: z.string().max(500),
    quantity: z.number().positive().max(9999).nullable(),
    unitPrice: z.number().positive().lt(1e8).nullable(),
    supplier: z.string().max(120),
    booking: uuid.nullable(),
  })
  .strict();
export async function saveFinanceAction(raw: unknown) {
  try {
    const x = entrySchema.parse(raw);
    Filter.parse({ start: x.date, end: x.date, barber: null });
    if (x.quantity !== null || x.unitPrice !== null) {
      if (
        x.quantity === null ||
        x.unitPrice === null ||
        Math.round(x.quantity * x.unitPrice * 100) !==
          Math.round(x.amount * 100)
      )
        throw Error("Quantidade e valor unitário não correspondem ao total.");
    }
    const { db, shop } = await resolveCurrentShop();
    const metadata = {
      notes: x.notes,
      supplier: x.supplier,
      ...(x.quantity !== null
        ? { quantity: x.quantity, unit_price: x.unitPrice }
        : {}),
    };
    const { data, error } = await db.rpc("save_manual_financial_entry", {
      p_shop: shop,
      p_request: x.request,
      p_entry: x.id,
      p_type: x.type,
      p_description: x.description,
      p_category: x.category,
      p_amount: x.amount,
      p_date: x.date,
      p_method: x.method,
      p_status: x.status,
      p_metadata: metadata,
      p_booking: x.booking,
    });
    if (error) throw Error(error.message);
    return {
      ok: true as const,
      data: data as { id: string; reused?: boolean; duplicate?: boolean },
    };
  } catch (e) {
    return {
      ok: false as const,
      error:
        e instanceof Error
          ? e.message
          : "Não foi possível salvar. Confira os dados e a migration SaaS 3.0.",
    };
  }
}
export async function voidFinanceAction(id: string) {
  try {
    uuid.parse(id);
    const { db, shop } = await resolveCurrentShop();
    const { error } = await db.rpc("void_manual_financial_entry", {
      p_shop: shop,
      p_entry: id,
    });
    if (error) throw Error(error.message);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error:
        e instanceof Error
          ? e.message
          : "Não foi possível anular o lançamento.",
    };
  }
}
