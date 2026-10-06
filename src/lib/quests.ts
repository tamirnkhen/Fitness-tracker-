import "server-only";
import { randomInt } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { planPeriod, type TemplateLike } from "@/lib/game/planner";
import { localDayKey, weekStartKey } from "@/lib/game/periods";
import type { GoalDraft, PlannedTemplate } from "@/lib/ai/quest";
import type { Profile, Task } from "@/lib/types";

/**
 * Makes sure today's daily tasks, this week's weekly tasks and (maybe) a surprise
 * bonus exist, expires stale ones and records the activity day. Idempotent.
 * `userId` must come from a verified session.
 */
export async function syncQuests(profile: Pick<Profile, "id" | "timezone">) {
  const db = createServiceClient();
  const today = localDayKey(new Date(), profile.timezone);
  const week = weekStartKey(today);

  await Promise.all([
    db.from("tasks").update({ status: "expired" }).eq("user_id", profile.id).eq("status", "open").neq("kind", "weekly").lt("period_key", today),
    db.from("tasks").update({ status: "expired" }).eq("user_id", profile.id).eq("status", "open").eq("kind", "weekly").lt("period_key", week),
  ]);

  // Record activity and claim today's bonus roll atomically: only the request that
  // inserts the row gets to roll.
  const { data: inserted } = await db
    .from("activity_days")
    .upsert({ user_id: profile.id, day: today, bonus_rolled: true }, { onConflict: "user_id,day", ignoreDuplicates: true })
    .select("day");
  const firstVisitToday = (inserted?.length ?? 0) > 0;

  const [{ data: templates }, { count: dailyCount }, { count: weeklyCount }] = await Promise.all([
    db.from("task_templates").select("id, goal_id, domain, custom_label, kind, title, description, xp, target_count").eq("user_id", profile.id).eq("active", true),
    db.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", profile.id).eq("kind", "daily").eq("period_key", today),
    db.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", profile.id).eq("kind", "weekly").eq("period_key", week),
  ]);

  const planned = planPeriod({
    templates: (templates ?? []) as TemplateLike[],
    dayKey: today,
    weekKey: week,
    bonusRoll: firstVisitToday ? randomInt(0, 1_000_000) / 1_000_000 : null,
    hasDaily: (dailyCount ?? 0) > 0,
    hasWeekly: (weeklyCount ?? 0) > 0,
  });

  if (planned.length > 0) {
    await db
      .from("tasks")
      .upsert(planned.map((t) => ({ ...t, user_id: profile.id })), { onConflict: "template_id,period_key", ignoreDuplicates: true });
  }

  await db.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", profile.id);
  return { today, week };
}

export async function getCurrentTasks(userId: string, today: string, week: string): Promise<Task[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .or(`and(kind.eq.weekly,period_key.eq.${week}),and(kind.neq.weekly,period_key.eq.${today})`)
    .order("created_at", { ascending: true });
  return (data ?? []) as Task[];
}

/** Persist goals + quest plan and mark onboarding complete. */
export async function saveQuestPlan(userId: string, goals: GoalDraft[], plan: PlannedTemplate[]) {
  const db = createServiceClient();

  // Starting over (e.g. re-running onboarding): retire the previous plan.
  await db.from("task_templates").update({ active: false }).eq("user_id", userId);
  await db.from("goals").update({ status: "archived" }).eq("user_id", userId).eq("status", "active");

  const { data: goalRows, error: goalError } = await db
    .from("goals")
    .insert(goals.map((g) => ({ ...g, user_id: userId })))
    .select("id, domain, custom_label");
  if (goalError || !goalRows) throw new Error(goalError?.message ?? "failed to save goals");

  const templates = plan.map((t) => {
    const goal = goalRows[t.goal_index];
    return {
      user_id: userId,
      goal_id: goal.id,
      domain: goal.domain,
      custom_label: goal.custom_label,
      kind: t.kind,
      title: t.title,
      description: t.description || null,
      xp: t.xp,
      target_count: t.target_count,
    };
  });
  const { error: templateError } = await db.from("task_templates").insert(templates);
  if (templateError) throw new Error(templateError.message);

  // Clear today's/this week's open generated tasks so the new plan takes over.
  await db.from("tasks").delete().eq("user_id", userId).eq("status", "open").neq("kind", "manual");

  await db.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", userId);
  await db.from("onboarding_sessions").delete().eq("user_id", userId);
}

export async function getDomainBreakdown(userId: string) {
  const db = createServiceClient();
  const { data } = await db.from("xp_events").select("domain, amount").eq("user_id", userId);
  const totals = new Map<string, number>();
  for (const row of data ?? []) totals.set(row.domain, (totals.get(row.domain) ?? 0) + row.amount);
  return totals;
}

export async function countCompletedTasks(userId: string): Promise<number> {
  const db = createServiceClient();
  const { count } = await db.from("xp_events").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return count ?? 0;
}
