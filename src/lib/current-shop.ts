import "server-only";
import { cookies } from "next/headers";
import { createServerActionClient } from "./supabase-server";
import { selectMembership, shopCookie } from "./shop-selection";
export async function resolveCurrentShop() {
  const db = await createServerActionClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw Error("Sessão inválida. Faça login novamente.");
  const { data, error: memberError } = await db
    .from("shop_members")
    .select("barbershop_id,role")
    .eq("user_id", user.id)
    .limit(101);
  if (memberError)
    throw Error(
      "Não foi possível consultar o vínculo da barbearia. Confira a conexão e as permissões.",
    );
  if ((data || []).length > 100)
    throw Error("Quantidade de vínculos acima do limite seguro.");
  const chosen = (await cookies()).get(shopCookie)?.value;
  const member = selectMembership(data || [], chosen);
  if (!["owner", "admin"].includes(member.role))
    throw Error("Acesso negado a esta barbearia.");
  const { data: shop, error: shopError } = await db
    .from("barbershops")
    .select("id")
    .eq("id", member.barbershop_id)
    .maybeSingle();
  if (shopError || !shop)
    throw Error(
      "O vínculo existe, mas a loja não pôde ser consultada. Confira RLS e cadastro.",
    );
  return { db, shop: member.barbershop_id, user };
}
