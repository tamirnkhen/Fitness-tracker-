export interface QuestConfig {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  CONTACT: string;
}

declare global {
  interface Window {
    QUEST_CONFIG?: Partial<QuestConfig>;
  }
}

export type ConfigProblem = 'missing' | 'bad_url' | 'secret_key';

export interface ConfigState {
  ok: boolean;
  problem?: ConfigProblem;
  url: string;
  key: string;
  contact: string;
}

function jwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3 || !key.startsWith('eyJ')) return null;
  try {
    const json = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'));
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

/** True for keys that must never be used in a browser. */
export function isSecretKey(key: string): boolean {
  return key.startsWith('sb_secret_') || jwtRole(key) === 'service_role';
}

/** Reads /config.js (runtime, not build-time). Never throws. */
export function readConfig(raw: Partial<QuestConfig> | undefined = globalThis.window?.QUEST_CONFIG): ConfigState {
  const url = String(raw?.SUPABASE_URL ?? '')
    .trim()
    .replace(/\/+$/, '');
  const key = String(raw?.SUPABASE_KEY ?? '').trim();
  const contact = String(raw?.CONTACT ?? '')
    .trim()
    .slice(0, 120);
  const base = { url, key, contact };
  if (!url || !key) return { ok: false, problem: 'missing', ...base };
  if (isSecretKey(key)) return { ok: false, problem: 'secret_key', ...base, key: '' };
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, problem: 'bad_url', ...base };
  }
  const sameOrigin = typeof location !== 'undefined' && u.origin === location.origin;
  if (!sameOrigin && (u.protocol !== 'https:' || !/\.supabase\.co$/.test(u.hostname))) {
    return { ok: false, problem: 'bad_url', ...base };
  }
  return { ok: true, url: u.origin, key, contact };
}
