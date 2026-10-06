/* Fişlik service worker: uygulamayı çevrimdışı çalıştırır.
   Uygulama dosyaları önce ağdan istenir (her açılışta güncel sürüm), ağ yoksa ya da
   birkaç saniye içinde cevap gelmezse önbellekteki sürüm verilir. Yazı tipleri önce önbellekten. */
const CACHE = "fislik-v3";
const NET_TIMEOUT = 3500;   // ms; yavaş bağlantıda bu süreden sonra önbellekteki sürüm açılır
const SHELL = [
  "./",
  "index.html",
  "css/style.css",
  "js/app.js",
  "data/decks.js",
  "data/stories.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("fislik-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  e.respondWith(caches.open(CACHE).then(async cache => {
    // sayfa açılışları "?..." gibi eklerle gelse de kabuğu bulsun
    const key = req.mode === "navigate" ? "./" : req;
    // no-cache: tarayıcının kendi HTTP önbelleğini de sunucuya sordurur (değişmediyse 304, ucuz)
    const fresh = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(res => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    });
    e.waitUntil(fresh.catch(() => {}));
    const cached = () => cache.match(key, { ignoreSearch: req.mode === "navigate" });
    const timeout = new Promise(r => setTimeout(r, NET_TIMEOUT));
    try {
      const winner = await Promise.race([fresh, timeout]);
      if (winner) return winner;                     // ağ zamanında cevap verdi
      return (await cached()) || await fresh;         // ağ yavaş: önbellek, o da yoksa ağı bekle
    } catch {
      return (await cached()) || Response.error();    // çevrimdışı
    }
  }));
});
