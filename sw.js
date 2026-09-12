/*
 * The shop floor has no network to depend on, so the app itself is kept on the device
 * the same way its trays are.
 *
 * Assets are content-hashed by the build: once one is cached it can never be wrong, so
 * they are served from the cache and fetched only when missing. The page itself has no
 * hash — it is what points at the current assets — so it is fetched first and only falls
 * back to the kept copy when there is nothing to fetch from. A shop that opens offline
 * gets the last version it ran; one that opens online is up to date.
 */
const CACHE = 'velanidia-v1';

// Where this worker was registered — the app's base, which is a subdirectory on GitHub
// Pages and the root elsewhere. Everything it keeps is addressed from there.
const PAGE = new URL('index.html', self.registration.scope).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(PAGE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

/** Keeps a copy of what came back, when it is worth keeping. */
async function keep(request, response) {
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function page(request) {
  try {
    return await keep(request, await fetch(request));
  } catch {
    return (await caches.match(PAGE)) ?? Response.error();
  }
}

async function asset(request) {
  const kept = await caches.match(request);
  if (kept) return kept;
  return keep(request, await fetch(request));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.mode === 'navigate' ? page(request) : asset(request));
});
