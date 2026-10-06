import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";

// Postgres-backed limiter (works across serverless instances). Each bucket guards
// one AI endpoint so a runaway client can't burn through API spend.
export const LIMITS = {
  "onboarding-chat": { max: 40, windowSeconds: 60 * 60 },
  "onboarding-plan": { max: 5, windowSeconds: 60 * 60 * 24 },
  "manual-task": { max: 20, windowSeconds: 60 * 60 * 24 },
  "photo-upload": { max: 10, windowSeconds: 60 * 60 * 24 },
  "avatar-generate": { max: 3, windowSeconds: 60 * 60 * 24 },
} as const;

export type LimitBucket = keyof typeof LIMITS;

export async function consumeRateLimit(userId: string, bucket: LimitBucket): Promise<boolean> {
  const { max, windowSeconds } = LIMITS[bucket];
  const { data, error } = await createServiceClient().rpc("consume_rate_limit", {
    p_user: userId,
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Fail closed: if we can't account for the request, don't make the paid call.
    console.error("rate limit check failed", error.message);
    return false;
  }
  return data === true;
}
