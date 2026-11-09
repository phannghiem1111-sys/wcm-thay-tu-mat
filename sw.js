// Service worker: cache khung app để mở nhanh/offline; dữ liệu Supabase luôn lấy từ mạng.
const C = "wcm-tumat-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "vendor/xlsx.full.min.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.hostname.endsWith("supabase.co")) return;
  const isCdn = /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(u.hostname);
  if (isCdn) { // cache-first cho thư viện có version cố định
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(C).then(c => c.put(e.request, cp)); return res; })));
  } else if (u.origin === location.origin) { // network-first cho app
    e.respondWith(fetch(e.request).then(res => { const cp = res.clone(); caches.open(C).then(c => c.put(e.request, cp)); return res; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
  }
});
