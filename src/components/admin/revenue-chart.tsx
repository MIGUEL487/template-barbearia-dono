"use client";
import { motion, useReducedMotion } from "framer-motion";
export function RevenueChart({
  entries,
}: {
  entries: { created_at: string; amount: number }[];
}) {
  const reduced = useReducedMotion();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const date = d.toLocaleDateString("en-CA");
    return {
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
  const max = Math.max(1, ...days.map((d) => d.value));
  return (
    <section className="revenue-chart" aria-labelledby="revenue-title">
      <h2 id="revenue-title">Receita dos últimos 7 dias</h2>
      <p>Valores recebidos em reais, sem projeções.</p>
      <div className="revenue-bars">
        {days.map((d) => (
          <div key={d.label}>
            <span>
              {d.value.toLocaleString("pt-BR", {notation:"compact",maximumFractionDigits:1})}
            </span>
            <div className="revenue-track">
              <motion.div
                initial={{ scaleY: reduced ? 1 : 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: reduced ? 0 : 0.4 }}
                style={{
                  height: `${(d.value / max) * 100}%`,
                  transformOrigin: "bottom",
                  background: "var(--accent)",
                  minHeight: d.value ? 2 : 0,
                }}
              />
            </div>
            <small>{d.label}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
