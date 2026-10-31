"use client";

import { BrandLogo } from "@/components/brand-logo";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, AlertCircle, ShieldCheck, Loader2 } from "lucide-react";
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
        setErrorMessage(
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : error.message,
        );
        setIsLoading(false);
        return;
      }

      if (data?.user) {
        const { data: membership, error: memError } = await supabase
          .from("shop_members")
          .select("barbershop_id, role")
          .eq("user_id", data.user.id)
          .single();

        if (memError || !membership) {
          setErrorMessage(
            "Usuário autenticado, mas sem vínculo cadastrado em shop_members nesta barbearia.",
          );
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
    <main className="admin-login min-h-screen flex flex-col items-center justify-center p-4 bg-bg text-text relative">
      <div className="w-full max-w-md bg-surface border border-border p-8 sm:p-10 rounded-2xl shadow-soft relative z-10 space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 flex items-center justify-center mb-3">
            <BrandLogo tone="dark" className="w-14 h-14" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text">
            Auto Stilo Gestão
          </h1>
          <p className="text-xs text-text-muted mt-1.5">
            Acesso exclusivo para administradores e proprietários
          </p>
        </div>

        {missingVars.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2">
            <strong className="block font-semibold">⚠️ Configuração Necessária:</strong>
            <p>
              Crie o arquivo <code className="bg-surface-2 px-1.5 py-0.5 rounded text-amber-200">.env.local</code> preenchendo:
            </p>
            <ul className="list-disc list-inside mt-1 font-mono text-xs text-amber-300/80">
              {missingVars.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              E-mail Administrativo
            </label>
            <input
              type="email"
              autoComplete="username"
              inputMode="email"
              placeholder="dono@autostilo.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-text focus:border-accent focus:outline-none transition-all placeholder:text-text-muted/40"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Senha de Acesso
            </label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-text focus:border-accent focus:outline-none transition-all placeholder:text-text-muted/40"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold py-3 px-4 rounded-xl text-sm shadow-glow transition-all active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Acessar Painel</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-hairline flex items-center justify-center text-xs text-text-muted gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Sessão segura com criptografia Supabase SSR</span>
        </div>
      </div>
    </main>
  );
}
