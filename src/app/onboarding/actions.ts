"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { MIN_AGE, TERMS_VERSION } from "@/lib/env";
import { ageOn, localDayKey } from "@/lib/game/periods";

export type ConsentState = { error?: string } | undefined;

const consentSchema = z.object({
  display_name: z.string().trim().min(1, "איך לקרוא לך?").max(60),
  birth_date: z.iso.date("תאריך לידה לא תקין"),
  accept_terms: z.literal("on", { error: "צריך לאשר את תנאי השימוש ומדיניות הפרטיות" }),
});

export async function acceptConsent(_prev: ConsentState, formData: FormData): Promise<ConsentState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = consentSchema.safeParse({
    display_name: formData.get("display_name"),
    birth_date: formData.get("birth_date"),
    accept_terms: formData.get("accept_terms"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const today = localDayKey(new Date());
  const age = ageOn(parsed.data.birth_date, today);
  if (age > 120 || age < 0) return { error: "תאריך לידה לא תקין" };

  const service = createServiceClient();
  if (age < MIN_AGE) {
    // We don't keep accounts (or any data) of people under the minimum age.
    await service.auth.admin.deleteUser(user.id);
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login?error=age");
  }

  const now = new Date().toISOString();
  const { error } = await service
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      birth_date: parsed.data.birth_date,
      age_verified_at: now,
      terms_accepted_at: now,
      terms_version: TERMS_VERSION,
    })
    .eq("id", user.id);
  if (error) return { error: "משהו השתבש. נסה שוב." };

  redirect("/onboarding");
}
