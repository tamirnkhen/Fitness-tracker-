/**
 * Tiny key/value store: IndexedDB first (room for images), localStorage
 * as a fallback, memory as the last resort (private modes that block both).
 */
const DB = 'the-quest';
const STORE = 'kv';
const LS_PREFIX = 'tq:';

export interface KV {
  get<T>(k: string): Promise<T | undefined>;
  set(k: string, v: unknown): Promise<void>;
  del(k: string): Promise<void>;
  clear(): Promise<void>;
  kind: 'idb' | 'ls' | 'memory';
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}

function idbStore(db: IDBDatabase): KV {
  const tx = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void) =>
    new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve((r ? r.result : undefined) as T);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  return {
    kind: 'idb',
    get: <T>(k: string) => tx<T | undefined>('readonly', (s) => s.get(k)),
    set: (k, v) => tx<void>('readwrite', (s) => s.put(v, k)),
    del: (k) => tx<void>('readwrite', (s) => s.delete(k)),
    clear: () => tx<void>('readwrite', (s) => s.clear()),
  };
}

function lsStore(): KV {
  return {
    kind: 'ls',
    async get<T>(k: string) {
      const v = localStorage.getItem(LS_PREFIX + k);
      return v == null ? undefined : (JSON.parse(v) as T);
    },
    async set(k, v) {
      localStorage.setItem(LS_PREFIX + k, JSON.stringify(v));
    },
    async del(k) {
      localStorage.removeItem(LS_PREFIX + k);
    },
    async clear() {
      for (const k of Object.keys(localStorage)) if (k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
    },
  };
}

function memStore(): KV {
  const m = new Map<string, unknown>();
  return {
    kind: 'memory',
    get: async <T>(k: string) => m.get(k) as T | undefined,
    set: async (k, v) => void m.set(k, JSON.parse(JSON.stringify(v))),
    del: async (k) => void m.delete(k),
    clear: async () => m.clear(),
  };
}

/** A store that writes to IDB and mirrors small keys to localStorage. */
export async function openStore(): Promise<KV> {
  let primary: KV | null = null;
  try {
    if (typeof indexedDB !== 'undefined') {
      const db = await Promise.race([idbOpen(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('idb timeout')), 3000))]);
      primary = idbStore(db);
      await primary.get('probe');
    }
  } catch {
    primary = null;
  }
  let ls: KV | null = null;
  try {
    localStorage.setItem(LS_PREFIX + 'probe', '1');
    localStorage.removeItem(LS_PREFIX + 'probe');
    ls = lsStore();
  } catch {
    ls = null;
  }
  if (!primary) return ls ?? memStore();
  if (!ls) return primary;
  const p = primary;
  const l = ls;
  // Mirror the game state (not images) to localStorage as a backup.
  const MIRROR = new Set(['session', 'state', 'meta']);
  return {
    kind: 'idb',
    async get<T>(k: string) {
      try {
        const v = await p.get<T>(k);
        if (v !== undefined) return v;
      } catch {
        /* fall through */
      }
      return MIRROR.has(k) ? l.get<T>(k).catch(() => undefined) : undefined;
    },
    async set(k, v) {
      let okP = true;
      try {
        await p.set(k, v);
      } catch {
        okP = false;
      }
      if (MIRROR.has(k) || !okP) {
        try {
          await l.set(k, v);
        } catch {
          if (!okP) throw new Error('storage_full');
        }
      }
    },
    async del(k) {
      await p.del(k).catch(() => {});
      await l.del(k).catch(() => {});
    },
    async clear() {
      await p.clear().catch(() => {});
      await l.clear().catch(() => {});
    },
  };
}

/** Wipe everything this site stored on the device. */
export async function wipeDevice(store: KV | null): Promise<void> {
  try {
    await store?.clear();
  } catch {
    /* ignore */
  }
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase(DB);
  } catch {
    /* ignore */
  }
  try {
    if (typeof caches !== 'undefined') for (const k of await caches.keys()) await caches.delete(k);
  } catch {
    /* ignore */
  }
}
