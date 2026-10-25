import { MENU, STATUS } from "./menu.js";
import { register as registerPolicy } from "./policy.js";

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
  async home(el) {
    const [schools, summary] = await Promise.all([load("schools"), load("summary")]);
    const s = stars();
    el.innerHTML = `<div class="panel"><b>관심 학교</b><p class="muted">${s.length ? s.map((id) => `<a href="#select/curriculum?v=compare&s=${esc(id)}">${nm(id, nameOf(schools, id), 18)}</a>`).join(" ") : "비교 화면의 ☆을 누르면 여기에 모입니다."}</p></div>
      <div class="panel"><b>편제표 등록 현황</b><p class="muted">${summary.length}개교 · ${summary[0].entryYear}학년도 입학생(대입 ${summary[0].entryYear + 3}학년도) 기준</p>
      <div class="cards">${summary.map((m) => `<a href="#select/curriculum"><b>${nm(m.schoolId, m.schoolName, 22)}</b><div class="muted">${esc(m.region || "")} · ${esc(m.schoolType || "")} · ${esc(m.founding || "")}</div><div>지정 ${m.creditsRequired} / 선택 ${m.creditsElective}학점</div></a>`).join("")}</div></div>
      <div class="panel"><b>이번 달 할 일</b><p class="muted">일정 데이터 연결 예정</p></div>`;
  },

  async curriculum(el, query, node) {
    await curriculumView(el, query, node);
  },

  async sources(el) {
    const schools = await load("schools");
    el.innerHTML = schools.map((s) => `<div class="panel"><b>${esc(s.name)}</b><ul>${(s._meta?.source || []).map((x) => `<li>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name)} <span class="muted">${esc(x.kind)} · ${esc(x.retrieved || "")}</span></li>`).join("")}</ul></div>`).join("");
  },

  async status(el) {
    const [schools, summary] = await Promise.all([load("schools"), load("summary")]);
    el.innerHTML = `<div class="tw"><table><thead><tr><th class="l">학교</th><th>입학학년도</th><th>정보 수집일</th><th>편제표 신뢰도</th><th>열린 flag</th><th>구분 미표기 행</th><th>확인 필요</th></tr></thead><tbody>${summary.map((m) => { const sc = schools.find((s) => s.id === m.schoolId); return `<tr><td class="l">${esc(m.schoolName)}</td><td>${m.entryYear}</td><td>${esc(sc?._meta?.updated || "-")}</td><td>${esc(m.confidence)}</td><td>${m.flagsOpen}</td><td>${m.kindMissingRows}</td><td>${m.reviewCount}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="muted">unverified = 사진 대조 전 / reported = 보도·사용자 확인 / verified = 대조 완료</p>
      <p class="note">편제표 값은 AI가 학교 배부 사진에서 옮긴 것으로, 일부(flag 22행)만 사진과 대조했습니다. 수능 범위는 2028 통합형 수능 기준 <b>추정</b>이며, 편제표는 개설 가능 <b>후보</b>입니다. 중요한 결정 전에는 원본으로 확인하세요.</p>`;
  },
};

// ---- 학교별 편제표: 학교 칩(on/off, 최대 4개교) + 탭(요약 / 상세 비교) ----
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
  const chipHtml = () => schools.map((x) => `<button type="button" class="chip ${sel.includes(x.id) ? "on" : ""}" data-id="${esc(x.id)}" aria-pressed="${sel.includes(x.id)}">${nm(x.id, x.name, 18)}</button>`).join("");
  const drawChips = () => {
    // 요약 탭: 본문 위 칩 줄 / 상세 비교 탭: 필터 패널 안의 "학교" 항목
    $("#chipbar").hidden = tab === "compare";
    $("#chips").innerHTML = chipHtml();
    const fc = $("#fchips"); if (fc) fc.innerHTML = chipHtml();
    const ac = $("#achips"); if (ac) ac.innerHTML = facets.areas.map((a) => `<button type="button" class="chip achip ${areasSel.includes(a) ? "on" : ""}" data-area="${esc(a)}" aria-pressed="${areasSel.includes(a)}">${esc(a)}</button>`).join("");
    const fs = $("#fsum"); if (fs) fs.textContent = `학교 ${sel.length}/${schools.length}`;
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

// 창체(창의적 체험활동) 블록: 총 학점·시수, 영역별 시수 합계, 학기별 보기(기본 접힘). 영역 이름은 데이터 그대로.
function creativeBlock(m, cur) {
  const c = cur?.creative;
  if (!c?.perTerm) return "";
  const terms = TERMS.filter((t) => c.perTerm[t]);
  const areas = [...new Set(terms.flatMap((t) => Object.keys(c.perTerm[t])))];
  const sum = (a) => terms.reduce((n, t) => n + (c.perTerm[t][a] || 0), 0);
  const extra = [c.standardHours != null ? `표준 ${c.standardHours}` : "", c.operatedHours != null ? `운영 ${c.operatedHours}` : ""].filter(Boolean).join(" · ");
  return `<div class="cre"><div><b>창체</b> <span class="cr1">${m.creditsCreative}학점 · ${c.totalHours}시간</span></div>
    <div class="muted small">${areas.map((a) => `${esc(a)} ${sum(a)}`).join(" · ")}</div>
    <details><summary>학기별 보기</summary><div class="crew"><table class="crt"><thead><tr><th></th>${terms.map((t) => `<th>${t}</th>`).join("")}</tr></thead><tbody>${areas.map((a) => `<tr><th>${esc(a)}</th>${terms.map((t) => `<td>${c.perTerm[t][a] ?? "-"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${extra ? `<div class="muted small">${esc(extra)} (데이터 표기)</div>` : ""}</details></div>`;
}

// 요약 카드: 선택한 학교만 가로로 나란히
async function summaryBody(el, ids) {
  const [schools, summary, subjects, curricula] = await Promise.all([load("schools"), load("summary"), load("subjects"), load("curricula")]);
  const st = stars();
  const card = (m) => {
    const sc = schools.find((x) => x.id === m.schoolId) || {};
    const uniq = subjects.filter((x) => x.schoolCount === 1 && x.offeredBy[0] === m.schoolId);
    const total = m.creditsRequired + m.creditsElective;
    return `<section class="school"><header><h3>${nm(m.schoolId, m.schoolName, 34)} <button class="star" data-id="${esc(m.schoolId)}" aria-label="관심">${st.includes(m.schoolId) ? "★" : "☆"}</button></h3>
      <div class="muted">${esc([m.region, m.schoolType, m.founding, m.gender].filter(Boolean).join(" · "))}</div>
      <div class="muted">${esc(m.assignment || "")}</div></header>
      <div class="big">총 ${m.creditsTotal}학점 <span class="muted">(교과 ${m.creditsSubject} + 창체 ${m.creditsCreative})</span></div>
      <div class="bar" title="지정 ${m.creditsRequired} / 선택 ${m.creditsElective}"><span class="req" style="width:${(m.creditsRequired / total) * 100}%">지정 ${m.creditsRequired}</span><span class="ele" style="width:${(m.creditsElective / total) * 100}%">선택 ${m.creditsElective}</span></div>
      <div class="terms">${TERMS.map((t) => { const b = m.byTerm[t], tot = b.required + b.elective || 1; return `<div><div class="tnum"><b class="r">${b.required}</b><b class="e">${b.elective}</b></div><div class="col"><i class="e" style="height:${(b.elective / tot) * 100}%"></i><i class="r" style="height:${(b.required / tot) * 100}%"></i></div><span>${t}</span></div>`; }).join("")}</div>
      <div class="muted small">학기별 학점: <b class="rk">지정</b> · <b class="ek">선택</b> (막대 위 숫자 = 지정 / 선택, 막대 = 비중)</div>
      <dl class="stats"><div><dt>지정 과목</dt><dd>${m.requiredCount}</dd></div><div><dt>택n 묶음</dt><dd>${m.groupCount}</dd></div><div><dt>골라야 하는 과목</dt><dd>${m.pickTotal}</dd></div>
      <div><dt>선택 후보</dt><dd>${m.candidateSubjects}</dd></div><div><dt>선택 폭</dt><dd>${m.breadth}</dd></div><div><dt>첫 선택 학기</dt><dd>${esc(m.firstElectiveTerm || "-")}</dd></div></dl>
      ${creativeBlock(m, curricula.find((x) => x.schoolId === m.schoolId))}
      <details><summary>이 학교에만 있는 과목 (${uniq.length})</summary><p>${uniq.map((x) => esc(x.name)).join(", ") || "-"}</p></details>
      <details><summary>메모</summary><textarea data-memo="${esc(m.schoolId)}" placeholder="이 브라우저에만 저장됩니다">${esc(store.get("memo:" + m.schoolId, ""))}</textarea></details>
      <div class="foot"><a class="btn" href="#" data-go="${esc(m.schoolId)}">이 학교 과목 보기</a>
      <span class="muted small">${m.reviewCount ? `⚠ 확인 필요 ${m.reviewCount}건 · ` : ""}수집 ${esc(sc._meta?.updated || "-")}</span></div></section>`;
  };
  const shown = ids.map((id) => summary.find((m) => m.schoolId === id)).filter(Boolean);
  el.innerHTML = shown.length ? `<div class="schoolgrid cols${shown.length > 4 ? "n" : shown.length}">${shown.map(card).join("")}</div>` : '<p class="note">위에서 학교를 하나 이상 선택하세요.</p>';
}

// 상세 비교: 필터 + 선택 학교를 열 단위로 나란히
async function compareShell(el, onReset, getAreas) {
  const [schools, facets, subjects, offerings, groups] = await Promise.all([load("schools"), load("facets"), load("subjects"), load("offerings"), load("groups")]);
  const subj = new Map(subjects.map((x) => [x.subjectKey, x]));
  const gmap = new Map(groups.map((g) => [g.id, g]));
  el.innerHTML = `<div class="cmp">
    <details class="panel filters" ${innerWidth > 1000 ? "open" : ""}><summary><b>필터</b> <span class="muted small"><span id="fsum"></span> · <span id="cnt"></span></span></summary><div class="fbody">
      <div class="fgroup"><span class="flabel">학교</span><div class="chips" id="fchips"></div></div>
      <div class="fgroup"><span class="flabel">과목명</span><input type="search" id="q" placeholder="과목명 검색"></div>
      <div class="fgroup"><span class="flabel">교과군 (여러 개 선택, 없으면 전체)</span><div class="chips" id="achips"></div></div>
      <div class="fgroup"><span class="flabel">이수 방식</span><select id="sel">${options([{ v: "school", t: "학교 지정" }, { v: "student", t: "학생 선택" }, { v: "outside", t: "학교 밖" }], "전체")}</select></div>
      <div class="fgroup"><span class="flabel">구분</span><select id="kind">${options(["공통", "일반", "진로", "융합"], "전체")}</select></div>
      <div class="fgroup"><span class="flabel">학년</span><select id="grade">${options([{ v: "1", t: "1학년" }, { v: "2", t: "2학년" }, { v: "3", t: "3학년" }], "전체")}</select></div>
      <div class="fgroup"><span class="flabel">학기</span><select id="term">${options(TERMS, "전체")}</select></div>
      <div class="fgroup"><span class="flabel">학점</span><select id="cr">${options([1, 2, 3, 4].map((v) => ({ v: String(v), t: `${v}학점` })), "전체")}</select></div>
      <div class="fgroup"><span class="flabel">택n 묶음 유형</span><select id="pool">${options(Object.entries(POOL).map(([v, t]) => ({ v, t })), "전체")}</select></div>
      <div class="fgroup"><span class="flabel">확인 필요 행</span><select id="chk">${options([...Object.entries(CHECK).map(([v, t]) => ({ v, t })), { v: "any", t: "하나라도 해당" }], "전체")}</select></div>
      <div class="fgroup"><span class="flabel">수능 범위(추정)</span><select id="csat">${options([{ v: "in", t: "출제 범위" }, { v: "base", t: "기초(공통)" }, { v: "out", t: "제외" }], "전체")}</select></div>
      <div class="fgroup"><label><input type="checkbox" id="diff"> 학교 간 차이 나는 과목만</label><label><input type="checkbox" id="one"> 한 학교에만 있는 과목</label></div>
      <button id="reset" type="button">필터 초기화</button>
    </div></details>
    <div class="cmpmain"><div class="tw"><table id="tbl"></table></div></div></div>`;
  const root = el.firstElementChild;
  let ids = [], need = 0;
  const AW = 72, LW = 150, CW = 190; // 교과군 열·과목 열·학교 열 폭
  const fitMode = () => $(".tw")?.classList.toggle("fit", $(".cmpmain").clientWidth >= need);
  window.addEventListener("resize", fitMode);
  const draw = (next) => {
    if (next) ids = next;
    const f = { q: $("#q").value.replace(/\s/g, ""), areas: getAreas(), sel: $("#sel").value, kind: $("#kind").value, term: $("#term").value, grade: $("#grade").value, cr: $("#cr").value, pool: $("#pool").value, chk: $("#chk").value, csat: $("#csat").value, diff: $("#diff").checked, one: $("#one").checked };
    if (!ids.length) { $("#tbl").innerHTML = ""; $("#cnt").textContent = "위에서 학교를 하나 이상 선택하세요."; return; }
    const by = new Map();
    for (const o of offerings) {
      if (!ids.includes(o.schoolId) || (f.areas.length && !f.areas.includes(o.area)) || (f.sel && o.selection !== f.sel) || (f.term && o.term !== f.term) || (f.csat && o.csatScope !== f.csat)) continue;
      if ((f.grade && String(o.grade) !== f.grade) || (f.cr && String(o.credits) !== f.cr)) continue;
      if (f.pool && gmap.get(o.groupId)?.poolType !== f.pool) continue;
      if (f.chk) {
        const is = { inferred: o.kindStatus === "inferred", unmarked: o.kindStatus === "unmarked", flag: o.openFlagIds.length > 0 };
        if (!(f.chk === "any" ? is.inferred || is.unmarked || is.flag : is[f.chk])) continue;
      }
      if (f.kind && !o.kind.includes(f.kind) && o.kindGuess !== f.kind) continue;
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
    $("#tbl").innerHTML = `<thead><tr><th class="ar">교과군</th><th class="l">과목</th>${ids.map((id, i) => `<th>${nm(id, names[i], 22)}</th>`).join("")}</tr></thead><tbody>${html || `<tr><td colspan="${ids.length + 2}">조건에 맞는 과목이 없습니다.</td></tr>`}</tbody>
      <tfoot><tr><th class="lf" colspan="2">해당 과목 수</th>${ids.map((id) => `<th>${rows.filter((r) => r.cells[id]).length}</th>`).join("")}</tr></tfoot>`;
    fitMode();
    $("#cnt").textContent = `${rows.length}개 과목`;
  };
  root.addEventListener("input", () => draw());
  root.addEventListener("change", () => draw());
  $("#reset").addEventListener("click", () => {
    ["q", "sel", "kind", "term", "grade", "cr", "pool", "chk", "csat"].forEach((id) => ($("#" + id).value = ""));
    ["diff", "one"].forEach((id) => ($("#" + id).checked = false));
    draw();
    onReset?.();
  });
  return { root, draw };
}

registerPolicy(views, { $, esc, load });

function render() {
  const [path, qs] = decodeURIComponent(location.hash.slice(1)).split("?");
  const query = new URLSearchParams(qs || "");
  const id = path || "home";
  const n = byId.get(id) || byId.get("home");
  drawNav(n.id);
  $("#nav").classList.remove("open");
  if (n.view === "curriculum") { // 표를 위로: 브레드크럼·설명 없이 제목과 탭을 한 줄에
    $("#main").innerHTML = '<div id="view"></div>';
    views.curriculum($("#view"), query, n).catch(() => ($("#view").innerHTML = '<p class="note">데이터를 불러오지 못했습니다. 페이지를 새로고침해 보세요.</p>'));
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
  if (n.view) views[n.view]($("#view"), query).catch(() => ($("#view").innerHTML = '<p class="note">데이터를 불러오지 못했습니다. 페이지를 새로고침해 보세요.</p>'));
}

$("#burger").addEventListener("click", () => $("#nav").classList.toggle("open"));
addEventListener("hashchange", render);
render();
