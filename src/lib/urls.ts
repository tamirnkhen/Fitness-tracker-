/** Only allow same-site relative paths as post-login destinations (no open redirects). */
export function safeNextPath(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** Canonical site URL for auth redirects. Prefer the configured value over the Host header. */
export function siteUrl(requestOrigin?: string | null): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return (requestOrigin ?? "http://localhost:3000").replace(/\/$/, "");
}
