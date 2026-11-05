import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  aiModel,
  boundedAiTimeout,
  validAiModel,
} from "@/lib/saas2/openrouter";
export function aiRuntime() {
  let env: Record<string, unknown> = {},
    contextAvailable = false;
  try {
    env = getCloudflareContext().env as unknown as Record<string, unknown>;
    contextAvailable = true;
  } catch {
    /* Local Node has no Worker binding. */
  }
  const binding =
      typeof env.OPENROUTER_API_KEY === "string"
        ? env.OPENROUTER_API_KEY.trim()
        : "",
    nodeKey = process.env.OPENROUTER_API_KEY?.trim() || "";
  const configured = String(
    env.OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || aiModel,
  ).trim();
  return {
    key: binding || nodeKey,
    source: binding
      ? "cloudflare_binding"
      : nodeKey
        ? "process_env"
        : "missing",
    contextAvailable,
    model: validAiModel(configured) ? configured : "",
    timeoutMs: boundedAiTimeout(
      env.OPENROUTER_TIMEOUT_MS || process.env.OPENROUTER_TIMEOUT_MS,
    ),
  };
}
export function aiKey() {
  return aiRuntime().key;
}
