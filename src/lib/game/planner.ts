import type { Domain } from "./domains";

// Turns a user's quest plan (templates) into the concrete tasks for a day/week.
// Pure and deterministic for a given day so it is safe to run on every visit:
// inserts are idempotent thanks to the (template_id, period_key) unique key.

export const DAILY_PER_GOAL = 2;
export const MAX_DAILY = 6;
export const WEEKLY_PER_GOAL = 1;
export const MAX_WEEKLY = 3;
/** Chance per day that a surprise bonus quest appears. */
export const BONUS_CHANCE = 0.35;

export interface TemplateLike {
  id: string;
  goal_id: string | null;
  domain: Domain;
  custom_label: string | null;
  kind: "daily" | "weekly" | "bonus";
  title: string;
  description: string | null;
  xp: number;
  target_count: number;
}

export interface PlannedTask {
  template_id: string;
  goal_id: string | null;
  domain: Domain;
  custom_label: string | null;
  kind: "daily" | "weekly" | "bonus";
  title: string;
  description: string | null;
  xp: number;
  target_count: number;
  period_key: string;
}

function dayIndex(key: string): number {
  return Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function groupByGoal(templates: TemplateLike[]): TemplateLike[][] {
  const groups = new Map<string, TemplateLike[]>();
  for (const t of [...templates].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = t.goal_id ?? "_";
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, list]) => list);
}

/** Rotate through each goal's templates, then interleave goals until the cap is hit. */
function pickRotating(templates: TemplateLike[], rotation: number, perGoal: number, cap: number): TemplateLike[] {
  const perGoalPicks = groupByGoal(templates).map((list) => {
    const n = Math.min(perGoal, list.length);
    const offset = ((rotation * perGoal) % list.length + list.length) % list.length;
    return Array.from({ length: n }, (_, i) => list[(offset + i) % list.length]);
  });
  const result: TemplateLike[] = [];
  for (let round = 0; result.length < cap; round++) {
    let added = false;
    for (const picks of perGoalPicks) {
      if (round < picks.length && result.length < cap) {
        result.push(picks[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return result;
}

function toPlanned(t: TemplateLike, periodKey: string): PlannedTask {
  return {
    template_id: t.id,
    goal_id: t.goal_id,
    domain: t.domain,
    custom_label: t.custom_label,
    kind: t.kind,
    title: t.title,
    description: t.description,
    xp: t.xp,
    target_count: t.kind === "weekly" ? t.target_count : 1,
    period_key: periodKey,
  };
}

export function planPeriod(params: {
  templates: TemplateLike[];
  dayKey: string;
  weekKey: string;
  /** Uniform random in [0,1) if the bonus has not been rolled today yet, otherwise null. */
  bonusRoll: number | null;
  /** Day/week tasks that already exist, so the caller can tell what is new. */
  hasDaily: boolean;
  hasWeekly: boolean;
}): PlannedTask[] {
  const { templates, dayKey, weekKey, bonusRoll } = params;
  const out: PlannedTask[] = [];

  if (!params.hasDaily) {
    const daily = templates.filter((t) => t.kind === "daily");
    for (const t of pickRotating(daily, dayIndex(dayKey), DAILY_PER_GOAL, MAX_DAILY)) {
      out.push(toPlanned(t, dayKey));
    }
  }

  if (!params.hasWeekly) {
    const weekly = templates.filter((t) => t.kind === "weekly");
    const weekNo = Math.floor(dayIndex(weekKey) / 7);
    for (const t of pickRotating(weekly, weekNo, WEEKLY_PER_GOAL, MAX_WEEKLY)) {
      out.push(toPlanned(t, weekKey));
    }
  }

  if (bonusRoll !== null && bonusRoll < BONUS_CHANCE) {
    const bonus = templates.filter((t) => t.kind === "bonus").sort((a, b) => a.id.localeCompare(b.id));
    if (bonus.length > 0) {
      out.push(toPlanned(bonus[hash(dayKey) % bonus.length], dayKey));
    }
  }

  return out;
}
