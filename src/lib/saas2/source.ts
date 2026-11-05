import {readLedger,settled} from "@/lib/saas3/ledger";
import { readAll as all } from "./pagination";
export { readAll as all } from "./pagination";
import "server-only";
import {resolveCurrentShop} from "@/lib/current-shop";
import { analyze, dayStart, daysIn, shiftDate, type Source } from "./analytics";
import { z } from "zod";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00Z");
    return (
      v >= "2020-01-01" &&
      v <= "2100-12-31" &&
      !isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === v
    );
  });
export const Filter = z
  .object({
    start: date,
    end: date,
    barber: z
      .string()
      .regex(/^[a-f0-9-]{36}$/i)
      .nullable()
      .default(null),
  })
  .strict();
export async function loadIntelligence(raw: unknown) {
  const filter = Filter.parse(raw);
  if (filter.start > filter.end) throw Error("Período inválido.");
  const days = daysIn(filter.start, filter.end);
  const previousStart = shiftDate(filter.start, -days.length),
    from = new Date(dayStart(previousStart)).toISOString(),
    end = new Date(dayStart(shiftDate(filter.end, 1))).toISOString();
  const {db,shop}=await resolveCurrentShop();
  const fields =
    "id,barber_id,customer_id,starts_at,ends_at,status,hold_expires_at,total_price,booking_items(service_id,service_name,price,duration_minutes)";
  const [bookings, history, ledger, barbers, services, hours, off, closed] =
    await Promise.all([
      all<Source["bookings"][number]>((a, b) =>
        db
          .from("bookings")
          .select(fields)
          .eq("barbershop_id", shop)
          .lt("starts_at", end)
          .gt("ends_at", from)
          .order("id")
          .range(a, b),
      ),
      all<Source["history"][number]>((a, b) =>
        db
          .from("bookings")
          .select(fields)
          .eq("barbershop_id", shop)
          .eq("status", "completed")
          .lt("starts_at", end)
          .order("id")
          .range(a, b),
      ),
      readLedger(db,shop,from,end).then(result=>result.entries.filter(settled)),
      all<Source["barbers"][number]>((a, b) =>
        db
          .from("barbers")
          .select("id,name,is_active")
          .eq("barbershop_id", shop)
          .order("id")
          .range(a, b),
      ),
      all<Source["services"][number]>((a, b) =>
        db
          .from("services")
          .select("id,name,price,duration_minutes,buffer_minutes,is_active")
          .eq("barbershop_id", shop)
          .order("id")
          .range(a, b),
      ),
      all<Source["hours"][number]>((a, b) =>
        db
          .from("working_hours")
          .select(
            "barber_id,day_of_week,start_time,end_time,lunch_start,lunch_end,is_off,barbers!inner(barbershop_id)",
          )
          .eq("barbers.barbershop_id", shop)
          .order("id")
          .range(a, b),
      ),
      all<Source["off"][number]>((a, b) =>
        db
          .from("time_off")
          .select("barber_id,starts_at,ends_at,barbers!inner(barbershop_id)")
          .eq("barbers.barbershop_id", shop)
          .lt("starts_at", end)
          .gt("ends_at", from)
          .order("id")
          .range(a, b),
      ),
      all<Source["closed"][number]>((a, b) =>
        db
          .from("closed_days")
          .select("date")
          .eq("barbershop_id", shop)
          .gte("date", previousStart)
          .lte("date", filter.end)
          .order("id")
          .range(a, b),
      ),
    ]);
  if (filter.barber && !barbers.some((b) => b.id === filter.barber))
    throw Error("Profissional inválido.");
  const source = {
    consents: [] as Source["consents"],
    bookings,
    history,
    ledger,
    barbers,
    services,
    hours,
    off,
    closed,
  };
  const now = Date.now(),
    current = analyze(source, filter.start, filter.end, filter.barber, now),
    previous = analyze(
      source,
      previousStart,
      shiftDate(filter.start, -1),
      filter.barber,
      now,
    );
  return {
    shop,
    db,
    source,
    filter,
    current,
    previous,
    generatedAt: new Date(now).toISOString(),
  };
}
