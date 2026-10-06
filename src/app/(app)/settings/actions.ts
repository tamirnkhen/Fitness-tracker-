"use server";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { deleteAllCharacterImages } from "@/lib/character";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

export type DeleteState = { error?: string } | undefined;

/**
 * Right to erasure: removes the photo + avatars from storage, then the auth user.
 * Every table references profiles → auth.users with ON DELETE CASCADE, so all
 * goals, tasks, XP history and AI logs go with it. (The admin audit log keeps
 * only the opaque user id, for accountability.)
 */
export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (String(formData.get("confirm") ?? "").trim() !== "מחיקה") return { error: "כדי לאשר, כתוב/י: מחיקה" };

  try {
    await deleteAllCharacterImages(user.id);
  } catch (error) {
    console.error(error);
    return { error: "מחיקת התמונות נכשלה, לכן החשבון לא נמחק. נסה/י שוב." };
  }

  const { error } = await createServiceClient().auth.admin.deleteUser(user.id);
  if (error) return { error: "מחיקת החשבון נכשלה. נסה/י שוב." };

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?error=deleted");
}
