import "server-only";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { consumeRateLimit, type LimitBucket } from "@/lib/rate-limit";

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/** Auth (+ optional rate limit) preamble shared by route handlers. */
export async function authorize(bucket?: LimitBucket) {
  const user = await getUser();
  if (!user) return { user: null, response: jsonError(401, "צריך להתחבר מחדש") } as const;
  if (bucket && !(await consumeRateLimit(user.id, bucket))) {
    return { user: null, response: jsonError(429, "הגעת למגבלת הבקשות. נסה שוב מאוחר יותר.") } as const;
  }
  return { user, response: null } as const;
}
