import { app, toast, type Session, type Overlay } from './store';
import { api, setApiConfig, type Imgs, type PubCard, type ServerPayload } from '../api';
import { readConfig } from '../config';
import { openStore, wipeDevice, type KV } from '../sync/store';
import { Sync, type Meta, emptyMeta } from '../sync/sync';
import { newState, normalizeState } from '../game/state';
import { dayKey } from '../game/dates';
import { levelOf } from '../game/level';
import { backdropFor } from '../game/backdrop';
import {
  rollover,
  completeQuest as engComplete,
  progressQuest as engProgress,
  easeQuest as engEase,
  setQuestText as engText,
  setTitle as engTitle,
  checkUnlocks,
  titleName,
  type Result,
} from '../game/engine';
import type { GameEvent, GameState } from '../game/types';
import { ACH, TITLES } from '../content/progress';
import { BOSSES } from '../content/bosses';
import { DONE_LINES, pick } from '../content/messages';
import { TERMS_VERSION } from '../i18n/terms';
import { T, errText } from '../i18n/he';
import { normalizePhone } from '../game/phone';
import { makeThumb } from '../character/thumb';
import * as sfx from '../audio/sfx';

let kv: KV | null = null;
let sync: Sync | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let dayTimer: ReturnType<typeof setInterval> | null = null;

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false) && app.get().online;

// ---------------------------------------------------------------- boot

export async function boot() {
  const config = readConfig();
  app.set({ config });
  if (!config.ok) {
    app.set({ phase: 'setup' });
    return;
  }
  setApiConfig(config);
  captureJoinLink();
  kv = await openStore();
  window.addEventListener('online', () => {
    app.set({ online: true });
    void sync?.pull();
    void sync?.push();
  });
  window.addEventListener('offline', () => app.set({ online: false, sync: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkDay();
      void sync?.pull();
      void refreshServerConfig();
    } else {
      void writeLocal();
      void sync?.flush();
    }
  });
  window.addEventListener('pagehide', () => {
    void writeLocal();
    void sync?.flush();
  });
  void refreshServerConfig();

  if (location.hash.startsWith('#admin')) {
    app.set({ phase: 'admin' });
    return;
  }

  const session = await kv.get<Session>('session');
  if (!session?.token) {
    app.set({ phase: 'auth' });
    return;
  }
  const raw = await kv.get<unknown>('state');
  const imgs = (await kv.get<Imgs>('imgs')) ?? null;
  const thumb = (await kv.get<{ src: string; bd: string }>('thumb')) ?? null;
  const meta = (await kv.get<Meta>('meta')) ?? emptyMeta();
  await startSession(session, raw ? normalizeState(raw) : newState(), imgs, meta, thumb);
  void sync?.pull().then((r) => {
    if (r && r.ok) routeAfterLoad();
  });
}

function captureJoinLink() {
  const m = location.hash.match(/join=([A-Za-z0-9]{6})/);
  if (m) {
    const code = m[1]!.toUpperCase();
    try {
      sessionStorage.setItem('tq:join', code);
    } catch {
      /* ignore */
    }
    history.replaceState(null, '', location.pathname + location.search);
  }
  let pending: string | null = null;
  try {
    pending = sessionStorage.getItem('tq:join');
  } catch {
    /* ignore */
  }
  app.set({ pendingJoin: pending });
}

export function clearPendingJoin() {
  try {
    sessionStorage.removeItem('tq:join');
  } catch {
    /* ignore */
  }
  app.set({ pendingJoin: null });
}

async function refreshServerConfig() {
  const r = await api.config();
  if (r.ok) {
    const server = {
      terms_ver: Number(r.terms_ver) || 1,
      min_version: String(r.min_version ?? '0'),
      broadcast: String(r.broadcast ?? ''),
      broadcast_id: String(r.broadcast_id ?? ''),
    };
    app.set({ server, termsVer: server.terms_ver });
  }
}

async function startSession(session: Session, game: GameState, imgs: Imgs | null, meta: Meta, thumb: { src: string; bd: string } | null) {
  sync?.stop();
  sfx.setMuted(game.settings.mute);
  const today = dayKey();
  let g = game;
  const events: GameEvent[] = [];
  if (g.profile.onboarded) {
    const r = rollover(g, today);
    g = r.state;
    events.push(...r.events);
  }
  app.set({ session, game: g, imgs, thumb, phase: g.profile.onboarded ? 'game' : 'onboarding' });
  sync = new Sync(kv!, api, host, session.token);
  await sync.init(meta);
  if (g !== game) persist(g);
  if (events.length) handleEvents(events, { quiet: true });
  void ensureThumb();
  if (dayTimer) clearInterval(dayTimer);
  dayTimer = setInterval(checkDay, 60000);
}

function routeAfterLoad() {
  const s = app.get();
  if (s.phase === 'consent') return;
  if (s.game && !s.game.profile.onboarded && s.phase === 'game') app.set({ phase: 'onboarding' });
  if (s.game && s.game.profile.onboarded && s.phase === 'onboarding' && !s.creatingCharacter) app.set({ phase: 'game' });
}

const host = {
  getState: () => app.get().game!,
  setState: (s: GameState) => {
    const today = dayKey();
    let g = s;
    if (g.profile.onboarded) g = rollover(g, today).state;
    app.set({ game: g });
    void persist(g, false);
    sfx.setMuted(g.settings.mute);
    routeAfterLoad();
    void ensureThumb();
  },
  getImgs: () => app.get().imgs,
  setImgs: (i: Imgs | null) => {
    app.set({ imgs: i, thumb: null });
    void kv?.set('imgs', i);
    void kv?.del('thumb');
    void ensureThumb();
  },
  buildPub: (): PubCard => {
    const s = app.get();
    const g = s.game!;
    return {
      name: g.profile.heroName || s.session?.name || 'גיבור',
      level: levelOf(g.xp),
      xp: g.xp,
      streak: g.streak.count,
      title: titleName(g.title),
      thumb: s.thumb?.src ?? null,
    };
  },
  onStatus: (st: Sync['status']) => {
    app.set({ sync: st });
    if (st === 'signedOut') void signOut(true);
    if (st === 'consent') app.set({ phase: 'consent' });
  },
  onPayload: (p: ServerPayload) => {
    app.set({ parties: p.parties ?? [], termsVer: p.terms_ver });
    if (p.user?.name && app.get().session) {
      const s = { ...app.get().session!, name: p.user.name };
      app.set({ session: s });
      void kv?.set('session', s);
    }
  },
  isOnline: online,
};

/** Rebuild the small portrait when the rank backdrop changes. */
export async function ensureThumb() {
  const s = app.get();
  if (!s.game || !s.imgs) return;
  const src = s.imgs.cut ?? s.imgs.legacy;
  if (!src) return;
  const bd = s.imgs.cut ? backdropFor(levelOf(s.game.xp)).id : 'legacy';
  if (s.thumb && s.thumb.bd === bd) return;
  const t = await makeThumb(src, levelOf(s.game.xp), !s.imgs.cut);
  if (!t) return;
  const thumb = { src: t, bd };
  app.set({ thumb });
  await kv?.set('thumb', thumb);
  void sync?.changed();
}

function checkDay() {
  const g = app.get().game;
  if (!g || !g.profile.onboarded || !g.day) return;
  const today = dayKey();
  if (g.day.key === today) return;
  apply((s) => rollover(s, today));
}

// --------------------------------------------------------- persistence

let pendingState: GameState | null = null;

async function writeLocal() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const g = pendingState;
  pendingState = null;
  if (!g) return;
  try {
    await kv?.set('state', g);
  } catch {
    toast('אין מקום פנוי במכשיר לשמירה', '⚠️', 'warn');
  }
}

/** Save locally (batched, so fast tapping doesn't thrash IndexedDB) and schedule a push. */
function persist(g: GameState, push = true) {
  pendingState = g;
  if (!saveTimer) saveTimer = setTimeout(() => void writeLocal(), 250);
  if (push) void sync?.changed();
}

/** Apply a game update without re-rendering anything that didn't change. */
export function apply(fn: (s: GameState) => Result | GameState, opts: { quiet?: boolean } = {}): GameEvent[] {
  const cur = app.get().game;
  if (!cur) return [];
  const out = fn(cur);
  const r: Result = 'state' in out && 'events' in out ? (out as Result) : { state: out as GameState, events: [] };
  if (r.state === cur) return [];
  app.set({ game: r.state, lastEvents: r.events });
  void persist(r.state);
  handleEvents(r.events, opts);
  return r.events;
}

function handleEvents(events: GameEvent[], opts: { quiet?: boolean } = {}) {
  const overlays: Overlay[] = [];
  let level: Overlay | null = null;
  for (const e of events) {
    switch (e.type) {
      case 'levelUp':
        level = { kind: 'levelUp', from: level && level.kind === 'levelUp' ? level.from : e.from, to: e.to };
        break;
      case 'backdrop':
        if (level && level.kind === 'levelUp') level.backdrop = { from: e.from, to: e.to };
        void (async () => {
          app.set({ thumb: null });
          await kv?.del('thumb');
          await ensureThumb();
        })();
        break;
      case 'bossDefeated':
        overlays.push({ kind: 'boss', bossId: e.bossId, reward: e.reward });
        break;
      case 'achievement': {
        const a = ACH.find((x) => x.id === e.id);
        if (a) toast(`הישג חדש: ${a.name}`, a.icon);
        break;
      }
      case 'title': {
        const t = TITLES.find((x) => x.id === e.id);
        if (t) toast(`תואר חדש נפתח: ${t.name}`, '🎖️');
        break;
      }
      case 'perfectDay':
        toast(`יום מושלם! +${e.bonus} XP`, '🌟');
        break;
      case 'shieldEarned':
        toast('הרווחת מגן רצף: יום אחד שמתפספס לא ישבור את הרצף.', '🛡️', 'info');
        break;
      case 'shieldUsed':
        toast('מגן הרצף הציל את הרצף שלך!', '🛡️', 'info');
        break;
      case 'streakLost':
        if (!opts.quiet || e.was > 1) toast(`הרצף של ${e.was} ימים נגמר. מתחילים רצף חדש היום.`, '🔥', 'info');
        break;
      case 'newBoss': {
        const b = BOSSES.find((x) => x.id === e.bossId);
        if (b && !opts.quiet) toast(`אויב חדש: ${b.name}`, '⚔️', 'info');
        break;
      }
      default:
        break;
    }
  }
  if (level) overlays.unshift(level);
  if (overlays.length) app.set((s) => ({ overlays: [...s.overlays, ...overlays] }));
  const sound = overlays.some((o) => o.kind === 'levelUp') ? 'levelUp' : overlays.some((o) => o.kind === 'boss') ? 'boss' : null;
  if (sound) void sfx.play(sound);
  else if (events.some((e) => e.type === 'xp')) void sfx.play('tick');
}

export function dismissOverlay() {
  const s = app.get();
  const next = s.overlays.slice(1);
  app.set({ overlays: next });
  // the boss sound plays when its overlay shows up after a level-up overlay
  if (next[0]?.kind === 'boss' && s.overlays[0]?.kind === 'levelUp') void sfx.play('boss');
}

// ---------------------------------------------------------------- game

export function completeQuest(id: string, text?: string) {
  const ev = apply((s) => engComplete(s, id, text !== undefined ? { text } : {}));
  if (ev.length) {
    const xp = ev.find((e) => e.type === 'xp' && e.questId === id);
    if (xp && xp.type === 'xp' && !ev.some((e) => e.type === 'levelUp')) {
      toast(`${pick(DONE_LINES, Date.now() >> 8)} +${xp.amount} XP`, '✓');
    }
  }
}
export const progressQuest = (id: string, d: number) => apply((s) => engProgress(s, id, d));
export const easeQuest = (id: string) => apply((s) => engEase(s, id));
export const setQuestText = (id: string, t: string) => apply((s) => engText(s, id, t));
export const chooseTitle = (id: string) => apply((s) => engTitle(s, id));

export function setSetting<K extends keyof GameState['settings']>(k: K, v: GameState['settings'][K]) {
  apply((s) => ({ ...s, settings: { ...s.settings, [k]: v }, updatedAt: Date.now() }));
  if (k === 'mute') sfx.setMuted(v as boolean);
}

export function setHeroName(name: string) {
  apply((s) => ({ ...s, profile: { ...s.profile, heroName: name }, updatedAt: Date.now() }));
}

export function seenBroadcast(id: string) {
  apply((s) => ({ ...s, seenBroadcast: id, updatedAt: Date.now() }));
}

/** Finish onboarding with the interview results. */
export function finishInterview(p: Pick<GameState['profile'], 'heroName' | 'focus' | 'struggles' | 'minutes' | 'goal' | 'block'>) {
  const cur = app.get().game ?? newState();
  let g: GameState = { ...cur, profile: { ...cur.profile, ...p, onboarded: true }, updatedAt: Date.now() };
  const r = rollover({ ...g, day: null }, dayKey());
  g = r.state;
  app.set({ game: g });
  void persist(g);
}

/** Store a freshly created character (cut-out only; never the photo). */
export async function saveCharacter(cut: string, frame: Imgs['frame']) {
  const imgs: Imgs = { cut, ...(frame ? { frame } : {}), style: 2 };
  app.set({ imgs, thumb: null });
  await kv?.set('imgs', imgs);
  await kv?.del('thumb');
  const evs: GameEvent[] = [];
  apply((s) => {
    const n: GameState = { ...s, char: { imgV: (s.char?.imgV ?? 0) + 1, legacy: false, style: 2 }, updatedAt: Date.now() };
    checkUnlocks(n, evs, Date.now());
    return { state: n, events: evs };
  });
  await ensureThumb();
  await sync?.changed({ imgs: true });
}

// ---------------------------------------------------------------- auth

export interface AuthResult {
  ok: boolean;
  msg?: string;
}

async function adopt(phone: string, r: ServerPayload & { token: string }, fallbackName: string) {
  const session: Session = { token: r.token, name: r.user?.name ?? fallbackName, phone };
  await kv!.set('session', session);
  const has = r.state && typeof r.state === 'object' && Object.keys(r.state as object).length > 0;
  const local = await kv!.get<unknown>('state');
  // a device that was used offline by the same account keeps its progress
  const game = has ? normalizeState(r.state) : local ? normalizeState(local) : newState();
  const imgs = r.imgs ?? null;
  await kv!.set('state', game);
  await kv!.set('imgs', imgs);
  await kv!.del('thumb');
  const meta: Meta = { ...emptyMeta(), base: Number(r.saved_at) || 0, imgV: Number(r.img_v) || 0, dirty: !has };
  await kv!.set('meta', meta);
  app.set({ parties: r.parties ?? [], termsVer: r.terms_ver ?? 1 });
  await startSession(session, game, imgs, meta, null);
  if (r.consent_ver < r.terms_ver) app.set({ phase: 'consent' });
}

export async function register(phoneIn: string, pin: string, name: string, consent: boolean): Promise<AuthResult> {
  if (!consent) return { ok: false, msg: T.auth.noTerms };
  const phone = normalizePhone(phoneIn);
  if (!phone) return { ok: false, msg: errText('bad_phone') };
  const r = await api.register(phone, pin, name.trim(), TERMS_VERSION);
  if (!r.ok && r.err === 'consent_required') return { ok: false, msg: T.common.minVersion };
  if (!r.ok) return { ok: false, msg: errText(r.err as string, r as { left?: number; retry_in?: number }) };
  await kv!.del('state');
  await adopt(phone, r as unknown as ServerPayload & { token: string }, name);
  return { ok: true };
}

export async function login(phoneIn: string, pin: string): Promise<AuthResult> {
  const phone = normalizePhone(phoneIn);
  if (!phone) return { ok: false, msg: errText('bad_credentials') };
  const r = await api.login(phone, pin);
  if (!r.ok) return { ok: false, msg: errText(r.err as string, r as { left?: number; retry_in?: number }) };
  // a different account on this device: start clean
  const prev = await kv!.get<Session>('session');
  if (prev && prev.phone !== phone) await kv!.clear();
  await adopt(phone, r as unknown as ServerPayload & { token: string }, '');
  return { ok: true };
}

export async function acceptTerms(): Promise<AuthResult> {
  const s = app.get().session;
  if (!s) return { ok: false };
  // only ever accept the version whose text this build actually shows
  const r = await api.consent(s.token, TERMS_VERSION);
  if (!r.ok) return { ok: false, msg: errText(r.err as string) };
  app.set({ phase: app.get().game?.profile.onboarded ? 'game' : 'onboarding' });
  void sync?.push();
  return { ok: true };
}

export async function signOut(expired = false) {
  const s = app.get().session;
  await writeLocal();
  await sync?.flush().catch(() => {});
  sync?.stop();
  sync = null;
  if (s && !expired) void api.logout(s.token);
  await wipeDevice(kv);
  kv = await openStore();
  app.reset();
  app.set({ phase: 'auth' });
  if (expired) toast(T.err.auth as string, '🔑', 'info');
}

export async function changePin(oldPin: string, newPin: string): Promise<AuthResult> {
  const s = app.get().session;
  if (!s) return { ok: false };
  const r = await api.changePin(s.token, oldPin, newPin);
  if (!r.ok) return { ok: false, msg: errText(r.err as string, r as { left?: number }) };
  return { ok: true, msg: T.account.pinChanged };
}

export async function deleteAccount(pin: string): Promise<AuthResult> {
  const s = app.get().session;
  if (!s) return { ok: false };
  const r = await api.deleteAccount(s.token, pin);
  if (!r.ok) return { ok: false, msg: errText(r.err as string, r as { left?: number; retry_in?: number }) };
  sync?.stop();
  sync = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  pendingState = null;
  await wipeDevice(kv);
  kv = await openStore();
  app.reset();
  app.set({ phase: 'auth' });
  toast(T.account.deleted, '👋', 'info');
  return { ok: true };
}

// --------------------------------------------------------------- party

export async function partyCreate(name: string): Promise<AuthResult & { code?: string }> {
  const s = app.get().session;
  if (!s) return { ok: false };
  const r = await api.partyCreate(s.token, name);
  if (!r.ok) return { ok: false, msg: errText(r.err as string) };
  app.set({ parties: r.parties });
  partyJoined();
  return { ok: true, code: r.code };
}

export async function partyJoin(code: string): Promise<AuthResult & { code?: string }> {
  const s = app.get().session;
  if (!s) return { ok: false };
  const r = await api.partyJoin(s.token, code.trim());
  if (!r.ok) return { ok: false, msg: errText(r.err as string) };
  app.set({ parties: r.parties });
  partyJoined();
  return { ok: true, code: r.code };
}

function partyJoined() {
  const evs: GameEvent[] = [];
  apply((g) => {
    const n = JSON.parse(JSON.stringify(g)) as GameState;
    checkUnlocks(n, evs, Date.now(), { inParty: true });
    return { state: evs.length ? n : g, events: evs };
  });
}

export async function partyLeave(code: string): Promise<AuthResult> {
  const s = app.get().session;
  if (!s) return { ok: false };
  const r = await api.partyLeave(s.token, code);
  if (!r.ok) return { ok: false, msg: errText(r.err as string) };
  app.set({ parties: r.parties, board: null });
  return { ok: true };
}

export async function loadBoard(code: string) {
  const s = app.get().session;
  if (!s || !online()) return;
  // push my latest card first so I see myself up to date
  await sync?.push();
  const r = await api.party(s.token, code);
  if (r.ok) app.set({ board: { code: r.code, name: r.name, members: r.members } });
  else if (r.err === 'not_member') app.set({ board: null });
}

export const setTab = (tab: 'quests' | 'world' | 'hero') => app.set({ tab });

export function syncNow() {
  void sync?.push();
}
