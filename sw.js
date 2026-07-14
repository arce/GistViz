// Service worker for GistVis - caches the heavy browsercc (Clang/LLVM)
// WebAssembly toolchain in Cache Storage so it only ever downloads once per
// browser, across page reloads and future visits.
//
// Scope is deliberately narrow: it only intercepts requests for the
// versioned browsercc / browser_wasi_shim assets on jsdelivr. Everything
// else (the GitHub Gist API, raw file contents, the page itself) passes
// straight through untouched, so viewing/editing gist files always stays
// fresh.
//
// Note: service workers only register in a secure context (https or
// localhost) - this silently does nothing if the page is opened via
// file:// or plain http.

const CACHE_NAME = 'gistvis-compiler-cache-v1';

function isCompilerAsset(url) {
  return url.hostname === 'cdn.jsdelivr.net' &&
    (url.pathname.includes('/npm/browsercc@') ||
     url.pathname.includes('/npm/@bjorn3/browser_wasi_shim@'));
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!isCompilerAsset(url)) {
    return; // let the browser / page handle this request normally
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) {
        return cached;
      }

      const response = await fetch(event.request);
      // Package URLs are version-pinned (e.g. browsercc@0.1.1), so any
      // successful response - including cross-origin "opaque" ones - is
      // safe to cache indefinitely; the URL itself never changes content.
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(event.request, response.clone());
      }
      return response;
    })
  );
});
