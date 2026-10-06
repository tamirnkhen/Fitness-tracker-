import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { TERMS_VERSION } from "@/lib/env";
import type { Profile } from "@/lib/types";

// Data Access Layer: the single place that decides who the caller is.
// Deduplicated per request with React cache().

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile | null) ?? null;
});

/** For pages: redirect to /login when signed out. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export function needsOnboarding(profile: Profile): "consent" | "goals" | null {
  if (!profile.age_verified_at || !profile.terms_accepted_at || profile.terms_version !== TERMS_VERSION) return "consent";
  if (!profile.onboarding_completed_at) return "goals";
  return null;
}

/** For app pages: signed in AND finished onboarding. */
export async function requireActiveProfile(): Promise<Profile> {
  await requireUser();
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (needsOnboarding(profile)) redirect("/onboarding");
  return profile;
}

/**
 * Admin gate. Re-reads the role from the database on every call (never trusts the
 * UI or a cached claim) and returns a 404 for non-admins so the panel isn't
 * discoverable.
 */
export async function requireAdmin(): Promise<Profile> {
  const user = await getUser();
  if (!user) redirect("/login");
  const service = createServiceClient();
  const { data } = await service.from("profiles").select("*").eq("id", user.id).single();
  const profile = data as Profile | null;
  if (!profile || profile.role !== "admin") notFound();
  return profile;
}
