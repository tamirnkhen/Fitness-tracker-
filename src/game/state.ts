import { REALM_IDS, STRUGGLE_IDS, type GameState, type RealmId, type StruggleId, type Quest } from './types';
import { isDayKey } from './dates';
import { MAX_TIER } from '../content/tracks';

export const STATE_VERSION = 2;

const zeroRealms = (): Record<RealmId, number> =>
  Object.fromEntries(REALM_IDS.map((r) => [r, 0])) as Record<RealmId, number>;

export function newSeed(): string {
  const b = new Uint8Array(8);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function newState(seed: string = newSeed(), now: number = Date.now()): GameState {
  return {
    v: 2,
    seed,
    createdAt: now,
    updatedAt: now,
    profile: { heroName: '', focus: [], struggles: [], minutes: 20, goal: '', block: '', onboarded: false },
    xp: 0,
    realmXp: zeroRealms(),
    streak: { count: 0, best: 0, last: null, shields: 0 },
    day: null,
    history: {},
    adapt: Object.fromEntries(REALM_IDS.map((r) => [r, { tier: 0, hits: 0, misses: 0 }])) as GameState['adapt'],
    boss: null,
    bossesDefeated: [],
    ach: {},
    title: 'wanderer',
    journal: [],
    counters: {
      quests: 0,
      text: 0,
      creator: 0,
      wild: 0,
      micro: 0,
      eased: 0,
      perfectDays: 0,
      comebacks: 0,
      perRealm: zeroRealms(),
    },
    settings: { mute: false, reminders: null, focusMode: false },
    char: null,
    seenBroadcast: '',
  };
}

const num = (v: unknown, d = 0, min = 0, max = 1e9) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const str = (v: unknown, d = '', maxLen = 2000) => (typeof v === 'string' ? v.slice(0, maxLen) : d);
const isRealm = (v: unknown): v is RealmId => typeof v === 'string' && (REALM_IDS as readonly string[]).includes(v);
const isStruggle = (v: unknown): v is StruggleId =>
  typeof v === 'string' && (STRUGGLE_IDS as readonly string[]).includes(v);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function cleanQuest(q: unknown): Quest | null {
  const o = obj(q);
  if (typeof o.id !== 'string' || !isRealm(o.realm)) return null;
  const kind = o.kind === 'text' || o.kind === 'count' ? o.kind : 'check';
  const source = ['track', 'side', 'wild', 'creator', 'micro'].includes(o.source as string)
    ? (o.source as Quest['source'])
    : 'side';
  const out: Quest = {
    id: o.id,
    tpl: str(o.tpl, o.id),
    source,
    realm: o.realm,
    kind,
    title: str(o.title, '', 200),
    xp: num(o.xp, 10, 0, 500),
    done: o.done === true,
  };
  if (typeof o.desc === 'string') out.desc = str(o.desc, '', 400);
  if (typeof o.target === 'number') out.target = num(o.target, 1, 1, 1000);
  if (typeof o.unit === 'string') out.unit = str(o.unit, '', 40);
  if (typeof o.prompt === 'string') out.prompt = str(o.prompt, '', 200);
  if (o.journal === true) out.journal = true;
  if (typeof o.tier === 'number') out.tier = num(o.tier, 0, 0, MAX_TIER);
  if (typeof o.progress === 'number') out.progress = num(o.progress, 0, 0, 1000);
  if (typeof o.text === 'string') out.text = str(o.text, '', 2000);
  if (o.weak === true) out.weak = true;
  if (o.eased === true) out.eased = true;
  if (typeof o.doneAt === 'number') out.doneAt = o.doneAt;
  if (typeof o.gained === 'number') out.gained = num(o.gained, 0, 0, 5000);
  return out;
}

/**
 * Accepts anything (old versions, corrupted storage, the server copy) and
 * returns a valid GameState. Never throws.
 */
export function normalizeState(raw: unknown): GameState {
  const base = newState(typeof obj(raw).seed === 'string' ? (obj(raw).seed as string) : undefined);
  const r = obj(raw);
  if (!Object.keys(r).length) return base;
  const s = base;
  s.createdAt = num(r.createdAt, s.createdAt, 0, 1e15);
  s.updatedAt = num(r.updatedAt, 0, 0, 1e15);
  const p = obj(r.profile);
  s.profile = {
    heroName: str(p.heroName, '', 24),
    focus: Array.isArray(p.focus) ? (p.focus.filter(isRealm).slice(0, 3) as RealmId[]) : [],
    struggles: Array.isArray(p.struggles) ? (p.struggles.filter(isStruggle).slice(0, 3) as StruggleId[]) : [],
    minutes: p.minutes === 10 || p.minutes === 40 ? p.minutes : 20,
    goal: str(p.goal, '', 600),
    block: str(p.block, '', 600),
    onboarded: p.onboarded === true,
  };
  s.xp = Math.floor(num(r.xp, 0));
  const rx = obj(r.realmXp);
  for (const k of REALM_IDS) s.realmXp[k] = num(rx[k], 0);
  const st = obj(r.streak);
  s.streak = {
    count: num(st.count, 0, 0, 100000),
    best: num(st.best, 0, 0, 100000),
    last: isDayKey(st.last) ? st.last : null,
    shields: num(st.shields, 0, 0, 2),
  };
  s.streak.best = Math.max(s.streak.best, s.streak.count);
  const d = obj(r.day);
  if (isDayKey(d.key) && Array.isArray(d.quests)) {
    s.day = {
      key: d.key,
      quests: d.quests.map(cleanQuest).filter((q): q is Quest => !!q),
      returning: d.returning === true,
      perfect: d.perfect === true,
    };
  }
  const h = obj(r.history);
  for (const [k, v] of Object.entries(h)) {
    if (!isDayKey(k)) continue;
    const o = obj(v);
    s.history[k] = { xp: num(o.xp, 0), done: num(o.done, 0), total: num(o.total, 0) };
  }
  const ad = obj(r.adapt);
  for (const k of REALM_IDS) {
    const a = obj(ad[k]);
    s.adapt[k] = { tier: num(a.tier, 0, 0, MAX_TIER), hits: num(a.hits, 0, 0, 100), misses: num(a.misses, 0, 0, 100) };
  }
  const b = obj(r.boss);
  if (typeof b.id === 'string') {
    s.boss = { id: b.id, hp: num(b.hp, 0, 0, 1e6), max: num(b.max, 300, 1, 1e6), since: isDayKey(b.since) ? b.since : '1970-01-01' };
  }
  s.bossesDefeated = Array.isArray(r.bossesDefeated) ? r.bossesDefeated.filter((x): x is string => typeof x === 'string') : [];
  const ach = obj(r.ach);
  for (const [k, v] of Object.entries(ach)) if (typeof v === 'number') s.ach[k] = v;
  s.title = str(r.title, 'wanderer', 40) || 'wanderer';
  s.journal = Array.isArray(r.journal)
    ? r.journal
        .map((j) => obj(j))
        .filter((j) => isDayKey(j.day) && typeof j.text === 'string')
        .map((j) => ({ day: j.day as string, text: str(j.text, '', 2000), at: num(j.at, 0, 0, 1e15), ...(typeof j.q === 'string' ? { q: str(j.q, '', 200) } : {}) }))
        .slice(-500)
    : [];
  const c = obj(r.counters);
  const pr = obj(c.perRealm);
  s.counters = {
    quests: num(c.quests),
    text: num(c.text),
    creator: num(c.creator),
    wild: num(c.wild),
    micro: num(c.micro),
    eased: num(c.eased),
    perfectDays: num(c.perfectDays),
    comebacks: num(c.comebacks),
    perRealm: Object.fromEntries(REALM_IDS.map((k) => [k, num(pr[k])])) as Record<RealmId, number>,
  };
  const se = obj(r.settings);
  const rem = obj(se.reminders);
  const hhmm = (v: unknown, d: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);
  s.settings = {
    mute: se.mute === true,
    focusMode: se.focusMode === true,
    reminders: Object.keys(rem).length
      ? { on: rem.on === true, morning: hhmm(rem.morning, '08:00'), evening: hhmm(rem.evening, '20:30') }
      : null,
  };
  const ch = obj(r.char);
  s.char = typeof ch.imgV === 'number' ? { imgV: num(ch.imgV, 0, 0, 1e9), legacy: ch.legacy === true, style: num(ch.style, 1, 0, 100) } : null;
  s.seenBroadcast = str(r.seenBroadcast, '', 64);
  return s;
}
