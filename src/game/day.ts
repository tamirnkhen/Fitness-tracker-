import type { DayKey, GameState, Quest, QuestTemplate, RealmId } from './types';
import { REALM_IDS } from './types';
import { TRACKS, MAX_TIER } from '../content/tracks';
import { QB, WILD, MICRO, CREATOR } from '../content/quests';
import { BOSSES } from '../content/bosses';
import { rngFor, pickOne, shuffle } from './rng';
import { levelOf } from './level';

export const CREATOR_MIN_LEVEL = 5;
export const WILD_CHANCE = 0.3;

function instance(t: QuestTemplate, id: string, source: Quest['source'], tier?: number): Quest {
  const q: Quest = { id, tpl: t.id, source, realm: t.realm, kind: t.kind, title: t.title, xp: t.xp, done: false };
  if (t.desc) q.desc = t.desc;
  if (t.target) {
    q.target = t.target;
    q.progress = 0;
  }
  if (t.unit) q.unit = t.unit;
  if (t.prompt) q.prompt = t.prompt;
  if (t.journal) q.journal = true;
  if (tier !== undefined) q.tier = tier;
  return q;
}

export function questCount(minutes: number): number {
  return minutes <= 10 ? 3 : minutes >= 40 ? 5 : 4;
}

export function trackTemplate(realm: RealmId, tier: number, variant: number): QuestTemplate {
  const tiers = TRACKS[realm];
  const t = Math.max(0, Math.min(MAX_TIER, tier, tiers.length - 1));
  const variants = tiers[t] ?? tiers[0]!;
  return variants[((variant % variants.length) + variants.length) % variants.length]!;
}

/**
 * genDay: the quests for one day. Deterministic for a given
 * (seed, day, focus, adapt tiers, level bucket, boss) so the same day
 * always rebuilds the same way on every device.
 */
export function genDay(s: GameState, key: DayKey, opts: { returning?: boolean } = {}): NonNullable<GameState['day']> {
  const rnd = rngFor(s.seed, key);
  const level = levelOf(s.xp);
  const focus: RealmId[] = s.profile.focus.length ? s.profile.focus.slice(0, 3) : ['body', 'mind', 'discipline'];
  const others = REALM_IDS.filter((r) => !focus.includes(r));
  const boss = s.boss ? BOSSES.find((b) => b.id === s.boss!.id) : undefined;
  const quests: Quest[] = [];
  const used = new Set<string>();
  const add = (t: QuestTemplate, source: Quest['source'], tier?: number) => {
    if (used.has(t.id)) return false;
    used.add(t.id);
    quests.push(instance(t, `${key}:${quests.length}`, source, tier));
    return true;
  };

  if (opts.returning) {
    // Comeback day: tiny wins only, plus one easier track quest.
    for (const t of shuffle(rnd, MICRO).slice(0, 3)) add(t, 'micro');
    const r = focus[0]!;
    const tier = Math.max(0, s.adapt[r].tier - 1);
    add(trackTemplate(r, tier, Math.floor(rnd() * 10)), 'track', tier);
  } else {
    const total = questCount(s.profile.minutes);
    // 1. the main track of every focus realm
    for (const r of focus) {
      const tier = s.adapt[r].tier;
      add(trackTemplate(r, tier, Math.floor(rnd() * 10)), 'track', tier);
    }
    // 2. side quests: mostly focus realms, one from elsewhere for variety
    const sidePool = shuffle(
      rnd,
      QB.filter((q) => focus.includes(q.realm) && (q.minLevel ?? 0) <= level),
    );
    const otherPool = shuffle(
      rnd,
      QB.filter((q) => others.includes(q.realm)),
    );
    if (quests.length < total && otherPool.length) add(otherPool[0]!, 'side');
    for (const t of sidePool) {
      if (quests.length >= total) break;
      add(t, 'side');
    }
    // 3. make sure the boss can be hit on its weak point
    if (boss && !quests.some((q) => boss.weak.includes(q.realm))) {
      const weakPool = shuffle(
        rnd,
        QB.filter((q) => boss.weak.includes(q.realm) && !used.has(q.id)),
      );
      if (weakPool[0]) {
        if (quests.length >= total) {
          const idx = quests.map((q) => q.source).lastIndexOf('side');
          if (idx >= 0) {
            used.delete(quests[idx]!.tpl);
            quests.splice(idx, 1);
          }
        }
        add(weakPool[0], 'side');
      }
    }
    // 4. creator mission from level 5
    if (level >= CREATOR_MIN_LEVEL) {
      const c = pickOne(rnd, CREATOR);
      add({ id: c.id, realm: c.realm, kind: 'text', title: c.title, prompt: c.prompt, xp: c.xp }, 'creator');
    }
  }
  // 5. surprise
  if (rnd() < WILD_CHANCE) add(pickOne(rnd, WILD), 'wild');

  quests.forEach((q, i) => {
    q.id = `${key}:${i}`;
    if (boss && boss.weak.includes(q.realm)) q.weak = true;
  });
  return { key, quests, returning: !!opts.returning, perfect: false };
}

/** An easier version of a quest ("קשה לי היום"). Returns null if it can't get easier. */
export function easierVersion(q: Quest): Quest | null {
  if (q.done || q.eased) return null;
  if (q.source === 'track') {
    const tier = Math.max(0, (q.tier ?? 0) - 1);
    if ((q.tier ?? 0) === 0) {
      const micro = MICRO.find((m) => m.realm === q.realm) ?? MICRO[0]!;
      return { ...instance(micro, q.id, 'micro'), eased: true, ...(q.weak ? { weak: true } : {}) };
    }
    const t = trackTemplate(q.realm, tier, 0);
    return { ...instance(t, q.id, 'track', tier), eased: true, ...(q.weak ? { weak: true } : {}) };
  }
  const micro = MICRO.find((m) => m.realm === q.realm) ?? MICRO[0]!;
  return { ...instance(micro, q.id, 'micro'), eased: true, ...(q.weak ? { weak: true } : {}) };
}
