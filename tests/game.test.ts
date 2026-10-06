import { describe, expect, it } from "vitest";
import { XP_RANGE, clampXp } from "@/lib/game/domains";
import { GEAR, isUnlocked, validateLoadout } from "@/lib/game/gear";
import { formatLevel, levelFromXp, levelProgress } from "@/lib/game/levels";
import { addDays, ageOn, localDayKey, weekStartKey } from "@/lib/game/periods";
import { BONUS_CHANCE, MAX_DAILY, MAX_WEEKLY, planPeriod, type TemplateLike } from "@/lib/game/planner";

describe("levels", () => {
  it("levels up every 1000 XP and resets the in-level counter", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(999)).toBe(1);
    expect(levelFromXp(1000)).toBe(2);
    expect(levelFromXp(2500)).toBe(3);
    expect(levelProgress(2350)).toEqual({ level: 3, intoLevel: 350, toNext: 650, fraction: 0.35 });
    expect(levelProgress(-5).level).toBe(1);
    expect(formatLevel(1)).toBe("LVL 01");
    expect(formatLevel(12)).toBe("LVL 12");
  });
});

describe("xp ranges", () => {
  it("clamps to the brief's ranges", () => {
    expect(clampXp("daily", 50)).toBe(10);
    expect(clampXp("daily", 0)).toBe(2);
    expect(clampXp("weekly", 5)).toBe(15);
    expect(clampXp("bonus", 999)).toBe(50);
    expect(clampXp("manual", Number.NaN)).toBe(2);
    expect(XP_RANGE.bonus.max).toBe(50);
  });
});

describe("periods", () => {
  it("computes the local day in the user's timezone", () => {
    // 22:30 UTC on Oct 6 is already Oct 7 in Israel (UTC+3 in October).
    expect(localDayKey(new Date("2026-10-06T22:30:00Z"), "Asia/Jerusalem")).toBe("2026-10-07");
    expect(localDayKey(new Date("2026-10-06T22:30:00Z"), "UTC")).toBe("2026-10-06");
    expect(localDayKey(new Date("2026-10-06T10:00:00Z"), "Not/AZone")).toBe("2026-10-06");
  });

  it("weeks start on Sunday (matches public.week_start)", () => {
    expect(weekStartKey("2026-10-06")).toBe("2026-10-04"); // Tuesday → Sunday
    expect(weekStartKey("2026-10-04")).toBe("2026-10-04"); // Sunday stays
    expect(weekStartKey("2026-10-10")).toBe("2026-10-04"); // Saturday
    expect(weekStartKey("2026-01-01")).toBe("2025-12-28"); // across a year boundary
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("computes age for the 18+ gate", () => {
    expect(ageOn("2008-10-07", "2026-10-06")).toBe(17);
    expect(ageOn("2008-10-06", "2026-10-06")).toBe(18);
    expect(ageOn("2000-02-29", "2026-02-28")).toBe(25);
  });
});

function tpl(id: string, goal: string, kind: TemplateLike["kind"], xp = 5, target = 1): TemplateLike {
  return { id, goal_id: goal, domain: "health", custom_label: null, kind, title: id, description: null, xp, target_count: target };
}

describe("planner", () => {
  const templates: TemplateLike[] = [
    ...["a1", "a2", "a3", "a4"].map((id) => tpl(id, "A", "daily")),
    ...["b1", "b2", "b3"].map((id) => tpl(id, "B", "daily")),
    ...["c1", "c2"].map((id) => tpl(id, "C", "daily")),
    ...["d1", "d2"].map((id) => tpl(id, "D", "daily")),
    tpl("wa1", "A", "weekly", 20, 3),
    tpl("wa2", "A", "weekly", 25, 4),
    tpl("wb1", "B", "weekly", 20, 3),
    tpl("wc1", "C", "weekly", 20, 3),
    tpl("wd1", "D", "weekly", 20, 3),
    tpl("x1", "A", "bonus", 40),
    tpl("x2", "B", "bonus", 30),
  ];
  const base = { templates, dayKey: "2026-10-06", weekKey: "2026-10-04", bonusRoll: null, hasDaily: false, hasWeekly: false };

  it("caps daily and weekly counts and spreads across goals", () => {
    const out = planPeriod(base);
    const daily = out.filter((t) => t.kind === "daily");
    const weekly = out.filter((t) => t.kind === "weekly");
    expect(daily).toHaveLength(MAX_DAILY);
    expect(new Set(daily.map((t) => t.goal_id)).size).toBe(4); // every goal gets something
    expect(weekly).toHaveLength(MAX_WEEKLY);
    expect(out.every((t) => (t.kind === "weekly" ? t.period_key === "2026-10-04" : t.period_key === "2026-10-06"))).toBe(true);
    expect(weekly.every((t) => t.target_count > 1)).toBe(true);
  });

  it("is deterministic for a day and rotates across days", () => {
    expect(planPeriod(base)).toEqual(planPeriod(base));
    const tomorrow = planPeriod({ ...base, dayKey: "2026-10-07" }).filter((t) => t.kind === "daily").map((t) => t.template_id);
    const today = planPeriod(base).filter((t) => t.kind === "daily").map((t) => t.template_id);
    expect(tomorrow).not.toEqual(today);
  });

  it("does not regenerate existing periods", () => {
    expect(planPeriod({ ...base, hasDaily: true, hasWeekly: true })).toEqual([]);
  });

  it("spawns a bonus only when the roll wins", () => {
    expect(planPeriod({ ...base, hasDaily: true, hasWeekly: true, bonusRoll: BONUS_CHANCE - 0.01 })).toHaveLength(1);
    expect(planPeriod({ ...base, hasDaily: true, hasWeekly: true, bonusRoll: BONUS_CHANCE })).toHaveLength(0);
    expect(planPeriod({ ...base, templates: templates.filter((t) => t.kind !== "bonus"), bonusRoll: 0 }).some((t) => t.kind === "bonus")).toBe(false);
  });

  it("handles a plan with no templates", () => {
    expect(planPeriod({ ...base, templates: [] })).toEqual([]);
  });
});

describe("gear", () => {
  it("unlocks by level or tasks", () => {
    const watch = GEAR.find((g) => g.id === "watch")!;
    const sneakers = GEAR.find((g) => g.id === "sneakers")!;
    expect(isUnlocked(watch, { level: 1, tasksCompleted: 0 })).toBe(false);
    expect(isUnlocked(watch, { level: 2, tasksCompleted: 0 })).toBe(true);
    expect(isUnlocked(sneakers, { level: 9, tasksCompleted: 24 })).toBe(false);
    expect(isUnlocked(sneakers, { level: 1, tasksCompleted: 25 })).toBe(true);
  });

  it("rejects locked items, unknown items and two items in one slot", () => {
    const stats = { level: 5, tasksCompleted: 0 };
    expect(validateLoadout(["watch", "jacket"], stats).ok).toBe(true);
    expect(validateLoadout(["hoodie", "jacket"], stats).ok).toBe(false);
    expect(validateLoadout(["armor"], stats).ok).toBe(false);
    expect(validateLoadout(["sneakers"], stats).ok).toBe(false);
    expect(validateLoadout(["laser-sword"], stats).ok).toBe(false);
    expect(validateLoadout([], stats).ok).toBe(true);
  });
});
