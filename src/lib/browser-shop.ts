import type { SupabaseClient } from "@supabase/supabase-js";
import { selectMembership, shopCookie } from "./shop-selection";
export async function currentMembership(
  db: SupabaseClient,
  userId: string,
  selection = "barbershop_id,role",
) {
  try {
    const { data, error } = await db
      .from("shop_members")
      .select(selection.includes("role") ? selection : selection + ",role")
      .eq("user_id", userId)
      .limit(101);
    if (error) throw error;
    if (!data || data.length > 100)
      throw Error("Não foi possível resolver os vínculos.");
    const rows = data as unknown as { barbershop_id: string; role: string }[];
    const selected = document.cookie
      .split("; ")
      .find((v) => v.startsWith(shopCookie + "="))
      ?.split("=")[1];
    return {
      data: selectMembership(
        rows,
        selected ? decodeURIComponent(selected) : undefined,
      ),
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
}
