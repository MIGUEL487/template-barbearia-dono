"use client";
import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
export function Bars({
  title,
  rows,
  format = (n: number) => String(n),
}: {
  title: string;
  rows: { label: string; value: number; detail?: string }[];
  format?: (n: number) => string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {!rows.length ? (
        <p className="text-text-muted mt-4">
          Ainda não há registros suficientes.
        </p>
      ) : (
        <div className="space-y-4 mt-4" aria-label={title}>
          {rows.map((r, i) => (
            <button
              key={r.label + i}
              type="button"
              className="block w-full text-left rounded-xl p-2 hover:bg-surface-2 focus-visible:outline-accent"
              onClick={() => setSelected(selected === i ? null : i)}
              aria-expanded={selected === i}
            >
              <span className="flex justify-between gap-4 text-sm">
                <span>{r.label}</span>
                <strong>{format(r.value)}</strong>
              </span>
              <span className="block h-2 mt-2 bg-surface-2 rounded-full overflow-hidden">
                <span
                  className="block h-full bg-accent rounded-full"
                  style={{ width: Math.max(0, (r.value / max) * 100) + "%" }}
                />
              </span>
              {selected === i && (
                <span className="block mt-2 text-xs text-text-muted">
                  {r.detail || `${r.label}: ${format(r.value)}`}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
