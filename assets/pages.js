// 대시보드 일반 화면: 홈(지금 할 일) · 일정 타임라인 · 고교 유형 · 대입 제도 · 제도 변경 로그 · 출처 현황 · 준비 중
// 데이터는 코드에 넣지 않고 암호화된 vault(통합 DB 파일)에서 api.load(이름)으로만 읽는다. docs/db-schema.md §10~§11 계약을 따른다.
// 읽는 파일: events, policy, high-school-types, admission-system, sources, facets(portal·csat), index. 파일이 없으면 "준비 중" 안내를 보인다.

const esc = (s = "") => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const safeUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : "");

// 신뢰도(§10): unverified → checked/reported → verified
const CONF = { verified: "확인됨", checked: "사진 대조 완료", reported: "보도·2차 자료", unverified: "미확인" };
const badge = (c, tip = "") => `<span class="badge b-${esc(c || "unverified")}"${tip ? ` title="${esc(tip)}"` : ""}>${esc(CONF[c] || CONF.unverified)}</span>`;
const DATE_STATUS_SHORT = { fixed: "확정", expected: "예정", tentative: "임시" };
const TERMS_STATUS = { ok: "이용조건 확인", partial: "일부 확인", unknown: "미확인", "n/a": "보도(해당 없음)" };

// ---- 날짜 ----
const day = (s) => new Date(`${s}T00:00:00`);
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dd = (s) => Math.round((day(s) - today()) / 86400000);
const ddText = (n) => (n === 0 ? "D-DAY" : n > 0 ? `D-${n}` : `D+${-n}`);

// ---- 데이터 읽기 ----
async function opt(api, name) {
  try { return await api.load(name); } catch { return null; }
}
const list = (d) => (Array.isArray(d) ? d : d?.items ?? null);
const arr = (v) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const empty = '<div class="placeholder">이 화면의 데이터가 아직 준비되지 않았습니다.</div>';
const rowsSorted = (rows, key, dir = 1) => [...rows].sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? "")) * dir);

// §11: 현 대상(입학 entryYear·대입 examYear)에 해당하는 행인가
const isTarget = (row, target) => {
  const a = row.appliesTo || {};
  return (!!target?.entryYear && arr(a.entryYear).includes(target.entryYear)) || (!!target?.examYear && arr(a.examYear).includes(target.examYear));
};
const yearsText = (a = {}) => [arr(a.entryYear).length ? `입학 ${arr(a.entryYear).join(", ")}` : "", arr(a.examYear).length ? `대입 ${arr(a.examYear).join(", ")}` : ""].filter(Boolean).join(" · ");
const isActive = (r) => r.status !== "superseded"; // superseded 는 이력으로 남은 이전 값(흐리게)
// 근거: 이름(http(s) 링크) + 조회일. 링크가 없으면 이름만.
const sourceLinks = (src) => arr(src).map((s) => `${safeUrl(s.url) ? `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>` : esc(s.name)}${s.retrieved ? ` <span class="muted">(조회 ${esc(s.retrieved)})</span>` : ""}`).join(", ");

// 날짜 상태(fixed/expected/tentative)와 제도 상태(phase) 배지. 임시값은 눈에 띄게 "임시"로 표시한다.
const dateBadge = (status, label) => (status ? `<span class="badge b-date-${esc(status)}" title="${esc(label || "")}">${esc(DATE_STATUS_SHORT[status] || status)}${status === "tentative" ? " (미확인)" : ""}</span>` : "");
const phaseBadge = (phase, label) => (phase ? `<span class="badge b-phase-${esc(phase)}">${esc(label || phase)}</span>` : "");
// 마지막 확인(updated)이 staleAfterDays 를 넘었으면 "오래됨"
const oldBadge = (row, ctx) => (row.updated && -dd(row.updated) > ctx.stale ? `<span class="badge b-old" title="마지막 확인 ${esc(row.updated)} (${ctx.stale}일 초과)">오래됨</span>` : "");

async function portalCtx(api) {
  const facets = (await opt(api, "facets")) || {};
  const portal = facets.portal || {};
  return { portal, target: portal.targetCohort, notice: facets.csat?.notice || "", stale: portal.staleAfterDays ?? 90, phaseLabel: (p) => portal.phase?.[p] || p || "", dateLabel: (s) => portal.dateStatus?.[s] || s || "" };
}

const table = (heads, rows) => `<div class="table-wrap"><table class="tbl pg-table"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const isStale = (s, stale) => !s.lastChecked || -dd(s.lastChecked) > stale;

function eventCard(e, ctx) {
  const end = e.dateEnd || e.dateStart, n = dd(end), shown = dd(e.dateStart) > 0 ? dd(e.dateStart) : n;
  const range = e.dateEnd ? `${e.dateStart} ~ ${e.dateEnd.slice(5)}` : e.dateStart;
  return `<div class="card${n < 0 || !isActive(e) ? " past" : ""}"><div class="row"><span class="date">${esc(range)}</span><span>${esc(e.title)}</span><span class="dday">${ddText(shown)}</span></div>
    <div class="muted">${badge(e.confidence)}${dateBadge(e.dateStatus, ctx.dateLabel(e.dateStatus))}${oldBadge(e, ctx)}${esc(e.category || "")} · ${esc(e.scope || "")}${yearsText(e.appliesTo) ? ` · ${esc(yearsText(e.appliesTo))}학년도` : ""}
    ${e.source?.length ? ` · ${sourceLinks(e.source)}` : ""}${e.note ? ` · ${esc(e.note)}` : ""}${e.updated ? ` · 확인 ${esc(e.updated)}` : ""}</div></div>`;
}

export const pages = {
  // ---------------------------------------------------------------- 홈: 지금 할 일 (§11-6)
  async home(el, data, api) {
    const [ctx, evRaw, srcRaw] = await Promise.all([portalCtx(api), opt(api, "events"), opt(api, "sources")]);
    const events = list(evRaw), sources = list(srcRaw);
    let html = `<p class="muted">오늘 ${esc(new Date().toLocaleDateString("sv-SE"))}${ctx.target ? ` · 대상 ${ctx.target.examYear}학년도 대입(입학 ${ctx.target.entryYear})` : ""}</p>`;
    if (ctx.notice) html += `<div class="notice">⚠️ ${esc(ctx.notice)}</div>`;
    if (!events) html += `<h3>다음 마감</h3>${empty}`;
    else {
      const up = rowsSorted(events.filter((e) => isActive(e) && isTarget(e, ctx.target) && dd(e.dateEnd || e.dateStart) >= 0), "dateStart").slice(0, 3);
      html += `<h3>다음 마감 3건</h3>${up.map((e) => eventCard(e, ctx)).join("") || '<p class="muted">예정된 일정이 없습니다.</p>'}`;
    }
    if (sources) {
      const stale = sources.filter((s) => isActive(s) && isStale(s, ctx.stale));
      html += `<h3>데이터 점검</h3><div class="card">출처 ${sources.length}건 중 <b>${stale.length}건</b>이 미열람이거나 ${ctx.stale}일을 넘었습니다. <span class="muted">(자료실 → 출처·갱신 현황)</span></div>`;
    }
    el.innerHTML = html;
  },

  // ---------------------------------------------------------------- 일정: 전체 타임라인 (§11-6)
  async timeline(el, data, api) {
    const [ctx, evRaw] = await Promise.all([portalCtx(api), opt(api, "events")]);
    const events = list(evRaw);
    if (!events) return void (el.innerHTML = empty);
    const scopes = [...new Set(events.map((e) => e.scope).filter(Boolean))], cats = [...new Set(events.map((e) => e.category).filter(Boolean))];
    el.innerHTML = `<p class="muted">고입·대입·수능 일정. 날짜의 "예정"·"임시"는 기본계획·보도 기준 값이라 공고로 다시 확인해야 합니다.</p>
      <div class="filters"><label>범위 <select id="f-scope"><option value="">전체</option>${scopes.map((s) => `<option>${esc(s)}</option>`).join("")}</select></label>
      <label>구분 <select id="f-cat"><option value="">전체</option>${cats.map((s) => `<option>${esc(s)}</option>`).join("")}</select></label>
      <label><input type="checkbox" id="f-all"> 다른 학년도(참고) 포함</label></div><div id="tl"></div>`;
    const draw = () => {
      const sc = el.querySelector("#f-scope").value, cat = el.querySelector("#f-cat").value, all = el.querySelector("#f-all").checked;
      const rows = rowsSorted(events.filter((e) => (all || isTarget(e, ctx.target)) && (!sc || e.scope === sc) && (!cat || e.category === cat)), "dateStart");
      el.querySelector("#tl").innerHTML = rows.map((e) => eventCard(e, ctx)).join("") || '<p class="muted">해당 일정이 없습니다.</p>';
    };
    draw();
    for (const id of ["#f-scope", "#f-cat", "#f-all"]) el.querySelector(id).onchange = draw;
  },

  // ---------------------------------------------------------------- 고교 선택: 유형·전형 (§11-3)
  async hstypes(el, data, api) {
    const [ctx, raw] = await Promise.all([portalCtx(api), opt(api, "high-school-types")]);
    const rows = list(raw);
    if (!rows) return void (el.innerHTML = empty);
    el.innerHTML = `<p class="muted">시기는 지역마다 다릅니다. 표의 "기준 지역"은 근거 보도가 어느 지역 기준인지 뜻합니다.</p>${table(["유형", "시기", "선발 방식", "기준 지역", "신뢰도", "출처"], rows.filter(isActive).map((t) => `<tr><td>${esc(t.type)}</td><td>${esc(t.timing)}</td><td>${esc(t.method)}</td><td>${esc(t.scopeNote || "")}</td><td>${badge(t.confidence)}${oldBadge(t, ctx)}</td><td>${sourceLinks(t.source)}</td></tr>`))}
      <p class="muted">거주 시·도교육청의 입학전형 기본계획과 학교 공고로 반드시 다시 확인하세요.</p>`;
  },

  // ---------------------------------------------------------------- 대입: 제도 요약 (§11-4)
  async system(el, data, api) {
    const [ctx, raw] = await Promise.all([portalCtx(api), opt(api, "admission-system")]);
    const rows = list(raw);
    const notice = ctx.notice ? `<div class="notice">${esc(ctx.notice)}</div>` : "";
    if (!rows) return void (el.innerHTML = `${notice}${empty}`);
    el.innerHTML = `${notice}${table(["항목", "내용", "상태", "적용 학년도", "비고"], rows.filter(isActive).map((r) => `<tr><td>${esc(r.topic)}</td><td>${esc(r.content)}</td><td>${badge(r.confidence)}${phaseBadge(r.phase, ctx.phaseLabel(r.phase))}${oldBadge(r, ctx)}</td><td>${esc(yearsText(r.appliesTo))}</td><td>${esc(r.note || "")}${r.source?.length ? `<div>${sourceLinks(r.source)}</div>` : ""}</td></tr>`))}
      <p class="muted">수능 영역별 이수 구성은 "고교 선택 → 학교별 편제표"에서 볼 수 있습니다.</p>`;
  },

  // ---------------------------------------------------------------- 제도 변경 로그 (§11-2)
  async policy(el, data, api) {
    const [ctx, raw] = await Promise.all([portalCtx(api), opt(api, "policy")]);
    const rows = list(raw);
    if (!rows) return void (el.innerHTML = empty);
    el.innerHTML = `<p class="muted">날짜 · 내용 · 영향 학년도 · 상태 · 출처. 이전 값으로 대체된 항목은 흐리게 표시합니다.</p>` + rowsSorted(rows, "date", -1).map((p) => `<div class="card${isActive(p) ? "" : " past"}"><div class="row"><span class="date">${esc(p.date)}</span><b>${esc(p.title)}</b></div><div>${esc(p.summary)}</div>
      <div class="muted">${badge(p.confidence)}${phaseBadge(p.phase, ctx.phaseLabel(p.phase))}${oldBadge(p, ctx)}${isActive(p) ? "" : '<span class="badge">대체됨</span>'}${yearsText(p.appliesTo) ? `영향 ${esc(yearsText(p.appliesTo))}학년도` : ""}${p.source?.length ? ` · ${sourceLinks(p.source)}` : ""}</div></div>`).join("");
  },

  // ---------------------------------------------------------------- 자료실: 출처·갱신 현황 (§11-5)
  async sources(el, data, api) {
    const [ctx, raw] = await Promise.all([portalCtx(api), opt(api, "sources")]);
    const rows = list(raw);
    if (!rows) return void (el.innerHTML = empty);
    el.innerHTML = `<p class="muted">${ctx.stale}일을 넘었거나 아직 열람하지 못한 항목은 ⚠️로 표시합니다.</p>${table(["출처", "구분", "확인일", "이용조건", "신뢰도", ""], rows.filter(isActive).map((s) => `<tr><td>${safeUrl(s.url) ? `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>` : esc(s.name)}${s.note ? `<div class="muted">${esc(s.note)}</div>` : ""}</td><td>${esc({ official: "공식", media: "보도", self: "사용자 제공" }[s.kind] || s.kind || "")}</td><td>${esc(s.lastChecked) || "미열람"}</td><td>${esc(TERMS_STATUS[s.termsStatus] || s.termsStatus || "")}</td><td>${badge(s.confidence)}</td><td>${isStale(s, ctx.stale) ? `⚠️ ${s.lastChecked ? "오래됨" : "미열람"}` : ""}</td></tr>`))}`;
  },

  // ---------------------------------------------------------------- 준비 중 안내(문구는 vault 의 section.message)
  soon(el, data, api, section) {
    el.innerHTML = `<div class="placeholder">${esc(section?.message || "준비 중입니다.")}</div>`;
  },
};
