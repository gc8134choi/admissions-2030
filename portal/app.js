import { MENU, STATUS } from "./menu.js";
import { register as registerPolicy } from "./policy.js";
import { registerHome } from "./home.js";
import { registerFiles } from "./files.js";

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
const badge = (s) => `<span class="badge ${s}">${STATUS[s]}</span>`;

function drawNav(activeId) {
  const holds = (n) => n.id === activeId || (n.children || []).some(holds);
  const li = (n, top) => `<li class="${top ? "top-item" : ""} ${top && holds(n) ? "has-on" : ""}"><a href="#${n.id}" class="${n.id === activeId ? "on" : ""}">${n.icon ? n.icon + " " : ""}${esc(n.title)}${badge(n.status)}</a>${n.children ? `<ul>${n.children.map((c) => li(c)).join("")}</ul>` : ""}</li>`;
  $("#nav").innerHTML = `<ul>${MENU.map((n) => li(n, true)).join("")}</ul>`;
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
const logo = (id, name, px = 20) => (LOGO_IDS.has(id) ? `<img class="logo" src="img/schools/128/${esc(id)}.png" alt="${esc(name)} 로고" width="${px}" height="${px}" style="--lg:${px}px">` : "");
const nm = (id, name, px) => `<span class="nm">${logo(id, name, px)}<span>${esc(name)}</span></span>`;
const SLOT = { required: "지정", elective: "선택", outside: "교외" };
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
    el.innerHTML = `<div class="tw"><table><thead><tr><th class="l">학교</th><th>입학학년도</th><th>정보 수집일</th><th>편제표 신뢰도</th><th>열린 flag</th><th>구분 미표기 행</th><th>확인 필요</th></tr></thead><tbody>${summary.map((m) => { const sc = schools.find((s) => s.id === m.schoolId); return `<tr><td class="l">${esc(m.schoolName)}</td><td>${m.entryYear}</td><td>${esc(sc?._meta?.updated || "-")}</td><td>${esc(m.confidence)}</td><td>${m.flagsOpen}</td><td>${m.kindMissingRows}</td><td>${m.reviewCount}</td></tr>`; }).join("")}</tbody></table></div>
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
  sel: [["school", "학교 지정"], ["student", "학생 선택"], ["outside", "학교 밖"]],
  kind: ["공통", "일반", "진로", "융합"].map((k) => [k, k]),
  csat: [["in", "출제 범위"], ["base", "기초(공통)"], ["out", "제외"]],
};
const fchips = (g) => `<div class="fcs">${FOPT[g].map(([v, t]) => `<button type="button" class="fchip" data-g="${g}" data-v="${esc(v)}" aria-pressed="false">${esc(t)}</button>`).join("")}</div>`;
const termGrid = () => `<div class="ftg">${[1, 2, 3].map((g) => `<button type="button" class="fchip fgr" data-grade="${g}" aria-pressed="false">${g}학년</button><button type="button" class="fchip" data-g="terms" data-v="${g}-1" aria-pressed="false">${g}-1</button><button type="button" class="fchip" data-g="terms" data-v="${g}-2" aria-pressed="false">${g}-2</button>`).join("")}</div>`;
const TERMS = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];

async function curriculumView(el, query, node) {
  const [schools, summary, facets] = await Promise.all([load("schools"), load("summary"), load("facets")]);
  const known = (id) => schools.some((x) => x.id === id);
  let sel = query.has("s") ? query.get("s").split(",").filter(known) : schools.map((x) => x.id);
  sel = [...new Set(sel)];
  let areasSel = facets.areas.filter((a) => (query.get("a") || "").split(",").includes(a)); // 비어 있으면 전체
  let tab = query.get("v") === "compare" ? "compare" : "summary";
  let compare = null; // 상세 비교 화면(필터 포함)은 한 번만 만들고 탭 전환 때 재사용한다

  el.innerHTML = `<div class="phead"><h2>${esc(node?.title || "학교별 편제표")} ${node ? badge(node.status) : ""}</h2>
      <div class="subtabs" id="tabs"><a href="#" data-tab="summary">학교별 요약</a><a href="#" data-tab="compare">상세 비교</a></div></div>
    <div class="chipbar" id="chipbar"><span class="flabel">학교</span><div class="chips" id="chips"></div></div>
    <div id="cview"></div>`;

  const syncUrl = () => {
    const q = new URLSearchParams();
    if (tab === "compare") q.set("v", "compare");
    q.set("s", sel.join(","));
    if (areasSel.length) q.set("a", areasSel.join(","));
    history.replaceState(null, "", `#select/curriculum?${q.toString().replace(/%2C/g, ",")}`);
  };
  const chipHtml = () => schools.map((x) => `<button type="button" class="chip schip ${sel.includes(x.id) ? "on" : ""}" data-id="${esc(x.id)}" aria-pressed="${sel.includes(x.id)}" title="${esc(x.name)}">${nm(x.id, x.name, 36)}</button>`).join("");
  const drawChips = () => {
    // 요약 탭: 본문 위 칩 줄 / 상세 비교 탭: 필터 패널 안의 "학교" 항목
    $("#chipbar").hidden = tab === "compare";
    $("#chips").innerHTML = chipHtml();
    const fc = $("#fchips"); if (fc) fc.innerHTML = chipHtml();
    // 표시 순서: 국어·영어·수학 / 한국사·사회·과학(한 줄 3개), 나머지는 한 줄 4개. 표의 교과군 정렬은 그대로.
    const TOP = ["국어", "영어", "수학", "한국사", "사회", "과학"].filter((a) => facets.areas.includes(a));
    const order = [...TOP, ...facets.areas.filter((a) => !TOP.includes(a))];
    const ac = $("#achips"); if (ac) ac.innerHTML = order.map((a) => `<button type="button" class="chip achip ${TOP.includes(a) ? "a3" : "a4"} ${areasSel.includes(a) ? "on" : ""}" data-area="${esc(a)}" aria-pressed="${areasSel.includes(a)}">${esc(a).replace(/([/·])/g, "$1<wbr>")}</button>`).join("");
    el.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  };
  const drawBody = async () => {
    const body = $("#cview");
    if (tab === "summary") { compare = null; await summaryBody(body, sel); }
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
      areasSel = facets.areas.filter((x) => (x === a ? !areasSel.includes(a) : areasSel.includes(x)));
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
    if (t) { e.preventDefault(); tab = t.dataset.tab; refresh(); return; }
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
  return `<div class="sn"><div class="sn-h"><b>특이 사항</b> <span class="sn-tag">사진 대조 전 ${esc(status || "추정")}</span></div>
    <ul>${list.slice(0, 5).map(li).join("")}</ul>${list.length > 5 ? `<details><summary>나머지 ${list.length - 5}줄</summary><ul>${list.slice(5).map(li).join("")}</ul></details>` : ""}</div>`;
}

// 요약 카드: 선택한 학교만 가로로 나란히
async function summaryBody(el, ids) {
  const [schools, summary, curricula] = await Promise.all([load("schools"), load("summary"), load("curricula")]);
  const notes = await load("school-notes").catch(() => null); // 특이 사항(없으면 생략)
  const st = stars();
  const card = (m) => {
    const sc = schools.find((x) => x.id === m.schoolId) || {};
    const total = m.creditsRequired + m.creditsElective;
    return `<section class="school"><header><h3>${nm(m.schoolId, m.schoolName, 34)} <button class="star" data-id="${esc(m.schoolId)}" aria-label="관심">${st.includes(m.schoolId) ? "★" : "☆"}</button></h3>
      ${(() => { const l1 = ["region", "schoolType", "founding", "gender"].filter((k) => vary(k)).map((k) => m[k]).filter(Boolean).join(" · "); return l1 ? `<div class="muted">${esc(l1)}</div>` : ""; })()}
      ${vary("assignment") && m.assignment ? `<div class="muted">${esc(m.assignment)}</div>` : ""}</header>
      <div class="big">총 ${m.creditsTotal}학점 <span class="muted">(교과 ${m.creditsSubject} + 창체 ${m.creditsCreative})</span></div>
      <div class="bar" title="지정 ${m.creditsRequired} / 선택 ${m.creditsElective}"><span class="req" style="width:${(m.creditsRequired / total) * 100}%">지정 ${m.creditsRequired}</span><span class="ele" style="width:${(m.creditsElective / total) * 100}%">선택 ${m.creditsElective}</span></div>
      <div class="terms">${TERMS.map((t) => { const b = m.byTerm[t], tot = b.required + b.elective || 1; return `<div><div class="tnum"><b class="r">${b.required}</b><b class="e">${b.elective}</b></div><div class="col"><i class="e" style="height:${(b.elective / tot) * 100}%"></i><i class="r" style="height:${(b.required / tot) * 100}%"></i></div><span>${t}</span></div>`; }).join("")}</div>
      <div class="muted small">학기별 학점: <b class="rk">지정</b> · <b class="ek">선택</b> (막대 위 숫자 = 지정 / 선택, 막대 = 비중)</div>
      <dl class="stats"><div><dt>지정 과목</dt><dd>${m.requiredCount}</dd></div><div><dt>택n 묶음</dt><dd>${m.groupCount}</dd></div><div><dt>골라야 하는 과목</dt><dd>${m.pickTotal}</dd></div>
      <div><dt>선택 후보</dt><dd>${m.candidateSubjects}</dd></div><div><dt>선택 폭</dt><dd>${m.breadth}</dd></div><div><dt>첫 선택 학기</dt><dd>${esc(m.firstElectiveTerm || "-")}</dd></div></dl>
      ${creativeBlock(m, curricula.find((x) => x.schoolId === m.schoolId))}
      ${notesBlock(notes?.schools?.find((x) => x.schoolId === m.schoolId)?.notes, notes?._meta?.status)}
      <details><summary>메모</summary><textarea data-memo="${esc(m.schoolId)}" placeholder="이 브라우저에만 저장됩니다">${esc(store.get("memo:" + m.schoolId, ""))}</textarea></details>
      <div class="foot"><a class="btn" href="#" data-go="${esc(m.schoolId)}">이 학교 과목 보기</a>
      <span class="muted small">${m.reviewCount ? `⚠ 확인 필요 ${m.reviewCount}건 · ` : ""}수집 ${esc(sc._meta?.updated || "-")}</span></div></section>`;
  };
  const shown = ids.map((id) => summary.find((m) => m.schoolId === id)).filter(Boolean);
  // 비교 중인 학교들 사이에 값이 다른 항목만 표시(학교가 하나뿐이면 전부 표시)
  const vary = (k) => shown.length < 2 || new Set(shown.map((x) => x[k] ?? "")).size > 1;
  const common = notes?.common?.length ? `<div class="sn-common"><span class="sn-tag">사진 대조 전 ${esc(notes._meta?.status || "추정")}</span> ${notes.common.map(esc).join(" ")}</div>` : "";
  el.innerHTML = shown.length ? `${common}<div class="schoolgrid cols${shown.length > 4 ? "n" : shown.length}">${shown.map(card).join("")}</div>` : '<p class="note">위에서 학교를 하나 이상 선택하세요.</p>';
}

// 상세 비교: 필터 + 선택 학교를 열 단위로 나란히
async function compareShell(el, onReset, getAreas) {
  const [schools, facets, subjects, offerings, groups] = await Promise.all([load("schools"), load("facets"), load("subjects"), load("offerings"), load("groups")]);
  const subj = new Map(subjects.map((x) => [x.subjectKey, x]));
  const gmap = new Map(groups.map((g) => [g.id, g]));
  el.innerHTML = `<div class="cmp">
    <div class="panel filters${innerWidth > 1000 ? "" : " fold"}"><div class="fhead"><button type="button" class="ib" id="ftog" aria-label="필터 접기/펼치기" title="필터 접기/펼치기">${ICON.filter}<span class="ftxt">필터</span></button><button type="button" class="ib" id="fsrch" aria-label="과목명 검색" title="과목명 검색">${ICON.search}</button></div>
      <div class="fsr" hidden><input type="search" id="q" placeholder="과목명" autocomplete="off"><button type="button" class="ib" id="fclr" aria-label="검색 닫기" title="검색 닫기(Esc)">×</button></div><div class="fbody">
      <div class="fgroup"><span class="flabel">학교</span><div class="chips" id="fchips"></div></div>
      <div class="fgroup"><span class="flabel">교과군 (여러 개 선택, 없으면 전체)</span><div class="chips" id="achips"></div></div>
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
      if (!ids.includes(o.schoolId) || (f.areas.length && !f.areas.includes(o.area)) || (f.sel.length && !f.sel.includes(o.selection)) || (f.terms.length && !f.terms.includes(o.term)) || (f.csat.length && !f.csat.includes(o.csatScope))) continue;
      if (f.pool && gmap.get(o.groupId)?.poolType !== f.pool) continue;
      if (f.kind.length && !f.kind.some((k) => o.kind.includes(k) || o.kindGuess === k)) continue;
      if (f.q && !o.subject.replace(/\s/g, "").includes(f.q)) continue;
      if (f.one && subj.get(o.subjectKey)?.schoolCount !== 1) continue;
      if (!by.has(o.subjectKey)) by.set(o.subjectKey, { area: o.area, name: subj.get(o.subjectKey)?.name || o.subject, cells: {} });
      (by.get(o.subjectKey).cells[o.schoolId] ||= []).push(o);
    }
    let rows = [...by.values()];
    if (f.diff) rows = rows.filter((r) => ids.some((id) => !r.cells[id]));
    // 정렬: 교과군 → 지정 → 선택 → 구분(공통·일반·진로·융합, 미표기 마지막) → 학점 내림차순 → 과목명
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
    let area = "", html = "", ai = -1;
    for (const r of rows) {
      const first = r.area !== area;
      if (first) { area = r.area; ai++; }
      html += `<tr class="ra${ai % 2}${first ? " af" : ""}">${first ? `<td class="ar" rowspan="${spans.get(r.area)}" title="${esc(r.area)}">${esc(r.area)}</td>` : ""}<td class="l">${esc(r.name)}</td>${ids.map((id) => cell(r.cells[id])).join("")}</tr>`;
    }
    need = AW + LW + CW * ids.length;
    $("#tbl").style.minWidth = `${need}px`;
    $("#tbl").innerHTML = `<thead><tr><th class="ar">교과군</th><th class="l">과목</th>${ids.map((id, i) => `<th>${nm(id, names[i], 30)}</th>`).join("")}</tr></thead><tbody>${html || `<tr><td colspan="${ids.length + 2}">조건에 맞는 과목이 없습니다.</td></tr>`}</tbody>
      <tfoot><tr><th class="lf" colspan="2">해당 과목 수</th>${ids.map((id) => `<th>${rows.filter((r) => r.cells[id]).length}</th>`).join("")}</tr></tfoot>`;
    fitMode();
  };
  root.addEventListener("input", () => draw());
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
  return { root, draw };
}

registerPolicy(views, { $, esc, load });
registerHome(views, { esc, load, store, nm, stars, toggleStar, nameOf, TERMS });
const filesApi = registerFiles(views, { esc, load, nm });

function render() {
  const [path, qs] = decodeURIComponent(location.hash.slice(1)).split("?");
  const query = new URLSearchParams(qs || "");
  const id = path || "home";
  const n = byId.get(id) || byId.get("home");
  drawNav(n.id);
  $("#nav").classList.remove("open");
  if (n.view === "curriculum" || n.view === "home") { // 위쪽 공간 절약: 브레드크럼·설명 없이 화면이 바로 시작
    $("#main").innerHTML = '<div id="view"></div>';
    views[n.view]($("#view"), query, n).catch(() => ($("#view").innerHTML = '<p class="note">데이터를 불러오지 못했습니다. 페이지를 새로고침해 보세요.</p>'));
    return;
  }
  const kids = n.children
    ? `<div class="cards">${n.children.map((c) => `<a href="#${c.id}"><b>${esc(c.title)}</b> ${badge(c.status)}<div class="muted">${esc(c.desc || (c.children ? c.children.map((x) => x.title).join(" · ") : ""))}</div></a>`).join("")}</div>`
    : "";
  const parts = n.parts && !n.view ? `<div class="panel"><b>예정 구성</b><ul>${n.parts.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>` : "";
  $("#main").innerHTML = `<div class="crumb">${trail(n).map((t) => esc(t.title)).join(" › ")}</div>
    <h2>${esc(n.title)} ${badge(n.status)}</h2><p class="muted">${esc(n.desc || "")}</p>
    ${n.status !== "v1" ? '<p class="note">아직 구현 전인 메뉴입니다. 구조 확인용 자리표시입니다.</p>' : ""}
    <div id="view"></div>${parts}${kids}`;
  if (n.view) views[n.view]($("#view"), query).then(() => filesApi.afterView(n.view, $("#view"))).catch(() => ($("#view").innerHTML = '<p class="note">데이터를 불러오지 못했습니다. 페이지를 새로고침해 보세요.</p>'));
}

$("#burger").addEventListener("click", () => $("#nav").classList.toggle("open"));
addEventListener("hashchange", render);
render();
