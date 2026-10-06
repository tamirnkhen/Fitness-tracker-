import { NextResponse } from "next/server";
import { authorize, jsonError } from "@/lib/api";
import { getProfile } from "@/lib/auth";
import { CHARACTER_BUCKET } from "@/lib/character";
import { checkUpload, MAX_UPLOAD_BYTES } from "@/lib/images/validate";
import { moderatePhoto, normalizePhoto } from "@/lib/images/process";
import { createServiceClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { user, response } = await authorize("photo-upload");
  if (!user) return response;

  const profile = await getProfile();
  if (!profile?.photo_consent_at) return jsonError(403, "צריך לאשר את השימוש בתמונה לפני ההעלאה");

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return jsonError(413, "הקובץ גדול מ-5MB");

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) return jsonError(400, "לא התקבלה תמונה");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(file.size, bytes);
  if (!check.ok) return jsonError(400, check.error);

  let jpeg: Buffer;
  try {
    jpeg = await normalizePhoto(bytes);
  } catch (error) {
    return jsonError(400, error instanceof Error && /[֐-׿]/.test(error.message) ? error.message : "לא הצלחנו לקרוא את התמונה");
  }

  try {
    if (!(await moderatePhoto(jpeg))) return jsonError(400, "התמונה לא עברה את בדיקת התוכן. נסה/י תמונת פנים רגילה.");
  } catch (error) {
    console.error("moderation failed", error);
    return jsonError(503, "בדיקת התמונה לא זמינה כרגע. נסה/י שוב בעוד רגע.");
  }

  const db = createServiceClient();
  const path = `${user.id}/source.jpg`;
  const { error: uploadError } = await db.storage.from(CHARACTER_BUCKET).upload(path, jpeg, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (uploadError) return jsonError(500, "ההעלאה נכשלה. נסה/י שוב.");

  await db.from("characters").upsert({
    user_id: user.id,
    source_path: path,
    status: "uploaded",
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
