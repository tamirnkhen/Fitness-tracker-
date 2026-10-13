import type { DayKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day of a Date (respects the device time zone and DST). */
export function dayKey(d: Date = new Date()): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isDayKey(s: unknown): s is DayKey {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toUtc(k: DayKey): number {
  const [y, m, d] = k.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Whole calendar days from a to b (b - a). DST-proof: works on UTC midnights. */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

export function addDays(k: DayKey, n: number): DayKey {
  const d = new Date(toUtc(k) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 0 = Sunday */
export function weekday(k: DayKey): number {
  return new Date(toUtc(k)).getUTCDay();
}
