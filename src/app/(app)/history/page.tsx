import type { Metadata } from "next";
import { DomainIcon, MilestoneIcon, TaskKindIcon } from "@/components/brand/icons";
import { requireActiveProfile } from "@/lib/auth";
import { domainLabel } from "@/lib/game/domains";
import { XP_PER_LEVEL, levelFromXp } from "@/lib/game/levels";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/types";

export const metadata: Metadata = { title: "היסטוריה" };

export default async function HistoryPage() {
  const profile = await requireActiveProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", profile.id)
    .eq("status", "done")
    .order("completed_at", { ascending: false })
    .limit(200);
  const tasks = (data ?? []) as Task[];

  const fmt = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: profile.timezone });
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = fmt.format(new Date(t.completed_at!));
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  // Walk backwards from the current total to mark the task that triggered each level-up.
  const levelUps = new Map<string, number>();
  let running = profile.xp_total;
  for (const t of tasks) {
    if (levelFromXp(running) > levelFromXp(running - t.xp)) levelUps.set(t.id, levelFromXp(running));
    running -= t.xp;
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-black">היסטוריית משימות</h1>
      <p className="mb-6 text-sm text-muted">
        <span className="font-display" dir="ltr">
          {profile.xp_total} XP
        </span>{" "}
        · {tasks.length} משימות אחרונות
      </p>

      {tasks.length === 0 && (
        <p className="rounded-2xl border border-line bg-card p-5 text-sm text-muted">עוד לא הושלמו משימות. כל משימה שתסמן/י תופיע כאן.</p>
      )}

      {[...groups.entries()].map(([day, list]) => (
        <section key={day} className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted">{day}</h2>
          <ul className="flex flex-col gap-2">
            {list.map((t) => {
              const leveledTo = levelUps.get(t.id);
              return (
                <li key={t.id}>
                  {leveledTo && (
                    <p className="mb-2 flex items-center gap-2 rounded-xl border border-amber-dim bg-[#1e1812] px-4 py-2 text-sm text-amber">
                      <MilestoneIcon size={16} /> עלית לרמה {leveledTo} · כל {XP_PER_LEVEL} נק׳
                    </p>
                  )}
                  <div className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
                    <TaskKindIcon kind={t.kind} size={20} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-cream">{t.title}</span>
                      <span className="flex items-center gap-1 text-xs text-muted">
                        <DomainIcon domain={t.domain} size={12} /> {domainLabel(t.domain, t.custom_label)}
                      </span>
                    </span>
                    <span className="font-display text-sm font-bold text-amber" dir="ltr">
                      +{t.xp}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
