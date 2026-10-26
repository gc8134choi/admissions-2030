// 학교 지도 보기("학교" 탭 안): 초·중·고 위치를 Leaflet + OpenStreetMap 타일로 보여 준다. 목록과 지도 전환, 네이버 지도·카카오맵 검색 링크.
// 데이터: places.json(tools/build-places.mjs). 좌표가 null인 학교는 목록에만 나온다. 지도(외부 스크립트·타일)를 못 불러오면 목록과 링크만 남는다.
// Leaflet 1.9.4 (BSD-2-Clause, © Vladimir Agafonkin·Leaflet contributors), 타일 © OpenStreetMap contributors (ODbL, tile.openstreetmap.org 이용 정책: 화면 열람용 소량 요청만).
// 서비스 워커는 같은 출처만 가로채므로 타일은 캐시하지 않는다.
const LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
const SRI = { css: "sha256-tXCrvaljxgtN5LT/Syb5Mm9T+yzPFGH98JVcoJT7JTk=", js: "sha256-XJrs/DDkVkUZ29zdzFOkGCJ9zHVo5hnpdi3c7HYJ7Uc=" };
export const LEVEL = { elementary: ["초", "초등학교"], middle: ["중", "중학교"], high: ["고", "고등학교"] };
const ES = { reported: "보도", estimated: "추정" };

let leafletP = null;
function loadLeaflet() {
  if (typeof window === "undefined" || navigator.onLine === false) return Promise.reject(new Error("offline"));
  if (window.L) return Promise.resolve(window.L);
  return (leafletP ||= new Promise((ok, no) => {
    const css = document.createElement("link");
    Object.assign(css, { rel: "stylesheet", href: LEAFLET + "leaflet.min.css", integrity: SRI.css, crossOrigin: "anonymous", referrerPolicy: "no-referrer" });
    document.head.appendChild(css);
    const js = document.createElement("script");
    Object.assign(js, { src: LEAFLET + "leaflet.min.js", integrity: SRI.js, crossOrigin: "anonymous", referrerPolicy: "no-referrer" });
    js.onload = () => (window.L ? ok(window.L) : no(new Error("leaflet")));
    js.onerror = () => { leafletP = null; no(new Error("leaflet")); };
    document.head.appendChild(js);
  }));
}

export const naverUrl = (p) => `https://map.naver.com/p/search/${encodeURIComponent(p.searchQuery || p.name)}`;
export const kakaoUrl = (p) => `https://map.kakao.com/?q=${encodeURIComponent(p.searchQuery || p.name)}`;
const safeUrl = (u) => (/^https?:\/\//.test(u || "") ? u : null);

// 장소 한 곳의 상세(이름·주소·홈페이지·지도 링크). 지도 팝업, 목록, 중학교 배정 화면이 함께 쓴다.
export function placeInfo(p, esc) {
  const st = ES[p.status] ? `<span class="es ${p.status === "reported" ? "rep" : "est"}">${ES[p.status]}</span>` : "";
  const hp = safeUrl(p.homepage);
  return `<b>${esc(p.name)}</b> <span class="muted small">${esc(LEVEL[p.level][1])}${p.kind ? ` · ${esc(p.kind)}` : ""}</span> ${st}
    <div class="pl-addr">${esc(p.address)}</div>
    <div class="pl-links">${hp ? `<a href="${esc(hp)}" target="_blank" rel="noopener">홈페이지</a>` : ""}<a href="${esc(naverUrl(p))}" target="_blank" rel="noopener">네이버 지도에서 열기</a><a href="${esc(kakaoUrl(p))}" target="_blank" rel="noopener">카카오맵에서 열기</a></div>`;
}

export async function mapBody(el, { load, esc, focus = null }) {
  const data = await load("places");
  const places = data.places;
  if (!places.length) { el.innerHTML = `<div class="ed"><h2>학교 지도</h2><p class="muted">아직 정리 중이에요.</p></div>`; return; }
  const st = (el.__map ||= { level: "all", view: "map", sel: null });
  if (focus && places.some((p) => p.id === focus)) { st.sel = focus; st.view = "map"; }
  let map = null, layer = null, markers = new Map(), mapFailed = false;
  const shown = () => places.filter((p) => st.level === "all" || p.level === st.level);
  const chip = (k, v, t, cur) => `<button type="button" class="chip ${v === cur ? "on" : ""}" data-k="${k}" data-v="${v}" aria-pressed="${v === cur}">${t}</button>`;

  el.innerHTML = `<div class="ed pl-wrap"><div class="chipbar"><span class="flabel">보기</span><div class="chips" id="pl-view"></div></div>
    <div class="chipbar"><span class="flabel">학교급</span><div class="chips" id="pl-level"></div></div>
    <div id="pl-map" class="pl-map" hidden></div><p id="pl-fail" class="muted small" hidden>지도를 불러오지 못했어요. 목록과 링크로 확인해 주세요.</p>
    <div id="pl-detail" class="pl-detail" hidden></div><div id="pl-list"></div>
    <p class="ed-src">지도 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · 위치는 조사 시점 기준이고 좌표는 어림값일 수 있어요.</p></div>`;
  const $ = (s) => el.querySelector(s);

  const drawChips = () => {
    $("#pl-view").innerHTML = chip("view", "map", "지도", st.view) + chip("view", "list", "목록", st.view);
    $("#pl-level").innerHTML = chip("level", "all", "전체", st.level) + Object.entries(LEVEL).map(([k, v]) => chip("level", k, v[1], st.level)).join("");
  };
  const drawList = () => {
    $("#pl-list").innerHTML = `<ul class="pl-list">${shown().map((p) => `<li class="${p.id === st.sel ? "on" : ""}" data-id="${esc(p.id)}"><button type="button" class="pl-row" data-id="${esc(p.id)}"><span class="pl-lv">${LEVEL[p.level][0]}</span><span><b>${esc(p.name)}</b><span class="muted small"> ${esc(p.address)}</span>${p.lat == null ? ' <span class="muted small">(지도 위치 없음)</span>' : ""}</span></button></li>`).join("")}</ul>`;
  };
  const drawDetail = () => {
    const p = places.find((x) => x.id === st.sel), d = $("#pl-detail");
    d.hidden = !p; d.innerHTML = p ? placeInfo(p, esc) : "";
  };
  const icon = (L, p, on) => L.divIcon({ className: "", html: `<span class="pl-pin lv-${p.level} ${on ? "on" : ""}">${LEVEL[p.level][0]}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
  const drawMarkers = () => {
    if (!map) return;
    const L = window.L;
    layer.clearLayers(); markers = new Map();
    for (const p of shown().filter((x) => x.lat != null)) {
      const m = L.marker([p.lat, p.lng], { icon: icon(L, p, p.id === st.sel), title: p.name, keyboard: true }).addTo(layer);
      m.on("click", () => select(p.id, false));
      markers.set(p.id, m);
    }
  };
  const fit = () => {
    const pts = shown().filter((x) => x.lat != null).map((x) => [x.lat, x.lng]);
    const p = places.find((x) => x.id === st.sel);
    if (p && p.lat != null) map.setView([p.lat, p.lng], 15);
    else if (pts.length) map.fitBounds(pts, { padding: [24, 24], maxZoom: 15 });
  };
  const select = (id, pan = true) => {
    st.sel = id; drawDetail(); drawList(); drawMarkers();
    const p = places.find((x) => x.id === id);
    if (pan && map && p?.lat != null) map.setView([p.lat, p.lng], Math.max(map.getZoom(), 15));
  };
  const ensureMap = async () => {
    const box = $("#pl-map");
    if (st.view !== "map" || mapFailed) { box.hidden = true; return; }
    box.hidden = false;
    try {
      const L = await loadLeaflet();
      if (!box.isConnected) return;
      if (!map) {
        map = L.map(box, { zoomControl: true, attributionControl: true }).setView([37.31, 127.09], 12);
        layer = L.layerGroup().addTo(map);
        let ok = 0, bad = 0;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" })
          .on("tileload", () => { ok++; })
          .on("tileerror", () => { bad++; if (!ok && bad >= 3) fail(); })
          .addTo(map);
        fit();
      }
      drawMarkers(); map.invalidateSize();
    } catch { fail(); }
  };
  const fail = () => { mapFailed = true; if (map) { map.remove(); map = null; } $("#pl-map").hidden = true; $("#pl-fail").hidden = false; st.view = "list"; drawChips(); };

  el.onclick = (e) => {
    const b = e.target.closest("button[data-k]");
    if (b) {
      st[b.dataset.k] = b.dataset.v;
      if (b.dataset.k === "view" && st.view === "map") { mapFailed = false; $("#pl-fail").hidden = true; }
      drawChips(); drawList(); ensureMap().then(() => { if (map && b.dataset.k === "level") { drawMarkers(); fit(); } });
      return;
    }
    const r = e.target.closest("button.pl-row");
    if (r) select(r.dataset.id);
  };
  drawChips(); drawList(); drawDetail();
  await ensureMap();
  if (st.sel) select(st.sel);
}
