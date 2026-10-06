"use client";
import { DomainIcon, TaskKindIcon } from "@/components/brand/icons";
import { domainLabel } from "@/lib/game/domains";
import type { Task } from "@/lib/types";

export function TaskCard({ task, busy, onComplete }: { task: Task; busy: boolean; onComplete: (t: Task) => void }) {
  const done = task.status === "done";
  // Brand rule: dashed = not fixed / personal (bonus + personal tasks).
  const dashed = task.kind === "bonus" || task.kind === "manual";
  const multi = task.target_count > 1;

  return (
    <article
      className={`relative flex items-center gap-3 rounded-2xl border bg-card p-4 transition ${dashed ? "border-dashed" : ""} ${
        task.kind === "bonus" ? "border-amber/70" : "border-line"
      } ${done ? "opacity-60" : ""}`}
    >
      <div className="shrink-0">
        <TaskKindIcon kind={task.kind} size={30} title={task.kind === "bonus" ? "בונוס אקראי" : undefined} />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className={`font-sans font-medium leading-6 text-cream ${done ? "line-through decoration-amber/60" : ""}`}>{task.title}</h3>
        {task.description && !done && <p className="mt-0.5 text-sm leading-5 text-muted">{task.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <DomainIcon domain={task.domain} size={14} />
            {domainLabel(task.domain, task.custom_label)}
          </span>
          <span className="font-display font-bold text-amber" dir="ltr">
            +{task.xp} XP
          </span>
          {task.kind === "bonus" && <span className="text-amber/80">Risk / Reward</span>}
        </div>
        {multi && (
          <div className="mt-2.5 flex gap-1" aria-label={`התקדמות ${task.progress} מתוך ${task.target_count}`}>
            {Array.from({ length: task.target_count }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < task.progress ? "bg-amber" : "bg-line-strong"}`} />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onComplete(task)}
        disabled={done || busy}
        aria-label={done ? `${task.title} — הושלם` : multi ? `סמן התקדמות: ${task.title}` : `סמן כבוצע: ${task.title}`}
        className={`flex size-12 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
          done ? "border-amber bg-amber text-ink" : "border-line-strong text-amber hover:border-amber"
        } ${busy ? "animate-pulse" : ""}`}
      >
        {done ? (
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : multi ? (
          <span className="font-display text-sm font-bold" dir="ltr">
            {task.progress}/{task.target_count}
          </span>
        ) : (
          <span className="sr-only">סמן</span>
        )}
      </button>
    </article>
  );
}
