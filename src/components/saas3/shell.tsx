"use client";
import { useInterfaceReducedMotion as useReducedMotion } from "@/components/ui/use-interface-motion";
import { Tooltip } from "@/components/ui/tooltip";
import type { ReactNode } from "react";
import { AdminNavigation } from "@/components/admin/navigation";
import { motion } from "motion/react";
export function Workspace({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <div className="admin-page min-h-screen bg-bg text-text flex flex-col lg:flex-row p-4 lg:p-6 gap-6">
      <AdminNavigation />
      <main className="admin-content flex-1 space-y-6 saas3">
        <header className="s3-heading">
          <div>
            <p className="s3-eyebrow">Auto Stilo · Gestão</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {actions && <div className="s3-heading-actions">{actions}</div>}
        </header>
        <motion.div
          className="s3-body"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
export function Metric({
  label,
  value,
  previous,
  tip,
}: {
  label: string;
  value: string;
  previous?: string;
  tip: string;
}) {
  return (
    <div className="s3-metric">
      <div className="s3-metric-icon" aria-hidden="true">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/previst|receber/i.test(label) ? (
            <>
              <path d="M4 17l5-5 4 3 7-10M15 5h5v5" />
              <path d="M4 21h16" />
            </>
          ) : /agend|atend/i.test(label) ? (
            <>
              <rect x="4" y="5" width="16" height="16" rx="3" />
              <path d="M8 3v4m8-4v4M4 11h16m-11 4h2m4 0h2" />
            </>
          ) : /ticket|saldo/i.test(label) ? (
            <>
              <path d="M4 6h16v4a2 2 0 000 4v4H4v-4a2 2 0 000-4zM13 6v12" />
            </>
          ) : (
            <>
              <rect x="3" y="6" width="18" height="14" rx="3" />
              <path d="M3 10h18m-5 5h2M6 3h11" />
            </>
          )}
        </svg>
      </div>
      <p>
        {label}
        <Tooltip text={tip}>
          <button type="button" className="s3-info" aria-label={tip}>
            ⓘ
          </button>
        </Tooltip>
      </p>
      <strong>{value}</strong>
      <small
        className="s3-metric-change"
        data-trend={
          previous?.startsWith("↗")
            ? "up"
            : previous?.startsWith("↘")
              ? "down"
              : "neutral"
        }
      >
        {previous || "Sem comparação disponível"}
      </small>
    </div>
  );
}
