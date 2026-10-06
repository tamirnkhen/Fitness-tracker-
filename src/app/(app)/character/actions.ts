"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { deleteAllCharacterImages } from "@/lib/character";
import { createServiceClient } from "@/lib/supabase/admin";

/** Separate, explicit consent for processing the user's face photo. */
export async function grantPhotoConsent(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (formData.get("photo_consent") !== "on") return;
  await createServiceClient().from("profiles").update({ photo_consent_at: new Date().toISOString() }).eq("id", user.id);
  revalidatePath("/character");
  revalidatePath("/onboarding/character");
}

/** Withdrawing consent deletes the source photo and every generated avatar. */
export async function withdrawPhotoConsent() {
  const user = await getUser();
  if (!user) redirect("/login");
  const db = createServiceClient();
  await deleteAllCharacterImages(user.id);
  await db.from("characters").update({ source_path: null, avatar_path: null, status: "none", updated_at: new Date().toISOString() }).eq("user_id", user.id);
  await db.from("profiles").update({ photo_consent_at: null }).eq("id", user.id);
  revalidatePath("/character");
}
