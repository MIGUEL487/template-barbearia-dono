import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";

function serverConfig() {
  let env: Record<string, unknown> = {};
  try {
    env = getCloudflareContext().env as unknown as Record<string, unknown>;
  } catch {}
  return {
    supabaseUrl:
      typeof env.NEXT_PUBLIC_SUPABASE_URL === "string"
        ? env.NEXT_PUBLIC_SUPABASE_URL
        : process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey:
      typeof env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string"
        ? env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  };
}

// Cliente de Servidor Autenticado (usa a sessão em cookie do usuário dono logado)
export async function createServerActionClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = serverConfig();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Variáveis do Supabase ausentes no servidor.");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: any }>,
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
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
  const { supabaseUrl } = serverConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente do servidor.",
    );
  }
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
