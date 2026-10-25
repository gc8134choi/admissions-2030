import { MENU, STATUS } from "./menu.js";

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
  const li = (n, top) => `<li class="${top ? "top-item" : ""}"><a href="#${n.id}" class="${n.id === activeId ? "on" : ""}">${n.icon ? n.icon + " " : ""}${esc(n.title)}${badge(n.status)}</a>${n.children ? `<ul>${n.children.map((c) => li(c)).join("")}</ul>` : ""}</li>`;
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
const SLOT = { required: "지정", elective: "선택", outside: "교외" };
const CSAT = { in: "포함", base: "기초", out: "제외", none: "-" };
const dataNote = '<p class="note">편제표 값은 AI가 학교 배부 사진에서 옮긴 것으로, 일부(flag 22행)만 사진과 대조했습니다. 수능 범위는 2028 통합형 수능 기준 <b>추정</b>이며, 편제표는 개설 가능 <b>후보</b>입니다. 중요한 결정 전에는 원본으로 확인하세요.</p>';
const options = (items, all) => `${all ? `<option value="">${esc(all)}</option>` : ""}${items.map((v) => `<option value="${esc(v.v ?? v)}">${esc(v.t ?? v)}</option>`).join("")}`;
const kindOf = (o) => (o.primaryKind ? o.primaryKind + (o.kindStatus === "inferred" ? "?" : "") : "미표기");

// ---- 뷰 ----
const views = {
  async home(el) {
    const [schools, summary] = await Promise.all([load("schools"), load("summary")]);
    const s = stars();
    el.innerHTML = `<div class="panel"><b>관심 학교</b><p class="muted">${s.length ? s.map((id) => `<a href="#select/curriculum?v=compare&s=${esc(id)}">${esc(nameOf(schools, id))}</a>`).join(", ") : "비교 화면의 ☆을 누르면 여기에 모입니다."}</p></div>
      <div class="panel"><b>편제표 등록 현황</b><p class="muted">${summary.length}개교 · ${summary[0].entryYear}학년도 입학생(대입 ${summary[0].entryYear + 3}학년도) 기준</p>
      <div class="cards">${summary.map((m) => `<a href="#select/curriculum"><b>${esc(m.schoolName)}</b><div class="muted">${esc(m.region || "")} · ${esc(m.schoolType || "")} · ${esc(m.founding || "")}</div><div>지정 ${m.creditsRequired} / 선택 ${m.creditsElective}학점</div></a>`).join("")}</div></div>
      <div class="panel"><b>이번 달 할 일</b><p class="muted">일정 데이터 연결 예정</p></div>`;
  },

  async curriculum(el, query) {
    await (query.get("v") === "compare" ? compareView : summaryView)(el, query);
  },

  async sources(el) {
    const schools = await load("schools");
    el.innerHTML = schools.map((s) => `<div class="panel"><b>${esc(s.name)}</b><ul>${(s._meta?.source || []).map((x) => `<li>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name)} <span class="muted">${esc(x.kind)} · ${esc(x.retrieved || "")}</span></li>`).join("")}</ul></div>`).join("");
  },

  async status(el) {
    const [schools, summary] = await Promise.all([load("schools"), load("summary")]);
    el.innerHTML = `<div class="tw"><table><thead><tr><th class="l">학교</th><th>입학학년도</th><th>정보 수집일</th><th>편제표 신뢰도</th><th>열린 flag</th><th>구분 미표기 행</th><th>확인 필요</th></tr></thead><tbody>${summary.map((m) => { const sc = schools.find((s) => s.id === m.schoolId); return `<tr><td class="l">${esc(m.schoolName)}</td><td>${m.entryYear}</td><td>${esc(sc?._meta?.updated || "-")}</td><td>${esc(m.confidence)}</td><td>${m.flagsOpen}</td><td>${m.kindMissingRows}</td><td>${m.reviewCount}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="muted">unverified = 사진 대조 전 / reported = 보도·사용자 확인 / verified = 대조 완료</p>`;
  },
};

// ---- 학교별 편제표: 요약 화면 ----
async function summaryView(el) {
  const [schools, summary, subjects] = await Promise.all([load("schools"), load("summary"), load("subjects")]);
  const st = stars(), terms = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];
  const card = (m) => {
    const sc = schools.find((x) => x.id === m.schoolId) || {};
    const uniq = subjects.filter((x) => x.schoolCount === 1 && x.offeredBy[0] === m.schoolId);
    const total = m.creditsRequired + m.creditsElective;
    return `<section class="school"><header><h3>${esc(m.schoolName)} <button class="star" data-id="${esc(m.schoolId)}" aria-label="관심">${st.includes(m.schoolId) ? "★" : "☆"}</button></h3>
      <div class="muted">${esc([m.region, m.schoolType, m.founding, m.gender].filter(Boolean).join(" · "))}</div>
      <div class="muted">${esc(m.assignment || "")}</div></header>
      <div class="big">총 ${m.creditsTotal}학점 <span class="muted">(교과 ${m.creditsSubject} + 창체 ${m.creditsCreative})</span></div>
      <div class="bar" title="지정 ${m.creditsRequired} / 선택 ${m.creditsElective}"><span class="req" style="width:${(m.creditsRequired / total) * 100}%">지정 ${m.creditsRequired}</span><span class="ele" style="width:${(m.creditsElective / total) * 100}%">선택 ${m.creditsElective}</span></div>
      <div class="terms">${terms.map((t) => { const b = m.byTerm[t], tot = b.required + b.elective || 1; return `<div><div class="col"><i style="height:${(b.elective / tot) * 100}%"></i></div><span>${t}</span><b>${b.elective}</b></div>`; }).join("")}</div>
      <div class="muted small">학기별 선택 학점 (막대 = 선택 비중)</div>
      <dl class="stats"><div><dt>지정 과목</dt><dd>${m.requiredCount}</dd></div><div><dt>택n 묶음</dt><dd>${m.groupCount}</dd></div><div><dt>골라야 하는 과목</dt><dd>${m.pickTotal}</dd></div>
      <div><dt>선택 후보</dt><dd>${m.candidateSubjects}</dd></div><div><dt>선택 폭</dt><dd>${m.breadth}</dd></div><div><dt>첫 선택 학기</dt><dd>${esc(m.firstElectiveTerm || "-")}</dd></div></dl>
      <details><summary>이 학교에만 있는 과목 (${uniq.length})</summary><p>${uniq.map((x) => esc(x.name)).join(", ") || "-"}</p></details>
      <details><summary>메모</summary><textarea data-memo="${esc(m.schoolId)}" placeholder="이 브라우저에만 저장됩니다">${esc(store.get("memo:" + m.schoolId, ""))}</textarea></details>
      <div class="foot"><a class="btn" href="#select/curriculum?v=compare&s=${esc(m.schoolId)}">이 학교 과목 보기</a>
      <span class="muted small">${m.reviewCount ? `⚠ 확인 필요 ${m.reviewCount}건 · ` : ""}수집 ${esc(sc._meta?.updated || "-")}</span></div></section>`;
  };
  el.innerHTML = `<div class="tools"><a class="btn primary" href="#select/curriculum?v=compare">상세 비교 →</a>
    <span class="muted">${summary[0].entryYear}학년도 입학생(대입 ${summary[0].entryYear + 3}학년도) 편제표 · ${summary.length}개교</span></div>${dataNote}
    <div class="schoolgrid">${summary.map(card).join("")}</div>`;
  el.addEventListener("click", (e) => { const b = e.target.closest(".star"); if (!b) return; toggleStar(b.dataset.id); b.textContent = stars().includes(b.dataset.id) ? "★" : "☆"; });
  el.addEventListener("input", (e) => { if (e.target.dataset.memo) store.set("memo:" + e.target.dataset.memo, e.target.value); });
}

// ---- 학교별 편제표: 상세 비교(필터) ----
async function compareView(el, query) {
  const [schools, facets, subjects, offerings, groups] = await Promise.all([load("schools"), load("facets"), load("subjects"), load("offerings"), load("groups")]);
  const subj = new Map(subjects.map((x) => [x.subjectKey, x]));
  const gmap = new Map(groups.map((g) => [g.id, g]));
  const preset = (query.get("s") || "").split(",").filter((id) => schools.some((x) => x.id === id));
  const on = preset.length ? preset : schools.map((x) => x.id);
  const terms = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];
  el.innerHTML = `<div class="cmp">
    <aside class="panel filters"><b>필터</b>
      <div class="fgroup"><span class="flabel">학교</span>${schools.map((x) => `<label><input type="checkbox" class="fs" value="${esc(x.id)}" ${on.includes(x.id) ? "checked" : ""}> ${esc(x.name)}</label>`).join("")}</div>
      <div class="fgroup"><span class="flabel">과목명</span><input type="search" id="q" placeholder="과목명 검색"></div>
      <div class="fgroup"><span class="flabel">교과군</span><select id="area">${options(facets.areas, "전체")}</select></div>
      <div class="fgroup"><span class="flabel">이수 방식</span><select id="sel">${options([{ v: "school", t: "학교 지정" }, { v: "student", t: "학생 선택" }, { v: "outside", t: "학교 밖" }], "전체")}</select></div>
      <div class="fgroup"><span class="flabel">구분</span><select id="kind">${options(["공통", "일반", "진로", "융합"], "전체")}</select></div>
      <div class="fgroup"><span class="flabel">학기</span><select id="term">${options(terms, "전체")}</select></div>
      <div class="fgroup"><span class="flabel">수능 범위(추정)</span><select id="csat">${options([{ v: "in", t: "출제 범위" }, { v: "base", t: "기초(공통)" }, { v: "out", t: "제외" }], "전체")}</select></div>
      <div class="fgroup"><label><input type="checkbox" id="diff"> 학교 간 차이 나는 과목만</label><label><input type="checkbox" id="one"> 한 학교에만 있는 과목</label></div>
      <button id="reset" type="button">필터 초기화</button>
    </aside>
    <div class="cmpmain"><div class="tools"><a class="btn" href="#select/curriculum">← 학교별 요약</a><span class="muted" id="cnt"></span></div>${dataNote}
      <div class="tw"><table id="tbl"></table></div></div></div>`;
  const draw = () => {
    const ids = [...el.querySelectorAll(".fs:checked")].map((x) => x.value);
    const f = { q: $("#q").value.replace(/\s/g, ""), area: $("#area").value, sel: $("#sel").value, kind: $("#kind").value, term: $("#term").value, csat: $("#csat").value, diff: $("#diff").checked, one: $("#one").checked };
    if (!ids.length) { $("#tbl").innerHTML = ""; $("#cnt").textContent = "학교를 하나 이상 선택하세요."; return; }
    const by = new Map();
    for (const o of offerings) {
      if (!ids.includes(o.schoolId) || (f.area && o.area !== f.area) || (f.sel && o.selection !== f.sel) || (f.term && o.term !== f.term) || (f.csat && o.csatScope !== f.csat)) continue;
      if (f.kind && !o.kind.includes(f.kind) && o.kindGuess !== f.kind) continue;
      if (f.q && !o.subject.replace(/\s/g, "").includes(f.q)) continue;
      if (f.one && subj.get(o.subjectKey)?.schoolCount !== 1) continue;
      if (!by.has(o.subjectKey)) by.set(o.subjectKey, { area: o.area, name: subj.get(o.subjectKey)?.name || o.subject, cells: {} });
      (by.get(o.subjectKey).cells[o.schoolId] ||= []).push(o);
    }
    let rows = [...by.values()];
    if (f.diff) rows = rows.filter((r) => ids.some((id) => !r.cells[id]));
    rows.sort((a, b) => facets.areas.indexOf(a.area) - facets.areas.indexOf(b.area) || a.name.localeCompare(b.name, "ko"));
    const names = ids.map((id) => nameOf(schools, id));
    const uniq = (a) => [...new Set(a)];
    const cell = (os) => {
      if (!os) return '<td class="no">✕</td>';
      const slots = uniq(os.map((o) => SLOT[o.slot])), tm = uniq(os.map((o) => o.term)).sort().join(", ");
      const kinds = uniq(os.map(kindOf)).join("/"), cr = uniq(os.map((o) => o.credits)).join("/");
      const g = os.map((o) => gmap.get(o.groupId)).find(Boolean);
      const warn = os.some((o) => o.openFlagIds.length) ? " ⚠️" : "";
      return `<td class="${os.some((o) => o.slot === "required") ? "req" : "ele"}">${slots.join("/")} ${esc(tm)}${warn}<br><span class="muted small">${esc(kinds)} · ${cr}학점${g ? ` · 택${g.pick}/${g.size}` : ""}</span></td>`;
    };
    let area = "", html = "";
    for (const r of rows) {
      if (r.area !== area) { area = r.area; html += `<tr class="area"><td colspan="${ids.length + 1}">${esc(area)}</td></tr>`; }
      html += `<tr><td class="l">${esc(r.name)}</td>${ids.map((id) => cell(r.cells[id])).join("")}</tr>`;
    }
    $("#tbl").innerHTML = `<thead><tr><th class="l">과목</th>${names.map((n) => `<th>${esc(n)}</th>`).join("")}</tr></thead><tbody>${html || `<tr><td colspan="${ids.length + 1}">조건에 맞는 과목이 없습니다.</td></tr>`}</tbody>
      <tfoot><tr><th class="l">해당 과목 수</th>${ids.map((id) => `<th>${rows.filter((r) => r.cells[id]).length}</th>`).join("")}</tr></tfoot>`;
    $("#cnt").textContent = `${rows.length}개 과목`;
  };
  el.addEventListener("input", draw);
  el.addEventListener("change", draw);
  $("#reset").addEventListener("click", () => {
    el.querySelectorAll(".fs").forEach((c) => (c.checked = true));
    ["q", "area", "sel", "kind", "term", "csat"].forEach((id) => ($("#" + id).value = ""));
    ["diff", "one"].forEach((id) => ($("#" + id).checked = false));
    draw();
  });
  draw();
}

// ---- 제도·일정 (policy.json: research/*.md에서 생성) ----
const PST = { confirmed: "확정", reported: "보도", estimated: "추정", unknown: "확인 못 함" };
const SKIND = { official: "공식", media: "매체" };
const pstBadge = (r) => `<span class="pst ${r.status}">${PST[r.status]}</span>${r.note ? `<div class="muted small">${esc(r.note)}</div>` : ""}`;
const srcCell = (r) => {
  const list = r.sources || (r.sourceName ? [{ name: r.sourceName, url: r.sourceUrl }] : []);
  if (!list.length) return '<span class="muted">출처 없음</span>';
  return `${r.sourceKind ? `<span class="muted small">${SKIND[r.sourceKind]}</span> ` : ""}${list.map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(", ")}`;
};
const policyNote = '<p class="note">조사일 2026-10-25, <b>검색 요약 기준이며 원문을 모두 열람하지 못했습니다. 공식 사이트로 재확인 필요.</b> 입학학년도 2027(현 중3) · 대입학년도 2030.</p>';
const policyTable = (rows, cols) => `<div class="tw"><table class="policy"><thead><tr>${cols.map((c) => `<th class="l">${c[0]}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td class="l">${c[1](r)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}">해당 항목이 없습니다.</td></tr>`}</tbody></table></div>`;
const basicCols = [["항목", (r) => `<b>${esc(r.title)}</b>`], ["내용", (r) => esc(r.body)], ["상태", pstBadge], ["구분·출처", srcCell]];
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtDate = (e) => { const f = (d) => d.split("-").slice(1).map(Number).join("."); const [a, b] = [e.start, e.end]; return `${e.start.slice(0, 4)}.${f(a)}${b ? "~" + f(b) : ""}`; };

Object.assign(views, {
  async system(el) {
    const rows = (await load("policy")).filter((r) => r.topic.startsWith("admission"));
    const TOPIC = { "admission-reform": "2028학년도 개편 확정안과 2030학년도 적용", "admission-trend": "2030학년도 대상 추가 동향", "admission-unknown": "확인 못 함" };
    el.innerHTML = `<div class="fixednote">2030학년도 제도는 2027.3 공표 예정이며 수능 세부 범위는 추정</div>${policyNote}
      <p class="muted">현 중3은 2028 개편안의 직접 대상(2025 입학생)이 아닙니다. 2030학년도 제도는 2027.3 공표 내용에 따라 바뀔 수 있습니다.</p>
      <div class="tools"><span class="muted">상태</span><select id="pst"><option value="">전체 (${rows.length})</option>${Object.entries(PST).map(([k, v]) => `<option value="${k}">${v} (${rows.filter((r) => r.status === k).length})</option>`).join("")}</select></div><div id="ptbl"></div>`;
    const cols = [...basicCols.slice(0, 2), ["대입학년도", (r) => `${r.examYear}<div class="muted small">입학 ${r.entryYear}</div>`], ...basicCols.slice(2)];
    const draw = () => {
      const f = $("#pst").value;
      $("#ptbl").innerHTML = Object.entries(TOPIC).map(([t, label]) => { const rs = rows.filter((r) => r.topic === t && (!f || r.status === f)); return rs.length ? `<h3>${label}</h3>${policyTable(rs, cols)}` : ""; }).join("") || '<p class="muted">조건에 맞는 항목이 없습니다.</p>';
    };
    $("#pst").addEventListener("change", draw);
    draw();
  },

  async schedule(el, query) {
    const tab = query.get("t") === "univ" ? "univ" : "hs";
    const tabs = `<div class="subtabs"><a href="#schedule?t=hs" class="${tab === "hs" ? "on" : ""}">고입</a><a href="#schedule?t=univ" class="${tab === "univ" ? "on" : ""}">대입</a></div>`;
    if (tab === "univ") { el.innerHTML = `${tabs}<p class="note">데이터 준비 중</p>`; return; }
    const rows = (await load("policy")).filter((r) => r.topic === "hs-schedule");
    const today = todayStr();
    const evs = rows.flatMap((r) => (r.events || []).map((e, i) => ({ ...e, r, first: i === 0 }))).sort((a, b) => a.start.localeCompare(b.start));
    const tr = (e) => `<tr class="${(e.end || e.start) < today ? "past" : ""}"><td class="l">${esc(fmtDate(e))}</td><td class="l"><b>${esc(e.r.title)}</b> · ${esc(e.label)}${e.first ? `<div class="muted small">${esc(e.r.body)}</div>` : ""}</td><td class="l">${pstBadge(e.r)}</td><td class="l">${srcCell(e.r)}</td></tr>`;
    const none = rows.filter((r) => !r.events);
    el.innerHTML = `${tabs}${policyNote}<p class="muted">2027학년도 고입(서울 기준). 오늘(${today}) 이전 일정은 흐리게 표시합니다. 연도는 2027학년도 고입이 2026년 하반기에 진행되는 것을 기준으로 붙였습니다.</p>
      <div class="tw"><table class="policy"><thead><tr><th class="l">날짜</th><th class="l">항목</th><th class="l">상태</th><th class="l">구분·출처</th></tr></thead><tbody>${evs.map(tr).join("")}</tbody></table></div>
      ${none.length ? `<h3>일정 미확인</h3>${policyTable(none, basicCols)}` : ""}`;
  },

  async types(el) {
    const rows = await load("policy");
    el.innerHTML = `${policyNote}<h3>고교 유형</h3>${policyTable(rows.filter((r) => r.topic === "hs-types"), basicCols)}
      <h3>고교학점제 요약 <span class="muted small">입학 후 제도</span></h3>${policyTable(rows.filter((r) => r.topic === "credit-system"), basicCols)}
      <p class="muted">고입 전형 일정은 <a href="#schedule">일정</a> 화면의 고입 탭에서 봅니다.</p>`;
  },
});

function render() {
  const [path, qs] = decodeURIComponent(location.hash.slice(1)).split("?");
  const query = new URLSearchParams(qs || "");
  const id = path || "home";
  const n = byId.get(id) || byId.get("home");
  drawNav(n.id);
  $("#nav").classList.remove("open");
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
