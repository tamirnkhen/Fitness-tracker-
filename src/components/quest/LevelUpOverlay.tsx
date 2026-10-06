"use client";
import { useEffect, useRef, useState } from "react";
import { Chevrons } from "@/components/brand/Logo";
import { GEAR, isUnlocked } from "@/lib/game/gear";

// A full-screen moment, not a "+1": chevrons surge upward, a gold shockwave,
// the level number counts up and newly unlocked gear is revealed.

const SPARKS = Array.from({ length: 18 }, (_, i) => ({
  angle: (360 / 18) * i,
  distance: 110 + ((i * 37) % 70),
  delay: (i % 6) * 0.04,
}));

export function LevelUpOverlay(props: { from: number; to: number; tasksCompleted: number; onClose: () => void }) {
  const [shown, setShown] = useState(props.from);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(props.onClose);
  useEffect(() => {
    onCloseRef.current = props.onClose;
  });

  const unlocked = GEAR.filter(
    (g) => g.unlock.type === "level" && isUnlocked(g, { level: props.to, tasksCompleted: props.tasksCompleted }) && !isUnlocked(g, { level: props.from, tasksCompleted: props.tasksCompleted }),
  );

  useEffect(() => {
    navigator.vibrate?.([30, 60, 30, 60, 120]);
    const start = setTimeout(() => setShown(props.to), 900);
    const focus = setTimeout(() => buttonRef.current?.focus(), 1200);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(start);
      clearTimeout(focus);
      window.removeEventListener("keydown", onKey);
    };
  }, [props.to]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="levelup-title"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-ink/95 px-6 text-center backdrop-blur-sm"
    >
      <style>{`
        @keyframes lu-rise { 0% { transform: translateY(120px) scale(.6); opacity: 0 } 60% { opacity: 1 } 100% { transform: translateY(0) scale(1); opacity: 1 } }
        @keyframes lu-wave { 0% { transform: scale(.2); opacity: .9 } 100% { transform: scale(3.2); opacity: 0 } }
        @keyframes lu-spark { 0% { transform: rotate(var(--a)) translateX(0); opacity: 1 } 100% { transform: rotate(var(--a)) translateX(var(--d)); opacity: 0 } }
        @keyframes lu-pop { 0% { transform: scale(.4); opacity: 0 } 70% { transform: scale(1.15); opacity: 1 } 100% { transform: scale(1) } }
        @keyframes lu-fill { from { width: 0 } to { width: 100% } }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(217,164,65,0.22),transparent_55%)]" />
      <div className="pointer-events-none absolute top-[40%] left-1/2 -ml-24 -mt-24 size-48 rounded-full border-2 border-amber [animation:lu-wave_1.4s_ease-out_0.5s_both]" />
      <div className="pointer-events-none absolute top-[40%] left-1/2 -ml-24 -mt-24 size-48 rounded-full border border-amber/60 [animation:lu-wave_1.6s_ease-out_0.75s_both]" />
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="pointer-events-none absolute top-[40%] left-1/2 size-1.5 rounded-full bg-amber"
          style={{ ["--a" as string]: `${s.angle}deg`, ["--d" as string]: `${s.distance}px`, animation: `lu-spark 1s ease-out ${0.55 + s.delay}s both` }}
        />
      ))}

      <div className="relative [animation:lu-rise_0.9s_cubic-bezier(.2,.8,.2,1)_both]">
        <Chevrons size={96} animated />
      </div>

      <p className="relative mt-6 font-display text-sm font-bold tracking-[0.4em] text-amber [animation:lu-pop_0.5s_ease-out_0.6s_both]" dir="ltr">
        LEVEL UP
      </p>
      <h2 id="levelup-title" className="relative mt-2 font-display text-8xl font-extrabold text-cream [animation:lu-pop_0.6s_ease-out_0.8s_both]" dir="ltr">
        <span className="sr-only">עלית לרמה </span>
        {String(shown).padStart(2, "0")}
      </h2>

      <div className="relative mt-6 h-2.5 w-64 overflow-hidden rounded-md border-[1.5px] border-line-strong" aria-hidden="true">
        <div className="h-full bg-amber [animation:lu-fill_0.9s_ease-in-out_0.3s_both]" />
      </div>
      <p className="relative mt-4 max-w-xs text-body [animation:lu-pop_0.5s_ease-out_1.1s_both]">1000 נקודות. רמה חדשה. המסע ממשיך.</p>

      {unlocked.length > 0 && (
        <div className="relative mt-6 rounded-2xl border border-amber-dim bg-card px-5 py-4 [animation:lu-pop_0.5s_ease-out_1.3s_both]">
          <p className="text-xs font-semibold tracking-[0.2em] text-amber">נפתח לדמות</p>
          <p className="mt-1 text-cream">{unlocked.map((g) => g.name).join(" · ")}</p>
        </div>
      )}

      <button
        ref={buttonRef}
        onClick={props.onClose}
        className="relative mt-10 min-h-12 rounded-xl bg-amber px-8 font-bold text-ink [animation:lu-pop_0.5s_ease-out_1.4s_both]"
      >
        ממשיכים
      </button>
    </div>
  );
}
