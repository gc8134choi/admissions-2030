// 프로필 전환 UI와 현재 프로필 정보. 키 저장·연도 규칙은 profile.js(공통 모듈), 이름·학교·수능 시행일은 data/learners.json.
// 헤더의 전환 컨트롤(세그먼트) + 표시 이름을 덮어쓰는 작은 입력(선택 기능, 이 브라우저에만 저장).
import { PROFILES, loadProfile, saveProfile } from "./profile.js";
export const LABELS_KEY = "portal.profile.labels";
export const ONE_KEY = "portal.oneperson"; // "한 명만 보기": 켜면 예은 요소를 숨긴다(이 브라우저에만 저장)
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let CFG = [];
let SHOW = false; // learners.json의 ui.showProfiles. 꺼져 있으면 사람 이름·구분을 UI에 내지 않는다.
export const showProfiles = () => SHOW;

// learners.json(정본)을 한 번 읽는다(없어도 profile.js의 기본값으로 동작).
export async function initProfiles(load) {
  try { const d = await load("learners"); CFG = d?.learners || []; SHOW = !!d?.ui?.showProfiles; } catch { CFG = []; }
}
const cfgOf = (id) => CFG.find((p) => p.id === id) || {};
export const nameOf = (store, id) => { const v = store.get(LABELS_KEY, {})?.[id]; return typeof v === "string" && v.trim() ? v.trim().slice(0, 10) : cfgOf(id).name || PROFILES.find((p) => p.id === id).label; };
// 현재 프로필: id("A"/"B"), key(소문자), 표시 이름, 학년 라벨, 연도, 학교 id 목록, 수능 설정
export function currentProfile(store) {
  const id = SHOW ? loadProfile(store) : "A", base = PROFILES.find((p) => p.id === id), c = cfgOf(id);
  return { id, key: id.toLowerCase(), name: nameOf(store, id), label: c.label || base.label, entryYear: base.entryYear, examYear: base.examYear, schoolIds: c.schoolIds || [], csat: c.csat || null, milestones: c.milestones || [] };
}
export const allProfiles = (store) => PROFILES.map((p) => ({ id: p.id, key: p.id.toLowerCase(), name: nameOf(store, p.id), label: cfgOf(p.id).label || p.label, entryYear: p.entryYear, examYear: p.examYear, schoolIds: cfgOf(p.id).schoolIds || [], csat: cfgOf(p.id).csat || null, milestones: cfgOf(p.id).milestones || [] }));

// 프로필 전환: 상단(데스크톱 #pf)과 하단(모바일 #dock)에 같은 점+글자 버튼을 그린다.
export function mountProfileSwitch(els, store, onChange) {
  if (!SHOW) { els.forEach((e) => { e.hidden = true; e.innerHTML = ""; }); document.documentElement.dataset.profile = "a"; return () => {}; }
  const draw = () => {
    if (store.get(ONE_KEY, false) && loadProfile(store) !== "A") saveProfile(store, "A"); // 한 명만 보기: 예나 화면 고정
    const cur = loadProfile(store);
    const html = PROFILES.map((p) => `<button type="button" role="tab" class="p${p.id.toLowerCase()}" aria-selected="${p.id === cur}" data-pf="${p.id}">${esc(nameOf(store, p.id))}</button>`).join("");
    const one = store.get(ONE_KEY, false);
    els.forEach((e) => { e.innerHTML = html; e.hidden = !!one; });
    document.documentElement.dataset.profile = cur.toLowerCase();
  };
  els.forEach((e) => e.addEventListener("redraw", () => draw()));
  const set = (id) => { if (id !== loadProfile(store)) { saveProfile(store, id); draw(); onChange(); } };
  els.forEach((e) => e.addEventListener("click", (ev) => { const b = ev.target.closest("[data-pf]"); if (b) set(b.dataset.pf); }));
  // 화면 좌우 스와이프로도 전환(버튼·링크·입력 위에서 시작한 것은 제외)
  let sx = null;
  document.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", (e) => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 90 && !e.target.closest("input,textarea,select,button,a,.tw,.cv-toc,.hs-logos,.hm-tabs")) set(dx < 0 ? "B" : "A"); }, { passive: true });
  draw();
  return draw;
}

// 보관함 > 설정: 표시 이름을 이 브라우저에서만 바꾼다(비우면 기본 이름).
export function nameSettings(store, onChange) {
  return `<form class="nm-form" id="nm-form">${PROFILES.map((p) => `<label>${esc(cfgOf(p.id).label || p.label)} 표시 이름<input type="text" name="${p.id}" maxlength="10" value="${esc(store.get(LABELS_KEY, {})?.[p.id] || "")}" placeholder="${esc(cfgOf(p.id).name || "")}" autocomplete="off"></label>`).join("")}<label class="chk"><input type="checkbox" name="one" ${store.get(ONE_KEY, false) ? "checked" : ""}> 한 명만 보기(예은 화면·D-day 숨김)</label><button type="submit" class="btn">저장</button></form>`;
}
export function bindNameSettings(root, store, onChange) {
  const f = root.querySelector("#nm-form"); if (!f) return;
  f.addEventListener("submit", (e) => { e.preventDefault(); const l = {}; for (const p of PROFILES) { const v = f.elements[p.id].value.trim(); if (v) l[p.id] = v.slice(0, 10); } store.set(LABELS_KEY, l); store.set(ONE_KEY, !!f.elements.one.checked); onChange(); document.getElementById("pf")?.dispatchEvent(new Event("redraw")); });
}
