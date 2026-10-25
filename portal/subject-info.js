// 과목 설명 팝오버: 과목명 옆 ⓘ를 누르면(탭·Enter·Space) 설명이 뜬다. 데이터: data/subject-info.json.
// 공통 사용법(다른 화면/세션):
//   import { preloadSubjectInfo, subjectName } from "./subject-info.js";
//   await preloadSubjectInfo(load);            // 화면을 그리기 전에 한 번(파일이 없어도 오류 없이 지나감)
//   html += subjectName("화법과 언어");        // 이름 + (설명이 있을 때만) ⓘ 버튼
// 설명(summary)이 없는 과목에는 ⓘ를 만들지 않는다. 팝오버 안에 출처·상태를 표시한다.
const PST = { confirmed: "확정", reported: "보도", estimated: "추정", unknown: "확인 못 함" };
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const txt = (s) => esc(String(s ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
const keyOf = (n) => String(n ?? "").normalize("NFC").replace(/\s+/g, "");

let MAP = new Map();
let META = {};
let loading = null;

// 데이터 읽기. 루트가 {_meta, subjects:[...]}, 배열, {과목명:{...}} 맵 어느 쪽이든 받는다.
export function preloadSubjectInfo(load) {
  loading ??= load("subject-info").then((d) => {
    META = (d && !Array.isArray(d) && d._meta) || {};
    const list = Array.isArray(d) ? d : d?.subjects || Object.entries(d || {}).filter(([k]) => k !== "_meta").map(([k, v]) => ({ name: k, ...v }));
    MAP = new Map(list.filter((x) => x && x.name && String(x.summary || "").trim()).map((x) => [keyOf(x.name), x]));
  }).catch(() => {});
  return loading;
}

// 이미 그려진 표의 본문(쉼표·가운데점·슬래시 등으로 나열된 과목명)에 ⓘ를 붙인다. 정책 화면 파일은 건드리지 않는다.
export async function decorateSubjectLists(el, load, headingPrefix) {
  await preloadSubjectInfo(load);
  const h = [...el.querySelectorAll("h3")].find((x) => x.textContent.trim().startsWith(headingPrefix));
  const box = h?.nextElementSibling;
  if (!box || box.dataset.siDone) return;
  box.dataset.siDone = "1";
  box.querySelectorAll("tbody td.l").forEach((td) => {
    if (td.children.length) return; // 굵은 제목·배지 셀 제외(본문 셀만)
    const parts = td.textContent.split(/([,·/:|()]|\s{2,})/);
    if (!parts.some((t) => t.trim() && hasSubjectInfo(t))) return;
    td.innerHTML = parts.map((t) => (t.trim() && hasSubjectInfo(t) ? subjectName(t.trim()) : esc(t))).join("");
  });
}

export const hasSubjectInfo = (name) => MAP.has(keyOf(name));

// 과목명(이스케이프됨) + 설명이 있으면 ⓘ 버튼
export function subjectName(name) {
  // 택일 묶음("미술↔음악")은 구성 과목별로 ⓘ를 붙인다
  if (String(name).includes("↔")) return String(name).split("↔").map((n) => subjectName(n.trim())).join("↔");
  const k = keyOf(name);
  if (!MAP.has(k)) return esc(name);
  return `${esc(name)}<button type="button" class="si" data-si="${esc(k)}" aria-label="${esc(name)} 과목 설명" aria-haspopup="dialog" aria-expanded="false">ⓘ</button>`;
}

let pop = null, anchor = null;
function close(refocus) {
  if (!pop) return;
  pop.remove(); pop = null;
  if (anchor) { anchor.setAttribute("aria-expanded", "false"); if (refocus) anchor.focus(); }
  anchor = null;
}
function open(btn) {
  const it = MAP.get(btn.dataset.si); if (!it) return;
  close(false);
  const src = it.source || META.source, status = it.status || META.status;
  const srcHtml = src ? (typeof src === "string" ? esc(src) : src.url && /^https?:\/\//.test(src.url) ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.name || src.url)}</a>` : esc(src.name || "")) : "";
  pop = document.createElement("div");
  pop.className = "sip"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", `${it.name} 설명`); pop.tabIndex = -1;
  pop.innerHTML = `<div class="sip-h"><b>${esc(it.name)}</b>${it.area ? ` <span class="muted small">${esc([it.area, it.type].filter(Boolean).join(" · "))}</span>` : ""}<button type="button" class="sip-x" aria-label="닫기">×</button></div>
    <p>${txt(it.summary)}</p>
    ${it.specialPurpose ? '<p class="muted small">특수 목적 고교 과목</p>' : ""}
    <dl class="sip-d"><dt>학점</dt><dd>${txt(it.credit || META.defaultCredit || "확인 필요")}</dd>${""}${it.old2015 ? `<dt>2015 개정</dt><dd>${txt(it.old2015)}</dd>` : ""}${it.majors ? `<dt>관련 학과</dt><dd>${txt(it.majors)}</dd>` : ""}</dl>
    <div class="sip-f small">${srcHtml ? `출처 ${srcHtml}` : ""}${status ? ` <span class="pst ${esc(status)}">${esc(PST[status] || status)}</span>` : ""}</div>`;
  document.body.appendChild(pop);
  anchor = btn; btn.setAttribute("aria-expanded", "true");
  // 버튼 아래(공간이 없으면 위)에 두고, 화면 밖으로 나가지 않게 가로·세로를 맞춘다
  const r = btn.getBoundingClientRect(), w = Math.min(340, innerWidth - 16);
  pop.style.width = `${w}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  const h = pop.offsetHeight, below = r.bottom + 6, top = below + h > innerHeight - 8 ? Math.max(8, r.top - h - 6) : below;
  pop.style.top = `${top}px`;
  pop.focus({ preventScroll: true });
}

// 문서 전체에 한 번만 건다(이벤트 위임: 표를 다시 그려도 유지).
if (!window.__siBound) {
  window.__siBound = true;
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.(".si");
    if (b) { e.preventDefault(); e.stopPropagation(); return anchor === b ? close(false) : open(b); }
    if (e.target.closest?.(".sip-x")) return close(true);
    if (pop && !pop.contains(e.target)) close(false);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop) { e.preventDefault(); close(true); } });
  document.addEventListener("scroll", (e) => { if (pop && !pop.contains(e.target)) close(false); }, true);
  window.addEventListener("resize", () => close(false));
  window.addEventListener("hashchange", () => close(false));
}
