import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Sync, DEBOUNCE_MS, RETRY_MS, type SyncApi, type SyncHost, type SyncStatus } from '../../src/sync/sync';
import type { KV } from '../../src/sync/store';
import { newState } from '../../src/game/state';
import { rollover, completeQuest } from '../../src/game/engine';
import type { GameState } from '../../src/game/types';
import type { Imgs } from '../../src/api/types';

function mem(): KV {
  const m = new Map<string, unknown>();
  return {
    kind: 'memory',
    get: async (k) => m.get(k) as never,
    set: async (k, v) => void m.set(k, v),
    del: async (k) => void m.delete(k),
    clear: async () => m.clear(),
  };
}

/** A fake server with the same rules as q_save / q_load. */
function fakeServer() {
  const srv = {
    state: {} as unknown,
    saved_at: 0,
    imgs: null as Imgs | null,
    img_v: 0,
    calls: [] as { fn: string; args: unknown[] }[],
    online: true,
  };
  const api: SyncApi = {
    async save(_t, base, state, _pub, imgs, imgV) {
      srv.calls.push({ fn: 'save', args: [base, imgs, imgV] });
      if (!srv.online) return { ok: false, err: 'network' };
      if (base !== srv.saved_at)
        return { ok: false, err: 'conflict', state: srv.state, saved_at: srv.saved_at, img_v: srv.img_v, imgs: srv.imgs };
      srv.state = JSON.parse(JSON.stringify(state));
      srv.saved_at += 10;
      if (imgV !== undefined) {
        srv.imgs = imgs ?? null;
        srv.img_v = imgV;
      }
      return { ok: true, saved_at: srv.saved_at };
    },
    async load() {
      srv.calls.push({ fn: 'load', args: [] });
      if (!srv.online) return { ok: false, err: 'network' };
      return {
        ok: true,
        state: srv.state,
        saved_at: srv.saved_at,
        imgs: srv.imgs,
        img_v: srv.img_v,
        consent_ver: 1,
        terms_ver: 1,
        parties: [],
        user: { name: 'x' },
      };
    },
  };
  return { srv, api };
}

function device(api: SyncApi, start: GameState, online: () => boolean) {
  let state = start;
  let imgs: Imgs | null = null;
  const statuses: SyncStatus[] = [];
  const host: SyncHost = {
    getState: () => state,
    setState: (s) => void (state = s),
    getImgs: () => imgs,
    setImgs: (i) => void (imgs = i),
    buildPub: () => ({ name: 'x', level: 1, xp: state.xp, streak: 0, title: '', thumb: null }),
    onStatus: (s) => void statuses.push(s),
    isOnline: online,
  };
  const sync = new Sync(mem(), api, host, 'tok');
  return {
    sync,
    statuses,
    get state() {
      return state;
    },
    set state(s: GameState) {
      state = s;
    },
    setImgs(i: Imgs) {
      imgs = i;
    },
  };
}

const D = '2026-05-01';
const fresh = () => {
  const s = newState('seed', 1);
  s.profile.focus = ['body'];
  s.profile.onboarded = true;
  return rollover(s, D, 2).state;
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Sync', () => {
  it('debounces pushes', async () => {
    const { srv, api } = fakeServer();
    const d = device(api, fresh(), () => true);
    await d.sync.init();
    await d.sync.changed();
    await d.sync.changed();
    await d.sync.changed();
    expect(srv.calls.length).toBe(0);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
    expect(srv.calls.filter((c) => c.fn === 'save').length).toBe(1);
    expect(d.sync.meta.dirty).toBe(false);
    expect(d.statuses.at(-1)).toBe('saved');
  });

  it('offline changes are pushed after the connection returns', async () => {
    const { srv, api } = fakeServer();
    let online = false;
    const d = device(api, fresh(), () => online);
    await d.sync.init();
    d.state = completeQuest(d.state, d.state.day!.quests[0]!.id, { text: 'ok ok' }, 5).state;
    await d.sync.changed();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
    expect(d.statuses.at(-1)).toBe('offline');
    expect(srv.saved_at).toBe(0);
    online = true;
    await vi.advanceTimersByTimeAsync(RETRY_MS + 10);
    expect(srv.saved_at).toBeGreaterThan(0);
    expect((srv.state as GameState).xp).toBe(d.state.xp);
    expect(d.state.xp).toBeGreaterThan(0);
  });

  it('a conflict merges both devices without losing progress', async () => {
    const { srv, api } = fakeServer();
    const base = fresh();
    const a = device(api, base, () => true);
    const b = device(api, base, () => true);
    await a.sync.init();
    await b.sync.init();
    a.state = completeQuest(a.state, a.state.day!.quests[0]!.id, { text: 'aa' }, 5).state;
    await a.sync.changed();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
    b.state = completeQuest(b.state, b.state.day!.quests[1]!.id, { text: 'bb' }, 6).state;
    await b.sync.changed();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
    const s = srv.state as GameState;
    expect(s.day!.quests[0]!.done).toBe(true);
    expect(s.day!.quests[1]!.done).toBe(true);
    expect(b.state.day!.quests[0]!.done).toBe(true);
    await a.sync.pull();
    expect(a.state.day!.quests[1]!.done).toBe(true);
    expect(a.state.xp).toBe(b.state.xp);
  });

  it('sends images only when they changed', async () => {
    const { srv, api } = fakeServer();
    const d = device(api, fresh(), () => true);
    await d.sync.init();
    d.setImgs({ cut: 'data:image/png;base64,AAAA' });
    await d.sync.changed({ imgs: true });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
    expect(srv.img_v).toBe(1);
    d.state = { ...d.state, updatedAt: 99 };
    await d.sync.changed();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
    const saves = srv.calls.filter((c) => c.fn === 'save');
    expect(saves.length).toBe(2);
    expect(saves[0]!.args[2]).toBe(1);
    expect(saves[1]!.args[2]).toBeUndefined();
  });

  it('a second device restores state and images on pull', async () => {
    const { srv, api } = fakeServer();
    const a = device(api, fresh(), () => true);
    await a.sync.init();
    a.state = completeQuest(a.state, a.state.day!.quests[0]!.id, { text: 'aa' }, 5).state;
    a.setImgs({ cut: 'data:image/png;base64,BBBB' });
    await a.sync.changed({ imgs: true });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
    const b = device(api, newState('other', 1), () => true);
    let gotImgs: Imgs | null = null;
    await b.sync.init();
    (b.sync as unknown as { host: SyncHost }).host.setImgs = (i) => void (gotImgs = i);
    await b.sync.pull();
    expect(b.state.xp).toBe(a.state.xp);
    expect(gotImgs).toEqual({ cut: 'data:image/png;base64,BBBB' });
    expect(srv.calls.at(-1)!.fn).toBe('load');
  });
});
