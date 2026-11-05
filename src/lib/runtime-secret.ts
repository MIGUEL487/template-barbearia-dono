import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  aiModel,
  boundedAiTimeout,
  validAiModel,
  canonicalAiModel,
  isFreeAiModel,
} from "@/lib/saas2/openrouter";
export const aiQuotaPauseShop = "11111111-1111-1111-1111-111111111111";
export const aiQuotaPauseStart = "2026-11-05T22:09:03Z";
export const aiQuotaPauseUntil = "2026-11-06T22:09:03Z";
export function aiRuntime(shop?: string, now = Date.now()) {
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
  const candidate = canonicalAiModel(configured);
  const effective =
    validAiModel(candidate) && !isFreeAiModel(candidate) ? aiModel : candidate;
  return {
    key: binding || nodeKey,
    source: binding
      ? "cloudflare_binding"
      : nodeKey
        ? "process_env"
        : "missing",
    contextAvailable,
    dailyQuotaEnabled: !(
      shop === aiQuotaPauseShop &&
      now >= Date.parse(aiQuotaPauseStart) &&
      now < Date.parse(aiQuotaPauseUntil) &&
      !["true", "1"].includes(
        String(
          env.AI_DAILY_QUOTA_ENABLED ??
            process.env.AI_DAILY_QUOTA_ENABLED ??
            "false",
        )
          .trim()
          .toLowerCase(),
      )
    ),
    dailyQuotaPauseUntil: shop === aiQuotaPauseShop ? aiQuotaPauseUntil : null,
    model: validAiModel(effective) ? effective : "",
    modelAdjusted: configured !== effective,
    timeoutMs: boundedAiTimeout(
      env.OPENROUTER_TIMEOUT_MS || process.env.OPENROUTER_TIMEOUT_MS,
    ),
  };
}
export function aiKey() {
  return aiRuntime().key;
}
