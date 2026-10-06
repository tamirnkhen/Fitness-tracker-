// Every 1000 XP is a level. The in-level counter "resets" while total XP keeps growing.
export const XP_PER_LEVEL = 1000;

export function levelFromXp(xpTotal: number): number {
  return Math.floor(Math.max(0, xpTotal) / XP_PER_LEVEL) + 1;
}

export function levelProgress(xpTotal: number) {
  const xp = Math.max(0, Math.floor(xpTotal));
  const level = levelFromXp(xp);
  const intoLevel = xp % XP_PER_LEVEL;
  return {
    level,
    intoLevel,
    toNext: XP_PER_LEVEL - intoLevel,
    fraction: intoLevel / XP_PER_LEVEL,
  };
}

export function formatLevel(level: number): string {
  return `LVL ${String(level).padStart(2, "0")}`;
}
