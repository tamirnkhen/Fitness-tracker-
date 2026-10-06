"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath, siteUrl } from "@/lib/urls";

export type AuthState = { error?: string; info?: string } | undefined;

const credentials = z.object({
  email: z.email("כתובת אימייל לא תקינה").max(254),
  password: z.string().min(8, "הסיסמה צריכה להכיל לפחות 8 תווים").max(128),
});

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Same message for unknown email and wrong password (no account enumeration).
  if (error) return { error: "האימייל או הסיסמה שגויים" };

  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials
    .extend({ display_name: z.string().trim().min(1, "איך לקרוא לך?").max(60) })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      display_name: formData.get("display_name"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const origin = siteUrl((await headers()).get("origin"));
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.display_name },
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });
  if (error) {
    if (error.code === "weak_password") return { error: "הסיסמה חלשה מדי — נסה סיסמה ארוכה ומגוונת יותר" };
    return { error: "לא הצלחנו ליצור חשבון. נסה שוב." };
  }

  // With email confirmation on, there is no session until the link is clicked.
  if (!data.session) return { info: "שלחנו לך מייל לאישור החשבון. לחץ על הקישור כדי להתחיל את המסע." };
  redirect("/onboarding");
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const origin = siteUrl((await headers()).get("origin"));
  const next = safeNextPath(formData.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
