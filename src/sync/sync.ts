import type { GameState } from '../game/types';
import { normalizeState } from '../game/state';
import { mergeStates } from '../game/merge';
import type { Imgs, PubCard, ServerPayload } from '../api/types';
import type { RpcResult } from '../api/rpc';
import type { KV } from './store';

export type SyncStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'offline' | 'error' | 'signedOut' | 'consent';

export interface Meta {
  /** server saved_at our local copy is based on */
  base: number;
  dirty: boolean;
  imgDirty: boolean;
  /** server img_v our images are based on */
  imgV: number;
  pubKey: string;
  lastSync: number;
}

export interface SyncApi {
  save(token: string, base: number, state: unknown, pub: PubCard, imgs?: Imgs | null, imgV?: number): Promise<RpcResult>;
  load(token: string): Promise<RpcResult>;
}

export interface SyncHost {
  getState(): GameState;
  setState(s: GameState, why: 'merge' | 'pull'): void;
  getImgs(): Imgs | null;
  setImgs(i: Imgs | null): void;
  buildPub(): PubCard;
  onStatus(s: SyncStatus): void;
  onPayload?(p: ServerPayload): void;
  isOnline(): boolean;
}

export const DEBOUNCE_MS = 1500;
export const RETRY_MS = 20000;

export const emptyMeta = (): Meta => ({ base: 0, dirty: false, imgDirty: false, imgV: 0, pubKey: '', lastSync: 0 });

/**
 * Offline-first sync. The local copy is the truth while playing; the
 * server is a backup and the bridge between devices.
 */
export class Sync {
  meta: Meta = emptyMeta();
  status: SyncStatus = 'idle';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private inflight: Promise<void> | null = null;
  private again = false;
  private stopped = false;

  constructor(
    private store: KV,
    private api: SyncApi,
    private host: SyncHost,
    private token: string,
  ) {}

  async init(meta?: Meta) {
    this.meta = { ...emptyMeta(), ...(meta ?? (await this.store.get<Meta>('meta')) ?? {}) };
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.retry) clearTimeout(this.retry);
  }

  private set(s: SyncStatus) {
    this.status = s;
    this.host.onStatus(s);
  }

  private async saveMeta() {
    await this.store.set('meta', this.meta).catch(() => {});
  }

  /** Call after every local change. Saves locally now, pushes debounced. */
  async changed(opts: { imgs?: boolean } = {}) {
    this.meta.dirty = true;
    if (opts.imgs) this.meta.imgDirty = true;
    await this.saveMeta();
    this.schedule(DEBOUNCE_MS);
  }

  schedule(ms: number) {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    if (this.status !== 'offline' && this.status !== 'error') this.set('pending');
    this.timer = setTimeout(() => void this.push(), ms);
  }

  private scheduleRetry() {
    if (this.stopped) return;
    if (this.retry) clearTimeout(this.retry);
    this.retry = setTimeout(() => {
      this.retry = null;
      void this.push();
    }, RETRY_MS);
  }

  /** Flush now (e.g. on pagehide). */
  flush() {
    if (this.timer) clearTimeout(this.timer);
    return this.push();
  }

  async push(): Promise<void> {
    if (this.stopped) return;
    if (this.inflight) {
      this.again = true;
      return this.inflight;
    }
    this.inflight = this.doPush().finally(() => {
      this.inflight = null;
      if (this.again) {
        this.again = false;
        void this.push();
      }
    });
    return this.inflight;
  }

  private async doPush(depth = 0): Promise<void> {
    const pub = this.host.buildPub();
    const pubKey = JSON.stringify(pub);
    if (!this.meta.dirty && !this.meta.imgDirty && pubKey === this.meta.pubKey) {
      this.set('saved');
      return;
    }
    if (!this.host.isOnline()) {
      this.set('offline');
      this.scheduleRetry();
      return;
    }
    this.set('saving');
    const state = this.host.getState();
    const sendImgs = this.meta.imgDirty;
    const imgs = sendImgs ? this.host.getImgs() : undefined;
    const nextImgV = sendImgs ? this.meta.imgV + 1 : undefined;
    // the edit counter we are pushing; later edits keep `dirty`
    const editAt = state.updatedAt;
    const r = await this.api.save(this.token, this.meta.base, state, pub, imgs ?? null, nextImgV);
    if (r.ok) {
      this.meta.base = Number(r.saved_at) || this.meta.base;
      if (sendImgs && nextImgV !== undefined) {
        this.meta.imgV = nextImgV;
        this.meta.imgDirty = false;
      }
      if (this.host.getState().updatedAt === editAt) this.meta.dirty = false;
      this.meta.pubKey = pubKey;
      this.meta.lastSync = Date.now();
      await this.saveMeta();
      this.set(this.meta.dirty ? 'pending' : 'saved');
      if (this.meta.dirty) this.schedule(DEBOUNCE_MS);
      return;
    }
    switch (r.err) {
      case 'conflict': {
        if (depth > 2) {
          this.set('error');
          this.scheduleRetry();
          return;
        }
        const merged = mergeStates(this.host.getState(), r.state);
        this.host.setState(merged, 'merge');
        this.meta.base = Number(r.saved_at) || 0;
        const serverImgV = Number(r.img_v) || 0;
        if (serverImgV > this.meta.imgV && !this.meta.imgDirty) {
          if (r.imgs !== undefined && r.imgs !== null) this.host.setImgs(r.imgs as Imgs);
          this.meta.imgV = serverImgV;
        } else if (this.meta.imgDirty) {
          this.meta.imgV = Math.max(this.meta.imgV, serverImgV);
        }
        this.meta.dirty = true;
        await this.saveMeta();
        return this.doPush(depth + 1);
      }
      case 'auth':
        this.set('signedOut');
        return;
      case 'consent_required':
        this.set('consent');
        return;
      case 'too_big':
      case 'bad_state':
      case 'bad_pub':
      case 'bad_imgs':
        // a client bug; keep local data, don't spin
        this.set('error');
        return;
      default:
        this.set(r.err === 'network' || r.err === 'timeout' ? 'offline' : 'error');
        this.scheduleRetry();
    }
  }

  /** Pull the server copy (on focus / online / start). */
  async pull(): Promise<RpcResult | null> {
    if (this.stopped || !this.host.isOnline()) {
      if (!this.host.isOnline()) this.set('offline');
      return null;
    }
    const r = await this.api.load(this.token);
    if (!r.ok) {
      if (r.err === 'auth') this.set('signedOut');
      else if (r.err === 'network' || r.err === 'timeout') this.set('offline');
      return r;
    }
    const p = r as unknown as ServerPayload;
    this.host.onPayload?.(p);
    if (p.consent_ver < p.terms_ver) {
      this.set('consent');
      return r;
    }
    const serverAt = Number(p.saved_at) || 0;
    if (serverAt !== this.meta.base) {
      const serverState = p.state && typeof p.state === 'object' && Object.keys(p.state).length ? p.state : null;
      if (serverState) {
        const next = this.meta.dirty ? mergeStates(this.host.getState(), serverState) : normalizeState(serverState);
        this.host.setState(next, 'pull');
      }
      this.meta.base = serverAt;
      // server has nothing yet: push ours. merged: still dirty, pushes below.
      if (!serverState) this.meta.dirty = true;
    }
    if ((p.img_v ?? 0) > this.meta.imgV && !this.meta.imgDirty) {
      this.host.setImgs(p.imgs);
      this.meta.imgV = p.img_v;
    }
    this.meta.lastSync = Date.now();
    await this.saveMeta();
    if (this.meta.dirty || this.meta.imgDirty) this.schedule(200);
    else this.set('saved');
    return r;
  }
}
