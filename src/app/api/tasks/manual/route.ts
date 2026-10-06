import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, jsonError } from "@/lib/api";
import { getProfile, needsOnboarding } from "@/lib/auth";
import { AiUnavailableError } from "@/lib/ai/claude";
import { scoreManualTask } from "@/lib/ai/quest";
import { hasServerEnv } from "@/lib/env";
import { DOMAINS, XP_RANGE } from "@/lib/game/domains";
import { localDayKey } from "@/lib/game/periods";
import { createServiceClient } from "@/lib/supabase/admin";

/** Manual tasks per day — keeps the XP economy honest. */
const MAX_MANUAL_PER_DAY = 5;
const DEFAULT_MANUAL_XP = 5;

const body = z.object({
  text: z.string().trim().min(3).max(200),
  domain: z.enum(DOMAINS).nullable().optional(),
});

export async function POST(request: Request) {
  const { user, response } = await authorize("manual-task");
  if (!user) return response;

  const profile = await getProfile();
  if (!profile || needsOnboarding(profile)) return jsonError(403, "צריך להשלים את ההרשמה");

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "תאר/י את המשימה ב-3 עד 200 תווים");

  const db = createServiceClient();
  const today = localDayKey(new Date(), profile.timezone);
  const { count } = await db
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("kind", "manual")
    .eq("period_key", today);
  if ((count ?? 0) >= MAX_MANUAL_PER_DAY) return jsonError(429, `אפשר להוסיף עד ${MAX_MANUAL_PER_DAY} משימות אישיות ביום`);

  let task = {
    title: parsed.data.text.slice(0, 140),
    domain: parsed.data.domain ?? ("personal" as const),
    custom_label: null as string | null,
    xp: DEFAULT_MANUAL_XP,
  };
  let scoredByAi = false;

  if (hasServerEnv("ANTHROPIC_API_KEY")) {
    try {
      const scored = await scoreManualTask(parsed.data.text, parsed.data.domain ?? null);
      if (!scored.acceptable) return jsonError(422, scored.reason || "זו לא נראית כמו משימה שאפשר לבצע היום");
      task = { title: scored.title, domain: scored.domain, custom_label: scored.custom_label, xp: scored.xp };
      scoredByAi = true;
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) throw error;
    }
  }

  const { data, error } = await db
    .from("tasks")
    .insert({
      user_id: user.id,
      kind: "manual",
      ...task,
      xp: Math.min(XP_RANGE.manual.max, Math.max(XP_RANGE.manual.min, task.xp)),
      period_key: today,
    })
    .select("*")
    .single();
  if (error) return jsonError(500, "לא הצלחנו לשמור את המשימה");

  return NextResponse.json({ task: data, scoredByAi });
}
