"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminNavigation } from "./navigation";
export function ManagementLayout({
  title,
  subtitle,
  actions,
  status,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname();
  const section = [
    "/analises",
    "/raio-x",
    "/resgate",
  ].includes(path)
    ? "Inteligência"
    : ["/financeiro", "/configuracoes", "/suporte"].includes(path)
      ? "Administração"
      : "Gestão";
  return (
    <div className="admin-page mg-layout min-h-screen bg-bg text-text flex flex-col lg:flex-row">
      <AdminNavigation />
      <main
        className="admin-content saas3 management-workspace flex-1"
        data-page={path.slice(1) || "dashboard"}
      >
        <header className="s3-heading mg-page-header">
          <div className="mg-heading-copy">
            <p className="mg-breadcrumb">
              Auto Stilo <span>/</span> {section}
            </p>
            <div className="mg-page-title">
              <h1>{title}</h1>
              {status}
            </div>
            <p className="mg-page-subtitle">{subtitle}</p>
          </div>
          {actions && <div className="mg-page-actions">{actions}</div>}
        </header>
        {children}
      </main>
    </div>
  );
}
