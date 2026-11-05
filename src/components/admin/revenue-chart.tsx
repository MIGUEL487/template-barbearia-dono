"use client";
import { useEffect, useState } from "react";
import { LineChart } from "@/components/saas3/line-chart";
import { localDate, shiftDate, money } from "@/lib/saas2/analytics";
export function RevenueChart({
  entries,
}: {
  entries: { created_at: string; amount: number }[];
}) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(localDate()), []);
  const rows = today
    ? Array.from({ length: 7 }, (_, i) => {
        const date = shiftDate(today, i - 6);
        return {
          date,
          income: entries
            .filter((e) => localDate(new Date(e.created_at)) === date)
            .reduce((n, e) => n + Math.round(Number(e.amount) * 100), 0),
          forecast: 0,
        };
      })
    : [];
  return (
    <section className="mg-panel revenue-chart" aria-labelledby="revenue-title">
      <div className="mg-section-heading">
        <div>
          <p className="mg-overline">Fluxo de caixa</p>
          <h2 id="revenue-title">Receita dos últimos 7 dias</h2>
          <p>Valores efetivamente registrados · America/Sao_Paulo</p>
        </div>
        <strong>{money(rows.reduce((n, r) => n + r.income, 0))}</strong>
      </div>
      <LineChart rows={rows} singleSeries />
      {today && !entries.length && (
        <p className="s3-note">
          Seus recebimentos aparecerão aqui conforme forem registrados.
        </p>
      )}
    </section>
  );
}
