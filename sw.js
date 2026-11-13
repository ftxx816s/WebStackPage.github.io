/* Private Navigation Toolbox V20.01 · local-first application shell cache. */
const SW_VERSION = 'fxnav-shell-v2001';
const SHELL_CACHE = `${SW_VERSION}-shell`;
const STATIC_CACHE = `${SW_VERSION}-static`;
const CORE_SHELL_URLS = ['/', '/cn/'];
const CORE_STATIC_URLS = [
  '/assets/runtime/brand-mark-c8629aa2.png',
  '/assets/runtime/favicon-985ed977.png',
  '/assets/runtime/fontawesome-2adefcbc.woff2',
  '/assets/runtime/neon-reference-bg-1fb3c28a.webp',
  '/assets/runtime/manager-ui-v1998.css?v=1998',
  '/assets/runtime/manager-ui-v1998.js?v=1998',
  '/assets/liquid-default-v20.00.webp?v=2000'
];

async function boundedFetch(path, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(path, { cache: 'default', credentials: 'same-origin', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function cacheCoreResource(cache, path) {
  try {
    const response = await boundedFetch(path, 4000);
    if (response && response.ok && response.type === 'basic') await cache.put(path, response.clone());
  } catch (_) {}
}

// Never activate a new worker with a missing or older application shell.
// A partial response is not a safe offline fallback.
const APP_SIGNATURE='version:"20.01",build:"V20.01"';
async function validatedShell(response, key){
  if(!response||!response.ok||response.type!=='basic')return null;
  const html=await response.clone().text();
  const valid=key==='/cn/'?html.includes(APP_SIGNATURE):html.includes('V20.01');
  return valid?response:null;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell=await caches.open(SHELL_CACHE);
    const response=await boundedFetch('/cn/', 20000);
    if(!await validatedShell(response,'/cn/'))throw new Error('V20.01 app shell not fully available');
    await shell.put('/cn/',response);
    const statics=await caches.open(STATIC_CACHE);
    await Promise.all([
      cacheCoreResource(shell,'/'),
      ...CORE_STATIC_URLS.map(path=>cacheCoreResource(statics,path))
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    const statics = await caches.open(STATIC_CACHE);
    const shellReady = !!(await shell.match('/cn/'));
    const staticReady = (await Promise.all(CORE_STATIC_URLS.map(path => statics.match(path)))).every(Boolean);
    // Keep the previous working shell if this update could not fully precache its replacement.
    if (shellReady && staticReady) {
      const names = await caches.keys();
      await Promise.all(names.filter(name => name.startsWith('fxnav-shell-') && ![SHELL_CACHE, STATIC_CACHE].includes(name)).map(name => caches.delete(name)));
    }
    await self.clients.claim();
  })());
});

function canonicalNavigationKey(url) {
  const copy = new URL(url.href);
  copy.search = '';
  if (copy.pathname === '/cn' || copy.pathname === '/cn/index.html') copy.pathname = '/cn/';
  return copy.href;
}

async function updateNavigation(request, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (await validatedShell(response, new URL(key).pathname)) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(key, response.clone());
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Authenticated and mutable APIs must always reach the server; never cache private D1 responses.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate' && ['/', '/cn', '/cn/', '/cn/index.html'].includes(url.pathname)) {
    const key = canonicalNavigationKey(url);
    const currentCachePromise = caches.open(SHELL_CACHE);
    const cachedPromise = currentCachePromise.then(cache => cache.match(key)).then(async current => current || await caches.match(key));
    const updatePromise = cachedPromise.then(cached => cached ? updateNavigation(request, key).catch(() => null) : null);
    event.waitUntil(updatePromise.then(() => undefined));
    event.respondWith((async () => {
      const cache = await currentCachePromise;
      let cached = await cache.match(key);
      if (!cached) cached = await caches.match(key);
      if (cached) return cached;
      // No cached shell yet: allow the browser's normal network request to finish without an artificial timeout.
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok && fresh.type === 'basic') await cache.put(key, fresh.clone());
        return fresh;
      } catch (_) {
        const appShell = await caches.match(new URL('/cn/', self.location.origin).href);
        if (appShell) return appShell;
        return new Response('私人导航工具箱暂时无法联网。首次成功打开页面后，浏览器会建立离线缓存。', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      let cached = await cache.match(request);
      if (!cached) cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    })());
  }
});
