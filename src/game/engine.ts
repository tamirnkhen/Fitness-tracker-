import type { DayKey, GameEvent, GameState, Quest, RealmId } from './types';
import { REALM_IDS } from './types';
import { levelOf } from './level';
import { backdropFor } from './backdrop';
import { addDays, daysBetween } from './dates';
import { genDay, easierVersion } from './day';
import { BOSSES, BOSS_HP_GROWTH, type Boss } from '../content/bosses';
import { ACH, TITLES, type Stats } from '../content/progress';
import { PERFECT_DAY_BONUS } from '../content/quests';
import { MAX_TIER } from '../content/tracks';

export interface Result {
  state: GameState;
  events: GameEvent[];
}

/** Cheap deep copy; GameState is plain JSON. */
export const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState;

export const STREAK_BONUS_PER_DAY = 0.03;
export const STREAK_BONUS_MAX_DAYS = 10;
export const HITS_TO_LEVEL_UP = 3;
export const MISSES_TO_LEVEL_DOWN = 2;
export const SHIELD_EVERY = 7;
export const MAX_SHIELDS = 2;
export const RETURN_GAP = 3;

export function streakMultiplier(streak: number): number {
  return 1 + Math.min(streak, STREAK_BONUS_MAX_DAYS) * STREAK_BONUS_PER_DAY;
}

export function bossDef(id: string | undefined): Boss | undefined {
  return BOSSES.find((b) => b.id === id);
}

/** addXp: adds XP and reports level-ups and backdrop changes. Mutates `s`. */
export function addXp(s: GameState, amount: number, events: GameEvent[], questId?: string): void {
  if (amount <= 0) return;
  const before = levelOf(s.xp);
  s.xp += Math.round(amount);
  events.push(questId ? { type: 'xp', amount: Math.round(amount), questId } : { type: 'xp', amount: Math.round(amount) });
  const after = levelOf(s.xp);
  if (after > before) {
    events.push({ type: 'levelUp', from: before, to: after });
    const a = backdropFor(before);
    const b = backdropFor(after);
    if (a.id !== b.id) events.push({ type: 'backdrop', from: a.id, to: b.id });
  }
}

/** newBoss: next boss, matched to the hero's struggles, growing tougher. */
export function newBoss(s: GameState, today: DayKey): GameState['boss'] {
  const beaten = s.bossesDefeated;
  const prefer = BOSSES.filter((b) => s.profile.struggles.includes(b.struggle) && !beaten.includes(b.id));
  const fresh = BOSSES.filter((b) => !beaten.includes(b.id));
  let def: Boss;
  if (prefer[0]) def = prefer[0];
  else if (fresh[0]) def = fresh[0];
  else {
    // everyone beaten: cycle, starting with the hero's own nemesis
    const own = BOSSES.filter((b) => s.profile.struggles.includes(b.struggle));
    const pool = own.length ? own : BOSSES;
    def = pool[beaten.length % pool.length]!;
  }
  const max = def.hp + BOSS_HP_GROWTH * beaten.length;
  return { id: def.id, hp: max, max, since: today };
}

export function stats(s: GameState, extra: { inParty?: boolean } = {}): Stats {
  return {
    level: levelOf(s.xp),
    xp: s.xp,
    streak: s.streak.count,
    streakBest: s.streak.best,
    quests: s.counters.quests,
    text: s.counters.text,
    creator: s.counters.creator,
    wild: s.counters.wild,
    micro: s.counters.micro,
    eased: s.counters.eased,
    perfectDays: s.counters.perfectDays,
    comebacks: s.counters.comebacks,
    bosses: s.bossesDefeated.length,
    journal: s.journal.length,
    perRealm: s.counters.perRealm,
    maxTier: Math.max(...REALM_IDS.map((r) => s.adapt[r].tier)),
    realmsTouched: REALM_IDS.filter((r) => s.counters.perRealm[r] > 0).length,
    hasCharacter: !!s.char && !s.char.legacy,
    inParty: !!extra.inParty || 'party' in s.ach,
  };
}

/** Unlock achievements (with their XP) and titles. Mutates `s`. */
export function checkUnlocks(s: GameState, events: GameEvent[], now: number, extra: { inParty?: boolean } = {}): void {
  // Achievements can grant XP which can unlock more: loop to a fixed point.
  for (let guard = 0; guard < 5; guard++) {
    const st = stats(s, extra);
    const fresh = ACH.filter((a) => !(a.id in s.ach) && a.test(st));
    if (!fresh.length) break;
    for (const a of fresh) {
      s.ach[a.id] = now;
      events.push({ type: 'achievement', id: a.id });
      if (a.xp) addXp(s, a.xp, events);
    }
  }
  const st = stats(s, extra);
  const known = new Set(
    s.ach
      ? Object.keys(s.ach)
          .filter((k) => k.startsWith('title:'))
          .map((k) => k.slice(6))
      : [],
  );
  for (const t of TITLES) {
    if (t.id === 'wanderer' || known.has(t.id)) continue;
    if (t.test(st)) {
      s.ach['title:' + t.id] = now;
      // a new title is worn right away; the hero can switch back any time
      s.title = t.id;
      events.push({ type: 'title', id: t.id });
    }
  }
}

export function unlockedTitles(s: GameState): string[] {
  return ['wanderer', ...TITLES.filter((t) => `title:${t.id}` in s.ach).map((t) => t.id)];
}

function findQuest(s: GameState, id: string): Quest | undefined {
  return s.day?.quests.find((q) => q.id === id);
}

/** Update the count of a counter quest. Completes it when the target is reached. */
export function progressQuest(state: GameState, id: string, delta: number, now = Date.now()): Result {
  const s = clone(state);
  const q = findQuest(s, id);
  if (!q || q.done || q.kind !== 'count' || !q.target) return { state, events: [] };
  q.progress = Math.max(0, Math.min(q.target, (q.progress ?? 0) + delta));
  s.updatedAt = now;
  if (q.progress >= q.target) return completeQuest(s, id, {}, now);
  return { state: s, events: [] };
}

/**
 * completeQuest: marks a quest done and applies everything that follows:
 * XP (with streak bonus), realm XP, boss damage, streak, perfect day,
 * achievements and titles.
 */
export function completeQuest(state: GameState, id: string, payload: { text?: string } = {}, now = Date.now()): Result {
  const s = clone(state);
  const events: GameEvent[] = [];
  const q = findQuest(s, id);
  if (!q || q.done || !s.day) return { state, events };
  if (q.kind === 'text') {
    const text = (payload.text ?? q.text ?? '').trim();
    if (text.length < 2) return { state, events };
    q.text = text.slice(0, 2000);
  }
  if (q.kind === 'count' && q.target) q.progress = q.target;

  const today = s.day.key;
  // streak: the first completion of a day extends it
  if (s.streak.last !== today) {
    const gap = s.streak.last ? daysBetween(s.streak.last, today) : Infinity;
    s.streak.count = gap === 1 ? s.streak.count + 1 : 1;
    s.streak.last = today;
    s.streak.best = Math.max(s.streak.best, s.streak.count);
    events.push({ type: 'streak', count: s.streak.count });
    if (s.streak.count % SHIELD_EVERY === 0 && s.streak.shields < MAX_SHIELDS) {
      s.streak.shields++;
      events.push({ type: 'shieldEarned' });
    }
  }

  const gained = Math.round(q.xp * streakMultiplier(s.streak.count));
  q.done = true;
  q.doneAt = now;
  q.gained = gained;
  s.realmXp[q.realm] += gained;
  s.counters.quests++;
  s.counters.perRealm[q.realm]++;
  if (q.kind === 'text') s.counters.text++;
  if (q.source === 'creator') s.counters.creator++;
  if (q.source === 'wild') s.counters.wild++;
  if (q.source === 'micro') s.counters.micro++;
  if (s.day.returning && s.day.quests.filter((x) => x.done).length === 1) s.counters.comebacks++;
  if (q.kind === 'text' && (q.journal || q.source === 'creator') && q.text) {
    s.journal.push({ day: today, text: q.text, at: now, q: q.title });
    if (s.journal.length > 500) s.journal.splice(0, s.journal.length - 500);
  }
  addXp(s, gained, events, q.id);

  // boss
  if (s.boss && s.boss.hp > 0) {
    const dmg = q.weak ? gained * 2 : gained;
    s.boss.hp = Math.max(0, s.boss.hp - dmg);
    events.push({ type: 'bossHit', damage: dmg, weak: !!q.weak });
    if (s.boss.hp === 0) {
      const def = bossDef(s.boss.id);
      const reward = def?.reward ?? 100;
      s.bossesDefeated.push(s.boss.id);
      events.push({ type: 'bossDefeated', bossId: s.boss.id, reward });
      addXp(s, reward, events);
    }
  }

  // perfect day
  if (!s.day.perfect && s.day.quests.every((x) => x.done)) {
    s.day.perfect = true;
    s.counters.perfectDays++;
    events.push({ type: 'perfectDay', bonus: PERFECT_DAY_BONUS });
    addXp(s, PERFECT_DAY_BONUS, events);
  }

  const h = s.history[today] ?? { xp: 0, done: 0, total: s.day.quests.length };
  s.history[today] = { xp: h.xp + gained, done: h.done + 1, total: s.day.quests.length };

  checkUnlocks(s, events, now);
  s.updatedAt = now;
  return { state: s, events };
}

/** Save a draft answer for a text quest without completing it. */
export function setQuestText(state: GameState, id: string, text: string, now = Date.now()): GameState {
  const s = clone(state);
  const q = findQuest(s, id);
  if (!q || q.done) return state;
  q.text = text.slice(0, 2000);
  s.updatedAt = now;
  return s;
}

/** "Too hard today": swap for an easier version. Counts as a miss for adapt. */
export function easeQuest(state: GameState, id: string, now = Date.now()): Result {
  const s = clone(state);
  const events: GameEvent[] = [];
  const q = findQuest(s, id);
  if (!q || !s.day) return { state, events };
  const easy = easierVersion(q);
  if (!easy) return { state, events };
  const a = s.adapt[q.realm];
  if (q.source === 'track') {
    a.hits = 0;
    a.misses++;
    if (a.misses >= MISSES_TO_LEVEL_DOWN && a.tier > 0) {
      a.tier--;
      a.misses = 0;
    }
  }
  s.day.quests = s.day.quests.map((x) => (x.id === id ? easy : x));
  s.counters.eased++;
  checkUnlocks(s, events, now);
  s.updatedAt = now;
  return { state: s, events };
}

/** Close a finished day: history + the adapt ladder. Mutates `s`. */
function closeDay(s: GameState): void {
  if (!s.day) return;
  const d = s.day;
  const done = d.quests.filter((q) => q.done);
  s.history[d.key] = {
    xp: done.reduce((n, q) => n + (q.gained ?? q.xp), 0),
    done: done.length,
    total: d.quests.length,
  };
  const seen = new Set<RealmId>();
  for (const q of d.quests) {
    if (q.source !== 'track' || seen.has(q.realm) || q.eased) continue;
    seen.add(q.realm);
    const a = s.adapt[q.realm];
    if (q.done) {
      a.misses = 0;
      a.hits++;
      if (a.hits >= HITS_TO_LEVEL_UP && a.tier < MAX_TIER) {
        a.tier++;
        a.hits = 0;
      }
    } else {
      a.hits = 0;
      a.misses++;
      if (a.misses >= MISSES_TO_LEVEL_DOWN && a.tier > 0) {
        a.tier--;
        a.misses = 0;
      }
    }
  }
  // keep history bounded (~2 years)
  const keys = Object.keys(s.history).sort();
  if (keys.length > 800) for (const k of keys.slice(0, keys.length - 800)) delete s.history[k];
}

/**
 * rollover: bring the state to `today`. Closes the previous day, applies
 * streak shields / breaks, spawns a boss, flags comeback days and builds
 * today's quests. Idempotent for the same day.
 */
export function rollover(state: GameState, today: DayKey, now = Date.now()): Result {
  if (state.day && state.day.key === today) return { state, events: [] };
  const s = clone(state);
  const events: GameEvent[] = [];
  const prevKey = s.day?.key ?? null;
  if (prevKey && daysBetween(prevKey, today) < 0) {
    // clock moved backwards: keep the current day, never rewind progress
    return { state, events: [] };
  }
  closeDay(s);

  // streak: missed days between the last active day and today
  if (s.streak.last && s.streak.count > 0) {
    const missed = daysBetween(s.streak.last, today) - 1;
    if (missed > 0) {
      if (missed <= s.streak.shields) {
        s.streak.shields -= missed;
        s.streak.last = addDays(today, -1);
        events.push({ type: 'shieldUsed', days: missed });
      } else {
        events.push({ type: 'streakLost', was: s.streak.count });
        s.streak.count = 0;
      }
    }
  }

  if (!s.boss || s.boss.hp <= 0) {
    s.boss = newBoss(s, today);
    events.push({ type: 'newBoss', bossId: s.boss!.id });
  }

  const lastActive = s.streak.last ?? prevKey;
  const returning = !!lastActive && !!prevKey && daysBetween(lastActive, today) >= RETURN_GAP;
  if (returning) events.push({ type: 'returning' });
  s.day = genDay(s, today, { returning });
  s.updatedAt = now;
  return { state: s, events };
}

export function setTitle(state: GameState, id: string): GameState {
  if (!unlockedTitles(state).includes(id)) return state;
  const s = clone(state);
  s.title = id;
  s.updatedAt = Date.now();
  return s;
}

export function titleName(id: string): string {
  return TITLES.find((t) => t.id === id)?.name ?? TITLES[0]!.name;
}
