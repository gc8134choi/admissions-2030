import { MENU, STATUS, TABS, REDIRECT, hrefOf, tabHref, locate } from "./menu.js";
import { register as registerPolicy } from "./policy.js";
import { registerHome } from "./home.js";
import { registerFiles } from "./files.js";
import { currentProfile, allProfiles, initProfiles, mountProfileSwitch, nameSettings, bindNameSettings, showProfiles } from "./profile-ui.js";
import { univBody } from "./univ-match.js";
import { STAGES, linkStage, stageTag } from "./stage.js";
import { briefingBlock } from "./briefing.js";
import { registerPlanner } from "./planner.js";
import { mapBody } from "./map.js";
import { middleBody } from "./middle.js";
import { mountSearch } from "./search.js";
import { schoolBand } from "./school-card.js";
import { preloadSubjectInfo, subjectName, decorateSubjectLists } from "./subject-info.js";

const $ = (s) => document.querySelector(s);
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
function drawTabs(tab) {
  const html = TABS.map((t) => `<a href="${tabHref(t)}"${t.id === tab.id ? ' aria-current="page"' : ""}>${esc(t.title)}</a>`).join("");
  const vl = $("#vaultlink"); if (vl) tab.id === "vault" ? vl.setAttribute("aria-current", "page") : vl.removeAttribute("aria-current");
  $("#topnav").innerHTML = html;
  $("#btabs").innerHTML = html;
}

// ---- 데이터 ----
const cache = new Map();
const load = (name) => {
  if (!cache.has(name)) cache.set(name, fetch(`data/${name}.json`).then((r) => { if (!r.ok) throw new Error(name); return r.json(); }));
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
    el.innerHTML = `<div class="tw"><table><thead><tr><th class="l">학교</th><th>입학학년도</th><th>정보 수집일</th><th>편제표 신뢰도</th><th>확인할 항목</th><th>구분이 빠진 과목</th><th>직접 확인해 볼 항목</th></tr></thead><tbody>${summary.map((m) => { const sc = schools.find((s) => s.id === m.schoolId); return `<tr><td class="l">${esc(m.schoolName)}</td><td>${m.entryYear}</td><td>${esc(sc?._meta?.updated || "-")}</td><td>${esc(m.confidence)}</td><td>${m.flagsOpen}</td><td>${m.kindMissingRows}</td><td>${m.reviewCount}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="muted">unverified = 사진 대조 전 / reported = 보도·사용자 확인 / verified = 대조 완료</p>
      <p class="note">편제표 값은 AI가 학교 배부 사진에서 옮긴 뒤 <b>사용자 사진 대조 완료${cdate ? `, ${esc(cdate)}` : ""}</b>입니다. 수능 범위는 2028 통합형 수능 기준 <b>추정</b>이며, 편제표는 개설 가능 <b>후보</b>입니다.</p>`;
  },
};

// ---- 학교별 편제표: 학교 칩(on/off, 최대 4개교) + 탭(요약 / 상세 비교) ----
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
  let tab = ["compare", "univ", "map", "middle"].includes(query.get("v")) ? query.get("v") : "summary";
  const lv = tab === "middle" || query.get("lv") === "middle" ? "middle" : "high"; // 학교 탭의 "중학교 | 고등학교"
  if (lv === "middle" && !["map", "middle"].includes(tab)) tab = "middle";
  if (lv === "high" && tab === "middle") tab = "summary";
  const TABSET = lv === "middle" ? [] : [["summary", "학교별 요약"], ["compare", "상세 비교"]]; // 학교 지도·중학교 배정·대학 요건은 메뉴(학교 탭 안)에서 연다
  let compare = null; // 상세 비교 화면(필터 포함)은 한 번만 만들고 탭 전환 때 재사용한다

  el.innerHTML = `<div class="phead">
      <div class="subtabs" id="tabs"${TABSET.some(([k]) => k === tab) ? "" : " hidden"}>${TABSET.map(([k, t]) => `<a href="#" data-tab="${k}">${t}</a>`).join("")}</div></div>
        <div class="chipbar" id="chipbar"><span class="flabel">학교</span><div class="chips" id="chips"></div></div>
    <div id="cview"></div>`;

  const syncUrl = () => {
    const q = new URLSearchParams();
    if (tab !== "summary") q.set("v", tab);
    if (lv === "middle" && tab === "map") q.set("lv", "middle");
    if (tab === "map" || tab === "middle") { if (tab === "map" && focusP) q.set("p", focusP); }
    else q.set("s", sel.join(","));
    if (areasSel.length) q.set("a", areasSel.join(","));
    history.replaceState(null, "", `#select/curriculum?${q.toString().replace(/%2C/g, ",")}`);
  };
  const chipHtml = () => schools.map((x) => `<button type="button" class="chip schip ${sel.includes(x.id) ? "on" : ""}" data-id="${esc(x.id)}" aria-pressed="${sel.includes(x.id)}" title="${esc(x.name)}">${nm(x.id, x.name, 36)}</button>`).join("");
  const drawChips = () => {
    // 요약 탭: 본문 위 칩 줄 / 상세 비교 탭: 필터 패널 안의 "학교" 항목
    $("#chipbar").hidden = tab !== "summary";
    $("#chips").innerHTML = chipHtml();
    const fc = $("#fchips"); if (fc) fc.innerHTML = chipHtml();
    // 표시 순서: 국어·영어·수학 / 한국사·사회·과학(한 줄 3개), 나머지는 한 줄 4개. 표의 교과군 정렬은 그대로.
    const ac = $("#achips"); if (ac) ac.innerHTML = AREA7.map((a, i) => `<button type="button" class="chip achip ${i < 4 ? "a4" : "a3"} ${areasSel.includes(a) ? "on" : ""}" data-area="${esc(a)}" aria-pressed="${areasSel.includes(a)}">${esc(a)}</button>`).join("");
    el.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  };
  const drawBody = async () => {
    const body = $("#cview");
    if (tab === "summary") { compare = null; await summaryBody(body, sel); const bf = query.get("bf"); if (bf) { const t = (bf === "1" ? body.querySelector(".bf-area") : body.querySelector(`#bf-${CSS.escape(bf)}`)); if (t) { t.scrollIntoView({ block: "start" }); t.querySelector("details")?.setAttribute("open", ""); } } }
    else if (tab === "map") { compare = null; await mapBody(body, { load, esc, focus: focusP, level: lv === "middle" ? "middle" : "high" }); }
    else if (tab === "middle") { compare = null; await middleBody(body, { load, esc }); }
    else if (tab === "univ") { compare = null; await univBody(body, { load, esc, profile: currentProfile(store), schools, sel }); }
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
    const t = e.target.closest("#tabs a");
    if (t) { e.preventDefault(); tab = t.dataset.tab; if (tab !== "map") focusP = null; refresh(); return; }
    const go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); sel = [go.dataset.go]; tab = "compare"; refresh(); return; }
    const star = e.target.closest(".star");
    if (star) { toggleStar(star.dataset.id); star.textContent = stars().includes(star.dataset.id) ? "★" : "☆"; }
  });
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
  const root = el.firstElementChild;
  let ids = [], need = 0;
  const AW = 72, LW = 150, CW = 190; // 교과군 열·과목 열·학교 열 폭
  const fitMode = () => $(".tw")?.classList.toggle("fit", $(".cmpmain").clientWidth >= need);
  window.addEventListener("resize", fitMode);
  const draw = (next) => {
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
      const arCell = first ? `<td class="ar" rowspan="${spans.get(r.area)}" title="${esc(r.area)}">${esc(r.area)}</td>` : "";
      trs.push(() => `<tr class="${cls}">${arCell}<td class="l">${subjectName(r.name)}</td>${ids.map((id) => cell(r.cells[id])).join("")}</tr>`);
    }
    need = AW + LW + CW * ids.length;
    $("#tbl").style.minWidth = `${need}px`;
    const CH = 24, token = (drawToken = Symbol());
    const head = `<thead><tr><th class="ar">교과군</th><th class="l">과목</th>${ids.map((id, i) => `<th>${nm(id, names[i], 30)}</th>`).join("")}</tr></thead>`;
    const foot = `<tfoot><tr><th class="lf" colspan="2">해당 과목 수</th>${ids.map((id) => `<th>${rows.filter((r) => r.cells[id]).length}</th>`).join("")}</tr></tfoot>`;
    const chunk = (i) => trs.slice(i, i + CH).map((f) => f()).join("");
    $("#tbl").innerHTML = `${head}<tbody>${trs.length ? chunk(0) : `<tr><td colspan="${ids.length + 2}">조건에 맞는 과목이 없어요.</td></tr>`}</tbody>${foot}`;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 16));
    const more = (i) => { if (token !== drawToken || i >= trs.length) return; idle(() => { if (token !== drawToken) return; $("#tbl tbody").insertAdjacentHTML("beforeend", chunk(i)); more(i + CH); }); };
    more(CH);
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

registerPolicy(views, { $, esc, load, store });
registerHome(views, { esc, load, store, nm, stars, toggleStar, nameOf, TERMS, hasLogo: (id) => LOGO_IDS.has(id), profile: () => currentProfile(store), profiles: () => allProfiles(store) });
registerPlanner(views, { esc, load, store });
const filesApi = registerFiles(views, { esc, load, nm });

// 보관함 > 바로가기: 분류별 헤어라인 목록. 공식·공공은 구분해 적고, 확인일을 함께 보여 준다(data/links.json).
views.midlife = async (el) => {
  el.innerHTML = `<div class="ed"><ul class="rows lk">
    <li class="row"><div><h3><a href="#select/curriculum?v=middle">교과서·교과 구성</a></h3><p>중학교 배정 화면에서 학교를 열면 나와요.</p></div></li>
    <li class="row"><div><h3><a href="#schedule?t=life" data-stage="중입">중학교 시기 일정</a></h3><p>중학교 배정·입학 일정을 일정 화면에서 모아 봐요.</p></div></li></ul>
    <p class="muted small">곧 열려요: 중학교 교육과정</p></div>`;
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
function render() {
  const [path, qs] = decodeURIComponent(location.hash.slice(1)).split("?");
  const query = new URLSearchParams(qs || "");
  let id = path || "home";
  if (REDIRECT[id]) { location.replace("#" + REDIRECT[id] + (qs ? "?" + qs : "")); return; } // 옛 주소 → 가까운 화면
  const n = byId.get(id) || byId.get("home");
  const loc = locate(n.id, query) || { tab: TABS[0], group: TABS[0].groups[0], item: TABS[0].groups[0].items[0] };
  const tab = loc.tab;
  document.body.dataset.profile = currentProfile(store).key;
  drawTabs(tab);
  document.title = `${tab.id === "home" ? "" : tab.title + " · "}스쿨 라이프`;
  scrollTo(0, 0);
  const navA = (href, title, on) => `<a href="${href}"${on ? ' aria-current="page"' : ""}>${esc(title)}</a>`;
  const row = (cls, label, links) => `<nav class="subnav${cls}" aria-label="${esc(label)}">${links}</nav>`;
  const sub = (tab.groups.length > 1 ? row(" lvl", `${tab.title} 안의 구분`, tab.groups.map((g) => navA(hrefOf(g.items[0]), g.title, g === loc.group)).join("")) : "")
    + (loc.group.items.length > 1 ? row("", `${tab.title} 안의 화면`, loc.group.items.map((x) => navA(hrefOf(x), x.title, x === loc.item)).join("")) : "");
  const soonL = [...(loc.group.soon || []), ...(tab.soon || [])];
  const soon = soonL.length ? `<p class="soon">곧 열려요: ${soonL.map(esc).join(" · ")}</p>` : "";
  if (n.view === "curriculum" && currentProfile(store).key === "b") { // 프로필 B는 아직 학교가 없다
    $("#main").innerHTML = `${sub}<div id="view"><section class="sec"><div class="empty"><span class="z" aria-hidden="true">0</span><p>${esc(currentProfile(store).name)}의 학교는 아직 없어요.</p><small>고입 이후 학교가 정해지면 과목표가 여기에 들어옵니다.</small><a href="#home">오늘 화면으로 →</a></div></section></div>${soon}`;
    return;
  }
  if (n.view === "curriculum" || n.view === "home") { // 위쪽 공간 절약: 제목 없이 화면이 바로 시작
    $("#main").innerHTML = `${sub}<div id="view"></div>${soon}`;
    views[n.view]($("#view"), query, n).catch(() => ($("#view").innerHTML = GO_ERR));
    return;
  }
  const title = loc.item.title || n.title;
  const lvTag = tab.id === "mid" || tab.id === "high" ? `<span class="lv-tag">${esc(tab.title)} ${esc(loc.group.title)}</span>` : "";
  $("#main").innerHTML = `${sub}<h1 class="ph">${esc(title)}${lvTag}</h1><div id="view"></div>${soon}`;
  if (n.view) views[n.view]($("#view"), query).then(() => { filesApi.afterView(n.view, $("#view")); if (n.view === "credit") decorateSubjectLists($("#view"), load, "4."); if (n.view === "schedule") addCalendar($("#view")); }).catch(() => ($("#view").innerHTML = GO_ERR));
}

addEventListener("hashchange", render);
await initProfiles(load);
{
  const d = new Date(), W = ["일", "월", "화", "수", "목", "금", "토"];
  $("#today").textContent = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}(${W[d.getDay()]})`;
}
mountProfileSwitch([$("#pf")], store, render);
mountSearch($("#srbtn"), { load, store, esc });
render();

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
