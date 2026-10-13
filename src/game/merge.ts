import type { GameState } from './types';
import { REALM_IDS } from './types';
import { normalizeState } from './state';

/**
 * Conflict resolution between this device and the server copy.
 *
 * 1. The copy with more total XP is the base (it has more progress);
 *    on a tie, the one edited last.
 * 2. Things that only ever grow are unioned so nothing earned is lost:
 *    achievements/titles, defeated bosses, journal entries, history days,
 *    best streak, counters (max).
 * 3. If both copies are on the same day, quests finished on either side
 *    stay finished (the XP of the base copy is kept, and the XP of quests
 *    finished only on the other side is added on top).
 */
export function mergeStates(localRaw: unknown, remoteRaw: unknown): GameState {
  const local = normalizeState(localRaw);
  const remote = normalizeState(remoteRaw);
  const localWins = local.xp > remote.xp || (local.xp === remote.xp && local.updatedAt >= remote.updatedAt);
  const base = localWins ? local : remote;
  const other = localWins ? remote : local;
  const out = normalizeState(JSON.parse(JSON.stringify(base)));

  for (const [k, v] of Object.entries(other.ach)) {
    if (!(k in out.ach) || (out.ach[k] ?? Infinity) > v) out.ach[k] = v;
  }
  for (const b of other.bossesDefeated) if (!out.bossesDefeated.includes(b)) out.bossesDefeated.push(b);

  const seen = new Set(out.journal.map((j) => `${j.day}|${j.at}|${j.text}`));
  for (const j of other.journal) {
    const id = `${j.day}|${j.at}|${j.text}`;
    if (!seen.has(id)) {
      out.journal.push(j);
      seen.add(id);
    }
  }
  out.journal.sort((a, b) => a.at - b.at);
  if (out.journal.length > 500) out.journal.splice(0, out.journal.length - 500);

  for (const [k, h] of Object.entries(other.history)) {
    const mine = out.history[k];
    if (!mine || h.done > mine.done) out.history[k] = { ...h };
  }

  out.streak.best = Math.max(out.streak.best, other.streak.best);
  const c = out.counters;
  const o = other.counters;
  c.quests = Math.max(c.quests, o.quests);
  c.text = Math.max(c.text, o.text);
  c.creator = Math.max(c.creator, o.creator);
  c.wild = Math.max(c.wild, o.wild);
  c.micro = Math.max(c.micro, o.micro);
  c.eased = Math.max(c.eased, o.eased);
  c.perfectDays = Math.max(c.perfectDays, o.perfectDays);
  c.comebacks = Math.max(c.comebacks, o.comebacks);
  for (const r of REALM_IDS) c.perRealm[r] = Math.max(c.perRealm[r], o.perRealm[r]);

  if (out.day && other.day && out.day.key === other.day.key) {
    const theirs = new Map(other.day.quests.map((q) => [q.id, q]));
    let bonus = 0;
    for (const q of out.day.quests) {
      const t = theirs.get(q.id);
      if (t && t.done && !q.done && t.tpl === q.tpl) {
        q.done = true;
        q.doneAt = t.doneAt ?? Date.now();
        q.gained = t.gained ?? t.xp;
        if (t.text) q.text = t.text;
        if (t.progress !== undefined) q.progress = t.progress;
        bonus += q.gained;
        out.realmXp[q.realm] += q.gained;
      }
    }
    if (bonus) {
      out.xp += bonus;
      const h = out.history[out.day.key];
      const done = out.day.quests.filter((q) => q.done).length;
      out.history[out.day.key] = { xp: (h?.xp ?? 0) + bonus, done, total: out.day.quests.length };
    }
  }

  // profile: keep the onboarded one if only one side finished onboarding
  if (!out.profile.onboarded && other.profile.onboarded) out.profile = { ...other.profile };
  // character: the newer image version wins
  if (other.char && (!out.char || other.char.imgV > out.char.imgV)) out.char = { ...other.char };
  out.updatedAt = Math.max(local.updatedAt, remote.updatedAt);
  return out;
}
