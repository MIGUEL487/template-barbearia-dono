import Link from "next/link";
import { Scissors, ShieldCheck, ArrowRight, Lock } from "lucide-react";

export default function AdminHomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-bg text-text relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/5 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-md bg-surface border border-border p-8 rounded-lg shadow-premium relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-sm bg-surface-2 border border-accent/40 flex items-center justify-center text-accent mb-4">
            <Scissors className="w-6 h-6 rotate-45" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-text">
            Painel do <span className="italic text-accent">Proprietário</span>
          </h1>
          <p className="text-sm text-text-muted mt-1">Acesso restrito à gestão da barbearia</p>
        </div>

        <form className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              E-mail Administrativo
            </label>
            <input
              type="email"
              placeholder="dono@barbearia.com.br"
              className="w-full bg-surface-2 border border-border focus:border-accent focus:ring-1 focus:ring-accent rounded-sm px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50 outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Senha
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              className="w-full bg-surface-2 border border-border focus:border-accent focus:ring-1 focus:ring-accent rounded-sm px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50 outline-none transition-colors"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-accent-contrast font-bold py-3 px-4 rounded-sm text-sm transition-all shadow-premium"
            >
              <Lock className="w-4 h-4" />
              <span>Entrar no Painel</span>
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-border flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Sessão Protegida por RLS</span>
          </div>
          <Link href="/recuperar-senha" className="hover:text-accent transition-colors">
            Esqueceu a senha?
          </Link>
        </div>
      </div>
    </main>
  );
}
