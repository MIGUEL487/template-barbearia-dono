"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { shopCookie } from "@/lib/shop-selection";
export function ShopSwitcher() {
  const [shops, setShops] = useState<
      { barbershop_id: string; name?: string }[]
    >([]),
    [selected, setSelected] = useState("");
  useEffect(() => {
    let alive = true;
    const db = createClient();
    void db.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data, error } = await db
        .from("shop_members")
        .select("barbershop_id,barbershops(name)")
        .eq("user_id", user.id)
        .limit(101);
      if (alive && !error) {
        setShops(
          (data || []).map((m) => ({
            barbershop_id: m.barbershop_id,
            name: (m.barbershops as unknown as { name?: string } | null)?.name,
          })),
        );
        setSelected(
          decodeURIComponent(
            document.cookie
              .split("; ")
              .find((v) => v.startsWith(shopCookie + "="))
              ?.split("=")[1] || "",
          ),
        );
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!shops.length || (shops.length===1 && (!selected || selected===shops[0].barbershop_id))) return null;
  return (
    <label className="block p-2 text-xs">
      Barbearia
      <select
        aria-label="Barbearia ativa"
        className="w-full bg-surface border border-border rounded-xl p-2 mt-2"
        value={selected}
        onChange={(e) => {
          if (!e.target.value) return;
          document.cookie =
            shopCookie +
            "=" +
            encodeURIComponent(e.target.value) +
            "; Path=/; SameSite=Lax; Max-Age=31536000" +
            (location.protocol === "https:" ? "; Secure" : "");
          location.reload();
        }}
      >
        <option value="">Selecione a loja</option>
        {shops.map((s, i) => (
          <option key={s.barbershop_id} value={s.barbershop_id}>
            {s.name || `Loja ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}
