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

let BY_KEY = new Map(), BY_ID = new Map(), WORDS = [], loading = null;

export function preloadGlossary(load) {
  loading ??= load("glossary").then((d) => {
    const terms = (d && d.terms) || [];
    BY_ID = new Map(terms.map((t) => [t.id, t]));
    BY_KEY = new Map();
    for (const t of terms) for (const w of [t.term, ...(t.aliases || [])]) BY_KEY.set(keyOf(w), t);
    WORDS = [...BY_KEY.keys()].sort((a, b) => b.length - a.length); // 긴 표기 먼저(예: "학교군"보다 "수지1중학군")
  }).catch(() => {});
  return loading;
}
export const hasTerm = (name) => BY_KEY.has(keyOf(name));
const btn = (t, label) => `<button type="button" class="gl-i" data-gl="${esc(t.id)}" aria-label="${esc(label)} 뜻" aria-haspopup="dialog" aria-expanded="false">ⓘ</button>`;
export function termHtml(name, escFn = esc) {
  const t = BY_KEY.get(keyOf(name));
  return t ? `${escFn(name)}${btn(t, name)}` : escFn(name);
}

// 이미 그려진 DOM 안의 글자에서 용어를 찾아 첫 등장 뒤에 ⓘ를 붙인다(링크·버튼·제목 안은 건너뜀). 같은 요소를 두 번 불러도 중복되지 않는다.
export function decorateGlossary(root, { skip = "a,button,script,style,textarea,input,select,.gl-i,.si,h1,h2,h3,summary" } = {}) {
  if (!root || !WORDS.length) return;
  const done = new Set([...root.querySelectorAll(".gl-i")].map((b) => b.dataset.gl));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (!n.nodeValue.trim() || n.parentElement.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const nodes = []; for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  for (const node of nodes) {
    const text = node.nodeValue;
    let hit = null;
    for (const w of WORDS) {
      const t = BY_KEY.get(w); if (done.has(t.id)) continue;
      const i = text.replace(/\s+/g, " ").indexOf(w) >= 0 ? text.indexOf(w) : -1; // 공백이 낀 표기는 건너뜀(단어 그대로 일치만)
      if (i >= 0 && (!hit || i < hit.i || (i === hit.i && w.length > hit.w.length))) hit = { i, w, t };
    }
    if (!hit) continue;
    done.add(hit.t.id);
    const end = hit.i + hit.w.length;
    const frag = document.createDocumentFragment();
    frag.append(text.slice(0, end));
    const holder = document.createElement("span"); holder.innerHTML = btn(hit.t, hit.w); frag.append(holder.firstChild);
    frag.append(text.slice(end));
    node.replaceWith(frag);
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
    <p>${esc(t.short)}</p>${t.detail ? `<p class="muted small">${esc(t.detail)}</p>` : ""}
    <div class="sip-f small">${srcs ? `출처 ${srcs}` : ""}${ES[t.status] ? ` <span class="pst ${esc(t.status)}">${ES[t.status]}</span>` : ""}</div>`;
  document.body.appendChild(pop);
  anchor = b; b.setAttribute("aria-expanded", "true");
  const r = b.getBoundingClientRect(), w = Math.min(340, innerWidth - 16);
  pop.style.width = `${w}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  const h = pop.offsetHeight, below = r.bottom + 6, top = below + h > innerHeight - 8 ? Math.max(8, r.top - h - 6) : below;
  pop.style.top = `${top}px`;
  pop.focus({ preventScroll: true });
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
