"use client";
import { localDate, shiftDate } from "@/lib/saas2/analytics";
export interface PeriodValue {
  start: string;
  end: string;
  preset: string;
}
export function periodFor(preset: string): PeriodValue {
  const end = localDate();
  return {
    preset,
    end,
    start:
      preset === "today"
        ? end
        : preset === "month"
          ? end.slice(0, 8) + "01"
          : shiftDate(end, preset === "30" ? -29 : -6),
  };
}
export function PeriodControl({
  value,
  onChange,
}: {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
}) {
  return (
    <div className="s3-period">
      <div className="s3-segment" role="group" aria-label="Período">
        {[
          ["today", "Hoje"],
          ["7", "7 dias"],
          ["30", "30 dias"],
          ["month", "Mês"],
          ["custom", "Personalizado"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={value.preset === id}
            onClick={() =>
              onChange(
                id === "custom" ? { ...value, preset: id } : periodFor(id),
              )
            }
          >
            {label}
          </button>
        ))}
      </div>
      {value.preset === "custom" && (
        <div className="s3-date-range">
          <label>
            De
            <input
              type="date"
              value={value.start}
              onChange={(e) => onChange({ ...value, start: e.target.value })}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={value.end}
              onChange={(e) => onChange({ ...value, end: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
