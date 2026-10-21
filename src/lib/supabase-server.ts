import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente de Servidor Autenticado (usa a sessão em cookie do usuário dono logado)
export function createServerActionClient() {
  const cookieStore = cookies();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Variáveis do Supabase ausentes no servidor.");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // O método `setAll` pode ser invocado de um Server Component
        }
      },
    },
  });
}

// Cliente com privilégios de Service Role (EXCLUSIVO para Server Actions e Webhooks no servidor)
export function createServerAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente do servidor.");
  }
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
