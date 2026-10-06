import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import type { Character } from "@/lib/types";

export const CHARACTER_BUCKET = "character-private";
const SIGNED_URL_SECONDS = 60 * 10;

export async function getCharacter(userId: string): Promise<Character | null> {
  const { data } = await createServiceClient().from("characters").select("*").eq("user_id", userId).maybeSingle();
  return (data as Character | null) ?? null;
}

/** Short-lived URL for the owner's avatar. Never use public URLs for these images. */
export async function signedAvatarUrl(character: Character | null): Promise<string | null> {
  if (!character?.avatar_path) return null;
  const { data } = await createServiceClient().storage.from(CHARACTER_BUCKET).createSignedUrl(character.avatar_path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

/** Remove every stored image for a user (source photo + all avatars). */
export async function deleteAllCharacterImages(userId: string) {
  const storage = createServiceClient().storage.from(CHARACTER_BUCKET);
  const { data: files } = await storage.list(userId, { limit: 1000 });
  if (files?.length) {
    const { error } = await storage.remove(files.map((f) => `${userId}/${f.name}`));
    if (error) throw new Error(`failed to delete images: ${error.message}`);
  }
}
