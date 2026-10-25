// 프로필 전환: A=현 중3(입학 2027), B=현 초6(입학 2030). 공개 저장소에는 이름·출생연도를 두지 않는다.
// 표시 이름은 브라우저(localStorage)에만 저장하고, 비어 있으면 기본 라벨("현 중3"/"현 초6")을 쓴다.
export const PROFILES = [
  { key: "a", label: "현 중3", entryYear: 2027 },
  { key: "b", label: "현 초6", entryYear: 2030 },
];
export const PROFILE_KEY = "portal.profile";
export const LABELS_KEY = "portal.profile.labels";
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const profileKey = (store) => { const k = store.get(PROFILE_KEY, "a"); return PROFILES.some((p) => p.key === k) ? k : "a"; };
export const labelOf = (store, key) => { const v = store.get(LABELS_KEY, {})?.[key]; return typeof v === "string" && v.trim() ? v.trim().slice(0, 10) : PROFILES.find((p) => p.key === key).label; };
// 현재 프로필: 키, 표시 라벨, 기본 라벨, 입학·대입학년도(= 입학 + 3)
export const currentProfile = (store) => {
  const key = profileKey(store), base = PROFILES.find((p) => p.key === key);
  return { key, label: labelOf(store, key), baseLabel: base.label, entryYear: base.entryYear, examYear: base.entryYear + 3 };
};

// 헤더의 전환 컨트롤(세그먼트) + 이름 편집 작은 입력. onChange는 프로필·이름이 바뀐 뒤 화면을 다시 그리게 한다.
export function mountProfileSwitch(el, store, onChange) {
  const draw = () => {
    const cur = profileKey(store);
    el.innerHTML = `<div class="pf-seg" role="radiogroup" aria-label="프로필 선택">${PROFILES.map((p) => `<button type="button" role="radio" aria-checked="${p.key === cur}" data-pf="${p.key}">${esc(labelOf(store, p.key))}</button>`).join("")}</div>
      <button type="button" class="pf-edit-btn" aria-label="표시 이름 바꾸기" title="표시 이름 바꾸기">✎</button>`;
  };
  let pop = null;
  const closePop = () => { pop?.remove(); pop = null; };
  const openPop = () => {
    closePop();
    const cur = profileKey(store);
    pop = document.createElement("form");
    pop.className = "pf-pop";
    pop.innerHTML = `<label>표시 이름 <span class="muted small">(이 브라우저에만 저장)</span><input type="text" maxlength="10" value="${esc(store.get(LABELS_KEY, {})?.[cur] || "")}" placeholder="${esc(PROFILES.find((p) => p.key === cur).label)}" autocomplete="off"></label>
      <div class="pf-pop-b"><button type="submit" class="btn primary">저장</button><button type="button" class="btn" data-reset>기본값</button></div>`;
    document.body.appendChild(pop);
    const inp = pop.querySelector("input"); inp.focus();
    const save = (v) => { const l = { ...store.get(LABELS_KEY, {}) }; if (v.trim()) l[cur] = v.trim().slice(0, 10); else delete l[cur]; store.set(LABELS_KEY, l); closePop(); draw(); onChange(); };
    pop.addEventListener("submit", (e) => { e.preventDefault(); save(inp.value); });
    pop.querySelector("[data-reset]").addEventListener("click", () => save(""));
  };
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pf]");
    if (b) { if (b.dataset.pf !== profileKey(store)) { store.set(PROFILE_KEY, b.dataset.pf); draw(); onChange(); } return; }
    if (e.target.closest(".pf-edit-btn")) { pop ? closePop() : openPop(); }
  });
  document.addEventListener("click", (e) => { if (pop && !pop.contains(e.target) && !e.target.closest(".pf-edit-btn")) closePop(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePop(); });
  draw();
}
