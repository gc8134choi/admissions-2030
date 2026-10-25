import { creditView } from "./credit.js";
import { loadAudience, saveAudience, toggleAudience, audienceMatch, audienceChips } from "./home.js";

// 제도·일정 화면(대입 제도, 일정, 고교 유형·전형, 제도 변경 로그). 데이터는 data/policy.json.
const PST = { confirmed: "확정", reported: "보도", estimated: "추정", unknown: "확인 못 함", material: "학교 배부 자료", seoul: "서울교육청 자료", "seoul-verified": "서울교육청 자료(원문 확인)", match: "서울·경기 자료 일치", gyeonggi: "경기도교육청 자료", opinion: "의견", academy: "학원 자료" };
const SKIND = { official: "공식", media: "매체", material: "학교 배부", seoul: "서울교육청", "seoul-gyeonggi": "서울·경기교육청", gyeonggi: "경기도교육청", opinion: "학원 의견", academy: "학원 자료" };
const NOTICE = '<p class="note">조사일 2026-10-25, <b>검색 요약 기준이며 공식 사이트로 재확인 필요.</b> 입학학년도 2027(현 중3) · 대입학년도 2030. <span class="unv">원문 미확인</span> 표시는 원문 페이지를 열람하지 못했다는 뜻입니다.</p>';

// 대입 제도 화면에 표로 보여 줄 cur-* 행(수능 출제범위, 전형 구분, 학종 평가요소). 나머지는 고교학점제 이해 화면.
const CUR_SYS = new Set(["cur-08", "cur-29", "cur-30"]);
// 학원 설명 자료 중 대입 관련 행(acd-04 진학 비율은 고교 유형 화면의 학원 의견 섹션).
const ACD_SYS = new Set(["acd-01", "acd-02", "acd-03"]);
// 대입 전형 구분·학생부종합 평가요소는 "대입 전형 구조" 묶음에, 수능 출제범위는 따로 묶는다.
const CUR_GROUP = { "cur-29": "admission-structure", "cur-30": "admission-structure" };

export function register(views, { $, esc, load, store }) {
  const badgeMain = (r) => `<span class="pst ${r.status}">${PST[r.status]}</span>${r.unverified ? ` <span class="unv"${r.reason ? ` title="${esc(r.reason)}"` : ""}>원문 미확인</span>` : ""}`;
  const badgeNote = (r) => `${r.unverified && r.reason ? `<div class="muted small">사유: ${esc(r.reason)}</div>` : ""}${r.note ? `<div class="muted small">${esc(r.note)}</div>` : ""}`;
  const badge = (r) => badgeMain(r) + badgeNote(r);
  const src = (r) => {
    const list = r.sources || (r.sourceName ? [{ name: r.sourceName, url: r.sourceUrl }] : []);
    // 링크 없는 배부·교육청 자료는 긴 설명 대신 짧은 라벨만 보이고, 전체 설명은 마우스를 올리면 나온다.
    if (r.sourceKind === "material") return '<span class="muted">학교 배부 자료(원본 사진)</span>';
    const label = { "seoul-gyeonggi": "서울·경기교육청 자료(원본 파일 미게시, 경기는 요약본)", gyeonggi: "경기도교육청 안내자료 요약본" }[r.sourceKind];
    if (label) return `<span class="muted" title="${esc(r.sourceName || "")}">${label}</span>`;
    if (r.sourceKind === "opinion" || r.sourceKind === "academy") return `<span class="muted">${esc(r.sourceName || "출처 미표기")}</span>`;
    if (r.status === "seoul-verified") { const no = (r.sourceName || "").match(/서교연 [\d-]+/); return `<span class="muted" title="${esc(r.sourceName || "")}">서울교육청 선택 과목 안내서${no ? `(${no[0]})` : ""}</span>`; }
    if (r.sourceKind === "seoul") return `<span class="muted" title="${esc(r.sourceName || "")}">서울교육청 설명회 자료(원본 파일 미게시)</span>`;
    if (!list.length) return '<span class="muted">출처 없음</span>';
    return `${r.sourceKind ? `<span class="muted small">${SKIND[r.sourceKind]}</span> ` : ""}${list.map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(", ")}`;
  };
  const table = (rows, cols, cls = () => "") => `<div class="tw"><table class="policy"><thead><tr>${cols.map((c) => `<th class="l">${c[0]}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr class="${cls(r)}">${cols.map((c) => `<td class="l">${c[1](r)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}">해당 항목이 없습니다.</td></tr>`}</tbody></table></div>`;
  const basic = [["항목", (r) => `<b>${esc(r.title)}</b>`], ["내용", (r) => esc(r.body)], ["상태", badge], ["구분·출처", src]];
  // 출처 칩: 공식=에메랄드, 매체=회색, 그 밖(배부·교육청·학원 등)은 중립. 링크 없는 자료는 짧은 라벨만(전체 설명은 툴팁).
  const srcChips = (r) => {
    const list = r.sources || (r.sourceName ? [{ name: r.sourceName, url: r.sourceUrl }] : []);
    const chip = (cls, t, url, title) => (url ? `<a class="sc ${cls}" href="${esc(url)}" target="_blank" rel="noopener">${esc(t)}</a>` : `<span class="sc ${cls}"${title ? ` title="${esc(title)}"` : ""}>${esc(t)}</span>`);
    const label = { "seoul-gyeonggi": "서울·경기교육청 자료(원본 파일 미게시, 경기는 요약본)", gyeonggi: "경기도교육청 안내자료 요약본", material: "학교 배부 자료(원본 사진)", seoul: "서울교육청 설명회 자료(원본 파일 미게시)" }[r.sourceKind];
    if (r.status === "seoul-verified") { const no = (r.sourceName || "").match(/서교연 [\d-]+/); return chip("kind", `서울교육청 선택 과목 안내서${no ? `(${no[0]})` : ""}`, "", r.sourceName); }
    if (label) return chip("kind", label, "", r.sourceName);
    if (r.sourceKind === "opinion" || r.sourceKind === "academy") return chip("kind", r.sourceName || "출처 미표기");
    if (!list.length) return chip("none", "출처 없음");
    const k = r.sourceKind === "official" ? "official" : r.sourceKind === "media" ? "media" : "kind";
    return `${r.sourceKind ? `<span class="sk ${k}">${SKIND[r.sourceKind]}</span>` : ""}${list.map((x) => chip(k, x.name, x.url)).join("")}`;
  };
  // 카드 리스트(표 대체): 항목명(좌)·상태 배지(우), 내용 전폭, 출처 칩. 옵션: meta(r)=제목 위 작은 글씨, cls(r)=추가 클래스, title(r)=제목.
  const cards = (rows, { meta, cls = () => "", title = (r) => r.title } = {}) => rows.length
    ? `<div class="rowlist">${rows.map((r) => `<article class="rowcard ${cls(r)}">${meta ? `<div class="rc-meta">${esc(meta(r))}</div>` : ""}<h4 class="rc-t">${esc(title(r))}</h4><div class="rc-s">${badgeMain(r)}</div><p class="rc-b">${esc(r.body)}</p>${badgeNote(r) ? `<div class="rc-n">${badgeNote(r)}</div>` : ""}<div class="rc-src">${srcChips(r)}</div></article>`).join("")}</div>`
    : '<p class="muted">해당 항목이 없습니다.</p>';
  const cnt = (n) => `<span class="cnt">${n}</span>`;
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
  const statusSelect = (rows) => `<div class="tools" id="pstw" role="group" aria-label="상태 필터"><span class="muted">상태</span><button type="button" class="fchip on" data-st="">전체 ${rows.length}</button>${Object.entries(PST).filter(([k]) => rows.some((r) => r.status === k)).map(([k, v]) => `<button type="button" class="fchip" data-st="${k}">${v} ${rows.filter((r) => r.status === k).length}</button>`).join("")}</div>`;
  const dateOf = (t) => (t.match(/^\d{4}-\d{2}(-\d{2})?/) || [""])[0];

  // 상단 안내문은 수능 세부 범위 행(adm-07)의 body를 읽어, 문구를 policy.json 한 곳에서 관리한다.
  const banner = (rows) => `<div class="al-body">2030학년도 제도는 중장기 대입 개편안 공표(2027.3 예정) 후 확정됩니다. ${esc(rows.find((r) => r.id === "adm-07")?.body || "수능 세부 범위는 추정")}</div>`;

  // 일정 표: events를 펼쳐 날짜순으로, 오늘 이전은 흐리게.
  const timeline = (rows) => {
    const t = today();
    const evs = rows.flatMap((r) => (r.events || []).map((e, i) => ({ ...e, r, first: i === 0 }))).sort((a, b) => a.start.localeCompare(b.start));
    const tr = (e) => `<tr class="${(e.end || e.start) < t ? "past" : ""}"><td class="l">${esc(fmt(e))}</td><td class="l"><b>${esc(e.r.title)}</b>${e.label ? ` · ${esc(e.label)}` : ""}${e.first ? `<div class="muted small">${esc(e.r.body)}</div>` : ""}</td><td class="l">${badge(e.r)}</td><td class="l">${src(e.r)}</td></tr>`;
    const none = rows.filter((r) => !r.events);
    return `<p class="muted">오늘(${t}) 이전 일정은 흐리게 표시합니다.</p><div class="tw"><table class="policy"><thead><tr><th class="l">날짜</th><th class="l">항목</th><th class="l">상태</th><th class="l">구분·출처</th></tr></thead><tbody>${evs.map(tr).join("")}</tbody></table></div>${none.length ? `<h3>일정 미확인</h3>${table(none, basic)}` : ""}`;
  };

  const logTable = (rows) => cards(rows, { meta: (r) => (dateOf(r.title) ? fmtDate(dateOf(r.title)) : "날짜 미정"), title: (r) => r.title.slice(dateOf(r.title).length).trim() || r.title });

  // 상태 필터가 있는 표 공통 처리
  const filtered = (el, rows, draw) => {
    let f = "";
    const render = () => { el.querySelectorAll("#pstw .fchip").forEach((b) => b.classList.toggle("on", b.dataset.st === f)); draw(f); };
    el.querySelector("#pstw").addEventListener("click", (e) => { const b = e.target.closest(".fchip"); if (!b) return; f = b.dataset.st; render(); });
    render();
  };

  views.system = async (el, query) => {
    const rows = (await load("policy")).filter((r) => r.topic.startsWith("admission") || r.topic === "change-log" || CUR_SYS.has(r.id) || ACD_SYS.has(r.id));
    const log = query.get("t") === "log";
    const body = rows.filter((r) => (r.topic === "change-log") === log);
    // 노란 경고는 한 줄로 합치고(앰버+코랄 선), 나머지 안내는 접어 둔다.
    el.innerHTML = `<div class="alert-amber"><b>2027.3 공표 전까지 확정 아님</b><details><summary>자세히</summary>${banner(rows)}${NOTICE}${log ? "" : '<p class="muted small">현 중3은 2028 개편안의 직접 대상(2025 입학생)이 아닙니다. 2030학년도 제도는 2027.3 공표 내용에 따라 바뀔 수 있습니다.</p>'}</details></div>${tabs([["sys", "#admission/system", "제도"], ["log", "#admission/system?t=log", "제도 변경 로그"]], log ? "log" : "sys")}
      ${statusSelect(body)}<div id="ptbl"></div>`;
    const TOPIC = { "admission-system": "2028학년도 개편 확정안과 2030학년도 적용", "admission-outlook": "2030학년도 대상 추가 동향", "admission-structure": "대입 전형 구조", "cur-select": "수능 출제범위(참고)", academy: "학원 설명 자료" };
    const NOTE = { "cur-select": '<p class="note">서울교육청 자료, 경기 적용 확인 필요. 수능 출제범위는 추정이며 2030학년도 확정이 아닙니다.</p>' };
    const key = (r) => (ACD_SYS.has(r.id) ? "academy" : CUR_SYS.has(r.id) ? CUR_GROUP[r.id] || "cur-select" : r.topic);
    // 선택과목 조사·대학 권장이수과목은 고교학점제 이해에서 자세히 보고, 여기는 한 줄 요약만 둔다.
    // 공식 이미지(공공누리 제1유형만 저장·표시). 그 밖의 자료는 링크만. 출처·이용 조건은 data/image-credits.json.
    const credits = (await load("image-credits")).filter((c) => /대입 제도/.test(c.screen));
    const imgBlock = credits.map((c) => c.usable
      ? `<figure class="pol-fig"><a href="img/credit/${esc(c.file)}" target="_blank" rel="noopener"><img src="img/credit/${esc(c.file)}" alt="${esc(c.title)}" loading="lazy"></a><figcaption>${esc(c.org)} · ${esc(c.title)} · <b>${esc(c.license)}</b> · <a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">원문 보기</a>${c.note ? `<div class="muted">${esc(c.note)}</div>` : ""}</figcaption></figure>`
      : `<p class="muted small">참고 링크(이용 조건 확인 필요): <a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(c.org)} · ${esc(c.title)}</a></p>`).join("");
    const pick = (await load("policy")).filter((r) => r.id === "cur-06" || r.id === "cur-07");
    const pickLine = pick.length ? `<p class="muted small">선택과목 조사·대학 권장이수과목: ${pick.map((r) => esc(r.body)).join(" / ")} · <a href="#life/credit">고교학점제 이해에서 자세히</a></p>` : "";
    const cols = [...basic.slice(0, 2), ["대입학년도", (r) => `${r.examYear}<div class="muted small">입학 ${r.entryYear}</div>`], ...basic.slice(2)];
    filtered(el, body, (f) => {
      const rs = (x) => x.filter((r) => !f || r.status === f);
      $("#ptbl").innerHTML = log ? logTable(rs(body)) : Object.entries(TOPIC).map(([t, label]) => { const g = rs(body.filter((r) => key(r) === t)); if (!g.length) return "";
        if (t === "academy") return `<h3>${label} ${cnt(g.length)} <span class="opinion-label">학원</span></h3><div class="opinion"><p class="muted small">학원 설명회 의견·자료입니다. 확인된 사실이 아닙니다.</p>${cards(g, { meta: (r) => `대입 ${r.examYear}학년도 · 입학 ${r.entryYear}` })}</div>`;
        return `<h3>${label} ${cnt(g.length)}</h3>${t === "cur-select" ? pickLine : ""}${NOTE[t] || ""}${cards(g, { meta: (r) => `대입 ${r.examYear}학년도 · 입학 ${r.entryYear}` })}${t === "cur-select" ? imgBlock : ""}`; }).join("") || '<p class="muted">조건에 맞는 항목이 없습니다.</p>';
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
    const rows = all.filter((r) => r.topic === (tab === "univ" ? "exam-schedule" : "hs-schedule") || (tab === "hs" && r.topic === "gg-hs-entry" && r.events));
    const chips = '<div id="aud"></div>'; // 칩 UI·저장(portal.audience)은 home.js와 공유
    el.innerHTML = `${tabs([["hs", "#schedule?t=hs", "고입"], ["univ", "#schedule?t=univ", "대입"]], tab)}${NOTICE}
      <p class="muted">${tab === "univ" ? "수능·대교협 일정. 2030학년도분은 대부분 추정입니다." : "2027학년도 고입(서울 기준). 연도는 2027학년도 고입이 2026년 하반기에 진행되는 것을 기준으로 붙였습니다."}</p>${chips}<div id="tl"></div>`;
    let sel = loadAudience(store);
    const draw = () => {
      $("#aud").innerHTML = audienceChips(sel, esc) + '<span class="muted small"> 선택 없음 = 전체</span>';
      $("#tl").innerHTML = timeline(rows.filter((r) => audienceMatch(r.audience, sel)));
    };
    $("#aud").addEventListener("click", (e) => {
      const k = e.target.closest("[data-aud]")?.dataset.aud;
      if (!k) return;
      sel = toggleAudience(sel, k);
      saveAudience(store, sel);
      draw();
    });
    draw();
  };

  // 고교학점제 이해(고교 생활 메뉴): 도표·그림 중심 화면은 credit.js.
  views.credit = (el) => creditView(el, { load, esc, badge, src, table: (rs) => cards(rs), basic });

  views.types = async (el) => {
    const rows = await load("policy");
    // asg-02(2구역 학교) 본문: 풍덕·성복·수지·홍천 4개교가 모두 2구역이라는 내용을 눈에 띄게 한다.
    const credit = rows.find((r) => r.id === "cur-01");
    const opn = rows.filter((r) => r.topic === "hs-choice-opinion" || r.id === "acd-04");
    const gg = rows.filter((r) => r.topic === "gg-hs-entry" && !r.events);
    const asg = rows.filter((r) => r.topic === "high-school-assignment");
    el.innerHTML = `${NOTICE}<h3>고교 유형 ${cnt(rows.filter((r) => r.topic === "hs-types").length)}</h3>${cards(rows.filter((r) => r.topic === "hs-types"))}
      ${gg.length ? `<h3>경기 고입 안내 <span class="muted small">2027학년도</span> ${cnt(gg.length)}</h3>${cards(gg)}` : ""}
      ${asg.length ? `<h3>용인 평준화 배정 <span class="muted small">2026학년도 기준 참고</span> ${cnt(asg.length)}</h3>
      <p class="note">원문 미확인, 2027 규칙 확인 필요</p>
      <div class="fixednote hlnote">우리 4개교(풍덕·성복·수지·홍천)는 모두 2구역</div>
      ${cards(asg, { cls: (r) => (r.id === "asg-02" ? "hl" : "") })}` : ""}
      ${credit ? `<h3>고교학점제 <span class="muted small">입학 후 제도</span></h3>
      <p>${esc(credit.body)} ${badge(credit)} · <a href="#life/credit">고교학점제 이해에서 자세히</a></p>` : ""}
      ${opn.length ? `<h3>선택 기준 ${cnt(opn.length)} <span class="opinion-label">학원 의견</span></h3>
      <div class="opinion"><p class="muted small">학원 설명회의 의견입니다. 확인된 사실이 아니며, 위 사실 섹션과 구분해서 보세요.</p>${cards(opn)}</div>` : ""}
      <p class="muted">고입 전형 일정은 <a href="#schedule">일정</a> 화면의 고입 탭에서 봅니다.</p>`;
  };
}
