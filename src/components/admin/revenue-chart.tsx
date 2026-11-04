"use client";

import {useEffect,useState} from "react";
import { motion, useReducedMotion } from "motion/react";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, BarChart2 } from "lucide-react";

export function RevenueChart({
  entries,
}: {
  entries: { created_at: string; amount: number }[];
}) {
  const reduced = useReducedMotion();
  const [mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  if(!mounted)return <section className="revenue-chart bg-surface border border-border rounded-2xl p-6 min-h-[280px]" aria-label="Preparando gráfico de receita" aria-busy="true"><div className="h-32 rounded-xl bg-surface-2"/></section>;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const date = d.toLocaleDateString("en-CA");
    return {
      dayName: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      label: d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      value: entries
        .filter(
          (e) => new Date(e.created_at).toLocaleDateString("en-CA") === date,
        )
        .reduce((a, e) => a + Number(e.amount), 0),
    };
  });

  const total7Days = days.reduce((sum, d) => sum + d.value, 0);
  const max = Math.max(1, ...days.map((d) => d.value));

  return (
    <section
      className="revenue-chart bg-surface border border-border rounded-2xl p-6 shadow-soft space-y-4"
      aria-labelledby="revenue-title"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-hairline">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-accent-light" />
            <h2 id="revenue-title" className="text-base font-bold text-text">
              Receita dos últimos 7 dias
            </h2>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Valores reais recebidos por atendimentos liquidados
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto bg-surface-2 px-3 py-1.5 rounded-full border border-hairline">
          <span className="text-xs text-text-muted">Total acumulado:</span>
          <span className="text-xs font-bold text-emerald-400">
            {formatCurrency(total7Days)}
          </span>
        </div>
      </div>

      <div className="revenue-bars grid grid-cols-7 gap-2 sm:gap-4 pt-2">
        {days.map((d, index) => {
          const heightPercent = max > 0 ? (d.value / max) * 100 : 0;
          return (
            <div key={d.label} className="flex flex-col items-center min-w-0">
              <span className="text-[11px] font-semibold text-text truncate max-w-full">
                {d.value > 0
                  ? d.value.toLocaleString("pt-BR", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    })
                  : "0"}
              </span>

              <div className="revenue-track w-full max-w-[42px] h-[130px] sm:h-[150px] bg-surface-2 rounded-t-lg flex flex-col justify-end p-1 my-2 border border-white/5 overflow-hidden">
                <motion.div
                  initial={{ height: reduced ? `${heightPercent}%` : "0%" }}
                  animate={{ height: `${Math.max(d.value > 0 ? 8 : 0, heightPercent)}%` }}
                  transition={{
                    duration: reduced ? 0 : 0.45,
                    delay: reduced ? 0 : index * 0.05,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="w-full rounded-t-md bg-gradient-to-t from-accent to-accent-light shadow-[0_0_12px_rgba(124,58,237,0.35)]"
                />
              </div>

              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
                  {d.dayName}
                </span>
                <small className="text-[11px] text-text-muted/80 block mt-0.5">
                  {d.label}
                </small>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
