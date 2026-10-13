import { app } from './store';

declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;

export const APP_VERSION = __APP_VERSION__;

/** a < b for dotted versions. */
export function versionLess(a: string, b: string): boolean {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

export const isOutdated = (min: string) => !!min && min !== '0' && versionLess(APP_VERSION, min);

/** Poll /version.json every ~5 minutes; show a refresh bar when a new build is live. */
export function watchVersion() {
  const check = async () => {
    try {
      const r = await fetch('/version.json', { cache: 'no-store', credentials: 'omit' });
      if (!r.ok) return;
      const v = (await r.json()) as { build?: string };
      if (v.build && v.build !== __BUILD_ID__) app.set({ updateReady: true });
    } catch {
      /* offline */
    }
  };
  setTimeout(check, 30000);
  setInterval(() => document.visibilityState === 'visible' && void check(), 5 * 60 * 1000);
}

export function registerSW() {
  if (
    !('serviceWorker' in navigator) ||
    (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1')
  )
    return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(
      (reg) => {
        reg?.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) app.set({ updateReady: true });
          });
        });
      },
      () => {},
    );
  });
}
