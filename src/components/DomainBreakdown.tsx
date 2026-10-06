import { DomainIcon } from "@/components/brand/icons";
import { DOMAINS, DOMAIN_INFO } from "@/lib/game/domains";

/** XP per domain as labelled bars — one accent colour, values printed, no legend needed. */
export function DomainBreakdown({ totals }: { totals: Map<string, number> }) {
  const max = Math.max(1, ...totals.values());
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <header className="mb-4 flex items-end justify-between">
        <h2 className="text-lg font-bold">XP לפי תחום</h2>
        <span className="font-display text-xs text-muted" dir="ltr">
          {sum} XP
        </span>
      </header>
      {sum === 0 ? (
        <p className="text-sm text-muted">כאן תראה/י איפה הכי התקדמת. השלם/י משימה כדי להתחיל.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {DOMAINS.filter((d) => (totals.get(d) ?? 0) > 0).map((d) => {
            const value = totals.get(d) ?? 0;
            return (
              <li key={d} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 text-body">
                  <DomainIcon domain={d} size={16} />
                  {DOMAIN_INFO[d].label}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
                  <span className="block h-full rounded-full bg-amber" style={{ width: `${(value / max) * 100}%` }} />
                </span>
                <span className="text-start font-display text-xs text-muted" dir="ltr">
                  {value}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
