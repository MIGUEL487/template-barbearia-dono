import type { SupabaseClient } from "@supabase/supabase-js";
import { readAll } from "@/lib/saas2/pagination";
export interface Entry {
  id: string;
  barbershop_id: string;
  booking_id: string | null;
  payment_id: string | null;
  type: string;
  amount: number | string;
  description: string;
  created_at: string;
  entry_status?: "settled" | "pending" | "void";
  entry_origin?: "automatic" | "manual";
  category?: string;
  payment_label?: string | null;
  metadata?: Record<string, unknown>;
  bookings: { barber_id: string } | null;
}
export const pendingSchema = (e: { code?: string } | null) =>
  !!e &&
  ["42703", "PGRST204", "PGRST205", "42P01", "42883", "PGRST202"].includes(
    e.code || "",
  );
export async function readLedger(
  db: SupabaseClient,
  shop: string,
  start: string,
  end: string,
) {
  const base =
    "id,barbershop_id,booking_id,payment_id,type,amount,description,created_at,bookings(barber_id)";
  let compatible = true;
  const probe = await db
    .from("financial_transactions")
    .select("entry_status")
    .eq("barbershop_id", shop)
    .limit(1);
  if (probe.error) {
    if (pendingSchema(probe.error)) compatible = false;
    else throw Error("Não foi possível consultar o livro-caixa.");
  }
  const entries = await readAll<Entry>((a, b) =>
    db
      .from("financial_transactions")
      .select(
        base +
          (compatible
            ? ",entry_status,entry_origin,category,payment_label,metadata"
            : ""),
      )
      .eq("barbershop_id", shop)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("id")
      .range(a, b),
  );
  return { entries, compatible };
}
export const settled = (e: { entry_status?: string }) =>
  !e.entry_status || e.entry_status === "settled";
export const safeCsv = (value: unknown) => {
  let s = String(value ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
};
export function brazilMoney(value: string) {
  const s = value.trim().replace(/\s|R\$/g, "");
  if (!/^(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?$/.test(s))
    throw Error("Informe o valor em reais, como 1.234,56.");
  const n = Number(s.replaceAll(".", "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n >= 1e8) throw Error("Valor inválido.");
  return Math.round(n * 100) / 100;
}
