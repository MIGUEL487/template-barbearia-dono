"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors, Lock, AlertCircle, ShieldCheck } from "lucide-react";
import { createClient, getMissingAdminEnvVars } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const missingVars = getMissingAdminEnvVars();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (missingVars.length > 0) {
      setErrorMessage(`Configure as variáveis no .env.local: ${missingVars.join(", ")}`);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
        setIsLoading(false);
        return;
      }

      if (data?.user) {
        // Verificar se usuário possui vínculo em shop_members
        const { data: membership, error: memError } = await supabase
          .from("shop_members")
          .select("barbershop_id, role")
          .eq("user_id", data.user.id)
          .single();

        if (memError || !membership) {
          setErrorMessage("Usuário autenticado, mas sem vínculo cadastrado como proprietário ou membro em shop_members.");
          setIsLoading(false);
          return;
        }

        router.push("/dashboard");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro inesperado ao conectar ao Supabase.");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-bg text-text relative">
      <div className="w-full max-w-md bg-surface border border-border p-8 rounded-lg shadow-premium relative z-10">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-sm bg-surface-2 border border-accent/40 flex items-center justify-center text-accent mb-4">
            <Scissors className="w-6 h-6 rotate-45" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-text">
            Painel do <span className="italic text-accent">Proprietário</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">Acesso exclusivo do dono da barbearia</p>
        </div>

        {missingVars.length > 0 && (
          <div className="mb-6 p-4 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
            <strong className="block font-semibold">⚠️ Configuração Necessária:</strong>
            <p>Crie o arquivo <code className="bg-surface px-1 py-0.5 rounded">.env.local</code> preenchendo:</p>
            <ul className="list-disc list-inside mt-1 font-mono text-[11px]">
              {missingVars.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-sm bg-danger/10 border border-danger/30 text-danger text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              E-mail do Dono
            </label>
            <input
              type="email"
              placeholder="dono@barbearia.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-2 border border-border focus:border-accent focus:ring-1 focus:ring-accent rounded-sm px-4 py-2.5 text-sm text-text outline-none transition-colors"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-2 border border-border focus:border-accent focus:ring-1 focus:ring-accent rounded-sm px-4 py-2.5 text-sm text-text outline-none transition-colors"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-accent-contrast font-bold py-3 px-4 rounded-sm text-sm transition-all shadow-premium disabled:opacity-50"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-accent-contrast border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Entrar no Painel</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-border flex items-center justify-center text-xs text-text-muted gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Autenticado via Supabase Auth & RLS</span>
        </div>
      </div>
    </main>
  );
}
