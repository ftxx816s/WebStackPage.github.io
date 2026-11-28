/* Private Navigation Toolbox V21.12 · local-first application shell cache. */
const SW_VERSION = 'fxnav-shell-v2112-studio-dialogs';
const SHELL_CACHE = `${SW_VERSION}-shell`;
const STATIC_CACHE = `${SW_VERSION}-static`;
const CORE_STATIC_URLS = [
  '/assets/runtime/brand-mark-c8629aa2.png',
  '/assets/runtime/favicon-985ed977.png',
  '/assets/runtime/fontawesome-2adefcbc.woff2',
  '/assets/runtime/neon-reference-bg-1fb3c28a.webp',
  '/assets/runtime/manager-ui-v1998.css?v=2008-official-glass-controls',
  '/assets/runtime/manager-ui-v1998.js?v=1998',
  '/assets/studio-v2100/studio.css?v=2112',
  '/assets/studio-v2100/studio.js?v=2112',
  '/assets/studio-v2100/catalog.js?v=2112'
];

async function boundedFetch(path, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(path, { cache: 'reload', credentials: 'same-origin', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function cacheCoreResource(cache, path) {
  try {
    const response = await boundedFetch(path, 4000);
    if (response && response.ok && response.type === 'basic') {await cache.put(path, response.clone());return true;}
  } catch (_) {}
  return false;
}

// Never activate a new worker with a missing or older application shell.
// A partial response is not a safe offline fallback.
const APP_SIGNATURE='version:"21.12",build:"V21.12"';
async function validatedShell(response, key){
  if(!response||!response.ok||response.type!=='basic')return null;
  const html=await response.clone().text();
  const valid=key==='/cn/'?html.includes(APP_SIGNATURE):html.includes('BUILD V21.12')&&html.includes('studio.js?v=2112');
  return valid?response:null;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell=await caches.open(SHELL_CACHE);
    // Both entry documents and the new workspace dependencies must exist before activation.
    for(const path of ['/cn/','/']){
      const response=await boundedFetch(path,20000);
      if(!await validatedShell(response,path))throw new Error('V21.12 shell unavailable: '+path);
      await shell.put(path,response);
    }
    const statics=await caches.open(STATIC_CACHE);
    const results=await Promise.all(CORE_STATIC_URLS.map(path=>cacheCoreResource(statics,path)));
    if(results.some((ok,i)=>!ok&&CORE_STATIC_URLS[i].startsWith('/assets/studio-v2100/')))throw new Error('V21.12 studio assets not fully available');
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    const statics = await caches.open(STATIC_CACHE);
    const shellReady = !!(await shell.match('/cn/')) && !!(await shell.match('/'));
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
  if (copy.pathname === '/index.html') copy.pathname = '/';
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

  if (request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname)) {
    event.respondWith((async()=>{
      const key=canonicalNavigationKey(url);
      try {
        const fresh=await updateNavigation(request,key);
        if(fresh.ok)return fresh;
      }catch(_){}
      const cache=await caches.open(SHELL_CACHE);
      const cached=await cache.match(key);
      if(cached&&await validatedShell(cached,'/'))return cached;
      return new Response('创意工作台暂时无法联网，请联网后重新打开首页。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
    })());
    return;
  }

  if (request.mode === 'navigate' && ['/cn', '/cn/', '/cn/index.html'].includes(url.pathname)) {
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
        if (await validatedShell(fresh,'/cn/')) await cache.put(key, fresh.clone());
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
