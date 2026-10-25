// 제도·일정 화면(대입 제도, 일정, 고교 유형·전형, 제도 변경 로그). 데이터는 data/policy.json.
const PST = { confirmed: "확정", reported: "보도", estimated: "추정", unknown: "확인 못 함", material: "학교 배부 자료", seoul: "서울교육청 자료" };
const SKIND = { official: "공식", media: "매체", material: "학교 배부", seoul: "서울교육청" };
const NOTICE = '<p class="note">조사일 2026-10-25, <b>검색 요약 기준이며 공식 사이트로 재확인 필요.</b> 입학학년도 2027(현 중3) · 대입학년도 2030. <span class="unv">원문 미확인</span> 표시는 원문 페이지를 열람하지 못했다는 뜻입니다.</p>';

// 대입 제도 화면에 보여 줄 과목 선택 지도 행(선택과목 조사 시기, 대학 권장이수과목, 수능 출제범위). 나머지 cur-*는 고교 유형·전형 화면.
const CUR_SYS = new Set(["cur-06", "cur-07", "cur-08"]);

export function register(views, { $, esc, load }) {
  const badge = (r) => `<span class="pst ${r.status}">${PST[r.status]}</span>${r.unverified ? ' <span class="unv">원문 미확인</span>' : ""}${r.note ? `<div class="muted small">${esc(r.note)}</div>` : ""}`;
  const src = (r) => {
    const list = r.sources || (r.sourceName ? [{ name: r.sourceName, url: r.sourceUrl }] : []);
    // 링크 없는 배부·교육청 자료는 긴 설명 대신 짧은 라벨만 보이고, 전체 설명은 마우스를 올리면 나온다.
    if (r.sourceKind === "material") return '<span class="muted">학교 배부 자료(원본 사진)</span>';
    if (r.sourceKind === "seoul") return `<span class="muted" title="${esc(r.sourceName || "")}">서울교육청 설명회 자료(원본 파일 미게시)</span>`;
    if (!list.length) return '<span class="muted">출처 없음</span>';
    return `${r.sourceKind ? `<span class="muted small">${SKIND[r.sourceKind]}</span> ` : ""}${list.map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(", ")}`;
  };
  const table = (rows, cols, cls = () => "") => `<div class="tw"><table class="policy"><thead><tr>${cols.map((c) => `<th class="l">${c[0]}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr class="${cls(r)}">${cols.map((c) => `<td class="l">${c[1](r)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}">해당 항목이 없습니다.</td></tr>`}</tbody></table></div>`;
  const basic = [["항목", (r) => `<b>${esc(r.title)}</b>`], ["내용", (r) => esc(r.body)], ["상태", badge], ["구분·출처", src]];
  const tabs = (items, on) => `<div class="subtabs">${items.map(([k, h, t]) => `<a href="${h}" class="${k === on ? "on" : ""}">${t}</a>`).join("")}</div>`;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  // 날짜 표시: 일 단위 값에는 요일을 코드로 계산해 붙이고, 월 단위 값은 그대로 둔다.
  const DOW = "일월화수목금토";
  const ymd = (d) => d.split("-").map(Number);
  const wd = (d) => { const [y, m, dd] = ymd(d); return DOW[new Date(y, m - 1, dd).getDay()]; };
  const day = (d) => { const [y, m, dd] = ymd(d); return dd ? `${y}.${m}.${dd}(${wd(d)})` : `${y}.${m}`; };
  const fmtDate = (d) => day(d);
  const fmt = (e) => {
    if (!e.end) return day(e.start);
    const [sy] = ymd(e.start), [ey, em, ed] = ymd(e.end);
    const tail = ed ? `${sy === ey ? "" : ey + "."}${em}.${ed}(${wd(e.end)})` : `${sy === ey ? "" : ey + "."}${em}`;
    return `${day(e.start)}~${tail}`;
  };
  const statusSelect = (rows) => `<div class="tools"><span class="muted">상태</span><select id="pst"><option value="">전체 (${rows.length})</option>${Object.entries(PST).filter(([k]) => rows.some((r) => r.status === k)).map(([k, v]) => `<option value="${k}">${v} (${rows.filter((r) => r.status === k).length})</option>`).join("")}</select></div>`;
  const dateOf = (t) => (t.match(/^\d{4}-\d{2}(-\d{2})?/) || [""])[0];

  // 상단 안내문은 수능 세부 범위 행(adm-07)의 body를 읽어, 문구를 policy.json 한 곳에서 관리한다.
  const banner = (rows) => `<div class="fixednote">2030학년도 제도는 중장기 대입 개편안 공표(2027.3 예정) 후 확정됩니다. ${esc(rows.find((r) => r.id === "adm-07")?.body || "수능 세부 범위는 추정")}</div>`;

  // 일정 표: events를 펼쳐 날짜순으로, 오늘 이전은 흐리게.
  const timeline = (rows) => {
    const t = today();
    const evs = rows.flatMap((r) => (r.events || []).map((e, i) => ({ ...e, r, first: i === 0 }))).sort((a, b) => a.start.localeCompare(b.start));
    const tr = (e) => `<tr class="${(e.end || e.start) < t ? "past" : ""}"><td class="l">${esc(fmt(e))}</td><td class="l"><b>${esc(e.r.title)}</b> · ${esc(e.label)}${e.first ? `<div class="muted small">${esc(e.r.body)}</div>` : ""}</td><td class="l">${badge(e.r)}</td><td class="l">${src(e.r)}</td></tr>`;
    const none = rows.filter((r) => !r.events);
    return `<p class="muted">오늘(${t}) 이전 일정은 흐리게 표시합니다.</p><div class="tw"><table class="policy"><thead><tr><th class="l">날짜</th><th class="l">항목</th><th class="l">상태</th><th class="l">구분·출처</th></tr></thead><tbody>${evs.map(tr).join("")}</tbody></table></div>${none.length ? `<h3>일정 미확인</h3>${table(none, basic)}` : ""}`;
  };

  const logTable = (rows) => table(rows, [["날짜", (r) => esc(dateOf(r.title) ? fmtDate(dateOf(r.title)) : "-")], ["항목", (r) => `<b>${esc(r.title.slice(dateOf(r.title).length).trim() || r.title)}</b>`], basic[1], basic[2], basic[3]]);

  // 상태 필터가 있는 표 공통 처리
  const filtered = (el, rows, draw) => {
    el.querySelector("#pst").addEventListener("change", () => draw(el.querySelector("#pst").value));
    draw("");
  };

  views.system = async (el, query) => {
    const rows = (await load("policy")).filter((r) => r.topic.startsWith("admission") || r.topic === "change-log" || CUR_SYS.has(r.id));
    const log = query.get("t") === "log";
    const body = rows.filter((r) => (r.topic === "change-log") === log);
    el.innerHTML = `${banner(rows)}${NOTICE}${tabs([["sys", "#admission/system", "제도"], ["log", "#admission/system?t=log", "제도 변경 로그"]], log ? "log" : "sys")}
      ${log ? "" : '<p class="muted">현 중3은 2028 개편안의 직접 대상(2025 입학생)이 아닙니다. 2030학년도 제도는 2027.3 공표 내용에 따라 바뀔 수 있습니다.</p>'}
      ${statusSelect(body)}<div id="ptbl"></div>`;
    const TOPIC = { "admission-system": "2028학년도 개편 확정안과 2030학년도 적용", "admission-outlook": "2030학년도 대상 추가 동향", "admission-structure": "대입 전형 구조", "cur-select": "과목 선택·대학 권장이수과목·수능 출제범위(참고)" };
    const NOTE = { "cur-select": '<p class="note">서울교육청 자료, 경기 적용 확인 필요. 수능 출제범위는 추정이며 2030학년도 확정이 아닙니다.</p>' };
    const key = (r) => (CUR_SYS.has(r.id) ? "cur-select" : r.topic);
    const cols = [...basic.slice(0, 2), ["대입학년도", (r) => `${r.examYear}<div class="muted small">입학 ${r.entryYear}</div>`], ...basic.slice(2)];
    filtered(el, body, (f) => {
      const rs = (x) => x.filter((r) => !f || r.status === f);
      $("#ptbl").innerHTML = log ? logTable(rs(body)) : Object.entries(TOPIC).map(([t, label]) => { const g = rs(body.filter((r) => key(r) === t)); return g.length ? `<h3>${label}</h3>${NOTE[t] || ""}${table(g, cols)}` : ""; }).join("") || '<p class="muted">조건에 맞는 항목이 없습니다.</p>';
    });
  };

  views.changelog = async (el) => {
    const rows = (await load("policy")).filter((r) => r.topic === "change-log");
    el.innerHTML = `${NOTICE}${statusSelect(rows)}<div id="ptbl"></div>`;
    filtered(el, rows, (f) => { $("#ptbl").innerHTML = logTable(rows.filter((r) => !f || r.status === f)); });
  };

  views.schedule = async (el, query) => {
    const tab = query.get("t") === "univ" ? "univ" : "hs";
    const all = await load("policy");
    const rows = all.filter((r) => r.topic === (tab === "univ" ? "exam-schedule" : "hs-schedule"));
    el.innerHTML = `${tabs([["hs", "#schedule?t=hs", "고입"], ["univ", "#schedule?t=univ", "대입"]], tab)}${NOTICE}
      <p class="muted">${tab === "univ" ? "수능·대교협 일정. 2030학년도분은 대부분 추정입니다." : "2027학년도 고입(서울 기준). 연도는 2027학년도 고입이 2026년 하반기에 진행되는 것을 기준으로 붙였습니다."}</p>${timeline(rows)}`;
  };

  views.types = async (el) => {
    const rows = await load("policy");
    // asg-02(2구역 학교) 본문: 풍덕·성복·수지·홍천 4개교가 모두 2구역이라는 내용을 눈에 띄게 한다.
    const cur = rows.filter((r) => r.topic === "curriculum-guide" && !CUR_SYS.has(r.id));
    const asg = rows.filter((r) => r.topic === "high-school-assignment");
    el.innerHTML = `${NOTICE}<h3>고교 유형</h3>${table(rows.filter((r) => r.topic === "hs-types"), basic)}
      ${asg.length ? `<h3>용인 평준화 배정 <span class="muted small">2026학년도 기준 참고</span></h3>
      <p class="note">원문 미확인, 2027 규칙 확인 필요</p>
      <div class="fixednote hlnote">우리 4개교(풍덕·성복·수지·홍천)는 모두 2구역</div>
      ${table(asg, basic, (r) => (r.id === "asg-02" ? "hl" : ""))}` : ""}
      <h3>고교학점제 요약 <span class="muted small">입학 후 제도</span></h3>${table(rows.filter((r) => r.topic === "hs-credit-system"), basic)}
      ${cur.length ? `<h3>졸업·이수 요건, 성적 산출, 과목 유형 <span class="muted small">서울교육청 과목 선택 지도 자료</span></h3>
      <p class="note">서울교육청 자료, 경기 적용 확인 필요</p>${table(cur, basic)}` : ""}
      <p class="muted">고입 전형 일정은 <a href="#schedule">일정</a> 화면의 고입 탭에서 봅니다.</p>`;
  };
}
