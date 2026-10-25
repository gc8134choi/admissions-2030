// 편제표 통합 DB 화면: 학교 비교표 · 과목 검색 · 학교 상세 (docs/db-schema.md 기준)
// 사용: app.js 의 renderers.db 가 renderDb(el, data, api) 를 부른다. api.load(이름) 으로 DB 파일을 읽는다.

const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const short = (n = "") => n.replace("고등학교", "고");
// 편제표 사진은 대시보드에서 쓰지 않는다(vault 에도 이미지가 없다). 다시 쓸 때만 true 로 바꾸고 build.mjs 의 IMAGES_ENABLED 도 켠다.
const SHOW_IMAGES = false;
const safeUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : ""); // http(s)만 링크로 허용
const num = (n) => (n === undefined || n === null ? "" : Number.isInteger(n) ? String(n) : n.toFixed(2));

const CONF = { unverified: ["전사본(전체 대조 전)", "c-un"], checked: ["사진 대조 완료", "c-chk"], reported: ["2차 자료", "c-rep"], verified: ["확인됨", "c-ver"] };
const badge = (c, label) => {
  const [t, cls] = CONF[c] || [c || "?", "c-un"];
  return `<span class="bdg ${cls}" title="신뢰도: ${esc(t)}">${esc(label || t)}</span>`;
};
const COLOR_BADGE = '<span class="bdg c-col" title="구분을 글자색(검정 일반·빨강 진로·파랑 융합)으로 읽은 값">글자색</span>';
const SLOT = { required: "학교지정", elective: "학생선택", outside: "학교 밖" };
const POOL = { cross: "교과(군) 간", basic: "기초교과", life: "기술·가정/정보/제2외국어/교양", "in-area": "한 교과 안" };
const TERMS = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];

// 구분(kind) 표시: 인쇄됨 / 추정 / 미표기
function kindHtml(o) {
  if (o.kindStatus === "inferred") return `${esc(o.kindGuess || "")}<span class="bdg c-est" title="다른 학교 표기로 추정한 값">추정</span>`;
  if (o.kindStatus === "unmarked") return `<span class="bdg c-miss" title="이 학교 표에 구분이 인쇄되어 있지 않음">미표기</span>`;
  if (o.kindStatus === "missing") return `<span class="bdg c-low" title="전사 확인 필요">확인 필요</span>`;
  return `${esc((o.kind || []).join("·"))}${o.kindStatus === "color" ? COLOR_BADGE : ""}`;
}

// flag 들을 행·묶음·표 전체에 연결해 둔 조회 표
function flagIndex(flags) {
  const by = new Map();
  for (const f of flags) for (const r of f.refs || []) (by.get(`${r.type}:${r.id}`) || by.set(`${r.type}:${r.id}`, []).get(`${r.type}:${r.id}`)).push(f);
  return (type, id) => by.get(`${type}:${id}`) || [];
}
const isOpen = (f) => f.status !== "checked";
function warn(fs) {
  const open = fs.filter(isOpen), done = fs.filter((f) => !isOpen(f));
  if (open.length) {
    const low = open.some((f) => f.confidence === "low");
    return `<span class="warn-i ${low ? "low" : "med"}" title="${esc(open.map((f) => `[${f.confidence}] ${f.ref} — ${f.note}`).join("\n"))}">⚠</span>`;
  }
  if (done.length) return `<span class="chk-i" title="${esc(done.map((f) => `사진 대조 완료: ${f.ref}${f.resolution ? " — " + f.resolution : ""}`).join("\n"))}">✓</span>`;
  return "";
}

export async function renderDb(el, data, api) {
  const [summary, schools, curricula, facets, index] = await Promise.all(
    ["summary", "schools", "curricula", "facets", "index"].map((n) => api.load(n))
  );
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const summaryBySchool = new Map(summary.map((s) => [s.schoolId, s]));
  const curriculumBySchool = new Map(curricula.map((c) => [c.schoolId, c]));
  const state = { view: "compare", sort: { k: "schoolName", dir: 1 }, filter: { type: "", founding: "", conf: "", q: "" }, detail: summary[0]?.schoolId, search: { q: "", area: "", kind: "", term: "", sel: "", csatArea: "", csatScope: "", school: "", shown: 30 }, detailCsat: "",
    matrix: { q: "", area: "", subArea: "", presence: "", sel: "", csatArea: "", csatScope: "", school: "" }, versus: { ids: summary.slice(0, 2).map((x) => x.schoolId) } };

  // ---- 지정/선택, 수능 영역 (docs/db-schema.md §5-4, §5-5)
  const csat = facets.csat || {};
  const AREA_LABEL = Object.fromEntries((csat.areas || []).map((a) => [a.key, a.label]));
  const SCOPE_LABEL = csat.scopes || {};
  const SEL = facets.selection || { school: "학교지정", student: "학생선택", outside: "학교 밖" };
  const selOf = (r) => r.selection || { required: "school", elective: "student", outside: "outside" }[r.slot];
  const SCOPE_TXT = { in: ["출제 범위", "c-in"], base: ["공통·기초", "c-base"], out: ["출제 제외", "c-outx"] };
  function csatBadge(o) {
    if (!o.csatScope || o.csatScope === "none") return "";
    const unc = o.csatConfidence === "unconfirmed";
    const [txt, cls] = SCOPE_TXT[o.csatScope] || [o.csatScope, "c-base"];
    const area = AREA_LABEL[o.csatArea] || o.csatArea || "";
    const tip = `수능 ${area}: ${SCOPE_LABEL[o.csatScope] || txt}${unc ? " · 근거 없음/추정(미확인)" : ""}${o.csatNote ? " · " + o.csatNote : ""}`;
    return `<span class="bdg ${cls}" title="${esc(tip)}">수능 ${esc(area)} ${esc(txt)}${unc ? " · 미확인" : ""}</span>`;
  }
  const csatMatch = (r, area, scope) => (!area || (area === "__none" ? r.csatScope === "none" : r.csatArea === area)) && (!scope || r.csatScope === scope);
  const csatAreaOpts = [...(csat.areas || []).map((a) => a.key), "__none"];
  const csatAreaLabel = (v) => (v === "__none" ? "수능 영역 없음" : AREA_LABEL[v] || v);
  const SRC_KIND = { official: "1차(공식)", media: "보도", other: "2차" };
  const csatNotice = () => csat.notice ? `<div class="note-box csat-notice"><b>수능 영역 정보 기준</b> ${esc(csat.notice)}
      <details><summary>근거 ${(csat.sources || []).length}건 · 신뢰도 설명</summary>
        <ul>${(csat.sources || []).map((x) => `<li>${safeUrl(x.url) ? `<a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener noreferrer">${esc(x.name)}</a>` : esc(x.name)} <span class="tag">${esc(SRC_KIND[x.kind] || x.kind)}</span> <span class="muted">조회 ${esc(x.retrieved || "")}${x.supports ? " · " + esc(x.supports) : ""}</span></li>`).join("")}</ul>
        <div class="muted">${esc(csat.basis || "")}</div>
        <div class="muted">${Object.entries(csat.confidenceLevels || {}).map(([k, v]) => `<b>${k === "unconfirmed" ? "미확인" : k === "reported" ? "보도·2차 자료" : "확정"}</b>: ${esc(v)}`).join("<br>")}</div>
        <div class="muted"><b>출제 제외</b>는 불필요한 과목이 아니라 수능에 나오지 않는 과목입니다(학생부 전형에서는 의미가 있을 수 있음). <b>미확인</b>은 "해당 없음"이 아니라 근거가 아직 없다는 뜻입니다.</div>
      </details></div>` : "";

  el.innerHTML = `
    <div class="subtabs" role="tablist">
      <button data-view="compare">학교 비교표</button>
      <button data-view="search">과목 검색</button>
      <button data-view="detail">학교 상세</button>
      <button data-view="matrix">과목 매트릭스</button>
      <button data-view="versus">학교 간 비교</button>
    </div>
    <p class="muted dbnote">입학 ${(index.entryYears || []).join(", ")}학년도 · 대입 ${(index.entryYears || []).map((y) => y + 3).join(", ")}학년도 · 학교 ${index.counts?.schools ?? ""}곳 · 과목 ${index.counts?.subjects ?? ""}종 · DB v${esc(index.version)}</p>
    ${csatNotice()}
    <div id="dbview"></div>`;
  const view = el.querySelector("#dbview");

  const views = { compare, search, detail, matrix, versus };
  async function go(v, patch) {
    if (patch) Object.assign(state, patch);
    state.view = v;
    el.querySelectorAll(".subtabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
    view.innerHTML = '<p class="muted">불러오는 중…</p>';
    try { await views[v](); } catch (e) { view.innerHTML = `<p class="empty">화면을 그리지 못했습니다: ${esc(e.message)}</p>`; }
  }
  el.querySelector(".subtabs").addEventListener("click", (e) => e.target.dataset.view && go(e.target.dataset.view));

  // ------------------------------------------------------------------ 1. 학교 비교표
  const COLS = [
    { k: "schoolName", l: "학교" }, { k: "schoolType", l: "유형" }, { k: "founding", l: "설립" }, { k: "region", l: "지역" },
    { k: "assignment", l: "배정방식" }, { k: "creditsSubject", l: "교과 학점", n: 1 }, { k: "requiredCount", l: "지정 과목", n: 1 },
    { k: "groupCount", l: "택n 묶음", n: 1 }, { k: "candidateSubjects", l: "후보 과목", n: 1 }, { k: "breadth", l: "선택 폭", n: 1 },
    { k: "creativeHours", l: "창체(시간)", n: 1 }, { k: "confidence", l: "신뢰도" }, { k: "reviewCount", l: "확인 필요", n: 1 },
  ];
  const uniq = (k) => [...new Set(summary.map((s) => s[k]).filter(Boolean))].sort();

  function compare() {
    const f = state.filter;
    const opt = (vals, cur) => `<option value="">전체</option>${vals.map((v) => `<option ${v === cur ? "selected" : ""}>${esc(v)}</option>`).join("")}`;
    view.innerHTML = `
      <div class="filters">
        <input type="search" id="f-q" placeholder="학교·지역 검색" value="${esc(f.q)}">
        <label>유형 <select id="f-type">${opt(uniq("schoolType"), f.type)}</select></label>
        <label>설립 <select id="f-founding">${opt(uniq("founding"), f.founding)}</select></label>
        <label>신뢰도 <select id="f-conf"><option value="">전체</option>${Object.entries(CONF).map(([k, [t]]) => `<option value="${k}" ${f.conf === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      </div>
      <div class="table-wrap"><table class="tbl cmp" id="cmp"></table></div>
      <p class="muted">열 제목을 누르면 정렬됩니다. 학교를 누르면 상세로 이동합니다. <b>선택 폭</b> = 후보 과목 수 ÷ 선택해야 하는 과목 수 (클수록 선택지가 넓음). <b>신뢰도</b>: "전사본(전체 대조 전)"은 사진에서 옮긴 값 전체를 아직 대조하지 않았다는 뜻이고, 일부 항목은 사진과 대조해 "사진 대조 완료"가 되었습니다.</p>`;
    const draw = () => {
      const rows = summary
        .filter((s) => (!f.type || s.schoolType === f.type) && (!f.founding || s.founding === f.founding) && (!f.conf || s.confidence === f.conf) &&
          (!f.q || [s.schoolName, s.region, s.assignment].join(" ").toLowerCase().includes(f.q.toLowerCase())))
        .sort((a, b) => {
          const x = a[state.sort.k], y = b[state.sort.k];
          return (typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), "ko")) * state.sort.dir;
        });
      view.querySelector("#cmp").innerHTML = `<thead><tr>${COLS.map((c) => `<th data-k="${c.k}" class="${c.n ? "n" : ""}">${c.l}${state.sort.k === c.k ? (state.sort.dir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead>
        <tbody>${rows.length ? rows.map((s) => {
          const fc = schoolById.get(s.schoolId)?._meta?.fieldConfidence || {};
          return `<tr data-school="${esc(s.schoolId)}"><td class="sticky"><b>${esc(s.schoolName)}</b></td><td>${esc(s.schoolType || "")}</td>
            <td>${esc(s.founding || "")}${fc.founding === "verified" ? ' <span class="bdg c-ver" title="사용자 확인">확인됨</span>' : ""}</td>
            <td class="ell" title="${esc(s.region || "")}">${esc(s.region || "")}</td><td class="ell" title="${esc(s.assignment || "")}">${esc(s.assignment || "")}</td>
            <td class="n">${num(s.creditsSubject)}</td><td class="n">${num(s.requiredCount)}</td><td class="n">${num(s.groupCount)}</td><td class="n">${num(s.candidateSubjects)}</td>
            <td class="n">${num(s.breadth)}</td><td class="n">${num(s.creativeHours)}</td><td>${badge(s.confidence)}</td>
            <td class="n">${s.reviewCount ? `<span class="warn-i ${s.validationErrors ? "low" : "med"}">⚠</span> ${s.reviewCount}` : "0"}</td></tr>`;
        }).join("") : `<tr><td colspan="${COLS.length}" class="empty">조건에 맞는 학교가 없습니다.</td></tr>`}</tbody>`;
    };
    draw();
    view.querySelector("#f-q").addEventListener("input", (e) => { f.q = e.target.value; draw(); });
    for (const [id, key] of [["f-type", "type"], ["f-founding", "founding"], ["f-conf", "conf"]]) view.querySelector("#" + id).addEventListener("change", (e) => { f[key] = e.target.value; draw(); });
    view.querySelector("#cmp").addEventListener("click", (e) => {
      const th = e.target.closest("th[data-k]");
      if (th) { state.sort = { k: th.dataset.k, dir: state.sort.k === th.dataset.k ? -state.sort.dir : 1 }; return draw(); }
      const tr = e.target.closest("tr[data-school]");
      if (tr) go("detail", { detail: tr.dataset.school });
    });
  }

  // ------------------------------------------------------------------ 2. 과목 검색
  async function search() {
    const [offerings, sidx, flags] = await Promise.all(["offerings", "search-index", "flags"].map((n) => api.load(n)));
    const flagsOf = flagIndex(flags);
    const rowsByKey = new Map();
    for (const o of offerings) (rowsByKey.get(o.subjectKey) || rowsByKey.set(o.subjectKey, []).get(o.subjectKey)).push(o);
    const s = state.search;
    const opts = (vals, cur, fmt = (v) => v) => `<option value="">전체</option>${vals.map((v) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(fmt(v))}</option>`).join("")}`;
    view.innerHTML = `
      <div class="filters">
        <input type="search" id="s-q" placeholder="과목명·별칭·초성 검색 (예: 물리, ㅁㄹㅎ)" value="${esc(s.q)}">
        <label>교과군 <select id="s-area">${opts(facets.areas, s.area)}</select></label>
        <label>구분 <select id="s-kind">${opts(facets.kinds, s.kind)}</select></label>
        <label>학기 <select id="s-term">${opts(facets.terms, s.term)}</select></label>
        <label>이수 방식 <select id="s-sel">${opts(["school", "student", "outside"], s.sel, (v) => SEL[v])}</select></label>
        <label>수능 영역 <select id="s-carea">${opts(csatAreaOpts, s.csatArea, csatAreaLabel)}</select></label>
        <label>수능 범위 <select id="s-cscope">${opts(["in", "base", "out"], s.csatScope, (v) => SCOPE_TXT[v][0])}</select></label>
        <label>학교 <select id="s-school">${opts(facets.schools.map((x) => x.id), s.school, (id) => short(schoolById.get(id)?.name || id))}</select></label>
      </div>
      <p class="muted" id="s-count"></p><div id="s-list"></div>`;
    const draw = () => {
      const q = s.q.trim().toLowerCase(), qi = s.q.replace(/\s/g, "");
      const rowOk = (r) => (!s.term || r.term === s.term) && (!s.sel || selOf(r) === s.sel) && (!s.school || r.schoolId === s.school) && (!s.kind || (r.kind || []).includes(s.kind)) && csatMatch(r, s.csatArea, s.csatScope);
      const filtering = s.term || s.sel || s.school || s.kind || s.csatArea || s.csatScope;
      const hits = sidx
        .filter((x) => (!s.area || x.area === s.area) && (!q || x.text.includes(q) || (x.initials || "").includes(qi)))
        .map((x) => ({ x, rows: (rowsByKey.get(x.subjectKey) || []).filter(rowOk) }))
        .filter((h) => !filtering || h.rows.length)
        .sort((a, b) => b.x.schools.length - a.x.schools.length || a.x.name.localeCompare(b.x.name, "ko"));
      view.querySelector("#s-count").textContent = `${hits.length}개 과목`;
      view.querySelector("#s-list").innerHTML = hits.slice(0, s.shown).map(({ x, rows }) => {
        const bySchool = new Map();
        for (const r of rows) (bySchool.get(r.schoolId) || bySchool.set(r.schoolId, []).get(r.schoolId)).push(r);
        const lines = [...bySchool.entries()].map(([sid, rs]) => {
          const conf = rs[0].confidence;
          const items = rs.sort((a, b) => a.term.localeCompare(b.term) || a.seq - b.seq).map((r) =>
            `<span class="ent">${r.term} ${SLOT[r.slot]}${r.slot === "elective" ? ` 택${r.pick}/${r.groupSize}` : ""} · ${num(r.credits)}학점${r.kind?.length || r.kindStatus !== "printed" ? ` · ${kindHtml(r)}` : ""}${csatBadge(r) ? " " + csatBadge(r) : ""}${warn(flagsOf("offering", r.id))}</span>`).join("");
          return `<div class="line"><b>${esc(short(schoolById.get(sid)?.name || sid))}</b> ${badge(conf)} ${items}</div>`;
        }).join("");
        const alias = (x.aliases || []).filter((a) => a !== x.name);
        return `<div class="sub"><div class="subh"><b>${esc(x.name)}</b> <span class="tag">${esc(x.area)}${x.subArea ? " · " + esc(x.subArea) : ""}</span>
          <span class="muted">${x.schools.length}개 학교</span>${alias.length ? `<div class="muted">표기: ${alias.map(esc).join(", ")}</div>` : ""}</div>${lines || '<div class="muted">조건에 맞는 개설 정보 없음</div>'}</div>`;
      }).join("") + (hits.length > s.shown ? `<button class="more" id="s-more">더 보기 (${hits.length - s.shown}개 남음)</button>` : "") || '<p class="empty">검색 결과가 없습니다.</p>';
      view.querySelector("#s-more")?.addEventListener("click", () => { s.shown += 30; draw(); });
    };
    draw();
    view.querySelector("#s-q").addEventListener("input", (e) => { s.q = e.target.value; s.shown = 30; draw(); });
    for (const [id, key] of [["s-area", "area"], ["s-kind", "kind"], ["s-term", "term"], ["s-sel", "sel"], ["s-carea", "csatArea"], ["s-cscope", "csatScope"], ["s-school", "school"]]) {
      view.querySelector("#" + id).addEventListener("change", (e) => { s[key] = e.target.value; s.shown = 30; draw(); });
    }
  }

  // ------------------------------------------------------------------ 3. 학교 상세
  async function detail() {
    const [offerings, groups, flags] = await Promise.all(["offerings", "groups", "flags"].map((n) => api.load(n)));
    const sid = state.detail;
    const sch = schoolById.get(sid), sm = summaryBySchool.get(sid), cur = curriculumBySchool.get(sid);
    if (!sch || !sm) return (view.innerHTML = '<p class="empty">학교를 선택해 주세요.</p>');
    const flagsOf = flagIndex(flags.filter((f) => f.schoolId === sid));
    const rows = offerings.filter((o) => o.schoolId === sid), grps = groups.filter((g) => g.schoolId === sid);
    const fc = sch._meta?.fieldConfidence || {};
    const general = flagsOf("curriculum", cur?.id);
    const chip = (label, val, field) => (val && val !== "미확인" ? `<span class="chip">${label} ${esc(val)}${fc[field] === "verified" ? ' <span class="bdg c-ver">확인됨</span>' : ""}</span>` : `<span class="chip muted">${label} 미확인</span>`);

    const keep = (o) => csatMatch(o, state.detailCsat, "");
    const termHtml = TERMS.map((t) => {
      const bt = sm.byTerm?.[t] || {};
      const req = rows.filter((o) => o.term === t && o.slot === "required" && keep(o)).sort((a, b) => a.seq - b.seq);
      const out = rows.filter((o) => o.term === t && o.slot === "outside" && keep(o));
      const gs = grps.filter((g) => g.term === t).sort((a, b) => a.label.localeCompare(b.label));
      return `<details class="term" open><summary><b>${t}</b> · ${num(bt.total)}학점 <span class="muted">지정 ${num(bt.required)} / 선택 ${num(bt.elective)}${bt.groupCount ? ` · 택n ${bt.groupCount}묶음` : ""}</span></summary>
        <table class="tbl small"><thead><tr><th>학교지정 과목</th><th>교과</th><th>구분</th><th>수능</th><th class="n">학점</th><th></th></tr></thead><tbody>
        ${req.map((o) => `<tr><td>${esc(o.subject)}</td><td class="muted">${esc(o.area)}</td><td>${kindHtml(o)}</td><td>${csatBadge(o) || '<span class="muted">—</span>'}</td><td class="n">${num(o.credits)}${o.basicCredits && o.basicCredits !== o.credits ? ` <span class="muted" title="기본학점">(기본 ${o.basicCredits})</span>` : ""}</td><td>${warn(flagsOf("offering", o.id))}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">없음</td></tr>'}
        </tbody></table>
        ${gs.map((g) => {
          const opts = rows.filter((o) => o.groupId === g.id && keep(o)).sort((a, b) => a.seq - b.seq);
          if (!opts.length) return "";
          return `<div class="grp"><div class="gh">학생선택 · 택${g.pick} · 각 ${num(g.creditsEach)}학점 · 후보 ${g.size}과목${opts.length !== g.size ? ` (표시 ${opts.length})` : ""} <span class="tag">${esc(POOL[g.poolType] || g.poolType)}</span>${warn(flagsOf("group", g.id))}</div>
            <div class="chips">${opts.map((o) => `<span class="chip cs-${esc(o.csatScope || "none")}" title="${esc(o.area)}${o.csatScope && o.csatScope !== "none" ? " · 수능 " + esc(AREA_LABEL[o.csatArea] || "") + " " + esc(SCOPE_LABEL[o.csatScope] || "") + (o.csatConfidence === "unconfirmed" ? " (미확인)" : "") : ""}">${esc(o.subject)}${(o.kindStatus === "printed" || o.kindStatus === "color") && o.kind?.length ? ` <small>${esc(o.kind.join("·"))}</small>${o.kindStatus === "color" ? COLOR_BADGE : ""}` : o.kindStatus === "inferred" ? ` <small>${esc(o.kindGuess)}</small><span class="bdg c-est">추정</span>` : o.kindStatus === "unmarked" ? '<span class="bdg c-miss">미표기</span>' : o.kindStatus === "missing" ? '<span class="bdg c-low">확인 필요</span>' : ""}${o.csatScope === "out" ? '<span class="cs-mark" title="수능 출제 제외(불필요한 과목이 아님)">제외</span>' : o.csatScope === "in" ? '<span class="cs-mark in" title="수능 출제 범위">출제</span>' : ""}${warn(flagsOf("offering", o.id))}</span>`).join("")}</div></div>`;
        }).join("")}
        ${out.map((o) => `<div class="grp out">학교 밖: ${esc(o.subject)} · ${num(o.credits)}학점 (교내 합계 불포함) ${warn(flagsOf("offering", o.id))}</div>`).join("")}</details>`;
    }).join("");

    const cre = cur?.creative?.perTerm || {};
    const acts = [...new Set(Object.values(cre).flatMap((o) => Object.keys(o)))];
    const myFlags = flags.filter((f) => f.schoolId === sid);

    view.innerHTML = `
      <div class="filters"><label>학교 <select id="d-school">${summary.map((s) => `<option value="${esc(s.schoolId)}" ${s.schoolId === sid ? "selected" : ""}>${esc(s.schoolName)}</option>`).join("")}</select></label>
        <label>수능 영역 보기 <select id="d-csat"><option value="">전체 과목</option>${csatAreaOpts.map((v) => `<option value="${esc(v)}" ${v === state.detailCsat ? "selected" : ""}>${esc(csatAreaLabel(v))}</option>`).join("")}</select></label></div>
      <div class="dhead"><div>
        <h3>${esc(sch.name)} ${badge(sm.confidence, "편제표: " + CONF[sm.confidence]?.[0])}</h3>
        <div class="chips">${chip("유형", sch.schoolType, "schoolType")}${chip("설립", sch.founding, "founding")}${chip("지역", sch.region, "region")}${chip("배정", sch.assignment, "assignment")}${chip("성별", sch.gender, "gender")}${chip("주소", sch.address, "address")}</div>
        <div class="muted">학교 정보 신뢰도 ${badge(sch._meta?.confidence)} · 입학 ${sm.entryYear}학년도 · ${esc(cur?.document || "")}</div>
        ${general.length ? `<div class="gnote">${warn(general)} 표 전체 메모 ${general.length}건: ${general.map((f) => esc(f.note)).join(" / ")}</div>` : ""}
      </div>${SHOW_IMAGES && cur?.displayImage ? `<div class="dimg"><img alt="편제표 사진" data-img="${esc(cur.displayImage)}"><div class="muted">사진을 누르면 크게 봅니다</div></div>` : ""}</div>
      <div class="stats">
        ${[["교과 학점", sm.creditsSubject, cur?.declared?.subjectCredits !== undefined ? (cur.declared.subjectCredits === sm.creditsSubject ? "표 인쇄값과 일치" : `표 ${cur.declared.subjectCredits}`) : ""], ["지정 학점", sm.creditsRequired, `${sm.requiredCount}과목`], ["선택 학점", sm.creditsElective, `택n ${sm.groupCount}묶음 · ${sm.pickTotal}과목 선택`],
          ["후보 과목", sm.candidateSubjects, `선택 폭 ${num(sm.breadth)}`], ["창체", sm.creativeHours + "h", `${sm.creditsCreative ?? ""}학점`], ["확인 필요", sm.reviewCount, `${sm.flagsOpen !== undefined ? `열린 플래그 ${sm.flagsOpen} · 대조 완료 ${sm.flagsChecked ?? 0}` : `플래그 ${sm.flagsTotal}`} · 구분 미표기 ${sm.kindMissingRows}행`]]
          .map(([l, v, s]) => `<div class="stat"><div class="muted">${l}</div><div class="v">${esc(v ?? "")}</div><div class="muted">${esc(s || "")}</div></div>`).join("")}
      </div>
      ${sm.kindMissingRows ? `<p class="note-box">이 학교 표에는 과목 구분(일반·진로)이 인쇄되어 있지 않습니다. 구분이 비어 있는 ${sm.kindMissingRows}행은 "추정"(다른 학교 기준) 또는 "미표기"로 표시합니다.</p>` : ""}
      <h4>수능 영역별 이수 구성 <small class="muted">(2028학년도 확정안 기준 · 2030학년도 적용 가정)</small></h4>
      ${csatTableHtml(sm)}
      <h4>학기별 편제</h4>
      <p class="muted">칩 오른쪽의 <span class="cs-mark in">출제</span>는 수능 출제 범위, <span class="cs-mark">제외</span>는 같은 교과이지만 수능 출제 제외입니다. 위의 "수능 영역 보기"로 영역별 과목만 모아 볼 수 있습니다.</p>
      <div class="terms">${termHtml}</div>
      <h4>창의적 체험활동 (학기당 시간)</h4>
      <div class="table-wrap"><table class="tbl small"><thead><tr><th>활동</th>${TERMS.map((t) => `<th class="n">${t}</th>`).join("")}</tr></thead><tbody>
        ${acts.map((a) => `<tr><td>${esc(a)}</td>${TERMS.map((t) => `<td class="n">${num(cre[t]?.[a])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <h4>판독 확인 필요 항목 (열린 ${myFlags.filter(isOpen).length}건)</h4>
      ${myFlags.filter(isOpen).length ? `<ul class="flags">${myFlags.filter(isOpen).map((f) => `<li><span class="warn-i ${f.confidence === "low" ? "low" : "med"}">⚠</span> <b>${esc(f.ref)}</b> <span class="tag">${esc(f.confidence)}</span><div class="muted">${esc(f.note)}${f.scope === "general" ? " · 표 전체 메모" : ""}</div></li>`).join("")}</ul>` : '<p class="muted">열린 항목 없음</p>'}
      ${myFlags.some((f) => !isOpen(f)) ? `<h4>사진 대조 완료 (${myFlags.filter((f) => !isOpen(f)).length}건)</h4><ul class="flags">${myFlags.filter((f) => !isOpen(f)).map((f) => `<li><span class="chk-i">✓</span> <b>${esc(f.ref)}</b> <span class="tag">원래 ${esc(f.confidence)}</span><div class="muted">${esc(f.note)}</div><div class="muted">결과: ${esc(f.resolution || "")} · ${esc(f.checkedDate || "")} ${esc(f.checkedBy || "")}</div></li>`).join("")}</ul>` : ""}`;

    view.querySelector("#d-school").addEventListener("change", (e) => go("detail", { detail: e.target.value }));
    view.querySelector("#d-csat").addEventListener("change", (e) => go("detail", { detailCsat: e.target.value }));
    const img = view.querySelector("img[data-img]");
    if (SHOW_IMAGES && img) api.blobUrl(img.dataset.img).then((u) => { img.src = u; img.addEventListener("click", () => api.openLightbox(u)); });
  }

  // ------------------------------------------------------------------ 공용: 수능 영역별 이수 구성 (summary.byCsat)
  // candidatesIn 은 반드시 같은 영역의 requiredIn·requiredBase 와 함께 보여 준다(§5-5).
  function csatReqText(b) {
    return `지정 ${num(b.requiredIn)}학점(출제 범위) + 공통·기초 ${num(b.requiredBase)}학점${b.requiredOut ? ` · 지정 중 출제 제외 ${num(b.requiredOut)}학점` : ""}`;
  }
  const csatCandText = (b) => `학생선택 후보 ${b.candidatesAll}개 중 출제 범위 ${b.candidatesIn}개`;
  const csatUnc = (b) => (b.unconfirmed ? '<span class="bdg c-un" title="이 영역에 근거 없음/추정(미확인) 행이 포함되어 있습니다">미확인 포함</span>' : "");
  function csatTableHtml(sm) {
    const bc = sm.byCsat;
    if (!bc) return '<p class="muted">수능 영역 정보가 없습니다.</p>';
    return `<div class="table-wrap"><table class="tbl small"><thead><tr><th>수능 영역</th><th>학교지정(학점)</th><th>학생선택 후보</th><th></th></tr></thead><tbody>
      ${(csat.areas || []).map((a) => { const b = bc[a.key]; return b ? `<tr><th>${esc(a.label)}</th><td>${csatReqText(b)}</td><td>${csatCandText(b)}</td><td>${csatUnc(b)}</td></tr>` : ""; }).join("")}
      </tbody></table></div>
      <p class="muted">후보 중 출제 범위가 0개여도, 수능 출제 과목이 이미 학교지정에 들어 있다면 수능 대비가 부족하다는 뜻이 아닙니다(예: 수학 필수 3과목은 지정). "출제 제외"는 불필요한 과목이 아니라 수능에 나오지 않는 과목입니다.</p>`;
  }

  // ------------------------------------------------------------------ 공용: 학교×과목 개설 상세 (offerings 기반)
  let detCache;
  async function getDet() {
    if (!detCache) {
      const offerings = await api.load("offerings");
      detCache = new Map();
      for (const o of offerings) {
        const k = `${o.subjectKey}|${o.schoolId}`;
        (detCache.get(k) || detCache.set(k, []).get(k)).push(o);
      }
    }
    return detCache;
  }
  const SLOT_ORDER = ["required", "elective", "outside"];
  function cellHtml(det, key, sid) {
    const rs = det.get(`${key}|${sid}`);
    if (!rs) return '<span class="none">—</span>';
    const parts = SLOT_ORDER.filter((sl) => rs.some((r) => r.slot === sl)).map((sl) => {
      const items = rs.filter((r) => r.slot === sl).sort((a, b) => a.term.localeCompare(b.term) || a.seq - b.seq)
        .map((r) => (sl === "elective" ? `${r.term} 택${r.pick}/${r.groupSize}` : r.term));
      return `<span class="mxe ${sl}">${SLOT[sl]}</span> ${esc([...new Set(items)].join(", "))}`;
    });
    const printed = [...new Set(rs.flatMap((r) => (r.kindStatus === "printed" || r.kindStatus === "color" ? r.kind || [] : [])))];
    const colored = rs.some((r) => r.kindStatus === "color");
    const inferred = rs.some((r) => r.kindStatus === "inferred"), unmarked = rs.some((r) => r.kindStatus === "unmarked");
    const kinds = `${printed.length ? esc(printed.join("·")) : ""}${colored ? COLOR_BADGE : ""}${inferred ? `${esc(rs.find((r) => r.kindStatus === "inferred").kindGuess || "")}<span class="bdg c-est">추정</span>` : ""}${unmarked ? '<span class="bdg c-miss">미표기</span>' : ""}`;
    const openOf = (r) => r.openFlagIds ?? r.flagIds ?? [];
    const flagged = rs.filter((r) => openOf(r).length);
    const w = flagged.length ? `<span class="warn-i ${flagged.some((r) => r.readConfidence === "low") ? "low" : "med"}" title="판독 확인 필요 항목이 열려 있습니다(학교 상세에서 내용 확인)">⚠</span>`
      : rs.some((r) => (r.flagIds || []).length) ? '<span class="chk-i" title="연결된 확인 필요 항목은 사진 대조로 확인 완료">✓</span>' : "";
    const cs = csatBadge(rs[0]);
    return `${parts.join("<br>")}${kinds ? `<div class="mxk">${kinds}</div>` : ""}${cs ? `<div class="mxk">${cs}</div>` : ""}${w}`;
  }
  const sigOf = (det, key, sid) => {
    const rs = det.get(`${key}|${sid}`);
    return rs ? [...new Set(rs.map((r) => r.slot))].sort().join("+") : "";
  };

  // ------------------------------------------------------------------ 4. 과목 × 학교 매트릭스
  async function matrix() {
    const [mx, sidx, det] = await Promise.all([api.load("subject-matrix"), api.load("search-index"), getDet()]);
    const textOf = new Map(sidx.map((x) => [x.subjectKey, x]));
    const m = state.matrix, N = summary.length;
    const subAreas = [...new Set(mx.map((r) => r.subArea).filter(Boolean))].sort();
    const sel = (id, vals, cur, fmt = (v) => v) => `<select id="${id}"><option value="">전체</option>${vals.map((v) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(fmt(v))}</option>`).join("")}</select>`;
    view.innerHTML = `
      <div class="filters">
        <input type="search" id="m-q" placeholder="과목명·초성 검색" value="${esc(m.q)}">
        <label>교과군 ${sel("m-area", facets.areas, m.area)}</label>
        <label>세부 ${sel("m-sub", subAreas, m.subArea)}</label>
        <label>개설 학교 ${sel("m-presence", ["all", "some", "one"], m.presence, (v) => ({ all: "모든 학교에 있음", some: "일부 학교에만", one: "한 학교에만" }[v]))}</label>
        <label>이수 방식 ${sel("m-sel", ["school", "student", "outside"], m.sel, (v) => SEL[v])}</label>
        <label>수능 영역 ${sel("m-carea", csatAreaOpts, m.csatArea, csatAreaLabel)}</label>
        <label>수능 범위 ${sel("m-cscope", ["in", "base", "out"], m.csatScope, (v) => SCOPE_TXT[v][0])}</label>
        <label>학교에 있는 과목 ${sel("m-school", summary.map((x) => x.schoolId), m.school, (id) => short(schoolById.get(id)?.name || id))}</label>
      </div>
      <p class="muted" id="m-count"></p>
      <div class="table-wrap"><table class="tbl mxt" id="mxt"></table></div>
      <p class="muted"><span class="mxe required">학교지정</span> 모든 학생이 이수 · <span class="mxe elective">학생선택</span> 택n 묶음의 후보(고를 수/후보 수) · <span class="mxe outside">학교 밖</span> 교내 학점에 불포함 · — 편제표에 없음. 구분은 인쇄된 값이고 "글자색"은 글자색(검정 일반·빨강 진로·파랑 융합)으로 읽은 값, "추정"은 다른 학교 표기로 추정한 값입니다. 수능 표시는 2028학년도 확정안 기준이며 2030학년도 적용은 가정입니다.</p>`;
    const draw = () => {
      const q = m.q.trim().toLowerCase(), qi = m.q.replace(/\s/g, "");
      const rows = mx.filter((r) => {
        const x = textOf.get(r.subjectKey);
        const has = (sid) => det.has(`${r.subjectKey}|${sid}`);
        const cnt = summary.filter((s) => has(s.schoolId)).length;
        return (!m.area || r.area === m.area) && (!m.subArea || r.subArea === m.subArea) &&
          (!q || (x && (x.text.includes(q) || (x.initials || "").includes(qi))) || r.name.toLowerCase().includes(q)) &&
          (!m.presence || (m.presence === "all" ? cnt === N : m.presence === "one" ? cnt === 1 : cnt < N)) &&
          (!m.school || has(m.school)) &&
          (!(m.sel || m.csatArea || m.csatScope) || summary.some((s) => (det.get(`${r.subjectKey}|${s.schoolId}`) || []).some((o) => (!m.sel || selOf(o) === m.sel) && csatMatch(o, m.csatArea, m.csatScope))));
      }).sort((a, b) => facets.areas.indexOf(a.area) - facets.areas.indexOf(b.area) || b.schoolCount - a.schoolCount || a.name.localeCompare(b.name, "ko"));
      view.querySelector("#m-count").textContent = `${rows.length}개 과목 (전체 ${mx.length}개)`;
      let last = "";
      view.querySelector("#mxt").innerHTML = `<thead><tr><th class="sticky">과목</th>${summary.map((s) => `<th>${esc(short(s.schoolName))}${badge(s.confidence)}</th>`).join("")}</tr></thead><tbody>
        ${rows.length ? rows.map((r) => {
          const head = r.area !== last ? `<tr class="grp-row"><td colspan="${N + 1}">${esc(r.area)}</td></tr>` : "";
          last = r.area;
          return `${head}<tr><td class="sticky"><b>${esc(r.name)}</b>${r.subArea ? `<span class="tag">${esc(r.subArea)}</span>` : ""}</td>${summary.map((s) => `<td class="mx">${cellHtml(det, r.subjectKey, s.schoolId)}</td>`).join("")}</tr>`;
        }).join("") : `<tr><td colspan="${N + 1}" class="empty">조건에 맞는 과목이 없습니다.</td></tr>`}</tbody>`;
    };
    draw();
    view.querySelector("#m-q").addEventListener("input", (e) => { m.q = e.target.value; draw(); });
    for (const [id, key] of [["m-area", "area"], ["m-sub", "subArea"], ["m-presence", "presence"], ["m-sel", "sel"], ["m-carea", "csatArea"], ["m-cscope", "csatScope"], ["m-school", "school"]]) {
      view.querySelector("#" + id).addEventListener("change", (e) => { m[key] = e.target.value; draw(); });
    }
  }

  // ------------------------------------------------------------------ 5. 학교 간 비교 (2~4개교)
  async function versus() {
    const [mx, det] = await Promise.all([api.load("subject-matrix"), getDet()]);
    const v = state.versus;
    const draw = () => {
      const chosen = summary.filter((s) => v.ids.includes(s.schoolId));
      const chips = `<div class="chips pick">${summary.map((s) => `<label class="chip ${v.ids.includes(s.schoolId) ? "on" : ""}"><input type="checkbox" value="${esc(s.schoolId)}" ${v.ids.includes(s.schoolId) ? "checked" : ""} ${!v.ids.includes(s.schoolId) && v.ids.length >= 4 ? "disabled" : ""}> ${esc(s.schoolName)}</label>`).join("")}</div>`;
      if (chosen.length < 2) { view.innerHTML = `<p class="muted">비교할 학교를 2~4곳 고르세요.</p>${chips}<p class="empty">2곳 이상 선택해 주세요.</p>`; return bind(); }
      const row = (label, fn, opts = {}) => {
        const vals = chosen.map(fn);
        const nums = vals.filter((x) => typeof x === "number");
        const hi = opts.hi && new Set(nums).size > 1 ? Math.max(...nums) : null, lo = opts.hi && new Set(nums).size > 1 ? Math.min(...nums) : null;
        return `<tr><th>${label}</th>${vals.map((x) => `<td class="${typeof x === "number" ? "n" : ""} ${x === hi ? "hi" : ""} ${x === lo ? "lo" : ""}">${opts.html ? x : esc(x ?? "")}</td>`).join("")}</tr>`;
      };
      const head = `<thead><tr><th></th>${chosen.map((s) => `<th>${esc(s.schoolName)}</th>`).join("")}</tr></thead>`;
      const sec = (title, body, note = "") => `<h4>${title}</h4>${note ? `<p class="muted">${note}</p>` : ""}<div class="table-wrap"><table class="tbl vs">${head}<tbody>${body}</tbody></table></div>`;

      const info = ["schoolType:유형", "founding:설립", "region:지역", "assignment:배정방식", "gender:성별"].map((p) => { const [k, l] = p.split(":"); return row(l, (s) => s[k] || "미확인"); }).join("");
      const metrics = [["교과 학점", "creditsSubject"], ["지정 학점", "creditsRequired"], ["선택 학점", "creditsElective"], ["지정 과목 수", "requiredCount"], ["택n 묶음 수", "groupCount"],
        ["선택해야 하는 과목 수", "pickTotal"], ["후보 과목 수(중복 제거)", "candidateSubjects"], ["선택 폭", "breadth"], ["창체(시간)", "creativeHours"]]
        .map(([l, k]) => row(l, (s) => s[k], { hi: true })).join("")
        + row("택n 첫 학기", (s) => s.firstElectiveTerm || "-") + row("신뢰도", (s) => badge(s.confidence), { html: true }) + row("확인 필요(건)", (s) => s.reviewCount, { hi: true });
      const byTerm = TERMS.map((t) => row(t, (s) => `지정 ${num(s.byTerm?.[t]?.required)} / 선택 ${num(s.byTerm?.[t]?.elective)}`)).join("");
      const areas = facets.areas.map((a) => row(a, (s) => (s.byArea?.[a] ? `지정 ${num(s.byArea[a].required)}학점 · 후보 ${s.byArea[a].candidates}과목` : "-"))).join("");
      const csatRows = (csat.areas || []).map((a) => row(a.label, (x) => (x.byCsat?.[a.key] ? `${csatReqText(x.byCsat[a.key])}<br>${csatCandText(x.byCsat[a.key])} ${csatUnc(x.byCsat[a.key])}` : "-"), { html: true })).join("");
      const kinds = [...new Set(chosen.flatMap((s) => Object.keys(s.byKind || {})))].map((k) => row(k, (s) => (s.byKind?.[k] !== undefined ? `${num(s.byKind[k])}학점` : "-"))).join("");

      // 과목 차이
      const cats = { diff: [], partial: [], same: [] };
      for (const r of mx) {
        const pres = chosen.filter((s) => det.has(`${r.subjectKey}|${s.schoolId}`));
        if (!pres.length) continue;
        if (pres.length < chosen.length) cats.partial.push(r);
        else if (new Set(chosen.map((s) => sigOf(det, r.subjectKey, s.schoolId))).size > 1) cats.diff.push(r);
        else cats.same.push(r);
      }
      const sortR = (a, b) => facets.areas.indexOf(a.area) - facets.areas.indexOf(b.area) || a.name.localeCompare(b.name, "ko");
      const subjTable = (list) => `<div class="table-wrap"><table class="tbl vs">${head}<tbody>${list.sort(sortR).map((r) => `<tr><th>${esc(r.name)}<span class="tag">${esc(r.area)}</span></th>${chosen.map((s) => `<td class="mx">${cellHtml(det, r.subjectKey, s.schoolId)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${chosen.length + 1}" class="empty">없음</td></tr>`}</tbody></table></div>`;
      const uniqueBy = chosen.map((s) => ({ s, list: cats.partial.filter((r) => det.has(`${r.subjectKey}|${s.schoolId}`) && chosen.filter((c) => det.has(`${r.subjectKey}|${c.schoolId}`)).length === 1) }));

      view.innerHTML = `<p class="muted">학교를 2~4곳 고르세요. 숫자 행은 가장 큰 값이 <span class="hi">강조</span>됩니다(좋고 나쁨이 아니라 차이를 보기 위한 표시).</p>${chips}
        ${sec("학교 정보", info)}${sec("규모와 선택 폭", metrics, "선택 폭 = 후보 과목 수 ÷ 선택해야 하는 과목 수")}
        ${sec("학기별 학점 (지정 / 선택)", byTerm)}${sec("교과군별 (지정 학점 · 선택 후보 과목 수)", areas)}${sec("수능 영역별 이수 구성 (학교지정 + 학생선택 후보)", csatRows, "후보의 출제 범위 과목 수는 항상 학교지정 학점과 함께 읽어야 합니다. 출제 범위 후보가 0개여도 필수 과목이 이미 지정에 있으면 수능 대비가 부족한 것이 아닙니다.")}${sec("구분별 지정 학점", kinds, "구분이 인쇄되지 않은 학교는 '추정'·'미표기'로 따로 집계됩니다.")}
        <h4>과목 차이</h4>
        <div class="stats"><div class="stat"><div class="muted">모든 학교에 같은 방식</div><div class="v">${cats.same.length}</div></div><div class="stat"><div class="muted">모든 학교에 있으나 방식이 다름</div><div class="v">${cats.diff.length}</div></div><div class="stat"><div class="muted">일부 학교에만 있음</div><div class="v">${cats.partial.length}</div></div></div>
        <details open><summary><b>방식이 다른 과목</b> (필수/선택/학기가 학교마다 다름) ${cats.diff.length}개</summary>${subjTable(cats.diff)}</details>
        <details open><summary><b>일부 학교에만 있는 과목</b> ${cats.partial.length}개</summary>${subjTable(cats.partial)}
          ${uniqueBy.map(({ s, list }) => `<p class="muted"><b>${esc(short(s.schoolName))}</b>에만 있는 과목 ${list.length}개: ${list.sort(sortR).map((r) => esc(r.name)).join(", ") || "없음"}</p>`).join("")}</details>
        <details><summary><b>모든 학교에 같은 방식으로 있는 과목</b> ${cats.same.length}개</summary><div class="chips">${cats.same.sort(sortR).map((r) => `<span class="chip">${esc(r.name)}</span>`).join("")}</div></details>`;
      bind();
    };
    const bind = () => view.querySelectorAll(".pick input").forEach((i) => i.addEventListener("change", () => {
      v.ids = [...view.querySelectorAll(".pick input:checked")].map((x) => x.value);
      draw();
    }));
    draw();
  }

  go("compare");
}

