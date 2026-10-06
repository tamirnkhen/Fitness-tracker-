import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, jsonError } from "@/lib/api";
import { getProfile } from "@/lib/auth";
import { validateLoadout } from "@/lib/game/gear";
import { countCompletedTasks } from "@/lib/quests";
import { createServiceClient } from "@/lib/supabase/admin";

const body = z.object({ items: z.array(z.string().max(40)).max(8) });

export async function POST(request: Request) {
  const { user, response } = await authorize();
  if (!user) return response;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "בקשה לא תקינה");

  const profile = await getProfile();
  if (!profile) return jsonError(401, "צריך להתחבר מחדש");

  // Unlocks are re-checked on the server against real progress.
  const result = validateLoadout(parsed.data.items, { level: profile.level, tasksCompleted: await countCompletedTasks(user.id) });
  if (!result.ok) return jsonError(400, result.error);

  await createServiceClient()
    .from("characters")
    .upsert({ user_id: user.id, equipped: result.items.map((i) => i.id), updated_at: new Date().toISOString() });

  return NextResponse.json({ ok: true, equipped: result.items.map((i) => i.id) });
}
