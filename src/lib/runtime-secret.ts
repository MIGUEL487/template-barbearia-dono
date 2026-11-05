import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
export function geminiKey() {
  try {
    const { env } = getCloudflareContext();
    const key = (env as unknown as Record<string, unknown>).GEMINI_API_KEY;
    if (typeof key === "string" && key.trim()) return key.trim();
  } catch {
    /* Local Node tests/dev have no Worker context. */
  }
  return process.env.GEMINI_API_KEY?.trim() || "";
}
