import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { geminiModel } from "@/lib/saas2/gemini";
export function geminiRuntime() {
  let env: Record<string, unknown> = {},
    contextAvailable = false;
  try {
    env = getCloudflareContext().env as unknown as Record<string, unknown>;
    contextAvailable = true;
  } catch {
    /* Local Node has no Worker binding. */
  }
  const binding =
    typeof env.GEMINI_API_KEY === "string" ? env.GEMINI_API_KEY.trim() : "";
  const nodeKey = process.env.GEMINI_API_KEY?.trim() || "";
  const configuredModel = String(
    env.GEMINI_MODEL || process.env.GEMINI_MODEL || "",
  ).trim();
  const model = /^gemini-[a-zA-Z0-9._-]{1,100}$/.test(configuredModel)
    ? configuredModel
    : geminiModel;
  return {
    key: binding || nodeKey,
    source: binding
      ? "cloudflare_binding"
      : nodeKey
        ? "process_env"
        : "missing",
    contextAvailable,
    model,
  };
}
export function geminiKey() {
  return geminiRuntime().key;
}
