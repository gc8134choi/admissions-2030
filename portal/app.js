import { applyHl } from "./hl.js";
import "./sticky-head.js";
import { decorateTerms, initTerms, setTerms } from "./terms.js";
import { foldSources, initSrcRef } from "./src-ref.js";
import { emptyLine, WHERE } from "./empty.js";
import { crumbHtml, footHtml, sourcesHtml } from "./pagefoot.js";
import { preloadGlossary, decorateGlossary } from "./glossary.js";
// "곧 열려요"에는 왜 아직인지와 지금 할 수 있는 행동을 한 줄로 적는다
const SOON_WHY = {
  "학년별 할 일": { why: "학년마다 챙길 일을 모으는 중이에요. 11월 안에 학년별 로드맵에 먼저 담을게요.", next: { label: "학년별 로드맵 보기", url: "#schedule?t=road" } },
  "대학·학과 찾기": { why: "대학 모집요강을 정리하는 중이에요. 2030학년도 요강은 2028년에 공개되고, 지금은 2027학년도 기준 참고예요.", next: { label: "대학 요건 보기", url: "#select/curriculum?v=univ" } },
  "학교별 시뮬레이션": { why: "내 계획표를 후보 학교에 맞춰 보는 기능이에요. 학교별 개설 과목 자료를 더 모아야 해요.", next: { label: "내 계획표로 먼저 확인", url: "#planner/plan" } },
  "목표 학과 체크": { why: "희망 학과 요건과 내 계획을 견주는 기능이에요. 대학 요건 자료를 모으는 중이에요.", next: { label: "대학 요건 보기", url: "#select/curriculum?v=univ" } },
  "중학교 교육과정": { why: "중학교별 교육과정은 학교 공지를 모으는 중이에요. 11월 안에 중학교 비교에 먼저 담을게요.", next: { label: "중학교 배정에서 학교 찾기", url: "#select/curriculum?v=middle" } },
};
import { MENU, STATUS } from "./menu.js";
import { TABS, REDIRECT, hrefOf, tabHref, locate, treeHtml, BOTTOM } from "./nav-tree.js";
import { registerHome } from "./home.js";
import { registerFiles } from "./files.js";
import { currentProfile, allProfiles, initProfiles, mountProfileSwitch, nameSettings, bindNameSettings, showProfiles } from "./profile-ui.js";
import { STAGES, linkStage, stageTag } from "./stage.js";
import { briefingBlock } from "./briefing.js";
import { hsHubBody } from "./dash.js";
import { schoolBand } from "./school-card.js";
import { preloadSubjectInfo, subjectName, decorateSubjectLists } from "./subject-info.js";

const $ = (s) => document.querySelector(s);
// 인쇄: 늦게 그리는 구역을 바로 그리고 접힌 구역(details)을 모두 펼친다. 끝나면 원래대로(print 미디어 에뮬레이션도 같이 처리)
{ const fns = [], opened = new Set(); let printing = false, timers = [];
  window.__onPrint = (fn) => fns.push(fn); window.__printing = false; window.__printUndo = []; // 인쇄 때문에 새로 그린 구역은 끝나면 원래(안 그린) 상태로 되돌린다
  const snaps = new Map(); let footSnap = null, decoAdded = []; // (DOM 복제로 저장: innerHTML을 되돌리면 <p> 안의 <details>가 파서에서 밖으로 튀어나와 푸터가 인쇄마다 늘었다)
  // 접이식을 열기 직전의 안쪽 모습(열면서 늦게 채워지는 내용이 인쇄 뒤에 남지 않게)
  const openAll = () => { if (!printing) return; document.querySelectorAll("details:not([open])").forEach((d) => { if (!opened.has(d)) { opened.add(d); snaps.set(d, d.cloneNode(true)); } d.open = true; }); }; // 인쇄 중에 새로 생긴 접이식도 기록해 두었다가 되돌린다
  let mo = null;
  const start = () => { if (printing) return; printing = true; window.__printing = true; { const before = new Set(document.querySelectorAll("#main .term, #main .gl-i")); try { window.__flushDecor?.(); } catch {} decoAdded = [...document.querySelectorAll("#main .term, #main .gl-i")].filter((e) => !before.has(e)); } footSnap = document.querySelector(".pgfoot")?.cloneNode(true) ?? null; fns.forEach((f) => { try { f(); } catch {} }); openAll(); const main = document.querySelector("#main"); if (main) { mo = new MutationObserver(openAll); mo.observe(main, { childList: true, subtree: true }); } // 인쇄 중에 새로 그려지는 접이식도 바로 펼치고 기록한다
    timers = [setTimeout(openAll, 600), setTimeout(openAll, 1600)]; }; // 열면서 새로 그려진 접이식도 다시 펼친다
  const end = () => { printing = false; window.__printing = false; mo?.disconnect(); mo = null; timers.forEach(clearTimeout); timers = []; opened.forEach((d) => { d.open = false; if (d.isConnected && snaps.has(d)) { const c = snaps.get(d), cur = d.cloneNode(true); cur.open = c.open; if (!cur.isEqualNode(c)) d.replaceChildren(...[...c.childNodes].map((n) => n.cloneNode(true))); } }); opened.clear(); snaps.clear(); { const f = document.querySelector(".pgfoot"); if (f && footSnap) { if (!f.isEqualNode(footSnap)) f.replaceChildren(...[...footSnap.childNodes].map((n) => n.cloneNode(true))); } footSnap = null; } decoAdded.forEach((e) => { if (!e.isConnected) return; if (e.classList.contains("gl-i")) e.remove(); else { const p = e.parentNode; e.replaceWith(document.createTextNode(e.textContent)); p?.normalize(); } }); decoAdded = []; window.__noDecorUntil = performance.now() + 900; /* 인쇄 때 먼저 붙인 용어 점선 밑줄·ⓘ는 인쇄가 끝나면 원래대로(화면의 장식 수가 인쇄마다 달라지지 않게) */ const undo = window.__printUndo.splice(0); undo.forEach((f) => { try { f(); } catch {} }); };
  const mq = matchMedia("print"); mq.addEventListener?.("change", (e) => (e.matches ? start() : end()));
  addEventListener("beforeprint", start); addEventListener("afterprint", end); }
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ---- 메뉴 인덱스 ----
const byId = new Map();
(function index(nodes, parent) { for (const n of nodes) { n.parent = parent; byId.set(n.id, n); if (n.children) index(n.children, n); } })(MENU, null);
const trail = (n) => (n ? [...trail(n.parent), n] : []);
// 상태 배지: 구현된 화면(v1)은 표시하지 않고, 준비 중인 것만 회색 점 + 글자로 보인다
const badge = (s) => (s === "v1" ? "" : `<span class="badge soon"><i></i>준비 중</span>`);
const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const MENU_ICON = {
  home: P('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>'),
  calendar: P('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  school: P('<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6M12 9v.01"/>'),
  book: P('<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5M9 7h6"/>'),
  cap: P('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>'),
  compass: P('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  log: P('<path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>'),
  folder: P('<path d="M3 6a2 2 0 012-2h4l2 3h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>'),
};

// 상단 메뉴(데스크톱)·하단 탭(모바일): 5개 탭, 글자만. 켜진 탭은 위쪽 선.
function drawTabs(loc) {
  const html = treeHtml(loc), hadFocus = !!document.activeElement?.closest?.("#sidenav");
  const side = $("#sidenav"), dr = $("#navtree"); if (side) side.innerHTML = `<nav class="nt" aria-label="전체 메뉴">${html}</nav>`; if (dr) dr.innerHTML = `<nav class="nt" aria-label="전체 메뉴">${html}</nav>`;
  const bt = $("#btabs"); if (bt) bt.innerHTML = BOTTOM.map((b) => b.href ? `<a href="${b.href}"${loc && (loc.item.id === b.r || (b.r === "schedule" && loc.item.id === "schedule")) ? ' aria-current="page"' : ""}>${esc(b.label)}</a>` : `<button type="button" data-b="${b.key}"${b.key === "menu" ? ' id="menubtn" aria-expanded="false" aria-controls="navdrawer"' : ""}>${esc(b.label)}</button>`).join("");
  closeDrawer();
  if (side) { const c = side.querySelector("[aria-current=page]"); if (c) { // 현재 항목이 사이드바 안에서 보이게(바깥 화면은 움직이지 않는다)
      const sr = side.getBoundingClientRect(), cr = c.getBoundingClientRect(); if (cr.top < sr.top + sr.height * 0.2 || cr.bottom > sr.bottom - sr.height * 0.2) side.scrollTop += (cr.top + cr.height / 2) - (sr.top + sr.height / 2); /* 가장자리면 가운데로 */ if (hadFocus) c.focus({ preventScroll: true }); } }
}
// 모바일 메뉴 서랍(같은 트리). 열면 본문 스크롤을 잠그고, 닫기·바깥 누름·Esc·항목 선택으로 닫는다.
const OUTSIDE = () => [...document.body.children].filter((e) => e.id !== "navdrawer" && !/^(SCRIPT|STYLE|LINK)$/.test(e.tagName));
function closeDrawer() { const d = $("#navdrawer"); if (d && !d.hidden) { d.hidden = true; document.body.classList.remove("nav-open"); OUTSIDE().forEach((e) => e.removeAttribute("inert")); $("#menubtn")?.setAttribute("aria-expanded", "false"); $("#menubtn")?.focus?.({ preventScroll: true }); } }
function openDrawer() { const d = $("#navdrawer"); if (!d) return; d.hidden = false; document.body.classList.add("nav-open"); OUTSIDE().forEach((e) => e.setAttribute("inert", "")); $("#menubtn")?.setAttribute("aria-expanded", "true");
  const cur = d.querySelector("#navtree [aria-current=page]"); if (cur) cur.scrollIntoView({ block: "center" }); d.querySelector(".nd-x")?.focus(); } // 현재 항목으로 스크롤(홈 링크가 아니라)
$("#btabs")?.addEventListener("click", (e) => { const b = e.target.closest("[data-b]"); if (!b) return; if (b.dataset.b === "menu") openDrawer(); else if (b.dataset.b === "search") $("#srbtn")?.click(); });
$("#navdrawer")?.addEventListener("click", (e) => { if (e.target.closest(".nd-x") || e.target.id === "navdrawer" || e.target.closest("a")) closeDrawer(); });
// 포커스 가두기(서랍이 열려 있는 동안 Tab은 서랍 안에서만 돈다)
$("#navdrawer")?.addEventListener("keydown", (e) => { if (e.key !== "Tab") return; const f = [...$("#navdrawer").querySelectorAll("a[href], button:not([disabled])")].filter((x) => x.checkVisibility?.() !== false); if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } });
matchMedia("(min-width:900px)").addEventListener?.("change", (m) => { if (m.matches) { const d = $("#navdrawer"); if (d && !d.hidden) { d.hidden = true; document.body.classList.remove("nav-open"); OUTSIDE().forEach((e) => e.removeAttribute("inert")); } } }); // 서랍을 연 채 넓히면 잠금 해제
addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

// 화면 모드 전환(자동·라이트·다크). 선택은 이 브라우저에만 저장한다.
function drawTheme() {
  if (!window.__theme) return;
  const cur = window.__theme.get();
  for (const box of [$("#themesw"), $("#themesw2"), $("#themesw3")]) { if (!box) continue; // 모바일에서는 서랍 안에 둔다(머리줄이 좁다)
    box.innerHTML = [["auto", "자동"], ["light", "밝게"], ["dark", "어둡게"]].map(([k, t]) => `<button type="button" data-th="${k}" aria-pressed="${k === cur}">${t}</button>`).join("");
    box.onclick = (e) => { const b = e.target.closest("[data-th]"); if (!b) return; window.__theme.set(b.dataset.th); drawTheme(); }; }
}
// 글자 크기(보통/크게): 이 브라우저에만 저장
function drawFs() {
  const cur = document.documentElement.getAttribute("data-fs") === "large" ? "large" : "normal";
  for (const box of [$("#fsw"), $("#fsw2"), $("#fsw3")]) { if (!box) continue;
    box.innerHTML = [["normal", "보통"], ["large", "크게"]].map(([k, t]) => `<button type="button" data-fs="${k}" aria-pressed="${k === cur}">글자 ${t}</button>`).join("");
    box.onclick = (e) => { const b = e.target.closest("[data-fs]"); if (!b) return; if (b.dataset.fs === "large") document.documentElement.setAttribute("data-fs", "large"); else document.documentElement.removeAttribute("data-fs"); try { localStorage.setItem("portal.fs", b.dataset.fs); } catch {} drawFs(); }; }
}
drawFs();
drawTheme();
// 스킨(보이는 모습만 바꾸는 선택): 보관함 맨 위에서 고른다. 구조·정보는 그대로다.
const SKIN_OPT = [["", "기본", "스크랩북 글래스(지금 모습)"], ["paper", "가정통신문", "신문처럼: 세리프 제목, 괘선, 카드 없음"], ["tool", "조용한 도구", "무채색과 포인트 한 색, 큰 숫자"]];
function skinPanel(host) {
  if (!host || !window.__skin) return;
  const cur = window.__skin.get();
  const html = `<section class="dp skinp" aria-label="스킨"><div class="sec-h"><h2><em>보기</em>스킨 고르기</h2></div><p class="muted small">모양만 바뀌어요. 메뉴와 내용은 그대로예요. 이 브라우저에만 저장돼요.</p><div class="skin-opts" role="group" aria-label="스킨">${SKIN_OPT.map(([k, t, d]) => `<button type="button" class="chip${k === cur ? " on" : ""}" data-skin="${k}" aria-pressed="${k === cur}"><b>${t}</b><span>${d}</span></button>`).join("")}</div></section>`;
  let box = host.querySelector(".skinp"); if (box) box.outerHTML = html; else host.insertAdjacentHTML("afterbegin", html);
  host.querySelector(".skinp").onclick = (e) => { const b = e.target.closest("[data-skin]"); if (!b) return; window.__skin.set(b.dataset.skin); skinPanel(host); };
}

// ---- 데이터 ----
const cache = new Map();
// 같은 id의 행·같은 날짜의 일정이 두 번 나오지 않게 화면에서도 한 번만 남긴다(데이터 정정과 별개로)
const dedupePolicy = (rows) => { if (!Array.isArray(rows)) return rows; const seen = new Set(); return rows.filter((r) => { const k = r.id || r.title; if (seen.has(k)) return false; seen.add(k); return true; }).map((r) => { if (!r.events) return r; const e = new Set(); return { ...r, events: r.events.filter((x) => { const k = `${x.start}|${x.end || ""}|${x.label || ""}`; if (e.has(k)) return false; e.add(k); return true; }) }; }); };
const load = (name) => {
  if (!cache.has(name)) cache.set(name, fetch(`data/${name}.json`).then((r) => { if (!r.ok) throw new Error(name); return r.json(); }).then((d) => (name === "policy" ? dedupePolicy(d) : d)));
  return cache.get(name);
};
const stars = () => store.get("stars", []);
const toggleStar = (id) => { const s = stars(); store.set("stars", s.includes(id) ? s.filter((x) => x !== id) : [...s, id]); };
const nameOf = (schools, id) => schools.find((s) => s.id === id)?.name || id;
// 학교 로고(128px 원형 사본). 파일이 있는 학교만 표시한다.
const LOGO_IDS = new Set(["school-pungdeok", "school-seongbok", "school-suji", "school-yonginheungcheon"]);
const logo = (id, name, px = 20) => (LOGO_IDS.has(id) ? `<img class="logo" src="img/schools/256/${esc(id)}.png" alt="${esc(name)} 로고" width="${px}" height="${px}" style="--lg:${px}px">` : "");
const nm = (id, name, px) => `<span class="nm">${logo(id, name, px)}<span>${esc(name)}</span></span>`;
const SLOT = { required: "필수", elective: "내가 고르는", outside: "교외" };
const CSAT = { in: "포함", base: "기초", out: "제외", none: "-" };
const options = (items, all) => `${all ? `<option value="">${esc(all)}</option>` : ""}${items.map((v) => `<option value="${esc(v.v ?? v)}">${esc(v.t ?? v)}</option>`).join("")}`;
const POOL = { basic: "기초교과", cross: "교과(군) 간 선택", "in-area": "한 교과 안 선택", life: "기술·가정/정보/제2외국어 등" };
const CHECK = { inferred: "구분 추정", unmarked: "구분 미표기", flag: "열린 flag 있음" };
// 구분 배지: 모두 같은 크기의 윤곽선 둥근 사각형(채움 없음), 색만 다름. 추정은 이름 끝에 "?", 미표기는 점선 [—].
const KCOLOR = { 공통: "#64748b", 일반: "#0ea5e9", 진로: "#f59e0b", 융합: "#a855f7", 특목: "#f43f5e", 전문: "#14b8a6" };
const kindBadge = (kind, est) => {
  const title = kind ? `${kind}${est ? " (추정)" : ""}` : "구분 미표기";
  return `<span class="kb${est ? " est" : ""}${kind ? "" : " none"}" style="--k:${KCOLOR[kind] || "#94a3b8"}" title="${esc(title)}">${kind ? esc(kind) + (est ? "?" : "") : "—"}</span>`;
};
const kindOf = (o) => (o.primaryKind ? o.primaryKind + (o.kindStatus === "inferred" ? "?" : "") : "미표기");

// ---- 뷰 ----
const views = {
  async settings(el) { // 화면 설정(어둡게·스킨): 예전에는 바뀐 소식 화면 위에 숨어 있었다
    el.innerHTML = `<section class="dp"><div class="sec-h"><h2><em>모드</em>화면 모드</h2></div><p class="muted small">자동은 휴대폰·컴퓨터의 설정을 따라가요. 이 브라우저에만 저장돼요.</p><div id="themesw3" class="tsw" role="group" aria-label="화면 모드"></div></section><section class="dp"><div class="sec-h"><h2><em>글자</em>글자 크기</h2></div><p class="muted small">크게를 고르면 모든 화면의 글자가 커져요. 이 브라우저에만 저장돼요.</p><div id="fsw3" class="fsw" role="group" aria-label="글자 크기"></div></section><div id="skinhost"></div>`;
    drawTheme(); drawFs(); skinPanel(el.querySelector("#skinhost"));
  },
  async curriculum(el, query, node) {
    await curriculumView(el, query, node);
  },

  async sources(el) {
    const schools = await load("schools");
    el.innerHTML = schools.map((s) => `<div class="panel"><b>${esc(s.name)}</b><ul>${(s._meta?.source || []).map((x) => `<li>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name)} <span class="muted">${esc(x.kind)} · ${esc(x.retrieved || "")}</span></li>`).join("")}</ul></div>`).join("");
  },

  async status(el) {
    const [schools, summary, curricula] = await Promise.all([load("schools"), load("summary"), load("curricula")]);
    const cdate = (curricula.map((c) => /\d{4}-\d{2}-\d{2}/.exec(c._meta?.source?.[0]?.note || "")?.[0]).filter(Boolean).sort().pop() || "");
    el.innerHTML = `<div class="tw"><table><thead><tr><th class="l">학교</th><th>입학학년도</th><th>정보 수집일</th><th>과목표 신뢰도</th><th>확인할 항목</th><th>구분이 빠진 과목</th><th>직접 확인해 볼 항목</th></tr></thead><tbody>${summary.map((m) => { const sc = schools.find((s) => s.id === m.schoolId); return `<tr><td class="l">${esc(m.schoolName)}</td><td>${m.entryYear}</td><td>${esc(sc?._meta?.updated || "-")}</td><td>${esc(m.confidence)}</td><td>${m.flagsOpen}</td><td>${m.kindMissingRows}</td><td>${m.reviewCount}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="muted">unverified = 사진 대조 전 / reported = 보도·사용자 확인 / verified = 대조 완료</p>
      <p class="note">과목표 값은 AI가 학교 배부 사진에서 옮긴 뒤 <b>사용자 사진 대조 완료${cdate ? `, ${esc(cdate)}` : ""}</b>입니다. 수능 범위는 2028 통합형 수능 기준 <b>추정</b>이며, 과목표는 개설 가능 <b>후보</b>입니다.</p>`;
  },
};

// ---- 학교별 과목표: 학교 칩(on/off, 최대 4개교) + 탭(요약 / 상세 비교) ----
const ICON = {
  filter: '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M2 3h12L9.5 8.5V13l-3-1.5V8.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};
// 상세 비교 필터 칩의 선택 상태(탭을 오가도 유지). 비어 있으면 전체.
const FS = { sel: [], kind: [], terms: [], csat: [] };
const FOPT = {
  sel: [["school", "학교가 정함"], ["student", "내가 고르는"], ["outside", "학교 밖"]],
  kind: ["공통", "일반", "진로", "융합"].map((k) => [k, k]),
  csat: [["in", "출제 범위"], ["base", "기초(공통)"], ["out", "제외"]],
};
const fchips = (g) => `<div class="fcs">${FOPT[g].map(([v, t]) => `<button type="button" class="fchip" data-g="${g}" data-v="${esc(v)}" aria-pressed="false">${esc(t)}</button>`).join("")}</div>`;
const termGrid = () => `<div class="ftg">${[1, 2, 3].map((g) => `<button type="button" class="fchip fgr" data-grade="${g}" aria-pressed="false">${g}학년</button><button type="button" class="fchip" data-g="terms" data-v="${g}-1" aria-pressed="false">${g}-1</button><button type="button" class="fchip" data-g="terms" data-v="${g}-2" aria-pressed="false">${g}-2</button>`).join("")}</div>`;
// 영역 필터 7개: 6개 이름 그대로, 나머지 교과군(체육·예술·기술·가정/정보·제2외국어/한문/교양)은 "기타"
const AREA7 = ["국어", "수학", "영어", "한국사", "사회", "과학", "기타"];
const area7 = (a) => (AREA7.includes(a) && a !== "기타" ? a : "기타");
const TERMS = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];

async function curriculumView(el, query, node) {
  const [schools, summary, facets] = await Promise.all([load("schools"), load("summary"), load("facets")]);
  const known = (id) => schools.some((x) => x.id === id);
  let sel = query.has("s") ? query.get("s").split(",").filter(known) : schools.map((x) => x.id);
  sel = [...new Set(sel)];
  const areaIn = (query.get("a") || "").split(",").map((a) => (AREA7.includes(a) ? a : a ? "기타" : "")); // 옛 링크의 체육·예술·기술가정·제2외국어는 기타로
  let areasSel = AREA7.filter((a) => areaIn.includes(a)); // 비어 있으면 전체
  let focusP = query.get("p"); // 지도 탭에서 강조할 학교
  let tab = ["compare", "univ", "map", "middle", "hs"].includes(query.get("v")) ? query.get("v") : "hs"; // 학교별 요약(summary)은 학교 비교(hs)에 합쳤다
  const lv = tab === "middle" || query.get("lv") === "middle" ? "middle" : "high"; // 학교 탭의 "중학교 | 고등학교"
  if (lv === "middle" && !["map", "middle"].includes(tab)) tab = "middle";
  if (lv === "high" && tab === "middle") tab = "hs";
  const TABSET = []; // 탭 3겹 → 2겹: 학교별 요약·상세 비교는 위쪽 메뉴 항목으로 올렸다(주소는 그대로) // 학교 지도·중학교 배정·대학 요건은 메뉴(학교 탭 안)에서 연다
  let compare = null; // 상세 비교 화면(필터 포함)은 한 번만 만들고 탭 전환 때 재사용한다

  el.innerHTML = `<div class="phead">
      <div class="subtabs" id="tabs"${TABSET.some(([k]) => k === tab) ? "" : " hidden"}>${TABSET.map(([k, t]) => `<a href="#" data-tab="${k}">${t}</a>`).join("")}</div></div>
    <div class="vtog" id="vtoggle" role="group" aria-label="보기" hidden><span>보기</span><button type="button" data-vt="hs">요약</button><button type="button" data-vt="compare">상세</button></div>
        <div class="chipbar" id="chipbar"><span class="flabel">학교</span><div class="chips" id="chips"></div></div>
    <div id="cview"></div>`;

  // 상세 비교 필터(f=sel:school|student;kind:공통 …)도 주소에 남겨 같은 화면을 링크로 다시 열 수 있게 한다
  if (query.get("f")) for (const part of query.get("f").split(";")) { const [k, v] = part.split(":"); if (FS[k] && v) FS[k] = v.split("|").filter(Boolean); }
  const fsParam = () => Object.entries(FS).filter(([, v]) => v.length).map(([k, v]) => `${k}:${v.join("|")}`).join(";");
  const syncUrl = () => {
    const q = new URLSearchParams();
    q.set("v", tab);
    if (lv === "middle" && tab === "map") q.set("lv", "middle");
    if (tab === "map" || tab === "middle") { if (tab === "map" && focusP) q.set("p", focusP); }
    else q.set("s", sel.join(","));
    if (areasSel.length) q.set("a", areasSel.join(","));
    if (tab === "compare" && fsParam()) q.set("f", fsParam());
    const cur = new URLSearchParams((location.hash.split("?")[1] || "")); // 학교 비교 표(c)·유형(t)·전형(ty)·대학 요건(us)의 선택은 지우지 않는다
    for (const k of ["c", "m", "t", "ty", "us", "g", "u", "open"]) if (cur.has(k) && !q.has(k)) q.set(k, cur.get(k));
    history.replaceState(null, "", `#select/curriculum?${q.toString().replace(/%2C/g, ",")}`);
  };
  const chipHtml = () => schools.map((x) => `<button type="button" class="chip schip ${sel.includes(x.id) ? "on" : ""}" data-id="${esc(x.id)}" aria-pressed="${sel.includes(x.id)}" title="${esc(x.name)}">${nm(x.id, x.name, 36)}</button>`).join("");
  const drawChips = () => {
    // 요약 탭: 본문 위 칩 줄 / 상세 비교 탭: 필터 패널 안의 "학교" 항목
    $("#chipbar").hidden = tab !== "hs";
    const vt = $("#vtoggle"); vt.hidden = !(tab === "hs" || tab === "compare"); vt.querySelectorAll("[data-vt]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.vt === tab));
    $("#chips").innerHTML = chipHtml();
    const fc = $("#fchips"); if (fc) fc.innerHTML = chipHtml();
    // 표시 순서: 국어·영어·수학 / 한국사·사회·과학(한 줄 3개), 나머지는 한 줄 4개. 표의 교과군 정렬은 그대로.
    const ac = $("#achips"); if (ac) ac.innerHTML = AREA7.map((a, i) => `<button type="button" class="chip achip ${i < 4 ? "a4" : "a3"} ${areasSel.includes(a) ? "on" : ""}" data-area="${esc(a)}" aria-pressed="${areasSel.includes(a)}">${esc(a)}</button>`).join("");
    el.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  };
  const drawBody = async () => {
    const body = $("#cview");
    if (tab === "hs") {
      compare = null;
      body.innerHTML = `<details class="dp ty-top" id="tyd"><summary>고교 유형·전형 한눈에</summary><div id="tybody"></div></details><div id="hsmain"></div><section class="dp sum-sec" id="sumsec"><div class="sec-h"><h2><em>과목표</em>과목표 학교 요약</h2></div><div id="sumhost"></div></section>`;
      const tyd = body.querySelector("#tyd"); let tyDone = false;
      const fillTy = async () => { if (tyDone) return; tyDone = true; try { await views.types(body.querySelector("#tybody"), query); } catch { body.querySelector("#tybody").innerHTML = '<p class="muted">불러오지 못했어요.</p>'; } };
      tyd.addEventListener("toggle", () => { if (tyd.open) fillTy(); });
      if (query.get("ty") === "1") { tyd.open = true; await fillTy(); } // 유형 패널을 먼저 채운 뒤 아래 구역을 그려서 늦게 들어온 본문이 아래를 밀지 않게
      const fillWide = await hsHubBody(body.querySelector("#hsmain"), { load, esc, lazy: true });
      // 밀도: 학교 요약 카드는 번호·막대만 보이게 접고(자세히로 펼침), 31교 기본 정보 표는 접이식, 요약 카드는 한눈에 패널 바로 아래로
      const hub = body.querySelector("#hsmain .hub-hs"), wide = body.querySelector("#hs-wide"), sec = body.querySelector("#sumsec");
      if (hub && wide) {
        const dt = document.createElement("details"); dt.className = "dp wide-fold"; const nHs = (await load("hs-compare").catch(() => null))?.schools?.length; dt.innerHTML = `<summary>학교${nHs ? " " + nHs + "곳" : ""} 기본 정보 표 (규모·입학·교육과정·진학)</summary>`; wide.before(dt); dt.appendChild(wide); let wd = false; dt.addEventListener("toggle", () => { if (dt.open && !wd) { wd = true; if (window.__printing) window.__printUndo.push(() => { wide.innerHTML = ""; wd = false; }); fillWide(); } }); dt.insertAdjacentHTML("beforebegin", `<p class="hs-quick muted small">바로 보기 <a href="#select/curriculum?v=hs&g=${encodeURIComponent("선택과목 현황")}">선택과목 현황</a> · <a href="#select/curriculum?v=hs&g=${encodeURIComponent("내신 출제")}">내신 출제·평가 경향</a></p>`); if (query.get("g")) dt.open = true; // g가 있으면(검색·바로 보기) 31교 표를 펼쳐 그 그룹으로 간다
        hub.insertBefore(sec, dt);
      }
      { // 요약 구역은 자리를 먼저 잡고(높이 예약) 채운다: 채워지면서 아래 내용이 밀리는 레이아웃 이동(CLS)을 막는다
        const host = body.querySelector("#sumhost"), per = innerWidth < 900 ? 256 : 164.5; host.style.minHeight = Math.max(1, sel.length) * per + "px";
        const fillSum = async () => { await summaryBody(host, sel); host.style.minHeight = "";
  body.querySelectorAll(".school").forEach((c) => { c.classList.add("cp"); const f = c.querySelector(".foot"); if (f) f.insertAdjacentHTML("afterbegin", '<button type="button" class="btn sc-more" aria-expanded="false">자세히</button>'); });
          try { (await import("./glossary.js")).decorateGlossary(host); } catch {} };
        let filled = false;
        const arm = () => { if ("IntersectionObserver" in window && !query.get("bf") && !query.get("hl")) { const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); goSum(); } }, { rootMargin: "900px 0px" }); io.observe(host); return true; } return false; };
        const goSum = () => { if (filled) return; filled = true; if (window.__printing) window.__printUndo.push(() => { host.innerHTML = ""; host.style.minHeight = Math.max(1, sel.length) * per + "px"; filled = false; arm(); }); return fillSum(); };
        window.__onPrint?.(goSum); // 인쇄할 때는 멀리 있어도 바로 그린다
        if (!arm()) await goSum(); // ?bf= 주소는 설명회 노트가 요약 안에 있어 바로 그린 뒤 그 자리로 간다
      }
      const bf = query.get("bf"); if (bf) { const t = (bf === "1" ? body.querySelector("[id^=\"bf-\"]") : body.querySelector(`#bf-${CSS.escape(bf)}`)); if (t) { t.scrollIntoView({ block: "start" }); t.querySelector("details")?.setAttribute("open", ""); } }
    }
    else if (tab === "map") { compare = null; await (await import("./map.js")).mapBody(body, { load, esc, focus: focusP, level: lv === "middle" ? "middle" : "high" }); }
    else if (tab === "middle") { compare = null; await (await import("./middle.js")).middleBody(body, { load, esc }); }
    else if (tab === "univ") { compare = null; await (await import("./univ-match.js")).univBody(body, { load, esc, profile: currentProfile(store), schools, sel }); }
    else {
      if (!compare || !body.contains(compare.root)) compare = await compareShell(body, () => { sel = schools.map((x) => x.id); areasSel = []; refresh(); }, () => areasSel);
      compare.draw(sel);
    }
  };
  const refresh = async () => { drawChips(); syncUrl(); await drawBody(); drawChips(); };

  el.addEventListener("click", (e) => {
    const ach = e.target.closest(".achip");
    if (ach) {
      const a = ach.dataset.area;
      areasSel = AREA7.filter((x) => (x === a ? !areasSel.includes(a) : areasSel.includes(x)));
      return void refresh();
    }
    const chip = e.target.closest(".chip");
    if (chip) {
      const id = chip.dataset.id;
      if (sel.includes(id)) sel = sel.filter((x) => x !== id);
      else sel = schools.map((x) => x.id).filter((x) => sel.includes(x) || x === id);
      return void refresh();
    }
    const scm = e.target.closest(".sc-more");
    if (scm) { const c = scm.closest(".school"), on = !c.classList.contains("sc-open"); c.classList.toggle("sc-open", on); scm.setAttribute("aria-expanded", on); scm.textContent = on ? "접기" : "자세히"; return; }
    const vtb = e.target.closest("[data-vt]");
    if (vtb) { tab = vtb.dataset.vt; focusP = null; return void refresh(); }
    const t = e.target.closest("#tabs a");
    if (t) { e.preventDefault(); tab = t.dataset.tab; if (tab !== "map") focusP = null; refresh(); return; }
    const go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); sel = [go.dataset.go]; tab = "compare"; refresh(); return; }
    const star = e.target.closest(".star");
    if (star) { toggleStar(star.dataset.id); star.textContent = stars().includes(star.dataset.id) ? "★" : "☆"; }
  });
  el.addEventListener("cmpchange", () => { if (tab === "compare") syncUrl(); });
  el.addEventListener("input", (e) => { if (e.target.dataset.memo) store.set("memo:" + e.target.dataset.memo, e.target.value); });
  await refresh();
}

// 창체(창의적 체험활동) 블록: 총 학점·시수, 영역별 시수 합계, 학기별 표(항상 펼침). 영역 이름은 데이터 그대로.
function creativeBlock(m, cur) {
  const c = cur?.creative;
  if (!c?.perTerm) return "";
  const terms = TERMS.filter((t) => c.perTerm[t]);
  const areas = [...new Set(terms.flatMap((t) => Object.keys(c.perTerm[t])))];
  const sum = (a) => terms.reduce((n, t) => n + (c.perTerm[t][a] || 0), 0);
  const extra = [c.standardHours != null ? `표준 ${c.standardHours}` : "", c.operatedHours != null ? `운영 ${c.operatedHours}` : ""].filter(Boolean).join(" · ");
  return `<div class="cre"><div><b>창체</b> <span class="cr1">${m.creditsCreative}학점 · ${c.totalHours}시간</span></div>
    <div class="muted small">${areas.map((a) => `${esc(a)} ${sum(a)}`).join(" · ")}</div>
    <div class="crew"><table class="crt"><thead><tr><th></th>${terms.map((t) => `<th>${t}</th>`).join("")}</tr></thead><tbody>${areas.map((a) => `<tr><th>${esc(a)}</th>${terms.map((t) => `<td>${c.perTerm[t][a] ?? "-"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${extra ? `<div class="muted small">${esc(extra)} (데이터 표기)</div>` : ""}</div>`;
}

// 특이 사항: 맨 위에 "사진 대조 전 추정" 라벨, 5줄까지 보이고 나머지는 접어 둔다.
function notesBlock(list, status) {
  if (!list?.length) return "";
  const li = (n) => `<li>${esc(n)}</li>`;
  return `<div class="sn"><div class="sn-h"><b>특이 사항</b></div>
    <ul>${list.slice(0, 3).map(li).join("")}</ul>${list.length > 3 ? `<details><summary>더 보기 (${list.length - 3})</summary><ul>${list.slice(3).map(li).join("")}</ul></details>` : ""}</div>`;
}

// 요약 카드: 선택한 학교만 가로로 나란히
async function summaryBody(el, ids) {
  const [schools, summary, curricula] = await Promise.all([load("schools"), load("summary"), load("curricula")]);
  const notes = await load("school-notes").catch(() => null); // 특이 사항(없으면 생략)
  const briefings = await load("briefings").catch(() => null); // 설명회 노트(없으면 생략)
  const st = stars();
  const card = (m) => {
    const sc = schools.find((x) => x.id === m.schoolId) || {};
    const total = m.creditsRequired + m.creditsElective;
    const l1 = ["region", "schoolType", "founding", "gender"].filter((k) => vary(k)).map((k) => m[k]).filter(Boolean).join(" · ");
    return `<section class="school"><header>${schoolBand(m, { starred: st.includes(m.schoolId), sub: l1, logoOk: LOGO_IDS.has(m.schoolId) })}
      ${vary("assignment") && m.assignment ? `<div class="muted">${esc(m.assignment)}</div>` : ""}</header>
      <p class="hs-adm"><span class="muted">전형</span> ${m.assignment ? esc(m.assignment) : "추첨 배정(평준화 지역)"} · <a href="#schedule?t=hs">고입 일정</a> · <a href="#select/types">전형 설명</a></p>
      <div class="hs-tiles k3"><div><b>${m.creditsTotal}</b><span title="교과 ${m.creditsSubject} + 창체 ${m.creditsCreative}">총 학점</span></div><div class="kr"><b>${m.creditsRequired}</b><span>필수</span></div><div class="ke"><b>${m.creditsElective}</b><span>내가 고르는</span></div></div>
      <div class="bar" title="필수 ${m.creditsRequired} / 내가 고르는 ${m.creditsElective}"><span class="req" style="width:${(m.creditsRequired / total) * 100}%">필수 ${m.creditsRequired}</span><span class="ele" style="width:${(m.creditsElective / total) * 100}%">내가 고르는 ${m.creditsElective}</span></div>
      <details class="fold"><summary>학기별 학점</summary>
      <div class="terms">${TERMS.map((t) => { const b = m.byTerm[t], tot = b.required + b.elective || 1; return `<div><div class="tnum"><b class="r">${b.required}</b><b class="e">${b.elective}</b></div><div class="col"><i class="e" style="height:${(b.elective / tot) * 100}%"></i><i class="r" style="height:${(b.required / tot) * 100}%"></i></div><span>${t}</span></div>`; }).join("")}</div>
      </details>
      <div class="st2">
        <div class="st-req"><b class="st-l" title="학교가 정함">필수</b> 과목 <b class="st-n">${m.requiredCount}</b></div>
        <div class="st-ele"><b class="st-l" title="내가 고르는 과목">내가 고르는</b> 후보 <b class="st-n">${m.candidateSubjects}</b> 중 <b class="st-n">${m.pickTotal}</b>개 고르기
          <div class="st-sub">택n 묶음 ${m.groupCount} · 선택 폭 ${m.breadth} · 첫 선택 학기 ${esc(m.firstElectiveTerm || "-")}</div></div>
      </div>
      ${(() => { const cb = creativeBlock(m, curricula.find((x) => x.schoolId === m.schoolId)); return cb ? `<details class="fold"><summary>창체 ${m.creditsCreative}학점 · ${m.creativeHours}시간</summary>${cb}</details>` : ""; })()}
      ${notesBlock(notes?.schools?.find((x) => x.schoolId === m.schoolId)?.notes, notes?._meta?.status)}
      ${briefingBlock(briefings, m.schoolId, esc) ? `<p class="bf-go"><a class="lnk" href="#" data-bf="${esc(m.schoolId)}">설명회 노트 보기 ↓</a></p>` : ""}
      <details><summary>메모</summary><textarea data-memo="${esc(m.schoolId)}" placeholder="이 브라우저에만 저장됩니다">${esc(store.get("memo:" + m.schoolId, ""))}</textarea></details>
      <div class="foot"><a class="btn" href="#" data-go="${esc(m.schoolId)}">이 학교 과목 보기</a>
      <span class="muted small">${m.reviewCount ? `직접 확인해 볼 항목 ${m.reviewCount}건 · ` : ""}수집 ${esc(sc._meta?.updated || "-")}</span></div></section>`;
  };
  const shown = ids.map((id) => summary.find((m) => m.schoolId === id)).filter(Boolean);
  // 비교 중인 학교들 사이에 값이 다른 항목만 표시(학교가 하나뿐이면 전부 표시)
  const vary = (k) => shown.length < 2 || new Set(shown.map((x) => x[k] ?? "")).size > 1;
  const common = notes?.common?.length ? `<div class="sn-common">${notes.common.map(esc).join(" ")}</div>` : "";
  el.innerHTML = shown.length ? `${common}<div class="schoolgrid cols${shown.length > 4 ? "n" : shown.length}">${shown.map(card).join("")}</div>${shown.map((m) => { const b = briefingBlock(briefings, m.schoolId, esc); return b ? `<section class="bf-area w-page" id="bf-${esc(m.schoolId)}"><h3 class="bf-t">${esc(schools.find((x) => x.id === m.schoolId)?.name || m.schoolName)} 설명회</h3>${b}</section>` : ""; }).join("")}` : '<p class="note">위에서 학교를 하나 이상 선택하세요.</p>';
  el.querySelectorAll("[data-bf]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); const t = el.querySelector(`#bf-${CSS.escape(a.dataset.bf)}`); if (t) { t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); t.querySelector("details")?.setAttribute("open", ""); } }));
}

// 상세 비교: 필터 + 선택 학교를 열 단위로 나란히
let drawToken = null; // 다시 그릴 때 이전 이어 붙이기를 멈추는 표시
async function compareShell(el, onReset, getAreas) {
  const [schools, facets, subjects, offerings, groups] = await Promise.all([load("schools"), load("facets"), load("subjects"), load("offerings"), load("groups")]);
  const subj = new Map(subjects.map((x) => [x.subjectKey, x]));
  const gmap = new Map(groups.map((g) => [g.id, g]));
  el.innerHTML = `<div class="cmp">
    <div class="panel filters${innerWidth > 1000 ? "" : " fold"}"><div class="fhead"><button type="button" class="ib" id="ftog" aria-label="필터 접기/펼치기" title="필터 접기/펼치기">${ICON.filter}<span class="ftxt">필터</span></button><button type="button" class="ib" id="fsrch" aria-label="과목명 검색" title="과목명 검색">${ICON.search}</button></div>
      <div class="fsr" hidden><input type="search" id="q" placeholder="과목명" autocomplete="off"><button type="button" class="ib" id="fclr" aria-label="검색 닫기" title="검색 닫기(Esc)">×</button></div><div class="fbody">
      <div class="fgroup"><span class="flabel">학교</span><div class="chips" id="fchips"></div></div>
      <div class="fgroup"><span class="flabel">영역 (여러 개 선택, 없으면 전체)</span><div class="chips" id="achips"></div></div>
      <div class="fgroup"><span class="flabel">이수 방식</span>${fchips("sel")}</div>
      <div class="fgroup"><span class="flabel">구분</span>${fchips("kind")}</div>
      <div class="fgroup"><span class="flabel">학년 · 학기</span>${termGrid()}</div>
      <div class="fgroup"><span class="flabel">수능 범위(추정)</span>${fchips("csat")}</div>
      <div class="fgroup"><span class="flabel">택n 묶음 유형</span><select id="pool">${options(Object.entries(POOL).map(([v, t]) => ({ v, t })), "전체")}</select></div>
      <div class="fgroup"><label><input type="checkbox" id="diff"> 학교 간 차이 나는 과목만</label><label><input type="checkbox" id="one"> 한 학교에만 있는 과목</label></div>
      <button id="reset" type="button">필터 초기화</button>
    </div></div>
    <div class="cmpmain"><div class="tw"><table id="tbl"></table></div></div></div>`;
  // 필터 묶음이 6개를 넘으면(영역 7, 학년·학기 9) 처음 6개만 보이고 "더 보기"로 편다
  el.querySelectorAll("#achips,.ftg").forEach((box) => { const g = box.closest(".fgroup"); g.classList.add("cap"); g.insertAdjacentHTML("beforeend", '<button type="button" class="more-g" aria-expanded="false">더 보기</button>'); });
  el.addEventListener("click", (e) => { const b = e.target.closest(".more-g"); if (!b) return; const g = b.closest(".fgroup"), on = !g.classList.contains("open"); g.classList.toggle("open", on); b.setAttribute("aria-expanded", on); b.textContent = on ? "접기" : "더 보기"; });
  const root = el.firstElementChild;
  let ids = [], need = 0;
  const AW = 0, LW = innerWidth < 600 ? 100 : 120, CW = innerWidth < 600 ? 116 : 170; // 교과군 열(없앰: 그룹 머리글 행)·과목 열·학교 열 폭
  const fitMode = () => $(".tw")?.classList.toggle("fit", $(".cmpmain").clientWidth >= need);
  window.addEventListener("resize", fitMode);
  const draw = (next) => {
    root.dispatchEvent(new CustomEvent("cmpchange", { bubbles: true }));
    if (next) ids = next;
    const f = { q: $("#q").value.replace(/\s/g, ""), areas: getAreas(), sel: FS.sel, kind: FS.kind, terms: FS.terms, pool: $("#pool").value, csat: FS.csat, diff: $("#diff").checked, one: $("#one").checked };
    if (!ids.length) { $("#tbl").innerHTML = '<tbody><tr><td class="l" style="padding:12px">필터에서 학교를 하나 이상 선택하세요.</td></tr></tbody>'; return; }
    const by = new Map();
    for (const o of offerings) {
      if (!ids.includes(o.schoolId) || (f.areas.length && !f.areas.includes(area7(o.area))) || (f.sel.length && !f.sel.includes(o.selection)) || (f.terms.length && !f.terms.includes(o.term)) || (f.csat.length && !f.csat.includes(o.csatScope))) continue;
      if (f.pool && gmap.get(o.groupId)?.poolType !== f.pool) continue;
      if (f.kind.length && !f.kind.some((k) => o.kind.includes(k) || o.kindGuess === k)) continue;
      if (f.q && !o.subject.replace(/\s/g, "").includes(f.q)) continue;
      if (f.one && subj.get(o.subjectKey)?.schoolCount !== 1) continue;
      if (!by.has(o.subjectKey)) by.set(o.subjectKey, { area: o.area, name: subj.get(o.subjectKey)?.name || o.subject, cells: {} });
      (by.get(o.subjectKey).cells[o.schoolId] ||= []).push(o);
    }
    let rows = [...by.values()];
    if (f.diff) rows = rows.filter((r) => ids.some((id) => !r.cells[id]));
    // 정렬: 교과군 → 필수 → 내가 고르는 → 구분(공통·일반·진로·융합, 미표기 마지막) → 학점 내림차순 → 과목명
    const KORDER = ["공통", "일반", "진로", "융합"];
    for (const r of rows) {
      const os = ids.flatMap((id) => r.cells[id] || []);
      r.isReq = os.some((o) => o.slot === "required") ? 0 : 1;
      r.kind = Math.min(...os.map((o) => { const i = KORDER.indexOf(o.primaryKind || o.kindGuess); return i < 0 ? KORDER.length : i; }));
      r.cr = Math.max(...os.map((o) => o.credits || 0));
    }
    rows.sort((a, b) => facets.areas.indexOf(a.area) - facets.areas.indexOf(b.area) || a.isReq - b.isReq || a.kind - b.kind || b.cr - a.cr || a.name.localeCompare(b.name, "ko"));
    const names = ids.map((id) => nameOf(schools, id));
    const uniq = (a) => [...new Set(a)];
    const cell = (os) => {
      if (!os) return '<td class="no" title="미개설" aria-label="미개설">-</td>';
      const slots = uniq(os.map((o) => SLOT[o.slot])), tm = uniq(os.map((o) => o.term)).sort().join(",");
      const kinds = uniq(os.map((o) => (o.primaryKind ? `${o.primaryKind}|0` : o.kindGuess ? `${o.kindGuess}|1` : "|0")));
      const icons = kinds.map((k) => { const [n, est] = k.split("|"); return kindBadge(n || null, est === "1"); }).join("");
      const crs = uniq(os.map((o) => o.credits)).map((c) => `<i class="cr" title="${c}학점">${c}</i>`).join("");
      const warn = os.some((o) => o.openFlagIds.length) ? '<span title="열린 flag">⚠️</span>' : "";
      return `<td class="${os.some((o) => o.slot === "required") ? "req" : "ele"}"><div class="c1">${icons}<span class="tm">${esc(tm)} (${slots.join("/")})</span>${crs}${warn}</div></td>`;
    };
    // 교과군은 맨 왼쪽 열(rowspan)로 한 번만 표시한다.
    const spans = new Map();
    for (const r of rows) spans.set(r.area, (spans.get(r.area) || 0) + 1);
    // 행은 처음 한 덩어리(24행)만 바로 그리고 나머지는 한가할 때 이어 붙인다(모바일에서 첫 화면이 빨리 뜨게).
    let area = "", ai = -1;
    const trs = [];
    for (const r of rows) {
      const first = r.area !== area;
      if (first) { area = r.area; ai++; }
      const cls = `ra${ai % 2}${first ? " af" : ""}`; // 이어 붙일 때 값이 바뀌지 않게 지금 정해 둔다
      if (first) trs.push(() => `<tr class="${cls} grp"><th class="gh" scope="rowgroup" colspan="${ids.length + 1}">${esc(r.area)}</th></tr>`); // 교과군은 열이 아니라 그룹 머리글 행
      trs.push(() => `<tr class="${cls}"><td class="l">${subjectName(r.name)}</td>${ids.map((id) => cell(r.cells[id])).join("")}</tr>`);
    }
    need = AW + LW + CW * ids.length;
    $("#tbl").style.minWidth = `${need}px`;
    const CH = 30, token = (drawToken = Symbol());
    const head = `<caption class="sr-only">학교별 개설 과목 비교(열=학교, 행=과목)</caption><thead><tr><th class="l" scope="col">과목</th>${ids.map((id, i) => `<th scope="col">${nm(id, names[i], 30)}</th>`).join("")}</tr></thead>`;
    const foot = `<tfoot><tr><th class="lf" scope="row">해당 과목 수</th>${ids.map((id) => `<th scope="col">${rows.filter((r) => r.cells[id]).length}</th>`).join("")}</tr></tfoot>`;
    const chunk = (i) => trs.slice(i, i + CH).map((f) => f()).join("");
    $("#tbl").innerHTML = `${head}<tbody>${trs.length ? chunk(0) : `<tr><td colspan="${ids.length + 2}">조건에 맞는 과목이 없어요.</td></tr>`}</tbody>${foot}`;
    // 밀도: 처음 한 덩어리만 보이고 나머지는 "과목 더 보기"로 이어 붙인다(136행을 한 번에 그리지 않는다).
    let shown = Math.min(CH, trs.length);
    root.querySelector("#rowsmore")?.remove();
    if (trs.length > CH) {
      const wrap = document.createElement("div"); wrap.id = "rowsmore"; wrap.className = "more-rows";
      const paint = () => { wrap.innerHTML = shown < trs.length ? `<button type="button" class="btn">과목 더 보기 (${shown}/${trs.length})</button> <button type="button" class="btn lnk" data-all>모두 보기</button>` : ""; };
      paint();
      wrap.addEventListener("click", (e) => { if (token !== drawToken) return; const all = e.target.closest("[data-all]"); if (!all && !e.target.closest("button")) return; const to = all ? trs.length : Math.min(trs.length, shown + CH); $("#tbl tbody").insertAdjacentHTML("beforeend", trs.slice(shown, to).map((f) => f()).join("")); shown = to; paint(); });
      $("#tbl").closest(".tw,.cmp-wrap,div")?.after(wrap);
    }
    fitMode();
  };
  let dbt; root.addEventListener("input", () => { clearTimeout(dbt); dbt = setTimeout(() => draw(), 120); }); // 글자 입력은 잠깐 모아서 한 번만
  root.addEventListener("change", () => draw());
  // 접기/펼치기, 과목명 검색(돋보기 → 입력창, 입력 즉시 필터, Esc·× 로 비우고 닫기)
  const box = $(".filters"), sr = $(".fsr"), qin = $("#q");
  const paintF = () => {
    root.querySelectorAll(".fchip[data-g]").forEach((b) => { const on = FS[b.dataset.g].includes(b.dataset.v); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    root.querySelectorAll(".fchip[data-grade]").forEach((b) => { const on = FS.terms.includes(`${b.dataset.grade}-1`) && FS.terms.includes(`${b.dataset.grade}-2`); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  };
  root.addEventListener("click", (e) => {
    const b = e.target.closest(".fchip"); if (!b) return;
    if (b.dataset.grade) { // 학년 칩: 두 학기를 함께 켜고 끈다
      const ts = [`${b.dataset.grade}-1`, `${b.dataset.grade}-2`], all = ts.every((t) => FS.terms.includes(t));
      FS.terms = all ? FS.terms.filter((t) => !ts.includes(t)) : [...new Set([...FS.terms, ...ts])];
    } else FS[b.dataset.g] = FS[b.dataset.g].includes(b.dataset.v) ? FS[b.dataset.g].filter((x) => x !== b.dataset.v) : [...FS[b.dataset.g], b.dataset.v];
    paintF(); draw();
  });
  paintF();
  $("#ftog").addEventListener("click", () => box.classList.toggle("fold"));
  const closeSearch = () => { qin.value = ""; sr.hidden = true; draw(); $("#fsrch").focus(); };
  $("#fsrch").addEventListener("click", () => { box.classList.remove("fold"); sr.hidden = false; qin.focus(); });
  $("#fclr").addEventListener("click", closeSearch);
  qin.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSearch(); });
  $("#reset").addEventListener("click", () => {
    sr.hidden = true;
    ["q", "pool"].forEach((id) => ($("#" + id).value = ""));
    for (const k of Object.keys(FS)) FS[k] = [];
    paintF();
    ["diff", "one"].forEach((id) => ($("#" + id).checked = false));
    draw();
    onReset?.();
  });
  // 과목 설명 데이터는 표를 막지 않고 따로 읽는다: 도착하면 ⓘ만 덧붙이도록 한 번 더 그린다.
  preloadSubjectInfo(load).then(() => { if (ids.length && root.isConnected) draw(); });
  return { root, draw };
}

// 첫 화면에 필요 없는 큰 화면 모듈(일정·제도·학점제·계획표)은 처음 열 때 불러온다(홈 로딩 단축)
const lazyReg = (names, loader) => { let p; for (const n of names) { const w = async (...args) => { p ||= loader(); await p; if (views[n] === w) throw new Error("view not registered: " + n); return views[n](...args); }; views[n] = w; } };
lazyReg(["changelog", "credit", "schedule", "system", "types"], () => import("./policy.js").then((m) => m.register(views, { $, esc, load, store })));
registerHome(views, { esc, load, store, nm, stars, toggleStar, nameOf, TERMS, hasLogo: (id) => LOGO_IDS.has(id), profile: () => currentProfile(store), profiles: () => allProfiles(store) });
lazyReg(["planner"], () => import("./planner.js").then((m) => m.registerPlanner(views, { esc, load, store })));
const filesApi = registerFiles(views, { esc, load, nm });

// 보관함 > 바로가기: 분류별 헤어라인 목록. 공식·공공은 구분해 적고, 확인일을 함께 보여 준다(data/links.json).
views.midlife = async (el) => {
  el.innerHTML = `<div class="ed"><ul class="rows lk">
    <li class="row"><div><h3><a href="#select/curriculum?v=middle">교과서·교과 구성</a></h3><p>중학교 배정 화면에서 학교를 열면 나와요.</p></div></li>
    <li class="row"><div><h3><a href="#schedule?t=life" data-stage="중입">중학교 시기 일정</a></h3><p>중학교 배정·입학 일정을 일정 화면에서 모아 봐요.</p></div></li></ul>
    ${emptyLine(esc, SOON_WHY["중학교 교육과정"])}</div>`;
  el.onclick = (e) => { if (e.target.closest("[data-stage]")) store.set("portal.schedule.stage", "중입"); };
};
views.links = async (el) => {
  const d = await load("links");
  const KIND = { 공식: "공식", 공공: "공공", 매체: "매체", 학원: "학원" };
  const SK = "portal.links.stage";
  let fs = store.get(SK, ""); if (!STAGES.includes(fs)) fs = "";
  const paint = () => {
  el.innerHTML = `<div class="chipbar"><span class="flabel">단계</span><div class="chips">${[["", "전체"], ...STAGES.map((g) => [g, g])].map(([v, t]) => `<button type="button" class="chip${v === fs ? " on" : ""}" data-stage="${v}" aria-pressed="${v === fs}">${t}</button>`).join("")}</div></div><p class="muted small">접속을 확인한 곳만 담았어요. 확인일 ${esc((d._meta?.checkedAt || "").replace(/-/g, "."))}</p>
    ${d.categories.map((c, i) => [c, i, d.items.filter((x) => x.category === c && (!fs || !linkStage(x) || linkStage(x) === fs))]).filter(([, , xs]) => xs.length).map(([c, i, xs]) => `<section class="sec"><div class="sec-h"><h2><em>${String(i + 1).padStart(2, "0")}</em>${esc(c)}</h2></div><ul class="rows lk">${xs.map((x) => `<li class="row"><div><h3><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)} ↗</a></h3><p>${esc(x.purpose)}</p><div class="meta">${stageTag(linkStage(x), esc)}<span class="kd${x.kind === "공식" ? " off" : ""}">${esc(KIND[x.kind] || x.kind)}</span><span class="muted small">${esc(x.org)} · 확인 ${esc(x.checkedAt.slice(5).replace("-", "."))}</span></div></div></li>`).join("")}</ul></section>`).join("")}
    <section class="sec"><div class="sec-h"><h2><em>앱처럼</em>홈 화면에 추가하는 법</h2></div><p class="muted small">아이폰은 공유 버튼 → "홈 화면에 추가", 안드로이드 크롬은 메뉴 → "홈 화면에 추가"를 누르세요. 한 번 열어 두면 인터넷이 약해도 홈이 열려요.</p></section>
    ${showProfiles() ? `<section class="sec"><div class="sec-h"><h2><em>설정</em>표시 이름</h2></div><p class="muted small">이 브라우저에서만 바뀌어요. 비우면 기본 이름으로 돌아가요.</p>${nameSettings(store)}</section>` : ""}`;
  bindNameSettings(el, store, render);
  };
  paint();
  el.onclick = (e) => { const b = e.target.closest("[data-stage]"); if (!b) return; fs = b.dataset.stage; store.set(SK, fs); paint(); };
};

// 일정 화면: 캘린더 구독(webcal) 또는 .ics 내려받기
const ICS_URL = "gc8134choi.github.io/admissions-2030/portal/data/schedule.ics";
function addCalendar(el) {
  if (el.querySelector(".cal")) return;
  const s = document.createElement("section");
  s.className = "sec cal";
  s.innerHTML = `<div class="sec-h"><h2><em>캘린더</em>내 캘린더에 담기</h2></div>
    <p class="muted small">구독하면 일정이 바뀔 때 캘린더 앱이 알아서 따라가요. 추정 일정은 제목에 (추정)이 붙어 있어요.</p>
    <p class="cal-a"><a class="lnk" href="webcal://${ICS_URL}">내 캘린더에 구독</a><a class="lnk" href="data/schedule.ics" download="schedule.ics">.ics 내려받기</a></p>`;
  el.appendChild(s);
}

const GO_ERR = '<p class="note">정보를 못 가져왔어요. 잠시 뒤 다시 열어 주세요.</p>';
// 빵부스러기 끝의 학교 이름, 자료 확인일, 출처 모음을 채운다(출처 버튼이 늦게 생겨도 따라간다)
function pageExtras(loc, query) {
  if (!loc || loc.item.id === "home") return;
  const sid = (query.get("s") || "").split(",").filter(Boolean);
  if (sid.length === 1) load("schools").then((ss) => { const x = ss.find((y) => y.id === sid[0]); const el = $("#crumb .crumb-s"); if (x && el) el.innerHTML = `<span aria-hidden="true"> › </span>${esc(x.name)}`; }).catch(() => {});
  load("policy").then((rows) => { const d = rows.map((r) => r.checkedAt).filter(Boolean).sort().pop(); const el = $(".pgfoot .pg-date"); if (d && el) el.textContent = `자료 확인 ${d.replace(/-/g, ".")} · `; }).catch(() => {});
}
const refreshPageSources = () => { const f = $(".pgfoot .pg-src"); if (f) f.innerHTML = sourcesHtml($("#main")) + " · "; };

// 정보성 화면(학점제·수능과 내신·중학교 배정·중학교 생활): 읽기 폭 70자 + 긴 화면 '이 화면에서' 목차(소제목 앵커)
const INFO_VIEWS = new Set(["credit", "system", "midlife"]);
const wantsToc = (n, query) => isInfo(n, query) || (n.view === "curriculum" && query.get("v") === "hs" && query.get("ty") === "1");
const isInfo = (n, query) => INFO_VIEWS.has(n.view) || (n.view === "curriculum" && query.get("v") === "middle");
function addToc() {
  const v0 = $("#view"), host = $("#toc-host"); if (!v0 || !host || host.querySelector(".toc-in")) return;
  const v = $("#tybody") && $("#tybody").children.length > 1 ? $("#tybody") : v0; /* 고교 종류 화면은 유형 패널 안의 소제목만 */
  let hs = [...v.querySelectorAll("h2")].filter((h) => h.textContent.trim().length > 1);
  if (hs.length < 3) hs = [...v.querySelectorAll("h2, h3")].filter((h) => h.textContent.trim().length > 1 && !h.closest(".toc-in"));
  if (/[?&]ty=1/.test(location.hash)) hs = [...v.querySelectorAll("h2, h3")].filter((h) => h.tagName === "H2" || /성적 반영|배점|구역|지망|쌍둥이|서류/.test(h.textContent)); // 고교 종류: 큰 구역 + 자주 찾는 소구역
  if (hs.length < 3) hs = [...v.querySelectorAll("h2, h3, details.hst > summary")].filter((h) => h.textContent.trim().length > 1 && !h.closest(".toc-in"));
  if (hs.length < 3) { host.classList.add("empty"); return; }
  hs = hs.slice(0, 10); // 너무 길면 위쪽 10개만
  const li = hs.map((h, i) => { h.id ||= "sec-" + (i + 1); h.style.scrollMarginTop = "84px"; const t = (h.querySelector("em")?.nextSibling?.textContent || h.textContent).trim().replace(/^(중입|고입|대입)\s*/, "").replace(/\s*ⓘ\s*/g, " "); return `<li><a href="#${h.id}" data-toc="${h.id}">${esc(t)}</a></li>`; }).join("");
  host.insertAdjacentHTML("afterbegin", `<details class="toc-in"><summary>이 화면에서 ▾</summary><ol>${li}</ol></details>`);
  host.querySelector(".toc-in").addEventListener("click", (e) => { const a = e.target.closest("[data-toc]"); if (!a) return; e.preventDefault(); const t = document.getElementById(a.dataset.toc); for (let d = t; d && d.id !== "main"; d = d.parentElement) if (d.tagName === "DETAILS") d.open = true; /* 접힌 구역 안의 소제목이면 펴고 간다 */ t?.scrollIntoView({ behavior: "smooth", block: "start" }); });
}
// 정보 화면: 웹폰트(Pretendard)가 늦게 들어오며 17px 글이 다시 줄바꿈되는 것(CLS)을 막는다 — 글자 모양이 준비될 때까지(최대 0.9초) 본문을 보이지 않게 둔다
function fontGate() {
  const m = $("#main"); if (!m || !m.classList.contains("info") || !document.fonts?.load) return;
  m.classList.add("fw"); let done = false;
  const open = () => { if (done) return; done = true; m.classList.remove("fw"); };
  setTimeout(open, 900);
  const t = () => (m.textContent || "").replace(/\s+/g, " ").slice(0, 3000);
  setTimeout(() => Promise.all([document.fonts.load('400 17px "Pretendard Variable"', t()), document.fonts.load('700 17px "Pretendard Variable"', t())]).then(open, open), 350); // 본문이 그려진 뒤 그 글자만 받는다
}
function render() {
  const [path, qs] = decodeURIComponent(location.hash.slice(1)).split("?");
  const query = new URLSearchParams(qs || "");
  let id = path || "home";
  if (REDIRECT[id]) { location.replace("#" + REDIRECT[id] + (qs ? (REDIRECT[id].includes("?") ? "&" : "?") + qs : "")); return; } // 옛 주소 → 가까운 화면
  if (id === "admission/system" && query.get("t") === "log") { location.replace("#changelog"); return; } // 옛 주소: 바뀐 소식은 자료·소식 한 곳
  const n = byId.get(id) || byId.get("home");
  const loc = locate(n.id, query) || { tab: TABS[0], group: TABS[0].groups[0], item: TABS[0].groups[0].items[0] };
  const tab = loc.tab;
  document.body.dataset.profile = currentProfile(store).key;
  $("#main").classList.toggle("info", isInfo(n, query)); $("#main").classList.remove("fw");
  drawTabs(loc);
  document.title = `${loc.item.id === "home" ? "" : (loc.item.page || loc.item.title) + " · "}스쿨 라이프`;
  scrollTo(0, 0);
  const navA = (href, title, on) => `<a href="${href}"${on ? ' aria-current="page"' : ""}>${esc(title)}</a>`;
  const row = (cls, label, links) => `<nav class="subnav${cls}" aria-label="${esc(label)}">${links}</nav>`;
  const sub = ""; // 메뉴 고르기는 좌측 트리 한 곳(화면 안 글자 탭 제거)
  const soonL = [...(loc.group.soon || []), ...(tab.soon || [])];
  const soon = soonL.length ? `<div class="soon"><b>곧 열려요</b>${soonL.map((n) => `<div class="soon-i"><span>${esc(n)}</span>${emptyLine(esc, SOON_WHY[n] || { why: "준비 중이에요. 자료를 모으는 대로 열어요." })}</div>`).join("")}</div>` : "";
  if (n.view === "curriculum" && currentProfile(store).key === "b") { // 프로필 B는 아직 학교가 없다
    $("#main").innerHTML = `${sub}<div id="view"><section class="sec"><div class="empty"><span class="z" aria-hidden="true">0</span><p>${esc(currentProfile(store).name)}의 학교는 아직 없어요.</p><small>고입 이후 학교가 정해지면 과목표가 여기에 들어옵니다.</small><a href="#home">오늘 화면으로 →</a></div></section></div>${soon}`;
    return;
  }
  if (n.view === "curriculum" || n.view === "home") { // 위쪽 공간 절약: 제목 없이 화면이 바로 시작
    $("#main").innerHTML = `${sub}${isInfo(n, query) || query.get("v") === "map" ? `<h1 class="ph">${esc(loc.item.page || loc.item.title)}</h1>` : ""}${crumbHtml(loc, hrefOf, tabHref)}${wantsToc(n, query) ? '<div id="toc-host" class="toc-host"></div>' : ""}<div id="view"></div>${soon}${footHtml(loc)}`;
    pageExtras(loc, query); fontGate();
    const mainEl = $("#main"); mainEl.classList.add("view-loading"); const ready = () => requestAnimationFrame(() => { mainEl.classList.remove("view-loading"); addToc(); }); // 화면이 다 그려지기 전에는 아래 안내(푸터)를 숨겨 밀림(CLS)을 막는다
    views[n.view]($("#view"), query, n).catch(() => ($("#view").innerHTML = GO_ERR)).finally(ready);
    return;
  }
  const title = loc.item.page || loc.item.title || n.title;
  const lvTag = "";
  $("#main").innerHTML = `${sub}<h1 class="ph">${esc(title)}${lvTag}</h1>${crumbHtml(loc, hrefOf, tabHref)}${wantsToc(n, query) ? '<div id="toc-host" class="toc-host"></div>' : ""}<div id="view"></div>${soon}${footHtml(loc)}`;
  pageExtras(loc, query); fontGate();
  { const mainEl = $("#main"); mainEl.classList.add("view-loading"); setTimeout(() => mainEl.classList.remove("view-loading"), 4000); /* 안전장치 */ }
  const doneLoad = () => requestAnimationFrame(() => { $("#main").classList.remove("view-loading"); addToc(); });
  if (n.view) views[n.view]($("#view"), query).finally(doneLoad).then(() => { filesApi.afterView(n.view, $("#view")); if (n.view === "credit") decorateSubjectLists($("#view"), load, "4."); if (n.view === "schedule") addCalendar($("#view")); }).catch(() => ($("#view").innerHTML = GO_ERR));
}

addEventListener("hashchange", () => { window.__hlWanted = /[?&]hl=/.test(location.hash) ? Date.now() : 0; render(); applyHl(); });
await initProfiles(load);
{
  const d = new Date(), W = ["일", "월", "화", "수", "목", "금", "토"];
  $("#today").textContent = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}(${W[d.getDay()]})`;
}
mountProfileSwitch([$("#pf")], store, render);
// 검색(약 64KB)은 처음 열 때(또는 한가할 때) 불러온다: 홈 첫 화면의 스크립트를 줄인다
{ const btn = $("#srbtn"); let mounted = false, mod = null, handle = null;
  const loadMod = () => (mod ||= import("./search.js"));
  const mount = async () => { const m = await loadMod(); if (!mounted) { mounted = true; btn.removeEventListener("click", first, true); removeEventListener("keydown", slash, true); handle = m.mountSearch(btn, { load, store, esc }); } return handle; };
  const first = async (e) => { if (mounted) return; e.stopImmediatePropagation(); e.preventDefault(); await mount(); btn.click(); };
  const slash = async (e) => { if (e.key !== "/" || mounted || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return; e.preventDefault(); await mount(); btn.click(); };
  btn.addEventListener("click", first, true); addEventListener("keydown", slash, true);
  (window.requestIdleCallback || ((f) => setTimeout(f, 2500)))(async () => { try { await mount(); handle?.warm?.(); } catch {} }); } // 한가할 때 모듈을 불러 붙이고 데이터까지 미리 읽는다(첫 검색 대기 단축)
// 용어 ⓘ를 모든 화면으로: 화면이 그려지거나 바뀔 때(필터 등) 사전의 용어를 묶음마다 처음 한 번 누르는 말로 바꾼다
initSrcRef();
{ // 화면마다 "출처 …" 줄을 버튼으로 접는다(필터·펼침으로 다시 그려져도 따라간다)
  const main = $("#main"); let tf = null;
  const fold = () => { so.disconnect(); try { foldSources(main); refreshPageSources(); } catch {} so.observe(main, { childList: true, subtree: true }); };
  const so = new MutationObserver(() => { clearTimeout(tf); tf = setTimeout(fold, 120); });
  so.observe(main, { childList: true, subtree: true });
}
load("glossary").then((g) => {
  setTerms(g.terms); initTerms(); preloadGlossary(load).catch(() => {});
  const main = $("#main"); let tm = null;
  // 화면마다 용어당 처음 한 번만(홈은 패널마다 따로 붙인다)
  const run = () => { mo.disconnect(); if (location.hash.replace(/^#/, "").split("?")[0] !== "" && location.hash !== "#home") { try { decorateTerms(main, "section,.ed-row,.dp,.piece,details,.school,.note,.tw"); } catch {} } try { decorateGlossary(main); } catch {} /* 용어 풀이(ⓘ)는 홈을 포함한 모든 화면에 */ mo.observe(main, { childList: true, subtree: true }); };
  const mo = new MutationObserver(() => { if (window.__printing || performance.now() < (window.__noDecorUntil || 0)) return; clearTimeout(tm); tm = setTimeout(run, 250); }); // 인쇄 중에는 용어 장식을 새로 붙이지 않는다(높이 변동 방지)
  window.__flushDecor = () => { clearTimeout(tm); run(); }; // 인쇄 시작 때 지금까지 그려진 부분의 장식을 먼저 끝낸다
  mo.observe(main, { childList: true, subtree: true });
}).catch(() => {});
window.__hlWanted = /[?&]hl=/.test(location.hash) ? Date.now() : 0; render(); applyHl();

// 서비스 워커: 한 번 열어 두면 오프라인에서도 홈이 열린다. 새 버전이 오면 한 줄로 알린다.
if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !/^(localhost|127\.)/.test(location.hostname) || new URLSearchParams(location.search).has("sw")) {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    const ask = (w) => { $("#upd").hidden = false; $("#upd-go").onclick = () => { w.postMessage("skip"); }; };
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener("updatefound", () => { const w = reg.installing; w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) ask(w); }); });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

$("#skip")?.addEventListener("click", (e) => { e.preventDefault(); const m = $("#main"); m.setAttribute("tabindex", "-1"); m.focus(); m.scrollIntoView({ block: "start" }); });
