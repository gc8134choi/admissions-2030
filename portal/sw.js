// 서비스 워커: 정적 파일은 네트워크 우선(실패하면 캐시), 데이터 JSON은 캐시를 먼저 보여 주고 뒤에서 갱신(stale-while-revalidate).
// 범위는 이 파일이 있는 폴더(/admissions-2030/portal/)다. 캐시 이름의 버전을 올리면 옛 캐시를 지운다.
const VERSION = "2026-10-31-19";
const STATIC = `static-${VERSION}`, DATA = `data-${VERSION}`;
const CORE = ["./", "index.html", "style.css", "theme.css", "scrap.css", "dense.css", "glass.css", "fonts/gaegu-700.woff2", "fonts/gowun-batang-700.woff2", "app.js", "menu.js", "home.js", "profile.js", "profile-ui.js", "subject-info.js", "files.js", "policy.js", "credit.js", "school-card.js", "roadmap.js", "search.js", "univ-match.js", "map.js", "planner.js", "stage.js", "briefing.js", "dash.js", "terms.js", "hs-compare.js", "middle.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

// 홈이 오프라인에서도 열리도록 처음 설치할 때 자주 쓰는 데이터도 함께 담는다.
const DATA_CORE = ["schools", "summary", "curricula", "policy", "learners", "links", "subject-info", "facets", "school-notes", "files", "places", "middle", "briefings", "hs-compare", "glossary"].map((n) => `data/${n}.json`);
self.addEventListener("install", (e) => {
  e.waitUntil(Promise.all([
    caches.open(STATIC).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))),
    caches.open(DATA).then((c) => Promise.all(DATA_CORE.map((u) => c.add(u).catch(() => {})))),
  ]));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => ![STATIC, DATA].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "skip") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // 외부(폰트 CDN 등)는 건드리지 않는다
  if (url.pathname.includes("/data/") && url.pathname.endsWith(".json")) {
    e.respondWith(caches.open(DATA).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  e.respondWith(fetch(req).then((r) => { if (r.ok) caches.open(STATIC).then((c) => c.put(req, r.clone())); return r; })
    .catch(() => caches.match(req).then((m) => m || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
