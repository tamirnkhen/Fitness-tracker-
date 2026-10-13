import { useEffect, useState } from 'preact/hooks';
import type { ConfigState } from '../config';
import type { GameEvent, GameState } from '../game/types';
import type { Imgs, PartyBoard, PartyInfo } from '../api/types';
import type { SyncStatus } from '../sync/sync';

export type Phase = 'boot' | 'setup' | 'auth' | 'consent' | 'onboarding' | 'game' | 'admin';
export type Tab = 'quests' | 'world' | 'hero';

export type Overlay =
  { kind: 'levelUp'; from: number; to: number; backdrop?: { from: string; to: string } } | { kind: 'boss'; bossId: string; reward: number };

export interface Toast {
  id: number;
  text: string;
  icon?: string;
  tone?: 'good' | 'info' | 'warn';
}

export interface ServerCfg {
  terms_ver: number;
  min_version: string;
  broadcast: string;
  broadcast_id: string;
}

export interface Session {
  token: string;
  name: string;
  phone: string;
}

export interface AppState {
  phase: Phase;
  config: ConfigState | null;
  session: Session | null;
  game: GameState | null;
  imgs: Imgs | null;
  thumb: { src: string; bd: string } | null;
  sync: SyncStatus;
  online: boolean;
  parties: PartyInfo[];
  board: PartyBoard | null;
  server: ServerCfg | null;
  tab: Tab;
  overlays: Overlay[];
  toasts: Toast[];
  updateReady: boolean;
  pendingJoin: string | null;
  termsVer: number;
  creatingCharacter: boolean;
  lastEvents: GameEvent[];
}

const initial: AppState = {
  phase: 'boot',
  config: null,
  session: null,
  game: null,
  imgs: null,
  thumb: null,
  sync: 'idle',
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  parties: [],
  board: null,
  server: null,
  tab: 'quests',
  overlays: [],
  toasts: [],
  updateReady: false,
  pendingJoin: null,
  termsVer: 1,
  creatingCharacter: false,
  lastEvents: [],
};

type Listener = () => void;
let state: AppState = initial;
const listeners = new Set<Listener>();

export const app = {
  get: () => state,
  set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
    const p = typeof patch === 'function' ? patch(state) : patch;
    let changed = false;
    for (const k of Object.keys(p) as (keyof AppState)[]) {
      if (!Object.is(state[k], p[k])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    state = { ...state, ...p };
    for (const l of [...listeners]) l();
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  reset() {
    state = { ...initial, config: state.config, online: state.online };
    for (const l of listeners) l();
  },
};

/** Subscribe a component to a slice of the app state. Re-renders only when the slice changes. */
export function useApp<T>(sel: (s: AppState) => T): T {
  const [v, setV] = useState(() => sel(state));
  useEffect(() => {
    const check = () => {
      let n: T;
      try {
        n = sel(state);
      } catch {
        // the component is about to unmount (e.g. game cleared on sign-out)
        return;
      }
      setV((old) => (Object.is(old, n) ? old : n));
    };
    check();
    return app.subscribe(check);
  }, []);
  return v;
}

let toastId = 0;
export function toast(text: string, icon?: string, tone: Toast['tone'] = 'good') {
  const t: Toast = { id: ++toastId, text, tone, ...(icon ? { icon } : {}) };
  app.set((s) => ({ toasts: [...s.toasts.slice(-3), t] }));
  setTimeout(() => app.set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), 3600);
}
