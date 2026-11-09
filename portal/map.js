// 학교 지도 보기("학교" 탭 안): 초·중·고 위치를 Leaflet + OpenStreetMap 타일로 보여 준다. 목록과 지도 전환, 네이버 지도·카카오맵 검색 링크.
// 데이터: places.json(tools/build-places.mjs). 좌표가 null인 학교는 목록에만 나온다. 지도(외부 스크립트·타일)를 못 불러오면 목록과 링크만 남는다.
// Leaflet 1.9.4 (BSD-2-Clause, © Vladimir Agafonkin·Leaflet contributors), 타일 © OpenStreetMap contributors (ODbL, tile.openstreetmap.org 이용 정책: 화면 열람용 소량 요청만).
// 서비스 워커는 같은 출처만 가로채므로 타일은 캐시하지 않는다.
const LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
const SRI = { css: "sha256-tXCrvaljxgtN5LT/Syb5Mm9T+yzPFGH98JVcoJT7JTk=", js: "sha256-XJrs/DDkVkUZ29zdzFOkGCJ9zHVo5hnpdi3c7HYJ7Uc=" };
import "./policy-css.js";
import { stageTag } from "./stage.js";
export const LEVEL = { elementary: ["초", "초등학교"], middle: ["중", "중학교"], high: ["고", "고등학교"] };
const NEAR = { library: ["도", "도서관"], station: ["역", "지하철역"] }; // 주변 시설(places.json nearby[])
const ES = { reported: "보도", estimated: "추정" };
const lvOf = (p) => (p.level === "nearby" ? NEAR[p.kind] || ["·", "주변 시설"] : LEVEL[p.level]);

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
  return `${stageTag({ middle: "중입", high: "고입" }[p.level], esc)}<b>${esc(p.name)}</b> <span class="muted small">${esc(lvOf(p)[1])}${p.kind && p.level !== "nearby" ? ` · ${esc(p.kind)}` : ""}</span> ${st}${p.level === "nearby" && p.note ? `<div class="muted small">${esc(p.note)}</div>` : ""}
    <div class="pl-addr">${esc(p.address)}${p.coordApprox ? ' <span class="muted small">위치 근사</span>' : ""}</div>
    <div class="pl-links">${hp ? `<a href="${esc(hp)}" target="_blank" rel="noopener">홈페이지</a>` : ""}<a href="${esc(naverUrl(p))}" target="_blank" rel="noopener">네이버 지도에서 열기</a><a href="${esc(kakaoUrl(p))}" target="_blank" rel="noopener">카카오맵에서 열기</a></div>`;
}

// level: 처음 보여 줄 학교급(elementary|middle|high). 없으면 주소의 lv= 값을 읽는다(#select/curriculum?v=map&lv=middle).
export async function mapBody(el, { load, esc, focus = null, level = null }) {
  const data = await load("places");
  const places = data.places;
  const nearby = data.nearby || [];
  const all = [...places, ...nearby];
  if (!places.length) { el.innerHTML = `<div class="ed"><h2>학교 지도</h2><p class="muted">아직 정리 중이에요.</p></div>`; return; }
  const lv0 = level || new URLSearchParams((location.hash.split("?")[1] || "")).get("lv");
  const st = (el.__map ||= { level: LEVEL[lv0] ? lv0 : "all", view: "map", sel: null, near: false });
  if (focus && all.some((p) => p.id === focus)) { st.sel = focus; st.view = "map"; const fp = all.find((p) => p.id === focus); if (st.level !== "all" && fp.level && fp.level !== st.level && LEVEL[fp.level]) st.level = fp.level; } // 주소의 학교급 필터가 그 학교를 가리면 학교의 학교급으로(마커가 보이게)
  let map = null, layer = null, markers = new Map(), mapFailed = false, focusReq = null, lastEls = []; /* focusReq: 키보드로 연 뒤 포커스를 보낼 곳({at:[lat,lng]} 또는 {detail:true}) */
  const shown = () => [...places.filter((p) => st.level === "all" || p.level === st.level), ...(st.near ? nearby : [])];
  const chip = (k, v, t, cur) => `<button type="button" class="chip ${v === cur ? "on" : ""}" data-k="${k}" data-v="${v}" aria-pressed="${v === cur}">${t}</button>`;

  el.innerHTML = `<div class="ed pl-wrap"><div class="chipbar"><span class="flabel">표시</span><div class="chips" id="pl-view"></div></div>
    <div class="chipbar"><span class="flabel">학교급</span><div class="chips" id="pl-level"></div></div>
    <div class="chipbar"><span class="flabel">주변</span><div class="chips" id="pl-near"></div></div>
    <div id="pl-map" class="pl-map" hidden></div><p id="pl-fail" class="muted small" hidden>지도를 불러오지 못했어요. 목록과 링크로 확인해 주세요.</p>
    <div id="pl-detail" class="pl-detail" hidden></div><div id="pl-list"></div>
    <p class="ed-src">지도 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · 위치는 조사 시점 기준이고 좌표는 어림값일 수 있어요.</p></div>`;
  const $ = (s) => el.querySelector(s);

  const drawChips = () => {
    $("#pl-view").innerHTML = chip("view", "map", "지도", st.view) + chip("view", "list", "목록", st.view);
    $("#pl-near").innerHTML = nearby.length ? `<button type="button" class="chip ${st.near ? "on" : ""}" data-k="near" data-v="${st.near ? "" : "1"}" aria-pressed="${st.near}">주변 시설 보기</button>` : '<span class="muted small">준비 중</span>';
    $("#pl-level").innerHTML = chip("level", "all", "전체", st.level) + Object.entries(LEVEL).map(([k, v]) => chip("level", k, v[1], st.level)).join("");
  };
  const drawList = () => {
    $("#pl-list").innerHTML = `<ul class="pl-list">${shown().map((p) => `<li class="${p.id === st.sel ? "on" : ""}" data-id="${esc(p.id)}"><button type="button" class="pl-row" data-id="${esc(p.id)}"><span class="pl-lv">${lvOf(p)[0]}</span><span><b>${esc(p.name)}</b><span class="muted small"> ${esc(p.address)}</span>${p.lat == null ? ' <span class="muted small">(지도 위치 없음)</span>' : ""}</span></button></li>`).join("")}</ul>`;
  };
  const drawDetail = () => {
    const p = all.find((x) => x.id === st.sel), d = $("#pl-detail");
    d.hidden = !p; d.innerHTML = p ? placeInfo(p, esc) : "";
  };
  const icon = (L, p, on, z = 44) => L.divIcon({ className: "", html: `<span class="pl-hit" style="width:${z}px;height:${z}px"><span class="pl-pin lv-${p.level} ${on ? "on" : ""}">${lvOf(p)[0]}</span></span>`, iconSize: [z, z], iconAnchor: [z / 2, z / 2] }); // 눌림 영역 44px, 보이는 핀은 26px
  const drawMarkers = () => {
    if (!map) return;
    const L = window.L;
    layer.clearLayers(); markers = new Map();
    /* 핀이 겹치면 묶음 마커('3곳')로 그리고, 누르면 그 묶음이 보이게 확대한다. 낱개 핀은 서로 30px 이상 떨어져 눌림 영역(핀 크기 그대로)이 겹치지 않는다 */
    /* 마커를 키보드로: Tab으로 닿고 Enter·Space로 낱개는 학교 열기, 묶음은 확대. 읽어 주는 이름은 aria-label */
    const a11y = (m, label, act) => { const el = m.getElement?.(); if (!el) return; el.setAttribute("role", "button"); el.setAttribute("aria-label", label); el.removeAttribute("title"); el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } }); };
    const lvLabel = ({ elementary: "초등학교", middle: "중학교", high: "고교" })[st.level] || "학교";
    const D = 60, list = shown().filter((x) => x.lat != null).sort((a, b) => (b.id === st.sel) - (a.id === st.sel)), cl = [];
    for (const p of list) {
      const pt = map.latLngToContainerPoint([p.lat, p.lng]), c = p.id === st.sel ? null : cl.find((k) => !k.sel && Math.hypot(k.x - pt.x, k.y - pt.y) < D);
      if (c) { c.items.push(p); c.x = (c.x * (c.items.length - 1) + pt.x) / c.items.length; c.y = (c.y * (c.items.length - 1) + pt.y) / c.items.length; } else cl.push({ x: pt.x, y: pt.y, items: [p], sel: p.id === st.sel });
    }
    cl.sort((a, b) => a.y - b.y || a.x - b.x); /* DOM(읽기·Tab) 순서를 북→남, 서→동으로 */
    const els = [];
    for (const k of cl) {
      if (k.items.length === 1) {
        const p = k.items[0], m = L.marker([p.lat, p.lng], { icon: icon(L, p, p.id === st.sel, 44), title: p.name, keyboard: true }).addTo(layer); els.push([m, p.lat, p.lng]);
        m.on("click", () => select(p.id, false)); markers.set(p.id, m); a11y(m, p.name, () => { select(p.id, false); const d = $("#pl-detail"); if (d) { d.tabIndex = -1; const f = () => d.focus({ preventScroll: false }); f(); setTimeout(f, 120); } });
      } else {
        const lat = k.items.reduce((a, p) => a + p.lat, 0) / k.items.length, lng = k.items.reduce((a, p) => a + p.lng, 0) / k.items.length, names = k.items.map((p) => p.name).join(", ");
        const m = L.marker([lat, lng], { icon: L.divIcon({ className: "", html: `<span class="pl-hit" style="width:44px;height:44px"><span class="pl-pin pl-cl">${k.items.length}곳</span></span>`, iconSize: [44, 44], iconAnchor: [22, 22] }), title: `${k.items.length}곳 묶음`, keyboard: true }).addTo(layer);
        els.push([m, lat, lng]); const zoomIn = () => { focusReq = { at: [lat, lng], t: Date.now() }; map.fitBounds(k.items.map((p) => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 18 });
          /* 확대가 끝난 뒤(재그림 포함) 포커스가 마커에 없으면 가장 가까운 새 마커로, 그래도 없으면 지도 영역으로: 포커스가 BODY로 떨어지지 않게 */
          setTimeout(() => { const a = document.activeElement; if (a && a.closest?.(".leaflet-marker-icon")) return; const near = lastEls.map(([mm, la, ln]) => [mm, Math.hypot(la - lat, ln - lng)]).sort((x, y) => x[1] - y[1])[0]; const el2 = near?.[0].getElement?.(); if (el2) el2.focus({ preventScroll: true }); else { const box = $("#pl-map"); if (box) { box.tabIndex = -1; box.focus({ preventScroll: true }); } } }, 1000); }; m.on("click", zoomIn); a11y(m, `${lvLabel} ${k.items.length}곳 묶음, 확대`, zoomIn);
      }
    }
    lastEls = els;
    if (focusReq?.at && Date.now() - focusReq.t < 1500) { const near = els.map(([m, la, ln]) => [m, Math.hypot(la - focusReq.at[0], ln - focusReq.at[1])]).sort((a, b) => a[1] - b[1])[0]; near?.[0].getElement?.()?.focus({ preventScroll: true }); } /* 군집을 확대한 뒤에는 같은 자리의 새 마커로 포커스 */
  };
  const fit = () => {
    const pts = shown().filter((x) => x.lat != null).map((x) => [x.lat, x.lng]);
    const p = all.find((x) => x.id === st.sel);
    if (p && p.lat != null) map.setView([p.lat, p.lng], 15);
    else if (pts.length) map.fitBounds(pts, { padding: [24, 24], maxZoom: 15 });
  };
  const select = (id, pan = true) => {
    st.sel = id; drawDetail(); drawList(); drawMarkers();
    const p = all.find((x) => x.id === id);
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
        map.attributionControl.setPrefix(false); /* Leaflet 링크만 끄고 OpenStreetMap 출처 표기(링크 포함)는 둔다 */
        layer = L.layerGroup().addTo(map); map.on("zoomend moveend", () => { if (!map._plBusy) drawMarkers(); });
        let ok = 0, bad = 0;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' })
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
      if (b.dataset.k === "near") { st.near = !!b.dataset.v; if (!st.near && nearby.some((n) => n.id === st.sel)) st.sel = null; } else st[b.dataset.k] = b.dataset.v;
      if (b.dataset.k === "view" && st.view === "map") { mapFailed = false; $("#pl-fail").hidden = true; }
      drawChips(); drawList(); drawDetail(); ensureMap().then(() => { if (map && (b.dataset.k === "level" || b.dataset.k === "near")) { drawMarkers(); if (b.dataset.k === "level") fit(); } });
      return;
    }
    const r = e.target.closest("button.pl-row");
    if (r) select(r.dataset.id);
  };
  drawChips(); drawList(); drawDetail();
  await ensureMap();
  if (st.sel) select(st.sel);
}
