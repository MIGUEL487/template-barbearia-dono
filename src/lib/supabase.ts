import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key";

// Cliente padrão para o navegador / contexto anônimo
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Cliente com privilégios de Service Role (EXCLUSIVO para Server Actions e Route Handlers no servidor)
export function createServerAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente do servidor.");
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
