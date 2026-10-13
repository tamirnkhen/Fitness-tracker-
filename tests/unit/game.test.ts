import { describe, expect, it } from 'vitest';
import { newState, normalizeState } from '../../src/game/state';
import { genDay, questCount, CREATOR_MIN_LEVEL } from '../../src/game/day';
import {
  rollover,
  completeQuest,
  progressQuest,
  easeQuest,
  addXp,
  newBoss,
  streakMultiplier,
  setTitle,
  unlockedTitles,
} from '../../src/game/engine';
import { levelInfo, xpForLevel, xpToNext, levelOf } from '../../src/game/level';
import { backdropFor, BACKDROPS } from '../../src/game/backdrop';
import { addDays, daysBetween, dayKey } from '../../src/game/dates';
import { mergeStates } from '../../src/game/merge';
import type { GameEvent, GameState } from '../../src/game/types';
import { REALM_IDS } from '../../src/game/types';
import { TRACKS } from '../../src/content/tracks';
import { QB, WILD, MICRO, CREATOR } from '../../src/content/quests';
import { BOSSES } from '../../src/content/bosses';
import { TITLES, ACH } from '../../src/content/progress';
import { MORN, EVE } from '../../src/content/messages';

const D = '2026-03-10';
function player(over: Partial<GameState['profile']> = {}): GameState {
  const s = newState('seed-1', 1000);
  s.profile = { ...s.profile, heroName: 'אלון', focus: ['body', 'mind'], struggles: ['energy'], minutes: 20, onboarded: true, ...over };
  return s;
}
const start = (s = player(), day = D) => rollover(s, day, 1).state;
const doAll = (s: GameState, now = 2) => {
  let st = s;
  const ev: GameEvent[] = [];
  for (const q of st.day!.quests) {
    const r = completeQuest(st, q.id, { text: 'תשובה טובה' }, now);
    st = r.state;
    ev.push(...r.events);
  }
  return { state: st, events: ev };
};

describe('content integrity', () => {
  it('has unique ids everywhere', () => {
    const ids = [
      ...Object.values(TRACKS)
        .flat(2)
        .map((q) => q.id),
      ...QB.map((q) => q.id),
      ...WILD.map((q) => q.id),
      ...MICRO.map((q) => q.id),
      ...CREATOR.map((q) => q.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(TITLES.map((t) => t.id)).size).toBe(TITLES.length);
    expect(new Set(ACH.map((t) => t.id)).size).toBe(ACH.length);
  });
  it('has 6 realms × 6 tiers, 20+ titles, a boss per struggle, varied reminders', () => {
    for (const r of REALM_IDS) {
      expect(TRACKS[r].length).toBe(6);
      for (const tier of TRACKS[r]) expect(tier.length).toBeGreaterThanOrEqual(2);
      expect(QB.filter((q) => q.realm === r).length).toBeGreaterThanOrEqual(6);
    }
    expect(TITLES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(BOSSES.map((b) => b.struggle)).size).toBe(7);
    expect(MORN.length).toBeGreaterThanOrEqual(10);
    expect(EVE.length).toBeGreaterThanOrEqual(10);
  });
  it('count quests have targets, text quests have prompts', () => {
    for (const q of [...Object.values(TRACKS).flat(2), ...QB, ...WILD, ...MICRO]) {
      if (q.kind === 'count') expect(q.target, q.id).toBeGreaterThan(0);
      if (q.kind === 'text') expect(q.prompt, q.id).toBeTruthy();
    }
  });
});

describe('level curve', () => {
  it('matches the formula', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(220);
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(10)).toBe(280);
    expect(xpForLevel(50)).toBe(28420);
  });
  it('levelInfo is consistent at every boundary', () => {
    for (let l = 1; l <= 120; l++) {
      const at = xpForLevel(l);
      expect(levelOf(at)).toBe(l);
      if (at > 0) expect(levelOf(at - 1)).toBe(l - 1);
      const i = levelInfo(at + 5);
      expect(i.into).toBe(5);
      expect(i.need).toBe(xpToNext(l));
    }
    expect(levelOf(-50)).toBe(1);
  });
});

describe('backdropFor', () => {
  const cases: [number, string][] = [
    [1, 'blue'],
    [9, 'blue'],
    [10, 'deepblue'],
    [19, 'deepblue'],
    [20, 'purple'],
    [29, 'purple'],
    [30, 'deeppurple'],
    [39, 'deeppurple'],
    [40, 'bordeaux'],
    [49, 'bordeaux'],
    [50, 'darkbordeaux'],
    [99, 'darkbordeaux'],
  ];
  for (const [lvl, id] of cases) it(`level ${lvl} → ${id}`, () => expect(backdropFor(lvl).id).toBe(id));
  it('is safe on bad input', () => {
    expect(backdropFor(0).id).toBe('blue');
    expect(backdropFor(NaN).id).toBe('blue');
    expect(backdropFor(-3).id).toBe('blue');
  });
  it('uses the requested colours', () => {
    expect(BACKDROPS.map((b) => b.base)).toEqual(['#2B7FB0', '#14405F', '#6B3FA0', '#3D1F66', '#B03A55', '#5C1020']);
  });
});

describe('dates', () => {
  it('crosses months, years and leap days', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2);
    expect(daysBetween('2027-01-01', '2026-12-31')).toBe(-1);
  });
  it('is DST-proof (Israel changes clocks in March and October)', () => {
    expect(daysBetween('2026-03-26', '2026-03-28')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(addDays('2026-03-27', 1)).toBe('2026-03-28');
    // local day keys across a DST change, built from real Dates
    const a = new Date(2026, 2, 27, 23, 30);
    const b = new Date(a.getTime() + 2 * 3600 * 1000);
    expect(daysBetween(dayKey(a), dayKey(b))).toBe(1);
  });
});

describe('genDay', () => {
  it('is deterministic per day and differs across days', () => {
    const s = start();
    const a = genDay(s, '2026-03-11');
    const b = genDay(s, '2026-03-11');
    expect(a).toEqual(b);
    const days = new Set(
      Array.from({ length: 10 }, (_, i) =>
        genDay(s, addDays(D, i))
          .quests.map((q) => q.tpl)
          .join(),
      ),
    );
    expect(days.size).toBeGreaterThan(5);
  });
  it('builds one track quest per focus realm and the right count', () => {
    for (const minutes of [10, 20, 40] as const) {
      const s = start(player({ minutes, focus: ['body', 'mind', 'career'] }));
      for (let i = 0; i < 20; i++) {
        const d = genDay(s, addDays(D, i));
        const core = d.quests.filter((q) => q.source !== 'wild' && q.source !== 'creator');
        expect(core.length).toBe(Math.max(questCount(minutes), 3));
        expect(
          d.quests
            .filter((q) => q.source === 'track')
            .map((q) => q.realm)
            .sort(),
        ).toEqual(['body', 'career', 'mind']);
        expect(new Set(d.quests.map((q) => q.tpl)).size).toBe(d.quests.length);
        expect(new Set(d.quests.map((q) => q.id)).size).toBe(d.quests.length);
      }
    }
  });
  it('always offers a hit on the boss weak point', () => {
    const s = start(player({ focus: ['adventure'], struggles: ['energy'] }));
    expect(s.boss!.id).toBe('exhaustion');
    for (let i = 0; i < 30; i++) {
      const d = genDay(s, addDays(D, i));
      expect(d.quests.some((q) => q.weak)).toBe(true);
    }
  });
  it('uses the adapt tier', () => {
    const s = start();
    s.adapt.body.tier = 4;
    const d = genDay(s, '2026-04-01');
    const t = d.quests.find((q) => q.source === 'track' && q.realm === 'body')!;
    expect(t.tier).toBe(4);
    expect(TRACKS.body[4]!.map((x) => x.id)).toContain(t.tpl);
  });
  it('adds creator missions from level 5 only', () => {
    const s = start();
    for (let i = 0; i < 10; i++) expect(genDay(s, addDays(D, i)).quests.some((q) => q.source === 'creator')).toBe(false);
    s.xp = xpForLevel(CREATOR_MIN_LEVEL);
    expect(genDay(s, D).quests.some((q) => q.source === 'creator')).toBe(true);
  });
  it('wild cards show up sometimes', () => {
    const s = start();
    const n = Array.from({ length: 100 }, (_, i) => genDay(s, addDays(D, i))).filter((d) =>
      d.quests.some((q) => q.source === 'wild'),
    ).length;
    expect(n).toBeGreaterThan(10);
    expect(n).toBeLessThan(60);
  });
  it('comeback days are micro quests', () => {
    const d = genDay(start(), D, { returning: true });
    expect(d.returning).toBe(true);
    expect(d.quests.filter((q) => q.source === 'micro').length).toBe(3);
  });
});

describe('completeQuest + addXp', () => {
  it('awards XP, realm XP, history and counters', () => {
    const s = start();
    const q = s.day!.quests[0]!;
    const r = completeQuest(s, q.id, { text: 'כתבתי' }, 5);
    const done = r.state.day!.quests[0]!;
    expect(done.done).toBe(true);
    expect(done.gained).toBe(Math.round(q.xp * streakMultiplier(1)));
    expect(r.state.realmXp[q.realm]).toBe(done.gained);
    expect(r.state.counters.quests).toBe(1);
    expect(r.state.history[D]!.done).toBe(1);
    expect(r.events.some((e) => e.type === 'achievement' && e.id === 'first')).toBe(true);
    // immutability
    expect(s.day!.quests[0]!.done).toBe(false);
    // idempotent
    expect(completeQuest(r.state, q.id).state).toBe(r.state);
  });
  it('text quests need an answer and go to the journal', () => {
    let s = start();
    const day = s.day!;
    day.quests[0] = { ...day.quests[0]!, kind: 'text', prompt: '?', journal: true };
    const id = day.quests[0]!.id;
    expect(completeQuest(s, id, { text: ' ' }).state).toBe(s);
    s = completeQuest(s, id, { text: 'אני מודה על השמש' }).state;
    expect(s.journal.at(-1)!.text).toBe('אני מודה על השמש');
  });
  it('count quests complete at the target', () => {
    let s = start();
    s.day!.quests[0] = { ...s.day!.quests[0]!, kind: 'count', target: 3, progress: 0 };
    const id = s.day!.quests[0]!.id;
    s = progressQuest(s, id, 1).state;
    s = progressQuest(s, id, 1).state;
    expect(s.day!.quests[0]!.done).toBe(false);
    s = progressQuest(s, id, 5).state;
    expect(s.day!.quests[0]!.done).toBe(true);
    expect(s.day!.quests[0]!.progress).toBe(3);
  });
  it('reports level ups and backdrop changes at 10/20/30/40/50', () => {
    for (const tier of [10, 20, 30, 40, 50]) {
      const s = start();
      s.xp = xpForLevel(tier) - 1;
      const ev: GameEvent[] = [];
      addXp(s, 5, ev);
      expect(ev).toContainEqual({ type: 'levelUp', from: tier - 1, to: tier });
      expect(ev.find((e) => e.type === 'backdrop')).toEqual({ type: 'backdrop', from: backdropFor(tier - 1).id, to: backdropFor(tier).id });
    }
    const s = start();
    s.xp = xpForLevel(12) - 1;
    const ev: GameEvent[] = [];
    addXp(s, 5, ev);
    expect(ev.some((e) => e.type === 'backdrop')).toBe(false);
  });
  it('perfect day gives a bonus once', () => {
    const r = doAll(start());
    expect(r.state.day!.perfect).toBe(true);
    expect(r.events.filter((e) => e.type === 'perfectDay').length).toBe(1);
    expect(r.state.counters.perfectDays).toBe(1);
  });
});

describe('boss', () => {
  it('matches the struggle, weak points deal double, defeat rewards', () => {
    let s = start(player({ struggles: ['focus'] }));
    expect(s.boss!.id).toBe('screenwizard');
    s.boss!.hp = 10;
    const weak = s.day!.quests.find((q) => q.weak)!;
    const r = completeQuest(s, weak.id, { text: 'x x' });
    const hit = r.events.find((e) => e.type === 'bossHit');
    expect(hit).toMatchObject({ weak: true });
    expect(r.events.some((e) => e.type === 'bossDefeated')).toBe(true);
    s = r.state;
    expect(s.bossesDefeated).toEqual(['screenwizard']);
    // next day a new boss appears, tougher
    s = rollover(s, addDays(D, 1)).state;
    expect(s.boss!.id).not.toBe('screenwizard');
    expect(s.boss!.max).toBe(BOSSES.find((b) => b.id === s.boss!.id)!.hp + 60);
  });
  it('cycles when all bosses are beaten', () => {
    const s = start();
    s.bossesDefeated = BOSSES.map((b) => b.id);
    const b = newBoss(s, D)!;
    expect(BOSSES.map((x) => x.id)).toContain(b.id);
    expect(b.max).toBeGreaterThan(400);
  });
});

describe('rollover + streak + adapt', () => {
  it('is idempotent on the same day', () => {
    const s = start();
    expect(rollover(s, D).state).toBe(s);
  });
  it('builds the streak day after day and keeps best', () => {
    let s = start();
    for (let i = 0; i < 5; i++) {
      s = rollover(s, addDays(D, i)).state;
      s = completeQuest(s, s.day!.quests[0]!.id, { text: 'ok ok' }).state;
    }
    expect(s.streak.count).toBe(5);
    s = rollover(s, addDays(D, 9)).state; // 3+ missed days
    expect(s.streak.count).toBe(0);
    expect(s.streak.best).toBe(5);
    expect(s.day!.returning).toBe(true);
    s = completeQuest(s, s.day!.quests[0]!.id, { text: 'ok ok' }).state;
    expect(s.streak.count).toBe(1);
    expect(s.counters.comebacks).toBe(1);
  });
  it('earns a shield every 7 days and uses it for a missed day', () => {
    let s = start();
    for (let i = 0; i < 7; i++) {
      s = rollover(s, addDays(D, i)).state;
      s = completeQuest(s, s.day!.quests[0]!.id, { text: 'ok ok' }).state;
    }
    expect(s.streak.shields).toBe(1);
    const r = rollover(s, addDays(D, 8)); // skipped day 7
    expect(r.events).toContainEqual({ type: 'shieldUsed', days: 1 });
    s = completeQuest(r.state, r.state.day!.quests[0]!.id, { text: 'ok ok' }).state;
    expect(s.streak.count).toBe(8);
    expect(s.streak.shields).toBe(0);
  });
  it('crosses month ends and DST without breaking the streak', () => {
    let s = start(player(), '2026-03-26');
    for (const d of ['2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31', '2026-04-01']) {
      s = rollover(s, d).state;
      s = completeQuest(s, s.day!.quests[0]!.id, { text: 'ok ok' }).state;
    }
    expect(s.streak.count).toBe(7);
  });
  it('ignores a clock that goes backwards', () => {
    const s = start();
    expect(rollover(s, addDays(D, -1)).state).toBe(s);
  });
  it('climbs after 3 hits, drops after 2 misses', () => {
    let s = start(player({ focus: ['body'] }));
    for (let i = 0; i < 3; i++) {
      s = rollover(s, addDays(D, i)).state;
      const t = s.day!.quests.find((q) => q.source === 'track')!;
      s = completeQuest(s, t.id).state;
    }
    s = rollover(s, addDays(D, 3)).state;
    expect(s.adapt.body.tier).toBe(1);
    s = rollover(s, addDays(D, 4)).state; // miss day 3's track
    s = rollover(s, addDays(D, 5)).state; // miss day 4's track
    expect(s.adapt.body.tier).toBe(0);
  });
  it('easeQuest swaps for an easier version and counts as a miss', () => {
    const s = start(player({ focus: ['body'] }));
    s.adapt.body.tier = 3;
    const s2 = rollover({ ...s, day: null }, addDays(D, 1)).state;
    const t = s2.day!.quests.find((q) => q.source === 'track')!;
    const r = easeQuest(s2, t.id);
    const e = r.state.day!.quests.find((q) => q.id === t.id)!;
    expect(e.eased).toBe(true);
    expect(e.tier).toBe(2);
    expect(e.xp).toBeLessThan(t.xp);
    expect(r.state.adapt.body.misses).toBe(1);
    expect(r.events.some((x) => x.type === 'achievement' && x.id === 'honest')).toBe(true);
    expect(easeQuest(r.state, t.id).state).toBe(r.state);
  });
});

describe('titles', () => {
  it('unlocks by level and can be selected only when unlocked', () => {
    let s = start();
    expect(setTitle(s, 'knight')).toBe(s);
    s.xp = xpForLevel(15) - 1;
    s = completeQuest(s, s.day!.quests[0]!.id, { text: 'ok ok' }).state;
    expect(unlockedTitles(s)).toContain('knight');
    expect(setTitle(s, 'knight').title).toBe('knight');
  });
});

describe('normalizeState', () => {
  it('survives garbage and keeps valid data', () => {
    for (const g of [null, undefined, 5, 'x', [], { xp: 'lots' }, { day: { key: 'bad' } }]) {
      const s = normalizeState(g);
      expect(s.v).toBe(2);
      expect(s.xp).toBe(0);
    }
    const s = start();
    expect(normalizeState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});

describe('mergeStates', () => {
  it('higher XP wins, achievements/journal/bosses are unioned', () => {
    let a = start();
    a = doAll(a).state;
    const b = start();
    b.journal.push({ day: '2026-03-01', text: 'מהמכשיר השני', at: 50 });
    b.ach.party = 77;
    b.bossesDefeated = ['quitter'];
    const m = mergeStates(b, a);
    expect(m.xp).toBe(a.xp);
    expect(m.journal.some((j) => j.text === 'מהמכשיר השני')).toBe(true);
    expect(m.ach.party).toBe(77);
    expect(m.bossesDefeated).toContain('quitter');
  });
  it('same day: quests done on either side stay done and their XP counts', () => {
    const base = start();
    const q0 = base.day!.quests[0]!.id;
    const q1 = base.day!.quests[1]!.id;
    const a = completeQuest(base, q0, { text: 'aa' }).state;
    const b = completeQuest(base, q1, { text: 'bb' }).state;
    const m = mergeStates(a, b);
    expect(m.day!.quests.find((q) => q.id === q0)!.done).toBe(true);
    expect(m.day!.quests.find((q) => q.id === q1)!.done).toBe(true);
    expect(m.xp).toBeGreaterThanOrEqual(Math.max(a.xp, b.xp));
    expect(m.history[D]!.done).toBe(2);
  });
  it('tie on XP: the last edit wins', () => {
    const a = start();
    const b = start();
    a.updatedAt = 10;
    b.updatedAt = 20;
    b.profile.heroName = 'חדש';
    expect(mergeStates(a, b).profile.heroName).toBe('חדש');
  });
});
