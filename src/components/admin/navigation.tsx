"use client";

import {ShopSwitcher} from "./shop-switcher";
import { MotionToggle } from "@/components/motion-preferences";
import { DemoBadge } from "@/components/demo-watermark";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Calendar,
  BarChart3,
  ScanLine,
  Target,
  ListOrdered,
  Users,
  DollarSign,
  MoreHorizontal,
  Scissors,
  Clock,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/actions/admin-actions";
import { deactivateDevicePush } from "@/lib/device-push";

const links = [
  ["/dashboard", "Painel", BarChart3],
  ["/agenda", "Agenda", Calendar],
  ["/clientes", "Clientes", Users],
  ["/financeiro", "Financeiro", DollarSign],
  ["/servicos", "Serviços", Scissors],
  ["/equipe", "Equipe", Clock],
  ["/analises", "Análises", BarChart3],
  ["/raio-x", "Raio-X", ScanLine],
  ["/resgate", "Modo Resgate", Target],
  ["/fila-de-espera", "Fila de espera", ListOrdered],
  ["/configuracoes", "Configurações", Settings],
] as const;

export function AdminNavigation() {
  const logout = async () => {
    try {
      await deactivateDevicePush();
    } catch {
      console.warn("[Notificações] Não foi possível remover completamente o push na saída.");
    }
    await logoutAction();
  };

  const path = usePathname();
  const [more, setMore] = useState(false);

  return (
    <>
      {/* Mobile Top Brand Bar */}
      <div className="admin-mobile-brand">
        <div className="flex items-center gap-3">
          <BrandLogo tone="dark" className="w-8 h-8" />
          <span className="font-bold text-text text-base">Auto Stilo</span>
        </div>
        <DemoBadge />
      </div>

      {/* Desktop Sidebar (Dashdark X architecture) */}
      <aside className="admin-sidebar" aria-label="Menu principal">
        <Link className="admin-brand brand-with-logo" href="/dashboard">
          <BrandLogo tone="dark" className="w-10 h-10 shrink-0" />
          <span>
            Auto Stilo
            <span>
              Gestão Premium <DemoBadge />
            </span>
          </span>
        </Link>

        <ShopSwitcher/><nav aria-label="Navegação administrativa">
          {links.map(([href, label, Icon]) => {
            const isActive = path === href;
            return (
              <Link
                href={href}
                key={href}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={18} className={isActive ? "text-accent-light" : "text-text-muted"} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-hairline/60 flex flex-col gap-3">
          <div className="px-2">
            <MotionToggle />
          </div>
          <button
            onClick={() => void logout()}
            className="flex items-center gap-3 px-3 py-2.5 text-xs text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors border border-transparent hover:border-danger/20 w-full text-left"
          >
            <LogOut size={16} />
            <span>Sair do painel</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="admin-bottom" aria-label="Menu administrativo móvel">
        {links.slice(0, 4).map(([href, label, Icon]) => (
          <Link
            href={href}
            key={href}
            aria-current={path === href ? "page" : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
        <button
          aria-expanded={more}
          aria-controls="admin-more"
          onClick={() => setMore(!more)}
        >
          <MoreHorizontal size={20} />
          <span>Mais</span>
        </button>
      </nav>

      {/* Mobile "Mais" Drawer */}
      {more && (
        <div
          className="admin-more"
          id="admin-more"
          onKeyDown={(e) => {
            if (e.key === "Escape") setMore(false);
          }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-hairline">
            <h2>Mais opções</h2>
            <button
              onClick={() => setMore(false)}
              className="p-2 text-text-muted hover:text-text rounded-full"
              aria-label="Fechar menu"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-col gap-2 my-2">
            <ShopSwitcher/>{links.slice(4).map(([href, label, Icon]) => (
              <Link href={href} key={href} onClick={() => setMore(false)}>
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
          <div className="pt-2 border-t border-hairline flex flex-col gap-3">
            <MotionToggle />
            <button
              onClick={() => void logout()}
              className="text-danger flex items-center justify-center gap-2"
            >
              <LogOut size={16} />
              <span>Sair do painel</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
