import "server-only";
import { z } from "zod";
import { createServerActionClient } from "./supabase-server";
// PostgreSQL also accepts the canonical UUIDs used by the existing shop/seed,
// whose variant bits are not restricted to the RFC variant checked by z.uuid().
const postgresUuid=z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export async function requireShopClient(
  shopId: string,
  roles: readonly string[] = ["owner", "admin", "barber", "receptionist"],
) {
  postgresUuid.parse(shopId);
  const db = await createServerActionClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error("Sessão inválida. Faça login novamente.");
  const { data: member, error: membershipError } = await db
    .from("shop_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("barbershop_id", shopId)
    .maybeSingle();
  if (membershipError || !member || !roles.includes(member.role))
    throw new Error("Acesso negado a esta barbearia.");
  return db;
}
export async function requireBarberInShop(
  db: Awaited<ReturnType<typeof createServerActionClient>>,
  shopId: string,
  barberId: string,
) {
  postgresUuid.parse(barberId);
  const { data, error } = await db
    .from("barbers")
    .select("id")
    .eq("id", barberId)
    .eq("barbershop_id", shopId)
    .maybeSingle();
  if (error || !data) throw new Error("Profissional não pertence à barbearia.");
}
