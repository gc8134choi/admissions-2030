// ⓘ 스타일(glossary.css, 작은 파일)은 풀이를 실제로 붙일 때 불러온다(홈 첫 화면에서는 받지 않음)
const ensureCss = () => { if (typeof document !== "undefined" && !document.getElementById("glossary-css")) { const l = document.createElement("link"); l.id = "glossary-css"; l.rel = "stylesheet"; l.href = "glossary.css"; document.head.appendChild(l); } };
// 용어사전 ⓘ 팝오버 공용 모듈. 데이터: glossary.json(tools/build-glossary.mjs).
// 사용법(다른 화면/세션):
//   import { preloadGlossary, termHtml, decorateGlossary } from "./glossary.js";
//   await preloadGlossary(load);                 // 화면을 그리기 전에 한 번(파일이 없어도 오류 없이 지나감)
//   html += termHtml("학교군", esc);             // 용어 + (풀이가 있을 때만) ⓘ 버튼
//   decorateGlossary(el);                        // 이미 그려진 화면 본문에서 용어를 찾아 첫 번째 등장에만 ⓘ를 붙임
// 풀이가 없는 글자에는 ⓘ를 만들지 않는다. 팝오버에 공식 명칭·상태(보도/추정만)·출처를 함께 보인다.
const ES = { reported: "보도", estimated: "추정" };
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const keyOf = (n) => String(n ?? "").normalize("NFC").replace(/\s+/g, "");

let BY_KEY = new Map(), BY_ID = new Map(), WORDS = [], ORIG = [], loading = null;

export function preloadGlossary(load) {
  loading ??= load("glossary").then((d) => {
    const terms = (d && d.terms) || [];
    BY_ID = new Map(terms.map((t) => [t.id, t]));
    BY_KEY = new Map();
    for (const t of terms) for (const w of [t.term, ...(t.aliases || [])]) BY_KEY.set(keyOf(w), t);
    ORIG = [...new Set(terms.flatMap((x) => [x.term, ...(x.aliases || [])]))].filter(Boolean).sort((a, b) => b.length - a.length);
    WORDS = [...BY_KEY.keys()].sort((a, b) => b.length - a.length); // 긴 표기 먼저(예: "학교군"보다 "수지1중학군")
  }).catch(() => {});
  return loading;
}
export const hasTerm = (name) => BY_KEY.has(keyOf(name));
const btn = (t, label) => `<button type="button" class="gl-i" data-gl="${esc(t.id)}" aria-label="${esc(label)} 뜻" aria-haspopup="dialog" aria-expanded="false">ⓘ</button>`;
export function termHtml(name, escFn = esc) {
  ensureCss();
  const t = BY_KEY.get(keyOf(name));
  return t ? `${escFn(name)}${btn(t, name)}` : escFn(name);
}

// 이미 그려진 DOM 안의 글자에서 용어를 찾아 첫 등장 뒤에 ⓘ를 붙인다(링크·버튼·제목 안은 건너뜀). 같은 요소를 두 번 불러도 중복되지 않는다.
// 이미 훑은 글자 조각은 다시 보지 않는다(화면이 조금씩 채워질 때마다 전체를 다시 훑으면 느려진다). 표기는 한 번에 찾는 정규식 하나로 본다.
const SCANNED = new WeakSet();
let RE = null, RE_N = -1;
const reOf = () => { if (RE_N !== ORIG.length) { RE_N = ORIG.length; RE = ORIG.length ? new RegExp(ORIG.map((w) => w.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*")).join("|"), "g") : null; } return RE; }; // 띄어쓰기가 있는 용어(수능 최저·창의적 체험활동)도 본문에서 찾는다
export function decorateGlossary(root, { skip = "a,button,script,style,textarea,input,select,label,summary,[role=button],.pn-o,.gl-i,.gl-rel,.si,.term,h1,.srcp,.srcb,.no-term,figcaption" } = {}) {
  const re = reOf();
  if (!root || !re) return;
  // 용어마다 "구역"(접이식·섹션·카드·표) 안에서 첫 등장에 ⓘ를 붙인다. 화면 전체에서 한 번만이 아니라 구역마다 한 번이라 긴 화면에서도 풀이가 가까이 있다.
  const scopeOf = (n) => n.parentElement.closest("details, section, article, .ed-row, table, .w-aside, .w-body") || root;
  const done = new Map(); // scope → Set(termId)
  const has = (sc) => done.get(sc) || done.set(sc, new Set()).get(sc);
  root.querySelectorAll(".gl-i").forEach((b) => has(scopeOf(b)).add(b.dataset.gl)); // 이미 붙은 ⓘ는 다시 붙이지 않는다
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (SCANNED.has(n) || !n.nodeValue.trim() || n.parentElement.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const nodes = []; for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  for (const node of nodes) {
    SCANNED.add(node);
    const text = node.nodeValue;
    re.lastIndex = 0;
    const sc = scopeOf(node), seen = has(sc);
    let hit = null;
    for (let m = re.exec(text); m; m = re.exec(text)) { const tm = BY_KEY.get(keyOf(m[0])); if (tm && !seen.has(tm.id)) { hit = { i: m.index, w: m[0], t: tm }; break; } }
    if (!hit) continue;
    seen.add(hit.t.id); ensureCss();
    const end = hit.i + hit.w.length;
    const frag = document.createDocumentFragment();
    const holder = document.createElement("span"); holder.innerHTML = btn(hit.t, hit.w);
    if (node.parentElement?.closest("h2, h3")) { /* 제목 안에서는 낱말과 ⓘ를 줄바꿈 없는 한 묶음으로(ⓘ가 줄 맨 앞에 혼자 남지 않게) */ frag.append(text.slice(0, hit.i)); const nb = document.createElement("data");  nb.className = "nb"; nb.style.cssText = "white-space:nowrap;font:inherit;letter-spacing:inherit"; nb.append(text.slice(hit.i, end), holder.firstChild); frag.append(nb); }
    else { frag.append(text.slice(0, end) + (node.parentElement?.closest(".ed-g") ? "\u2060" : "")); // 도장(.ed-g) 안에서는 ⓘ가 줄 맨 앞에 혼자 남지 않게 낱말과 붙인다(WORD JOINER)
      frag.append(holder.firstChild); }
    const tail = document.createTextNode(text.slice(end)); frag.append(tail); // 같은 글 조각에 다른 용어가 더 있으면 이어서 찾는다(예: 과학고·마이스터고·특성화고)
    node.replaceWith(frag);
    if (tail.nodeValue.trim()) nodes.push(tail);
  }
}

let pop = null, anchor = null;
function close(refocus) {
  if (!pop) return;
  pop.remove(); pop = null;
  if (anchor) { anchor.setAttribute("aria-expanded", "false"); if (refocus) anchor.focus(); }
  anchor = null;
}
function open(b) {
  const t = BY_ID.get(b.dataset.gl); if (!t) return;
  close(false);
  const srcs = (t.sources || []).map((x) => (x.url && /^https?:\/\//.test(x.url) ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(" · ");
  pop = document.createElement("div");
  pop.className = "sip"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", `${t.term} 뜻`); pop.tabIndex = -1;
  pop.innerHTML = `<div class="sip-h"><b>${esc(t.term)}</b>${t.official && t.official !== t.term ? ` <span class="muted small">공식 명칭: ${esc(t.official)}</span>` : ""}<button type="button" class="sip-x" aria-label="닫기">×</button></div>
    <p>${esc(t.short)}</p>${t.detail ? `<p class="muted small">${esc(t.detail)}</p>` : ""}`; /* 출처·상태 줄은 화면에 쓰지 않는다(2026-11-08 결정, 출처는 자료실) */
  document.body.appendChild(pop);
  anchor = b; b.setAttribute("aria-expanded", "true");
  const r = b.getBoundingClientRect(), w = Math.min(340, innerWidth - 16);
  pop.style.width = `${w}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  const h = pop.offsetHeight, below = r.bottom + 6, top = below + h > innerHeight - 8 ? Math.max(8, r.top - h - 6) : below;
  pop.style.top = `${top}px`;
  pop.focus({ preventScroll: true });
}
// 검색 결과에서 용어를 누르면 화면을 옮기지 않고 그 자리(화면 위쪽)에 풀이 창을 연다
export function showTerm(id) {
  if (!BY_ID.get(id)) return false;
  open({ dataset: { gl: id }, setAttribute() {}, focus() {}, getBoundingClientRect: () => ({ left: Math.max(8, innerWidth / 2 - 170), top: 96, bottom: 96 }) });
  return true;
}
if (typeof document !== "undefined" && !window.__glBound) {
  window.__glBound = true;
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.(".gl-i");
    if (b) { e.preventDefault(); e.stopPropagation(); return anchor === b ? close(false) : open(b); }
    if (pop && e.target.closest?.(".sip-x")) return close(true);
    if (pop && !pop.contains(e.target)) close(false);
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop) { e.preventDefault(); close(true); } });
  document.addEventListener("scroll", (e) => { if (pop && !pop.contains(e.target)) close(false); }, true);
  window.addEventListener("resize", () => close(false));
  window.addEventListener("hashchange", () => close(false));
}
