import { NextResponse } from "next/server";
import { authorize, jsonError } from "@/lib/api";
import { getProfile } from "@/lib/auth";
import { generateAvatar } from "@/lib/ai/avatar";
import { CHARACTER_BUCKET, getCharacter, signedAvatarUrl } from "@/lib/character";
import { hasServerEnv } from "@/lib/env";
import { GEAR } from "@/lib/game/gear";
import { createServiceClient } from "@/lib/supabase/admin";

export const maxDuration = 120;

export async function POST() {
  if (!hasServerEnv("OPENAI_API_KEY")) return jsonError(503, "יצירת הדמות לא זמינה כרגע");

  const { user, response } = await authorize("avatar-generate");
  if (!user) return response;

  const profile = await getProfile();
  if (!profile?.photo_consent_at) return jsonError(403, "צריך לאשר את השימוש בתמונה");

  const character = await getCharacter(user.id);
  if (!character?.source_path) return jsonError(400, "צריך להעלות תמונה קודם");
  if (character.status === "generating" && Date.now() - Date.parse(character.updated_at) < 3 * 60_000) {
    return jsonError(409, "הדמות כבר נוצרת — עוד רגע");
  }

  const db = createServiceClient();
  await db.from("characters").update({ status: "generating", updated_at: new Date().toISOString() }).eq("user_id", user.id);

  try {
    const { data: source, error } = await db.storage.from(CHARACTER_BUCKET).download(character.source_path);
    if (error || !source) throw new Error("source photo missing");

    const gear = GEAR.filter((g) => character.equipped.includes(g.id));
    const png = await generateAvatar(Buffer.from(await source.arrayBuffer()), gear);

    const avatarPath = `${user.id}/avatar-${Date.now()}.png`;
    const { error: uploadError } = await db.storage.from(CHARACTER_BUCKET).upload(avatarPath, png, { contentType: "image/png" });
    if (uploadError) throw new Error(uploadError.message);
    if (character.avatar_path) await db.storage.from(CHARACTER_BUCKET).remove([character.avatar_path]);

    const updated = {
      ...character,
      avatar_path: avatarPath,
      status: "ready" as const,
      generation_count: character.generation_count + 1,
      updated_at: new Date().toISOString(),
    };
    await db
      .from("characters")
      .update({ avatar_path: avatarPath, status: "ready", generation_count: updated.generation_count, updated_at: updated.updated_at })
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true, url: await signedAvatarUrl(updated) });
  } catch (error) {
    console.error("avatar generation failed", error);
    await db.from("characters").update({ status: "failed", updated_at: new Date().toISOString() }).eq("user_id", user.id);
    return jsonError(502, "יצירת הדמות נכשלה. אפשר לנסות שוב.");
  }
}
