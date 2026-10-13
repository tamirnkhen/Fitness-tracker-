/* The Quest service worker.
 * - App shell: network-first, offline fallback from cache.
 * - Hashed assets & fonts: cache-first.
 * - NEVER caches anything that is not same-origin (Supabase is never cached),
 *   and never caches version.json. config.js is network-first like the shell
 *   (so the game still opens offline).
 */
const BUILD = '__BUILD_ID__';
const CACHE = 'quest-' + BUILD;
const PRECACHE = __PRECACHE__;
const NEVER = ['/version.json', '/sw.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => {}),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('quest-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase & everything else: straight to network
  if (NEVER.includes(url.pathname)) return;

  const hashed = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/seg/');
  if (hashed) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // shell / navigation: network first, cache fallback
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? '/' : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === 'navigate' ? '/' : req).then((hit) => hit || caches.match('/'))),
  );
});
