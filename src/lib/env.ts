// Public values are inlined by Next at build time; secrets are read lazily and only
// from server modules (each of which imports "server-only").

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function requireServerEnv(name: "SUPABASE_SERVICE_ROLE_KEY" | "ANTHROPIC_API_KEY" | "OPENAI_API_KEY"): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function hasServerEnv(name: "ANTHROPIC_API_KEY" | "OPENAI_API_KEY"): boolean {
  return Boolean(process.env[name]);
}

/** Minimum age to use the app. Photos of faces + AI processing → adults only. */
export const MIN_AGE = 18;

/** Bump when the Terms / Privacy text changes so users re-accept. */
export const TERMS_VERSION = "2026-10-draft-1";
