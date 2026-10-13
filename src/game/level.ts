/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return 100 + 20 * (Math.max(1, level) - 1);
}

/** Total XP needed to reach `level` from 0. */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level)) - 1;
  // sum_{l=1..n} (100 + 20(l-1)) = 100n + 10n(n-1)
  return 100 * n + 10 * n * (n - 1);
}

export interface LevelInfo {
  level: number;
  into: number;
  need: number;
  pct: number;
}

export function levelInfo(xp: number): LevelInfo {
  const total = Math.max(0, Math.floor(xp));
  // invert 10n^2 + 90n - total = 0
  let n = Math.floor((-90 + Math.sqrt(8100 + 40 * total)) / 20);
  while (xpForLevel(n + 2) <= total) n++;
  while (n > 0 && xpForLevel(n + 1) > total) n--;
  const level = n + 1;
  const into = total - xpForLevel(level);
  const need = xpToNext(level);
  return { level, into, need, pct: Math.min(1, into / need) };
}

export const levelOf = (xp: number) => levelInfo(xp).level;
