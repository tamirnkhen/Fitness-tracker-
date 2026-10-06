"use client";
import { useState } from "react";
import { FormError } from "@/components/ui";
import { GEAR, unlockLabel, type GearSlot } from "@/lib/game/gear";

const SLOT_LABEL: Record<GearSlot, string> = { top: "גוף", feet: "רגליים", wrist: "יד", back: "גב" };

export function GearPicker({ unlockedIds, equipped: initial }: { unlockedIds: string[]; equipped: string[] }) {
  const [equipped, setEquipped] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function toggle(id: string) {
    const item = GEAR.find((g) => g.id === id)!;
    const next = equipped.includes(id)
      ? equipped.filter((e) => e !== id)
      : [...equipped.filter((e) => GEAR.find((g) => g.id === e)?.slot !== item.slot), id];
    setSaving(true);
    setError(null);
    const res = await fetch("/api/character/equip", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: next }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setError(data?.error ?? "לא נשמר — נסה/י שוב");
      return;
    }
    setEquipped(next);
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="mb-1 text-lg font-bold">ציוד ולבוש</h2>
      <p className="mb-4 text-sm text-muted">נפתחים עם רמות והישגים. אחרי שבוחרים — מעדכנים את הדמות.</p>
      <ul className="grid grid-cols-2 gap-2.5">
        {GEAR.map((g) => {
          const unlocked = unlockedIds.includes(g.id);
          const on = equipped.includes(g.id);
          return (
            <li key={g.id}>
              <button
                type="button"
                disabled={!unlocked || saving}
                aria-pressed={on}
                onClick={() => toggle(g.id)}
                className={`flex min-h-20 w-full flex-col items-start justify-center rounded-xl border p-3 text-start transition ${
                  on ? "border-amber bg-amber/10" : unlocked ? "border-line-strong hover:border-amber" : "border-dashed border-line opacity-55"
                }`}
              >
                <span className="text-sm font-medium text-cream">{g.name}</span>
                <span className="text-xs text-muted">{unlocked ? (on ? `לבוש · ${SLOT_LABEL[g.slot]}` : SLOT_LABEL[g.slot]) : `🔒 ${unlockLabel(g.unlock)}`}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3">
        <FormError message={error} />
      </div>
    </section>
  );
}
