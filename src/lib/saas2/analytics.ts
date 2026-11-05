import { toCents } from "./money";
export const TZ = "America/Sao_Paulo";
export const localDate = (value = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
export const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(date + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
export const dayStart = (date: string) => Date.parse(date + "T00:00:00-03:00");
export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export interface Booking {
  id: string;
  barber_id: string;
  customer_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  hold_expires_at: string | null;
  total_price: number | string;
  booking_items: {
    service_id: string;
    service_name: string;
    price: number | string;
    duration_minutes: number;
  }[];
}
export interface Ledger {
  amount: number | string;
  type: string;
  created_at: string;
  booking_id: string | null;
  bookings: { barber_id: string } | null;
}
export interface Barber {
  id: string;
  name: string;
  is_active: boolean;
}
export interface Service {
  id: string;
  name: string;
  price: number | string;
  duration_minutes: number;
  buffer_minutes: number;
  is_active: boolean;
}
export interface Hours {
  barber_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
  is_off: boolean;
}
export interface Absence {
  barber_id: string;
  starts_at: string;
  ends_at: string;
}
export interface Source {
  bookings: Booking[];
  history: Booking[];
  ledger: Ledger[];
  barbers: Barber[];
  services: Service[];
  hours: Hours[];
  off: Absence[];
  closed: { date: string }[];
  consents: {
    customer_id: string;
    consent_given: boolean;
    revoked_at: string | null;
    given_at: string;
  }[];
}
export function daysIn(start: string, end: string) {
  const result: string[] = [];
  for (let d = start; d <= end; d = shiftDate(d, 1)) {
    if (result.length >= 93) throw Error("Selecione até 93 dias.");
    result.push(d);
  }
  return result;
}
export const validBooking = (b: Booking, now: number) =>
  ["confirmed", "completed"].includes(b.status) ||
  (b.status === "hold" &&
    !!b.hold_expires_at &&
    Date.parse(b.hold_expires_at) > now);
type Span = [number, number];
function subtract(spans: Span[], block: Span): Span[] {
  return spans.flatMap(([a, b]) =>
    block[0] >= b || block[1] <= a
      ? [[a, b] as Span]
      : [
          ...(block[0] > a ? [[a, Math.min(b, block[0])] as Span] : []),
          ...(block[1] < b ? [[Math.max(a, block[1]), b] as Span] : []),
        ],
  );
}
const asTime = (day: string, time: string) =>
  Date.parse(`${day}T${time.slice(0, 8)}-03:00`);
export function capacity(
  date: string,
  barber: string,
  source: Source,
  now: number,
) {
  const wh = source.hours.find(
    (h) =>
      h.barber_id === barber &&
      h.day_of_week === new Date(date + "T12:00Z").getUTCDay(),
  );
  if (!wh || wh.is_off || source.closed.some((c) => c.date === date))
    return {
      minutes: 0,
      occupied: 0,
      hourly: [] as { hour: string; minutes: number; occupied: number }[],
    };
  let spans: Span[] = [
    [asTime(date, wh.start_time), asTime(date, wh.end_time)],
  ];
  if (wh.lunch_start && wh.lunch_end)
    spans = subtract(spans, [
      asTime(date, wh.lunch_start),
      asTime(date, wh.lunch_end),
    ]);
  for (const t of source.off.filter((t) => t.barber_id === barber))
    spans = subtract(spans, [Date.parse(t.starts_at), Date.parse(t.ends_at)]);
  let free = spans;
  for (const b of source.bookings.filter(
    (b) => b.barber_id === barber && validBooking(b, now),
  ))
    free = subtract(free, [Date.parse(b.starts_at), Date.parse(b.ends_at)]);
  const duration = (xs: Span[]) =>
    xs.reduce((sum, [a, b]) => sum + Math.max(0, b - a) / 60000, 0);
  const hourly = [];
  for (let hour = 0; hour < 24; hour++) {
    const from = dayStart(date) + hour * 3600000,
      to = from + 3600000;
    const clipped = (xs: Span[]) =>
      xs
        .map(([a, b]) => [Math.max(a, from), Math.min(b, to)] as Span)
        .filter(([a, b]) => b > a);
    const minutes = duration(clipped(spans));
    if (minutes)
      hourly.push({
        hour: String(hour).padStart(2, "0") + ":00",
        minutes,
        occupied: minutes - duration(clipped(free)),
      });
  }
  return {
    minutes: duration(spans),
    occupied: duration(spans) - duration(free),
    hourly,
  };
}
export function retention(history: Booking[], now: number) {
  const visits = new Map<string, number[]>();
  for (const b of history.filter(
    (b) => b.status === "completed" && Date.parse(b.starts_at) <= now,
  )) {
    const dates = visits.get(b.customer_id) || [];
    dates.push(Date.parse(b.starts_at));
    visits.set(b.customer_id, dates);
  }
  return [...visits].map(([id, dates]) => {
    dates.sort((a, b) => a - b);
    const unique = dates.filter(
      (d, i) =>
        i === 0 || localDate(new Date(d)) !== localDate(new Date(dates[i - 1])),
    );
    const gaps = unique.slice(1).map((d, i) => (d - unique[i]) / 86400000);
    const usual =
      gaps.length >= 2 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
    const elapsed = (now - unique[unique.length - 1]) / 86400000;
    const category =
      usual === null
        ? "Dados insuficientes"
        : elapsed > usual * 1.25
          ? "Retorno atrasado"
          : elapsed >= usual * 0.8
            ? "Próximo do retorno esperado"
            : "Dentro do intervalo habitual";
    return {
      id,
      visits: unique.length,
      usual,
      elapsed,
      category,
      slowing:
        gaps.length >= 3 &&
        gaps[gaps.length - 1] >
          (gaps.slice(0, -1).reduce((a, b) => a + b, 0) / (gaps.length - 1)) *
            1.25,
    };
  });
}
export function analyze(
  source: Source,
  start: string,
  end: string,
  barberId: string | null,
  now = Date.now(),
) {
  const days = daysIn(start, end),
    from = dayStart(start),
    until = dayStart(shiftDate(end, 1));
  const inPeriod = (b: Booking) =>
    Date.parse(b.starts_at) >= from &&
    Date.parse(b.starts_at) < until &&
    (!barberId || b.barber_id === barberId);
  const bookings = source.bookings.filter(inPeriod),
    valid = bookings.filter((b) => validBooking(b, now)),
    completed = bookings.filter((b) => b.status === "completed");
  const ledger = source.ledger.filter(
    (l) =>
      Date.parse(l.created_at) >= from &&
      Date.parse(l.created_at) < until &&
      (!barberId || l.bookings?.barber_id === barberId),
  );
  const sum = (type: string) =>
      ledger
        .filter((l) => l.type === type)
        .reduce((n, l) => n + toCents(l.amount), 0),
    income = sum("income"),
    refunds = sum("refund"),
    expenses = sum("expense");
  const expected = valid.reduce((n, b) => n + toCents(b.total_price), 0),
    pending = valid.filter((b) => b.status === "hold").length;
  const selected = source.barbers.filter(
    (b) =>
      (b.is_active || bookings.some((x) => x.barber_id === b.id)) &&
      (!barberId || b.id === barberId),
  );
  const heatmap: {
    date: string;
    hour: string;
    minutes: number;
    occupied: number;
  }[] = [];
  let capacityMinutes = 0,
    occupiedMinutes = 0;
  const hourTotals = new Map<string, { minutes: number; occupied: number }>();
  for (const d of days)
    for (const b of selected.filter((b) => b.is_active)) {
      const c = capacity(d, b.id, source, now);
      capacityMinutes += c.minutes;
      occupiedMinutes += c.occupied;
      for (const h of c.hourly) {
        const cell = heatmap.find((x) => x.date === d && x.hour === h.hour);
        if (cell) {
          cell.minutes += h.minutes;
          cell.occupied += h.occupied;
        } else heatmap.push({ date: d, ...h });
        const prev = hourTotals.get(h.hour) || { minutes: 0, occupied: 0 };
        hourTotals.set(h.hour, {
          minutes: prev.minutes + h.minutes,
          occupied: prev.occupied + h.occupied,
        });
      }
    }
  const serviceTotals = new Map<
    string,
    { name: string; count: number; total: number }
  >();
  for (const b of completed)
    for (const item of b.booking_items || []) {
      const prev = serviceTotals.get(item.service_id) || {
        name: item.service_name,
        count: 0,
        total: 0,
      };
      serviceTotals.set(item.service_id, {
        name: item.service_name,
        count: prev.count + 1,
        total: prev.total + toCents(item.price),
      });
    }
  const history = source.history.filter(
      (b) =>
        (!barberId || b.barber_id === barberId) &&
        Date.parse(b.starts_at) < until,
    ),
    returnData = retention(history, now);
  const customerIds = [...new Set(completed.map((b) => b.customer_id))];
  let fresh = 0,
    returning = 0;
  for (const id of customerIds) {
    const first = history
      .filter((b) => b.customer_id === id && b.status === "completed")
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    if (first && Date.parse(first.starts_at) < from) returning++;
    else fresh++;
  }
  const daily = days.map((date) => {
    const xs = bookings.filter(
        (b) => localDate(new Date(b.starts_at)) === date,
      ),
      entries = ledger.filter(
        (l) => localDate(new Date(l.created_at)) === date,
      );
    const people = [
      ...new Set(
        xs.filter((b) => b.status === "completed").map((b) => b.customer_id),
      ),
    ];
    const returningCustomers = people.filter((id) =>
      history.some(
        (b) =>
          b.customer_id === id &&
          b.status === "completed" &&
          Date.parse(b.starts_at) < dayStart(date),
      ),
    ).length;
    return {
      newCustomers: people.length - returningCustomers,
      returningCustomers,
      date,
      bookings: xs.length,
      income: entries
        .filter((l) => l.type === "income")
        .reduce((n, l) => n + toCents(l.amount), 0),
      forecast: xs
        .filter((b) => validBooking(b, now))
        .reduce((n, b) => n + toCents(b.total_price), 0),
    };
  });
  const professionals = selected.map((b) => {
    const xs = completed.filter((x) => x.barber_id === b.id);
    return {
      name: b.name,
      completed: xs.length,
      serviceValue: xs.reduce((n, x) => n + toCents(x.total_price), 0),
    };
  });
  const completedValue = completed.reduce(
    (n, b) => n + toCents(b.total_price),
    0,
  );
  return {
    heatmap,
    income,
    refunds,
    expenses,
    registeredBalance: income - refunds - expenses,
    expected,
    pending,
    bookings: bookings.length,
    valid: valid.length,
    completed: completed.length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
    noShow: bookings.filter((b) => b.status === "no_show").length,
    ticket: completed.length
      ? Math.round(completedValue / completed.length)
      : null,
    capacityMinutes,
    occupiedMinutes,
    occupancy: capacityMinutes ? occupiedMinutes / capacityMinutes : null,
    freeMinutes: capacityMinutes - occupiedMinutes,
    services: [...serviceTotals.values()].sort((a, b) => b.count - a.count),
    professionals,
    fresh,
    returning,
    retention: returnData,
    daily,
    hourly: [...hourTotals]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, x]) => ({ hour, ...x })),
    notes: [
      "Receita realizada: lançamentos de entrada pela data do recebimento; não soma pagamentos duas vezes.",
      "Previsão: valor integral de reservas confirmadas, concluídas e pré-reservas ainda válidas; pode incluir valores já recebidos.",
      "Saldo registrado: entradas menos estornos e despesas cadastradas; não representa lucro nem custos desconhecidos.",
      "Ticket: valor dos serviços concluídos dividido por atendimentos concluídos. Capacidade histórica usa o expediente e os bloqueios cadastrados atualmente.",
    ],
  };
}
export type Analysis = ReturnType<typeof analyze>;
