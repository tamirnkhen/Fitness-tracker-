import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, jsonError } from "@/lib/api";
import { getProfile, needsOnboarding } from "@/lib/auth";
import { AiUnavailableError } from "@/lib/ai/claude";
import { fallbackPlan } from "@/lib/ai/fallback";
import { MAX_GOALS, generateQuestPlan, sanitizeGoals, type PlannedTemplate } from "@/lib/ai/quest";
import { hasServerEnv } from "@/lib/env";
import { saveQuestPlan, syncQuests } from "@/lib/quests";

const body = z.object({ goals: z.array(z.unknown()).min(1).max(MAX_GOALS) });

export async function POST(request: Request) {
  const { user, response } = await authorize("onboarding-plan");
  if (!user) return response;

  const profile = await getProfile();
  if (!profile || needsOnboarding(profile) === "consent") return jsonError(403, "צריך להשלים את שלב ההסכמה קודם");

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "צריך בין מטרה אחת לארבע");
  const goals = sanitizeGoals(parsed.data.goals);
  if (goals.length === 0) return jsonError(400, "צריך לפחות מטרה אחת עם שם");

  let plan: PlannedTemplate[] = [];
  let source: "ai" | "fallback" = "fallback";
  if (hasServerEnv("ANTHROPIC_API_KEY")) {
    try {
      plan = await generateQuestPlan(goals);
      source = "ai";
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) throw error;
    }
  }
  // Every goal needs at least some daily tasks; fill gaps from the starter plan.
  const fallback = fallbackPlan(goals);
  for (let i = 0; i < goals.length; i++) {
    if (!plan.some((t) => t.goal_index === i && t.kind === "daily")) {
      plan.push(...fallback.filter((t) => t.goal_index === i));
    }
  }

  await saveQuestPlan(user.id, goals, plan);
  await syncQuests(profile);
  return NextResponse.json({ ok: true, source });
}
