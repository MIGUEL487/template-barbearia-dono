import {
  analyze,
  dayStart,
  shiftDate,
  validBooking,
  type Source,
} from "../saas2/analytics";
import { diagnose } from "../saas2/diagnosis";
export type ReportKind = "briefing" | "closing";
/** First effective opening through last effective closing among active professionals.
 * Lunch and split/individual shifts are excluded from capacity, not separate push events. */
export function businessWindow(source: Source, date: string) {
  if (source.closed.some((c) => c.date === date)) return null;
  const weekday = new Date(date + "T12:00Z").getUTCDay();
  const spans: [number, number][] = [];
  for (const h of source.hours.filter(
    (h) =>
      !h.is_off &&
      h.day_of_week === weekday &&
      source.barbers.some((b) => b.id === h.barber_id && b.is_active),
  )) {
    const at = (time: string) =>
      Date.parse(`${date}T${time.slice(0, 8)}-03:00`);
    let parts: [number, number][] = [[at(h.start_time), at(h.end_time)]];
    const subtract = (start: number, end: number) => {
      parts = parts.flatMap(([a, b]) =>
        start >= b || end <= a
          ? [[a, b]]
          : [
              ...(start > a
                ? [[a, Math.min(b, start)] as [number, number]]
                : []),
              ...(end < b ? [[Math.max(a, end), b] as [number, number]] : []),
            ],
      );
    };
    if (h.lunch_start && h.lunch_end)
      subtract(at(h.lunch_start), at(h.lunch_end));
    for (const o of source.off.filter((o) => o.barber_id === h.barber_id))
      subtract(Date.parse(o.starts_at), Date.parse(o.ends_at));
    spans.push(...parts.filter(([a, b]) => Number.isFinite(a) && b > a));
  }
  return spans.length
    ? {
        opens: Math.min(...spans.map((s) => s[0])),
        closes: Math.max(...spans.map((s) => s[1])),
      }
    : null;
}
export function operationalReport(
  source: Source,
  date: string,
  kind: ReportKind,
  goal: number | null,
  now = Date.now(),
  lowOccupancy = 0.4,
) {
  const c = analyze(source, date, date, null, now),
    p = analyze(source, shiftDate(date, -1), shiftDate(date, -1), null, now),
    window = businessWindow(source, date);
  const scheduledServices = new Map<string, { name: string; count: number }>();
  for (const b of source.bookings.filter(
    (b) =>
      validBooking(b, now) &&
      Date.parse(b.starts_at) >= dayStart(date) &&
      Date.parse(b.starts_at) < dayStart(shiftDate(date, 1)),
  ))
    for (const i of b.booking_items || []) {
      const row = scheduledServices.get(i.service_id) || {
        name: i.service_name,
        count: 0,
      };
      row.count++;
      scheduledServices.set(i.service_id, row);
    }
  const rules: { id: string; condition: string; message: string }[] = [];
  if (c.occupancy !== null && c.occupancy < lowOccupancy)
    rules.push({
      id: "low-occupancy",
      condition: `${Math.round(c.occupancy * 100)}% < ${Math.round(lowOccupancy * 100)}%`,
      message: `Há ${Math.round(c.freeMinutes)} minutos livres no expediente cadastrado.`,
    });
  if (goal && c.income >= goal * 0.8)
    rules.push({
      id: "goal",
      condition: `Recebido ${c.income} / meta ${goal} centavos`,
      message:
        c.income >= goal
          ? "A meta de recebimentos foi atingida."
          : "A meta está a menos de 20% dos recebimentos registrados.",
    });
  const sample = c.bookings >= 10 && p.bookings >= 10;
  if (sample && c.cancelled / c.bookings > p.cancelled / p.bookings)
    rules.push({
      id: "cancellations",
      condition: `${c.cancelled}/${c.bookings} contra ${p.cancelled}/${p.bookings} no período anterior (mínimo 10 em cada)`,
      message:
        "Cancelamentos acima da referência anterior; confira a fila de espera.",
    });
  const retained = c.retention.filter((r) => r.usual !== null);
  if (retained.length)
    rules.push({
      id: "retention",
      condition: `${retained.length} cliente(s) com ao menos três visitas em dias diferentes`,
      message: `${retained.filter((r) => r.category === "Retorno atrasado").length} retorno(s) acima do intervalo histórico; não indica intenção de abandono.`,
    });
  return {
    version: 4,
    mode: "deterministic" as const,
    date,
    kind,
    generatedAt: new Date(now).toISOString(),
    window: window
      ? {
          opens: new Date(window.opens).toISOString(),
          closes: new Date(window.closes).toISOString(),
        }
      : null,
    current: c,
    previous: p,
    goal,
    goalProgress: goal && goal > 0 ? c.income / goal : null,
    scheduledServices: [...scheduledServices.values()],
    busyHours: [...c.hourly]
      .filter((h) => h.occupied > 0)
      .sort((a, b) => b.occupied - a.occupied)
      .slice(0, 3),
    rules,
    attention: diagnose(c, p, goal),
    partial: kind === "briefing" || (!!window && now < window.closes),
  };
}
export type OperationalReport = ReturnType<typeof operationalReport>;
