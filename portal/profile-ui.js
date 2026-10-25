// 프로필 전환 UI와 현재 프로필 정보. 키 저장·연도 규칙은 profile.js(공통 모듈), 이름·학교·수능 시행일은 data/profiles.json.
// 헤더의 전환 컨트롤(세그먼트) + 표시 이름을 덮어쓰는 작은 입력(선택 기능, 이 브라우저에만 저장).
import { PROFILES, loadProfile, saveProfile } from "./profile.js";
export const LABELS_KEY = "portal.profile.labels";
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let CFG = [];

// profiles.json을 한 번 읽는다(없어도 profile.js의 기본값으로 동작).
export async function initProfiles(load) {
  try { const d = await load("profiles"); CFG = d?.profiles || []; } catch { CFG = []; }
}
const cfgOf = (id) => CFG.find((p) => p.id === id) || {};
export const nameOf = (store, id) => { const v = store.get(LABELS_KEY, {})?.[id]; return typeof v === "string" && v.trim() ? v.trim().slice(0, 10) : cfgOf(id).name || PROFILES.find((p) => p.id === id).label; };
// 현재 프로필: id("A"/"B"), key(소문자), 표시 이름, 학년 라벨, 연도, 학교 id 목록, 수능 설정
export function currentProfile(store) {
  const id = loadProfile(store), base = PROFILES.find((p) => p.id === id), c = cfgOf(id);
  return { id, key: id.toLowerCase(), name: nameOf(store, id), label: c.label || base.label, entryYear: base.entryYear, examYear: base.examYear, schoolIds: c.schoolIds || [], csat: c.csat || null };
}
export const allProfiles = (store) => PROFILES.map((p) => ({ id: p.id, key: p.id.toLowerCase(), name: nameOf(store, p.id), label: cfgOf(p.id).label || p.label, entryYear: p.entryYear, examYear: p.examYear, schoolIds: cfgOf(p.id).schoolIds || [], csat: cfgOf(p.id).csat || null }));

export function mountProfileSwitch(el, store, onChange) {
  const draw = () => {
    const cur = loadProfile(store);
    el.innerHTML = `<div class="pf-seg" role="radiogroup" aria-label="프로필 선택">${PROFILES.map((p) => `<button type="button" role="radio" aria-checked="${p.id === cur}" data-pf="${p.id}">${esc(nameOf(store, p.id))}</button>`).join("")}</div>
      <button type="button" class="pf-edit-btn" aria-label="표시 이름 바꾸기" title="표시 이름 바꾸기">✎</button>`;
  };
  let pop = null;
  const closePop = () => { pop?.remove(); pop = null; };
  const openPop = () => {
    closePop();
    const cur = loadProfile(store);
    pop = document.createElement("form");
    pop.className = "pf-pop";
    pop.innerHTML = `<label>표시 이름 <span class="muted small">(이 브라우저에만 저장, 비우면 기본값)</span><input type="text" maxlength="10" value="${esc(store.get(LABELS_KEY, {})?.[cur] || "")}" placeholder="${esc(cfgOf(cur).name || "")}" autocomplete="off"></label>
      <div class="pf-pop-b"><button type="submit" class="btn primary">저장</button><button type="button" class="btn" data-reset>기본값</button></div>`;
    document.body.appendChild(pop);
    const inp = pop.querySelector("input"); inp.focus();
    const save = (v) => { const l = { ...store.get(LABELS_KEY, {}) }; if (v.trim()) l[cur] = v.trim().slice(0, 10); else delete l[cur]; store.set(LABELS_KEY, l); closePop(); draw(); onChange(); };
    pop.addEventListener("submit", (e) => { e.preventDefault(); save(inp.value); });
    pop.querySelector("[data-reset]").addEventListener("click", () => save(""));
  };
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pf]");
    if (b) { if (b.dataset.pf !== loadProfile(store)) { saveProfile(store, b.dataset.pf); draw(); onChange(); } return; }
    if (e.target.closest(".pf-edit-btn")) { pop ? closePop() : openPop(); }
  });
  document.addEventListener("click", (e) => { if (pop && !pop.contains(e.target) && !e.target.closest(".pf-edit-btn")) closePop(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePop(); });
  draw();
}
