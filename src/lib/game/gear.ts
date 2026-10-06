// Outfit & gear that unlock with level or achievements. `prompt` describes the item
// to the image model when the character is regenerated wearing it.

export type GearSlot = "top" | "feet" | "wrist" | "back";

export type Unlock = { type: "level"; level: number } | { type: "tasks"; count: number };

export interface GearItem {
  id: string;
  name: string;
  slot: GearSlot;
  unlock: Unlock;
  prompt: string;
}

export const GEAR: GearItem[] = [
  { id: "watch", name: "שעון כושר", slot: "wrist", unlock: { type: "level", level: 2 }, prompt: "a sleek black fitness smartwatch on the left wrist" },
  { id: "sneakers", name: "נעלי ריצה", slot: "feet", unlock: { type: "tasks", count: 25 }, prompt: "modern dark running sneakers with subtle amber-gold accents instead of boots" },
  { id: "hoodie", name: "קפוצ'ון ענבר", slot: "top", unlock: { type: "level", level: 3 }, prompt: "an open charcoal hoodie with amber-gold trim worn over the tank top" },
  { id: "backpack", name: "תיק מסעות", slot: "back", unlock: { type: "tasks", count: 60 }, prompt: "a compact dark canvas adventurer backpack with leather straps" },
  { id: "jacket", name: "ז'קט עור", slot: "top", unlock: { type: "level", level: 5 }, prompt: "a fitted dark brown leather jacket over the tank top" },
  { id: "bracer", name: "מגן אמה", slot: "wrist", unlock: { type: "level", level: 8 }, prompt: "a dark leather forearm bracer with a small amber-gold chevron emblem" },
  { id: "cloak", name: "גלימת מסע", slot: "back", unlock: { type: "level", level: 12 }, prompt: "a long charcoal traveler's cloak with an amber-gold clasp" },
  { id: "armor", name: "שריון קל", slot: "top", unlock: { type: "level", level: 20 }, prompt: "light segmented dark armor plates over the chest with thin amber-gold edges" },
];

export function isUnlocked(item: GearItem, stats: { level: number; tasksCompleted: number }): boolean {
  return item.unlock.type === "level" ? stats.level >= item.unlock.level : stats.tasksCompleted >= item.unlock.count;
}

export function unlockLabel(unlock: Unlock): string {
  return unlock.type === "level" ? `נפתח ברמה ${unlock.level}` : `נפתח אחרי ${unlock.count} משימות`;
}

/** Validates a requested loadout: known items, unlocked, at most one per slot. */
export function validateLoadout(
  ids: string[],
  stats: { level: number; tasksCompleted: number },
): { ok: true; items: GearItem[] } | { ok: false; error: string } {
  const unique = [...new Set(ids)];
  const items: GearItem[] = [];
  const slots = new Set<GearSlot>();
  for (const id of unique) {
    const item = GEAR.find((g) => g.id === id);
    if (!item) return { ok: false, error: "פריט לא קיים" };
    if (!isUnlocked(item, stats)) return { ok: false, error: `${item.name} עדיין נעול` };
    if (slots.has(item.slot)) return { ok: false, error: "אפשר ללבוש פריט אחד בכל משבצת" };
    slots.add(item.slot);
    items.push(item);
  }
  return { ok: true, items };
}
