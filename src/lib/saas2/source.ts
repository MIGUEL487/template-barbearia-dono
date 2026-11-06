import "server-only";
import { resolveCurrentShop } from "@/lib/current-shop";
import { readIntelligence } from "./data";
export { Filter, all } from "./data";
export async function loadIntelligence(raw: unknown) {
  const { db, shop } = await resolveCurrentShop();
  return readIntelligence(db, shop, raw);
}
