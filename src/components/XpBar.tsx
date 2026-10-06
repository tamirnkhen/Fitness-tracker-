import { XP_PER_LEVEL, formatLevel, levelProgress } from "@/lib/game/levels";

export function XpBar({ xpTotal, size = "md" }: { xpTotal: number; size?: "sm" | "md" }) {
  const { level, intoLevel, fraction } = levelProgress(xpTotal);
  return (
    <div className="w-full">
      <div
        role="progressbar"
        aria-label={`התקדמות ברמה ${level}`}
        aria-valuemin={0}
        aria-valuemax={XP_PER_LEVEL}
        aria-valuenow={intoLevel}
        dir="ltr" /* brand: the XP bar always fills left → right, as in the logo */
        className={`w-full overflow-hidden rounded-md border-[1.5px] border-line-strong ${size === "sm" ? "h-2" : "h-3"}`}
      >
        <div className="h-full rounded-[4px] bg-amber transition-[width] duration-[1.4s] ease-[cubic-bezier(.2,.8,.2,1)]" style={{ width: `${fraction * 100}%` }} />
      </div>
      {size === "md" && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="font-display font-bold tracking-[0.15em] text-amber" dir="ltr">
            {formatLevel(level)}
          </span>
          <span className="font-display text-muted" dir="ltr">
            {intoLevel} / {XP_PER_LEVEL} XP
          </span>
        </div>
      )}
    </div>
  );
}
