"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TaskKindIcon } from "@/components/brand/icons";
import { XpBar } from "@/components/XpBar";
import type { CompleteTaskResult, Task } from "@/lib/types";
import { AddTaskSheet } from "./AddTaskSheet";
import { LevelUpOverlay } from "./LevelUpOverlay";
import { TaskCard } from "./TaskCard";

export function QuestBoard(props: { tasks: Task[]; xpTotal: number; tasksCompleted: number; firstRun: boolean }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(props.tasks);
  const [xpTotal, setXpTotal] = useState(props.xpTotal);
  const [completedCount, setCompletedCount] = useState(props.tasksCompleted);
  const [levelUp, setLevelUp] = useState<{ from: number; to: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  async function complete(task: Task) {
    if (busy) return;
    setBusy(task.id);
    const res = await fetch(`/api/tasks/${task.id}/complete`, { method: "POST" }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      flash(data?.error ?? "אין חיבור — נסה/י שוב בעוד רגע");
      if (res?.status === 409) router.refresh();
      return;
    }
    const result = (await res.json()) as CompleteTaskResult;
    setTasks((all) =>
      all.map((t) =>
        t.id === task.id
          ? { ...t, progress: result.progress, status: result.completed ? "done" : "open", completed_at: result.completed ? new Date().toISOString() : null }
          : t,
      ),
    );
    if (result.completed) {
      setXpTotal(result.xp_total);
      setCompletedCount((c) => c + 1);
      flash(`‎+${result.xp_awarded} XP`);
      navigator.vibrate?.(20);
    }
    if (result.level_after > result.level_before) setLevelUp({ from: result.level_before, to: result.level_after });
  }

  const byKind = (kind: Task["kind"]) => tasks.filter((t) => t.kind === kind);
  const bonus = byKind("bonus");
  const daily = byKind("daily");
  const weekly = byKind("weekly");
  const manual = byKind("manual");
  const dailyDone = [...daily, ...manual].filter((t) => t.status === "done").length;

  return (
    <>
      <div className="mb-6">
        <XpBar xpTotal={xpTotal} />
      </div>

      {props.firstRun && dailyDone === 0 && (
        <p className="mb-5 animate-fade-up rounded-2xl border border-amber-dim bg-[#1e1812] p-4 text-sm leading-6 text-[#D9C9A8]">
          <strong className="text-amber">המשימה הראשונה שלך מחכה.</strong> בחר/י משימה יומית אחת, בצע/י אותה וסמן/י — וקבל/י את ה-XP הראשון.
        </p>
      )}

      {bonus.length > 0 && (
        <Section title="בונוס אקראי" kind="bonus" subtitle="צץ בלי התראה · רק להיום">
          {bonus.map((t) => (
            <TaskCard key={t.id} task={t} busy={busy === t.id} onComplete={complete} />
          ))}
        </Section>
      )}

      <Section title="משימות היום" kind="daily" subtitle={`${dailyDone} / ${daily.length + manual.length} הושלמו`}>
        {daily.length === 0 && manual.length === 0 && <p className="text-sm text-muted">אין משימות להיום עדיין.</p>}
        {daily.map((t) => (
          <TaskCard key={t.id} task={t} busy={busy === t.id} onComplete={complete} />
        ))}
        {manual.map((t) => (
          <TaskCard key={t.id} task={t} busy={busy === t.id} onComplete={complete} />
        ))}
        <AddTaskSheet onAdded={(task) => setTasks((all) => [...all, task])} />
      </Section>

      {weekly.length > 0 && (
        <Section title="יעדי השבוע" kind="weekly" subtitle="יעד מצטבר">
          {weekly.map((t) => (
            <TaskCard key={t.id} task={t} busy={busy === t.id} onComplete={complete} />
          ))}
        </Section>
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center">
        {toast && (
          <span className="animate-fade-up rounded-full border border-amber-dim bg-card-raised px-5 py-2 font-display font-bold text-amber shadow-lg">
            {toast}
          </span>
        )}
      </div>

      {levelUp && (
        <LevelUpOverlay
          from={levelUp.from}
          to={levelUp.to}
          tasksCompleted={completedCount}
          onClose={() => {
            setLevelUp(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function Section(props: { title: string; subtitle: string; kind: Task["kind"]; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <header className="mb-3 flex items-end justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <TaskKindIcon kind={props.kind} size={18} />
          {props.title}
        </h2>
        <span className="text-xs text-muted">{props.subtitle}</span>
      </header>
      <div className="flex flex-col gap-2.5">{props.children}</div>
    </section>
  );
}
