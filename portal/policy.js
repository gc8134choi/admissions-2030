import { creditView } from "./credit.js";
import { roadmapView } from "./roadmap.js";
import { loadProfile, profileOf, filterByProfile } from "./profile.js";
import { loadAudience, saveAudience, toggleAudience, audienceMatch, audienceChips } from "./home.js";

// 제도·일정 화면(대입 제도, 일정, 고교 유형·전형, 바뀐 소식). 데이터는 data/policy.json. 스타일은 policy.css(A안 에디토리얼).
if (typeof document !== "undefined" && !document.getElementById("policy-css")) { const l = document.createElement("link"); l.id = "policy-css"; l.rel = "stylesheet"; l.href = "policy.css"; document.head.appendChild(l); }
// 상태 점: 확정=채운 점, 보도=반 채움, 추정=빈 점(앰버). 그 밖의 자료 상태는 빈 점 + 글자.
const ES = { confirmed: ["ok", "확정"], "seoul-verified": ["ok", "서울교육청 원문 확인"], reported: ["rep", "보도"], match: ["rep", "서울·경기 자료 일치"], seoul: ["rep", "서울교육청 자료"], gyeonggi: ["rep", "경기도교육청 자료"], material: ["rep", "학교 배부 자료"], estimated: ["est", "추정"], unknown: ["", "확인 못 함"], opinion: ["", "의견"], academy: ["", "학원 자료"] };
const PST = { confirmed: "확정", reported: "보도", estimated: "추정", unknown: "확인 못 함", material: "학교 배부 자료", seoul: "서울교육청 자료", "seoul-verified": "서울교육청 자료(원문 확인)", match: "서울·경기 자료 일치", gyeonggi: "경기도교육청 자료", opinion: "의견", academy: "학원 자료" };
const SKIND = { official: "공식", media: "매체", material: "학교 배부", seoul: "서울교육청", "seoul-gyeonggi": "서울·경기교육청", gyeonggi: "경기도교육청", opinion: "학원 의견", academy: "학원 자료" };
const NOTICE_TPL = '<p class="note">조사일 2026-10-25 · <b>검색 요약 기준이며 공식 사이트로 재확인 필요.</b> {L}: 입학학년도 {E} · 대입학년도 {X}. "원문은 아직 못 봤어요"는 원문 페이지를 열람하지 못했다는 뜻이에요.</p>';
const noticeFor = (p) => NOTICE_TPL.replace("{E}", p.entryYear).replace("{L}", `${p.label}(${p.grade})`).replace("{X}", p.examYear);

// 대입 제도 화면에 표로 보여 줄 cur-* 행(수능 출제범위, 전형 구분, 학종 평가요소). 나머지는 고교학점제 이해 화면.
const CUR_SYS = new Set(["cur-08", "cur-29", "cur-30"]);
// 학원 설명 자료 중 대입 관련 행(acd-04 진학 비율은 고교 유형 화면의 학원 의견 섹션).
const ACD_SYS = new Set(["acd-01", "acd-02", "acd-03"]);
// 대입 전형 구분·학생부종합 평가요소는 "대입 전형 구조" 묶음에, 수능 출제범위는 따로 묶는다.
const CUR_GROUP = { "cur-29": "admission-structure", "cur-30": "admission-structure" };

export function register(views, { $, esc, load, store }) {
  // 선택된 프로필(portal.profile)의 행 + 연도 없는 공통 행만 쓴다. 프로필을 바꾸면 셸이 화면을 다시 그린다.
  const curProfile = () => profileOf(loadProfile(store));
  const loadPolicy = async () => filterByProfile(await load("policy"), curProfile().id);
  const notice = () => noticeFor(curProfile());
  const badgeMain = (r) => { const [c, t] = ES[r.status] || ["", r.status]; return `${c === "ok" ? "" : `<span class="es ${c}">${esc(t)}</span>`}${r.unverified ? `<span class="ed-unv"${r.reason ? ` title="${esc(r.reason)}"` : ""}>원문은 아직 못 봤어요</span>` : ""}`; };
  // 확인된 항목(확정·원문 확인)은 메모를 "확인 필요/별도 확인"이 있을 때만 보여 준다.
  const badgeNote = (r) => { const ok = (ES[r.status] || [])[0] === "ok"; return `${r.unverified && r.reason ? `<div class="ed-note">사유: ${esc(r.reason)}</div>` : ""}${r.note && (!ok || /확인 필요|별도 확인/.test(r.note)) ? `<div class="ed-note">${esc(r.note)}</div>` : ""}`; };
  const badge = (r) => badgeMain(r) + badgeNote(r);
  // 출처: 문장 끝 밑줄 링크. 링크 없는 배부·교육청 자료는 짧은 라벨(전체 설명은 툴팁).
  const src = (r) => {
    const list = r.sources || (r.sourceName ? [{ name: r.sourceName, url: r.sourceUrl }] : []);
    const label = { "seoul-gyeonggi": "서울·경기교육청 자료(원본 파일 미게시, 경기는 요약본)", gyeonggi: "경기도교육청 안내자료 요약본", material: "학교 배부 자료(원본 사진)", seoul: "서울교육청 설명회 자료(원본 파일 미게시)" }[r.sourceKind];
    if (r.status === "seoul-verified") { const no = (r.sourceName || "").match(/서교연 [\d-]+/); return `<span title="${esc(r.sourceName || "")}">서울교육청 선택 과목 안내서${no ? `(${no[0]})` : ""}</span>`; }
    if (label) return `<span title="${esc(r.sourceName || "")}">${label}</span>`;
    if (r.sourceKind === "opinion" || r.sourceKind === "academy") return `<span>${esc(r.sourceName || "미표기")}</span>`;
    if (!list.length) return "<span>없음</span>";
    return `${r.sourceKind ? `<span>${SKIND[r.sourceKind]}</span> · ` : ""}${list.map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(" · ")}`;
  };
  const table = (rows, cols, cls = () => "") => `<div class="tw"><table class="policy"><thead><tr>${cols.map((c) => `<th class="l">${c[0]}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr class="${cls(r)}">${cols.map((c) => `<td class="l">${c[1](r)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}">해당 항목이 없어요.</td></tr>`}</tbody></table></div>`;
  const basic = [["항목", (r) => `<b>${esc(r.title)}</b>`], ["내용", (r) => esc(r.body)], ["상태", badge], ["구분·출처", src]];
  // 행 리스트(표 대체, A안): 왼쪽 상태 점, 오른쪽 제목·내용·출처. 구분은 헤어라인만. 옵션: meta(r)=제목 위 작은 글씨, cls(r)=추가 클래스, title(r)=제목.
  const cards = (rows, { meta, cls = () => "", title = (r) => r.title } = {}) => rows.length
    ? `<div class="ed-rows">${rows.map((r) => `<article class="ed-row ${cls(r)}">${meta && meta(r) ? `<div class="ed-meta">${esc(meta(r))}</div>` : ""}<div class="ed-st">${badgeMain(r)}</div><h3>${esc(title(r))}</h3><p class="ed-b">${esc(r.body)}</p>${badgeNote(r)}<p class="ed-s">출처 ${src(r)}</p></article>`).join("")}</div>`
    : '<p class="muted">해당 항목이 없어요.</p>';
  const cnt = (n) => `<span class="cnt">${n}</span>`;
  const tabs = (items, on) => `<div class="ed-tabs">${items.map(([k, h, t]) => `<a href="${h}" class="${k === on ? "on" : ""}">${t}</a>`).join("")}</div>`;
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
  // 상태 필터: 확정·원문 확인은 "확인됨"으로 묶는다(화면에는 확정 표시를 하지 않는다).
  const stKey = (r) => ((ES[r.status] || [])[0] === "ok" ? "ok" : r.status);
  const stMatch = (r, f) => !f || stKey(r) === f;
  const statusSelect = (rows) => { const keys = [...new Set(rows.map(stKey))].sort((a, b) => (a === "ok" ? -1 : b === "ok" ? 1 : 0)); return `<div class="ed-filter" id="pstw" role="group" aria-label="상태 필터"><span>상태</span><button type="button" class="on" data-st="">전체 ${rows.length}</button>${keys.map((k) => `<button type="button" data-st="${k}">${k === "ok" ? "확인됨" : ES[k] ? ES[k][1] : k} ${rows.filter((r) => stKey(r) === k).length}</button>`).join("")}</div>`; };
  const dateOf = (t) => (t.match(/^\d{4}-\d{2}(-\d{2})?/) || [""])[0];

  // 상단 안내문은 수능 세부 범위 행(adm-07)의 body를 읽어, 문구를 policy.json 한 곳에서 관리한다.
  const banner = (rows) => `<div class="al-body">2030학년도 제도는 중장기 대입 개편안 공표(2027.3 예정) 후 확정돼요. ${esc(rows.find((r) => r.id === "adm-07")?.body || "수능 세부 범위는 추정")}</div>`;

  // 일정 표: events를 펼쳐 날짜순으로, 오늘 이전은 흐리게.
  const timeline = (rows) => {
    const t = today();
    const evs = rows.flatMap((r) => (r.events || []).map((e, i) => ({ ...e, r, first: i === 0 }))).sort((a, b) => a.start.localeCompare(b.start));
    const only3 = (e) => { const a = e.audience || e.r.audience; return !!a && a.length > 0 && a.every((x) => x === "grade3"); };
    const tr = (e) => `<tr class="${(e.end || e.start) < t ? "past" : ""}${only3(e) ? " g3" : ""}"><td class="l">${esc(fmt(e))}</td><td class="l"><b>${esc(e.r.title)}</b>${e.label ? ` · ${esc(e.label)}` : ""}${e.first ? `<div class="muted small">${esc(e.r.body)}</div>` : ""}</td><td class="l">${badge(e.r)}</td><td class="l">${src(e.r)}</td></tr>`;
    const none = rows.filter((r) => !r.events);
    if (!evs.length && !none.length) return '<p class="note">아직 모인 일정이 없어요. 일정이 생기면 이 자리에 떠요.</p>';
    return `<p class="muted">오늘(${t}) 이전 일정은 흐리게, 현 고3 일정은 <span class="g3k">회색</span>으로 표시해요.</p><div class="tw"><table class="policy"><thead><tr><th class="l">날짜</th><th class="l">항목</th><th class="l">상태</th><th class="l">구분·출처</th></tr></thead><tbody>${evs.map(tr).join("")}</tbody></table></div>${none.length ? `<h2>일정 미확인</h2>${table(none, basic)}` : ""}`;
  };

  const logTable = (rows) => cards(rows, { meta: (r) => (dateOf(r.title) ? fmtDate(dateOf(r.title)) : "날짜 미정"), title: (r) => r.title.slice(dateOf(r.title).length).trim() || r.title });

  // 상태 필터가 있는 표 공통 처리
  const filtered = (el, rows, draw) => {
    let f = "";
    const render = () => { el.querySelectorAll("#pstw button").forEach((b) => b.classList.toggle("on", b.dataset.st === f)); draw(f); };
    el.querySelector("#pstw").addEventListener("click", (e) => { const b = e.target.closest("#pstw button"); if (!b) return; f = b.dataset.st; render(); });
    render();
  };


  // 수능 체제·내신 산출 규칙(rules.json). 선택된 학습자의 appliesTo 상태를 우선 표시한다(확정은 표시 안 함).
  const rulesSection = async () => {
    const rules = await load("rules"); const id = curProfile().id; const me = curProfile();
    const mine = (r) => (r.appliesTo || []).find((a) => a.learner === id);
    const stat = (st, unv) => badgeMain({ status: st, unverified: unv });
    const links = (list) => (list || []).length ? `<div class="ed-src">${list.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a> (${SKIND[x.kind] || x.kind})`).join(" · ")}</div>` : "";
    const regs = rules.csatRegimes.filter(mine).map((r) => { const a = mine(r);
      const tbl = r.areas ? `<table class="ed-tbl"><thead><tr><th>영역</th><th>문항</th><th>배점</th><th>시간</th><th>성적</th></tr></thead><tbody>${r.areas.map((x) => `<tr><td>${esc(x.area)}${x.scope ? `<div class="muted small">${esc(x.scope.join("·"))}</div>` : ""}</td><td>${x.items ?? ""}</td><td>${x.points ?? ""}</td><td>${x.minutes ?? ""}분</td><td>${x.scoring === "absolute" ? "절대평가" : "상대평가"}</td></tr>`).join("")}</tbody></table>` : "";
      return `<div class="ed-row"><div class="ed-st">${stat(a.status, r.unverified)}</div><h3>${esc(r.label)}</h3><p>${esc(a.note || r.note || "")}</p>${tbl}${links(a.sources && a.sources.length ? a.sources : r.sources)}</div>`; });
    const gr = rules.gradingRules.filter(mine).map((r) => { const a = mine(r); const b = r.rankGrades.bandPercent;
      return `<div class="ed-row"><div class="ed-st">${stat(a.status, r.unverified)}</div><h3>내신 산출: 5등급 상대평가</h3><p>${me.label}는 ${b.map((v, i) => `${i + 1}등급 ${v}%`).join(" · ")}로 등급을 매겨요. ${esc(a.note || "")}</p>${links(a.sources && a.sources.length ? a.sources : r.sources)}</div>`; });
    return regs.length + gr.length ? `<h2>수능·내신 규칙</h2><div class="ed-rows">${regs.join("")}${gr.join("")}</div>` : "";
  };

  views.system = async (el, query) => {
    const rows = (await loadPolicy()).filter((r) => r.topic.startsWith("admission") || r.topic === "change-log" || CUR_SYS.has(r.id) || ACD_SYS.has(r.id) || r.topic === "profile-2033");
    const log = query.get("t") === "log";
    const body = rows.filter((r) => (r.topic === "change-log") === log);
    // 한 줄 안내(헤어라인 위아래). 나머지 안내는 접어 둔다.
    el.innerHTML = `<div class="ed"><div class="ed-top"><b>2027.3 공표 전까지는 확정이 아니에요.</b><details><summary>자세히</summary>${banner(rows)}${notice()}${log || curProfile().id !== "A" ? "" : `<p>${curProfile().label}(${curProfile().grade})는 2028 개편안의 직접 대상(2025 입학생)이 아니에요. 2030학년도 제도는 2027.3 공표 내용에 따라 바뀔 수 있어요.</p>`}</details></div>${tabs([["sys", "#admission/system", "제도"], ["log", "#admission/system?t=log", "바뀐 소식"]], log ? "log" : "sys")}
      ${log ? "" : await rulesSection()}${statusSelect(body)}<div id="ptbl"></div></div>`;
    const TOPIC = { "admission-system": "2028학년도 개편 확정안과 2030학년도 적용", "admission-outlook": "2030학년도 대상 추가 동향", "admission-structure": "대입 전형 구조", "cur-select": "수능 출제범위(참고)", academy: "학원 설명 자료", "profile-2033": "2033학년도 대입 전망(추정)" };
    const NOTE = { "cur-select": '<p class="ed-src">서울교육청 자료라서 경기 적용은 확인이 필요해요. 수능 출제범위는 추정이고, 2030학년도 확정이 아니에요.</p>' };
    const key = (r) => (ACD_SYS.has(r.id) ? "academy" : CUR_SYS.has(r.id) ? CUR_GROUP[r.id] || "cur-select" : r.topic);
    // 선택과목 조사·대학 권장이수과목은 고교학점제 이해에서 자세히 보고, 여기는 한 줄 요약만 둔다.
    // 공식 이미지(공공누리 제1유형만 저장·표시). 그 밖의 자료는 링크만. 출처·이용 조건은 data/image-credits.json.
    const credits = (await load("image-credits")).filter((c) => /대입 제도/.test(c.screen));
    const imgBlock = credits.map((c) => c.usable
      ? `<figure class="ed-fig"><a href="img/credit/${esc(c.file)}" target="_blank" rel="noopener"><img src="img/credit/${esc(c.file)}" alt="${esc(c.title)}" loading="lazy"></a><figcaption>${esc(c.org)} · ${esc(c.title)} · <b>${esc(c.license)}</b> · <a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">원문 보기</a>${c.note ? `<div>${esc(c.note)}</div>` : ""}</figcaption></figure>`
      : `<p class="ed-src">참고 링크(이용 조건은 확인이 필요해요): <a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(c.org)} · ${esc(c.title)}</a></p>`).join("");
    const pick = (await loadPolicy()).filter((r) => r.id === "cur-06" || r.id === "cur-07");
    const pickLine = pick.length ? `<p class="ed-src">선택과목 조사·대학 권장이수과목: ${pick.map((r) => esc(r.body)).join(" / ")} · <a href="#life/credit">고교학점제 이해에서 자세히</a></p>` : "";
    const cols = [...basic.slice(0, 2), ["대입학년도", (r) => `${r.examYear}<div class="muted small">입학 ${r.entryYear}</div>`], ...basic.slice(2)];
    filtered(el, body, (f) => {
      const rs = (x) => x.filter((r) => stMatch(r, f));
      $("#ptbl").innerHTML = log ? logTable(rs(body)) : Object.entries(TOPIC).map(([t, label]) => { const g = rs(body.filter((r) => key(r) === t)); if (!g.length) return "";
        if (t === "academy") return `<h2>${label}<span class="ed-tag">학원 의견·자료</span> ${cnt(g.length)}</h2><div class="ed-op"><p>학원 설명회 의견과 자료예요. 확인된 사실이 아니에요.</p>${cards(g, { meta: (r) => [r.examYear && `대입 ${r.examYear}학년도`, r.entryYear && `입학 ${r.entryYear}`].filter(Boolean).join(" · ") })}</div>`;
        return `<h2>${label} ${cnt(g.length)}</h2>${t === "cur-select" ? pickLine : ""}${NOTE[t] || ""}${cards(g, { meta: (r) => [r.examYear && `대입 ${r.examYear}학년도`, r.entryYear && `입학 ${r.entryYear}`].filter(Boolean).join(" · ") })}${t === "cur-select" ? imgBlock : ""}`; }).join("") || '<p class="muted">조건에 맞는 항목이 없어요.</p>';
    });
  };

  views.changelog = async (el) => {
    const rows = (await loadPolicy()).filter((r) => r.topic === "change-log");
    el.innerHTML = `<div class="ed"><div class="ed-top"><b>바뀐 소식</b><details><summary>자세히</summary>${notice()}</details></div>${statusSelect(rows)}<div id="ptbl"></div></div>`;
    filtered(el, rows, (f) => { $("#ptbl").innerHTML = logTable(rows.filter((r) => stMatch(r, f))); });
  };

  views.schedule = async (el, query) => {
    const tab = ["univ", "life", "road"].includes(query.get("t")) ? query.get("t") : "hs";
    if (tab === "road") {
      const tb = `<div class="ed">${tabs([["hs", "#schedule?t=hs", "고입"], ["univ", "#schedule?t=univ", "대입"], ["life", "#schedule?t=life", "졸업·입학"], ["road", "#schedule?t=road", "학년별"]], "road")}</div>`;
      el.innerHTML = tb + '<div id="rdhost"></div>';
      await roadmapView(el.querySelector("#rdhost"), { load, esc, learner: curProfile(), fmt, badgeMain, notice });
      return;
    }
    const all = filterByProfile(await load("policy"), curProfile().id, { grade3: true }); // 현고3 행은 아래 칩(audience)이 걸러 준다
    const rows = all.filter((r) => r.topic === ({ univ: "exam-schedule", life: "life-schedule" }[tab] || "hs-schedule") || (tab === "hs" && r.topic === "gg-hs-entry" && r.events) || (r.topic === "profile-2033" && (tab === "hs" ? /고입/.test(r.title) : tab === "univ" && r.events)));
    const chips = '<div id="aud"></div>'; // 칩 UI·저장(portal.audience)은 home.js와 공유
    el.innerHTML = `${tabs([["hs", "#schedule?t=hs", "고입"], ["univ", "#schedule?t=univ", "대입"], ["life", "#schedule?t=life", "졸업·입학"], ["road", "#schedule?t=road", "학년별"]], tab)}${notice()}
      <p class="muted">${{ univ: "수능·대교협 일정이에요. 2030학년도분은 대부분 추정이에요.", life: "졸업·배정·입학 일정이에요. 추정은 (추정)으로 표시해요. 겨울방학·졸업식·신입생 예비소집 날짜는 학교마다 달라서 학교 공지로 확인해 주세요." }[tab] || "2027학년도 고입(서울 기준). 연도는 2027학년도 고입이 2026년 하반기에 진행되는 것을 기준으로 붙였어요."}</p>${chips}<div id="tl"></div>`;
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
  views.credit = (el) => creditView(el, { load: (n) => (n === "policy" ? loadPolicy() : load(n)), profile: curProfile(), esc, badge, badgeMain, src, table: (rs) => cards(rs), basic });

  views.types = async (el) => {
    const rows = await loadPolicy();
    // asg-02(2구역 학교) 본문: 풍덕·성복·수지·홍천 4개교가 모두 2구역이라는 내용을 눈에 띄게 한다.
    const credit = rows.find((r) => r.id === "cur-01");
    const opn = rows.filter((r) => r.topic === "hs-choice-opinion" || r.id === "acd-04");
    const gg = rows.filter((r) => r.topic === "gg-hs-entry" && !r.events);
    const asg = rows.filter((r) => r.topic === "high-school-assignment");
    el.innerHTML = `<div class="ed"><div class="ed-top"><b>고교 유형과 전형이에요.</b><details><summary>자세히</summary>${notice()}</details></div>
      <h2>고교 유형 ${cnt(rows.filter((r) => r.topic === "hs-types").length)}</h2>${cards(rows.filter((r) => r.topic === "hs-types"))}
      ${gg.length ? `<h2>경기 고입 안내 <small>2027학년도</small> ${cnt(gg.length)}</h2>${cards(gg)}` : ""}
      ${asg.length ? `<h2>용인 평준화 배정 <small>2026학년도 기준 참고</small> ${cnt(asg.length)}</h2>
      <p class="ed-big">우리 4개교(풍덕·성복·수지·홍천)는 모두 <em>2구역</em></p>
      <p class="ed-src">원문은 아직 못 봤어요. 2027 규칙은 한 번 더 확인해요.</p>
      ${cards(asg, { cls: (r) => (r.id === "asg-02" ? "hl" : "") })}` : ""}
      ${credit ? `<h2>고교학점제 <small>입학 후 제도</small></h2>
      <p class="ed-b">${esc(credit.body)}</p><p class="ed-s">${badgeMain(credit)} · <a href="#life/credit">고교학점제 이해에서 자세히 봐요</a></p>` : ""}
      ${opn.length ? `<h2>선택 기준<span class="ed-tag">학원 의견</span> ${cnt(opn.length)}</h2>
      <div class="ed-op"><p>학원 설명회의 의견이에요. 확인된 사실이 아니라서 위 내용과 구분해서 봐요.</p>${cards(opn)}</div>` : ""}
      <p class="ed-src">고입 전형 일정은 <a href="#schedule">일정</a>의 고입 탭에서 볼 수 있어요.</p></div>`;
  };
}
