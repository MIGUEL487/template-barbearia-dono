"use client";

import Image from "next/image";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, AlertCircle, ShieldCheck } from "lucide-react";
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
        const { data: membership, error: memError } = await supabase
          .from("shop_members")
          .select("barbershop_id, role")
          .eq("user_id", data.user.id)
          .single();

        if (memError || !membership) {
          setErrorMessage("Usuário autenticado, mas sem vínculo cadastrado em shop_members nesta barbearia.");
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
      <div className="w-full max-w-md bg-surface p-10 rounded-[36px] shadow-soft relative z-10 space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-4 shadow-sm">
            <Image src="/media/auto-stilo/marca-203.webp" width={56} height={56} className="rounded-full" alt="Auto Stilo" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-text">
            Painel do dono
          </h1>
          <p className="text-xs text-text-muted mt-2">Acesso administrativo exclusivo</p>
        </div>

        {missingVars.length > 0 && (
          <div className="p-4 rounded-[20px] bg-amber-500/10 text-amber-300 text-xs space-y-2">
            <strong className="block font-semibold">⚠️ Configuração Necessária:</strong>
            <p>Crie o arquivo <code className="bg-surface px-2 py-2 rounded">.env.local</code> preenchendo:</p>
            <ul className="list-disc list-inside mt-2 font-mono text-xs">
              {missingVars.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-[20px] bg-danger/10 text-danger text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-2" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-2 ml-2">
              E-mail Administrativo
            </label>
            <input
              type="email" autoComplete="username" inputMode="email"
              placeholder="dono@barbearia.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-2 rounded-full px-6 py-4 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-2 ml-2">
              Senha de Acesso
            </label>
            <input
              type="password" autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-2 rounded-full px-6 py-4 text-xs text-text focus:ring-2 focus:ring-accent focus:outline-none transition-all"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-accent-contrast font-bold py-4 px-6 rounded-full text-xs shadow-glow transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-accent-contrast border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Acessar Painel</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="pt-6 border-t border-hairline flex items-center justify-center text-xs text-text-muted gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Sessão segura com criptografia Supabase SSR</span>
        </div>
      </div>
    </main>
  );
}
