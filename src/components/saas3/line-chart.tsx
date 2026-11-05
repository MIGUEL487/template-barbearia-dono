"use client";
import { useInterfaceReducedMotion as useReducedMotion } from "@/components/ui/use-interface-motion";
import { AnimatedSelect } from "@/components/ui/animated-select";
import { useId, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { money } from "@/lib/saas2/analytics";
export function LineChart({
  rows,
  secondary = "Previsão",
  first = "Recebido",
  monetary = true,
}: {
  rows: { date: string; income: number; forecast: number }[];
  secondary?: string;
  first?: string;
  monetary?: boolean;
}) {
  const reduced = useReducedMotion();
  const [series, setSeries] = useState<"both" | "income" | "forecast">("both"),
    [active, setActive] = useState(0),
    [hovered, setHovered] = useState(false);
  const id = useId().replaceAll(":", "");
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.forecast])),
    w = 800,
    h = 210,
    left = 64,
    right = 16,
    top = 16,
    bottom = 32,
    x = (i: number) =>
      left + (i * (w - left - right)) / Math.max(1, rows.length - 1),
    y = (n: number) => top + (1 - n / max) * (h - top - bottom);
  const path = (key: "income" | "forecast") =>
    rows.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r[key])}`).join(" ");
  const format = (n: number) => (monetary ? money(n) : String(n));
  const selected = rows[Math.min(active, rows.length - 1)];
  return (
    <div className="s3-chart">
      <div className="s3-chart-toolbar">
        <div className="s3-legend">
          <span>
            <i />
            {first}
          </span>
          <span>
            <i className="s3-line-secondary" />
            {secondary}
          </span>
        </div>
        <label className="sr-only" htmlFor={id}>
          Séries da receita
        </label>
        <AnimatedSelect
          id={id}
          aria-label="Séries da receita"
          value={series}
          onChange={(e) => setSeries(e.target.value as typeof series)}
        >
          <option value="both">Comparar séries</option>
          <option value="income">{first}</option>
          <option value="forecast">{secondary}</option>
        </AnimatedSelect>
      </div>
      {!rows.length ? (
        <p className="s3-empty">Os lançamentos do período aparecerão aqui.</p>
      ) : (
        <>
          <svg
            onMouseLeave={() => setHovered(false)}
            viewBox={`0 0 ${w} ${h}`}
            role="img"
            aria-label={`Evolução de ${first} e ${secondary}. Valores acessíveis na seleção de datas abaixo.`}
          >
            <defs>
              <linearGradient id={id + "-fill"} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--accent)" stopOpacity=".16" />
                <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line
                  x1={left}
                  x2={w - right}
                  y1={y(max * f)}
                  y2={y(max * f)}
                  stroke="var(--border)"
                  strokeDasharray="3 6"
                />
                <text
                  x={left - 8}
                  y={y(max * f) + 4}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="11"
                >
                  {new Intl.NumberFormat("pt-BR", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format((max * f) / (monetary ? 100 : 1))}
                </text>
              </g>
            ))}
            {series !== "forecast" && (
              <>
                <path
                  d={
                    path("income") +
                    ` L${x(rows.length - 1)},${h - bottom} L${x(0)},${h - bottom} Z`
                  }
                  fill={`url(#${id}-fill)`}
                />
                <motion.path
                  initial={reduced ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.35 }}
                  className="s3-chart-path"
                  d={path("income")}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                />
              </>
            )}
            {series !== "income" && (
              <motion.path
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.35 }}
                className="s3-chart-path"
                d={path("forecast")}
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
                strokeDasharray="5 5"
              />
            )}
            {rows.map((r, i) => (
              <g
                key={r.date}
                onMouseEnter={() => {
                  setActive(i);
                  setHovered(true);
                }}
              >
                {[0, Math.floor(rows.length / 2), rows.length - 1].includes(
                  i,
                ) && (
                  <text
                    x={x(i)}
                    y={h - 8}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize="11"
                  >
                    {r.date.slice(5).split("-").reverse().join("/")}
                  </text>
                )}
                <rect
                  x={x(i) - Math.max(5, (w - left) / rows.length / 2)}
                  y={top}
                  width={Math.max(10, (w - left) / rows.length)}
                  height={h - bottom - top}
                  fill="transparent"
                />
              </g>
            ))}
            {selected && (
              <circle
                cx={x(Math.min(active, rows.length - 1))}
                cy={y(
                  series === "forecast" ? selected.forecast : selected.income,
                )}
                r="4"
                fill="var(--text)"
                stroke="var(--accent)"
                strokeWidth="2"
              />
            )}
          </svg>
          <AnimatePresence>
            {hovered && selected && (
              <motion.div
                className="s3-chart-tooltip"
                initial={reduced ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 2 }}
                transition={{
                  duration: reduced ? 0 : 0.12,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <span>{selected.date.split("-").reverse().join("/")}</span>
                <strong>
                  {first}: {format(selected.income)}
                </strong>
                <strong>
                  {secondary}: {format(selected.forecast)}
                </strong>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="s3-chart-readout" aria-live="polite">
            <label>
              Consultar data
              <AnimatedSelect
                aria-label="Data no gráfico"
                value={Math.min(active, rows.length - 1)}
                onChange={(e) => setActive(Number(e.target.value))}
              >
                {rows.map((r, i) => (
                  <option key={r.date} value={i}>
                    {r.date.split("-").reverse().join("/")}
                  </option>
                ))}
              </AnimatedSelect>
            </label>
            {selected && (
              <span>
                {first}: <strong>{format(selected.income)}</strong> ·{" "}
                {secondary}: <strong>{format(selected.forecast)}</strong>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
