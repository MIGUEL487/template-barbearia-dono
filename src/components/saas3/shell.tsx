"use client";
import type { ReactNode } from "react";
import { AdminNavigation } from "@/components/admin/navigation";
import { motion, useReducedMotion } from "motion/react";
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
      <p>
        {label}
        <span tabIndex={0} className="s3-info" aria-label={tip} title={tip}>
          ⓘ
        </span>
      </p>
      <strong>{value}</strong>
      <small>{previous || "Sem comparação disponível"}</small>
    </div>
  );
}
