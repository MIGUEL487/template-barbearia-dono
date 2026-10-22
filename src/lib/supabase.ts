import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getMissingAdminEnvVars(): string[] {
  const missing: string[] = [];
  if (!supabaseUrl || supabaseUrl.trim() === "" || supabaseUrl.includes("dummy")) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!supabaseAnonKey || supabaseAnonKey.trim() === "" || supabaseAnonKey.includes("dummy")) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  // No navegador (client-side), variáveis sem NEXT_PUBLIC_ não são expostas por segurança.
  // Somente verificamos a service_role key no lado do servidor.
  if (typeof window === "undefined") {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY.trim() === "") {
      missing.push("SUPABASE_SERVICE_ROLE_KEY");
    }
  }
  return missing;
}

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Credenciais do Supabase não configuradas no ambiente. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local."
    );
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Instância padrão para o navegador
export const supabase = supabaseUrl && supabaseAnonKey
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : (null as any);
