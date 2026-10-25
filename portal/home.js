// 홈 화면. 데이터: policy.json(일정·변경 로그·학점제 규칙·마일스톤), summary/curricula/schools(관심 학교).
// policy.json·policy.js는 읽기만 한다(서브 세션 담당).
const PST = { confirmed: "확정", reported: "보도", estimated: "추정", unknown: "확인 못 함" };
const DAY = 864e5;

// ---- 일정 대상 필터(칩): 일정 화면 등 다른 화면에서 같은 키·함수를 재사용할 수 있게 분리 ----
export const AUDIENCES = [["general", "일반고"], ["science", "과학·영재"], ["private", "자사·외·국제"], ["grade3", "현고3"]];
export const AUDIENCE_KEY = "portal.audience"; // localStorage 키(값: audience 키 배열 JSON)
export const AUDIENCE_DEFAULT = ["general", "science", "private"];
export const loadAudience = (store) => { const v = store.get(AUDIENCE_KEY, null); return Array.isArray(v) ? v.filter((k) => AUDIENCES.some(([a]) => a === k)) : [...AUDIENCE_DEFAULT]; };
export const saveAudience = (store, sel) => store.set(AUDIENCE_KEY, sel);
export const toggleAudience = (sel, key) => (sel.includes(key) ? sel.filter((k) => k !== key) : [...sel, key]);
// 아무것도 안 켜면 전체, 행에 audience가 없거나 common이면 항상 표시, 하나라도 겹치면 표시
export const audienceMatch = (aud, sel) => !sel.length || !aud || !aud.length || aud.includes("common") || aud.some((a) => sel.includes(a));
export const audienceChips = (sel, esc) => `<div class="hm-aud" role="group" aria-label="일정 대상">${AUDIENCES.map(([k, t]) => `<button type="button" class="fchip${sel.includes(k) ? " on" : ""}" data-aud="${k}" aria-pressed="${sel.includes(k)}">${esc(t)}</button>`).join("")}</div>`;

export function registerHome(views, { esc, load, store, nm, stars, toggleStar, nameOf, TERMS }) {
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  // "YYYY-MM-DD" 또는 월 단위 "YYYY-MM" → 시작·끝 날짜
  const span = (s, e) => {
    const p = (t) => { const [y, m, d] = t.split("-").map(Number); return d ? { a: new Date(y, m - 1, d), b: new Date(y, m - 1, d), month: false } : { a: new Date(y, m - 1, 1), b: new Date(y, m, 0), month: true }; };
    const a = p(s), b = e ? p(e) : a;
    return { start: a.a, end: b.b, month: a.month };
  };
  const two = (n) => String(n).padStart(2, "0");
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  const dayText = (d, t, withYear) => `${withYear || d.getFullYear() !== t.getFullYear() ? d.getFullYear() + "." : ""}${two(d.getMonth() + 1)}.${two(d.getDate())}(${WD[d.getDay()]})`;
  const ymdText = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? dayText(new Date(+m[1], +m[2] - 1, +m[3]), new Date(0), true) : (s || "-").replace(/-/g, "."); };
  const fmtDate = (sp, t) => (sp.month ? `${sp.start.getFullYear()}.${two(sp.start.getMonth() + 1)}` : dayText(sp.start, t));
  // 기간은 양 끝 모두 요일 표기. 월 단위 기간은 "YYYY.MM~YYYY.MM"
  const fmtRange = (sp, t, e) => {
    if (sp.month) return e && e.end && e.end !== e.start ? `${fmtDate(sp, t)}~${e.end.slice(0, 4)}.${e.end.slice(5, 7)}` : fmtDate(sp, t);
    if (sp.end > sp.start) return `${dayText(sp.start, t)}~${dayText(sp.end, t, sp.end.getFullYear() !== sp.start.getFullYear())}`;
    return fmtDate(sp, t);
  };
  const dLabel = (sp, t) => {
    if (sp.start <= t && t <= sp.end) return sp.month ? "이번 달" : "진행 중";
    const n = Math.round((sp.start - t) / DAY);
    return n === 0 ? "D-day" : `D-${n.toLocaleString()}`;
  };
  const link = (r) => {
    const s = (r.sources && r.sources[0]) || (r.sourceName ? { name: r.sourceName, url: r.sourceUrl } : null);
    if (!s) return "";
    return s.url && /^https?:\/\//.test(s.url) ? `<a class="hm-src" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : `<span class="muted small">${esc(s.name)}</span>`;
  };
  const badges = (r) => `<span class="pst ${r.status}">${PST[r.status] || r.status}</span>${r.unverified ? ' <span class="unv">원문 미확인</span>' : ""}`;
  // 행에 events가 없고 date("YYYY-MM-DD" 또는 "시작~끝")만 있어도 일정으로 읽는다.
  const DRE = /^\d{4}-\d{2}(-\d{2})?$/;
  const eventsOf = (r) => {
    if (r.events) return r.events;
    const [a, b] = String(r.date || "").split("~").map((x) => x.trim());
    return DRE.test(a) ? [{ label: "", start: a, ...(b && DRE.test(b) ? { end: b } : {}) }] : [];
  };
  const dateOf = (t) => (t.match(/^\d{4}(-\d{2}){0,2}/) || [""])[0];

  // 메모/할 일: 이 브라우저(localStorage)에만 저장. 접근할 수 없으면 비활성.
  const canStore = () => { try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); return true; } catch { return false; } };

  views.home = async (el) => {
    const [schools, summary, curricula, policy] = await Promise.all([load("schools"), load("summary"), load("curricula"), load("policy")]);
    const t = today();
    const P = new Map(policy.map((r) => [r.id, r]));
    const entryYear = summary[0].entryYear, examYear = entryYear + 3;
    const ev0 = (id) => P.get(id)?.events?.[0];

    // 1) 상황 한 줄 + 수능 D-일수(월 단위 추정이면 그 달 15일 기준 "약")
    const csat = ev0("sch-12") || ev0("sch-07"), csatRow = P.get("sch-12") || P.get("sch-07");
    let hero = "";
    if (csat) {
      const sp = span(csat.start, csat.end);
      const target = sp.month ? new Date(sp.start.getFullYear(), sp.start.getMonth(), 15) : sp.start;
      const n = Math.round((target - t) / DAY);
      hero = `<span class="hm-dday"><b>${sp.month ? "약 " : ""}D-${n.toLocaleString()}</b> <span class="pst ${csatRow.status}">${PST[csatRow.status]}</span> <span class="muted small">${fmtRange(sp, t, csat)} · ${esc(csat.label)}</span></span>`;
    } else hero = '<span class="hm-dday muted">수능 시행일 데이터 없음 (2029.11 추정)</span>';

    // 2) 다가오는 일정: 고입·대입 일정 중 오늘~90일, 지난 일정 숨김
    const limit = new Date(t.getTime() + 90 * DAY);
    const upcoming = policy.filter((r) => r.topic === "hs-schedule" || r.topic === "gg-hs-entry" || r.topic === "exam-schedule")
      .flatMap((r) => eventsOf(r).map((e) => ({ r, e, sp: span(e.start, e.end) })))
      .filter((x) => x.sp.end >= t && x.sp.start <= limit).sort((a, b) => (a.r.region === "seoul") - (b.r.region === "seoul") || a.sp.start - b.sp.start || a.sp.end - b.sp.end); // 서울 행은 경기·전국 행 다음(같은 대상 안에서)
    let aud = loadAudience(store);
    const upRows = () => upcoming.filter((x) => audienceMatch(x.e.audience || x.r.audience, aud));
    const li = (x) => `<li><span class="hm-d${x.sp.start <= t ? " now" : ""}">${dLabel(x.sp, t)}</span><span class="hm-date">${fmtRange(x.sp, t, x.e)}</span><span class="hm-tx"><b>${esc(x.r.title)}</b>${x.e.label ? ` · ${esc(x.e.label)}` : ""}</span><span class="hm-bd">${badges(x.r)}</span>${link(x.r)}</li>`;
    // "지금" 카드: 선택한 대상의 가장 가까운 일정 1건
    const nextCard = () => {
      const x = upRows()[0];
      if (!x) return `<div class="hm-next empty"><span class="hm-nl">다음 일정</span><b>${upcoming.length ? "선택한 대상의 " : ""}예정된 일정 없음</b><a class="hm-more" href="#schedule">전체 일정 보기</a></div>`;
      return `<div class="hm-next"><span class="hm-nl">다음 일정</span><span class="hm-nd${x.sp.start <= t ? " now" : ""}">${dLabel(x.sp, t)}</span><b class="hm-nt">${esc(x.r.title)}${x.e.label ? ` · ${esc(x.e.label)}` : ""}</b><span class="hm-date">${fmtRange(x.sp, t, x.e)}</span><span class="hm-bd">${badges(x.r)} ${link(x.r)}</span></div>`;
    };
    const upList = () => { const rest = upRows().slice(1); return rest.length ? rest.map(li).join("") : '<li class="muted">이어지는 일정 없음</li>'; };

    // 3) 장기 타임라인: 모든 마일스톤을 policy.json 행에서 읽는다.
    const rng = (e) => fmtRange(span(e.start, e.end), t, e);
    const one = (id, label, suffix = "") => { const r = P.get(id), e = ev0(id); return { label, row: r, key: e?.start, date: e ? rng(e) + suffix : "" }; };
    const subs = ["sch-11", "sch-12", "sch-13"].map((id) => ({ r: P.get(id), e: ev0(id) })).filter((x) => x.r && x.e);
    const ms = [
      one("hs-05", "고입 후기 전형"),
      { label: "중장기 대입 개편안 공표", row: P.get("log-10"), key: dateOf(P.get("log-10")?.title || ""), date: dateOf(P.get("log-10")?.title || "").replace("-", ".") },
      one("sch-09", "입학"),
      one("sch-08", "수능 시행 기본계획 공고", " 전후"),
      { label: `${examYear}학년도 대입`, row: null, key: subs.map((x) => x.e.start).sort()[0], date: "", subs },
    ];
    const state = (m) => (m.key && span(m.key).end < t ? "past" : "");
    let nextDone = false;
    const tl = ms.map((m) => {
      let cls = state(m); if (!cls && !nextDone) { cls = "next"; nextDone = true; }
      const subHtml = m.subs ? `<div class="hm-subs">${m.subs.map((x) => `<div><span class="hm-mdate">${rng(x.e)}</span> <b>${esc(x.r.title.replace(`${examYear}학년도 `, ""))}</b> <span class="pst ${x.r.status}">${PST[x.r.status]}</span></div>`).join("")}</div>` : "";
      return `<li class="${cls}"><span class="hm-dot"></span>${m.date || !m.subs ? `<span class="hm-mdate">${esc(m.date || "일정 데이터 없음")}</span>` : ""}<b>${esc(m.label)}</b>${m.row ? `<span>${badges(m.row)}</span>` : ""}${subHtml}</li>`;
    }).join("");

    // 4) 최근 변경: 제도 변경 로그 중 날짜가 있고 오늘 이전인 최신 3건
    const log = policy.filter((r) => r.topic === "change-log").map((r) => ({ r, d: dateOf(r.title) })).filter((x) => x.d && span(x.d).start <= t)
      .sort((a, b) => span(b.d).start - span(a.d).start);
    const logUpdated = policy.filter((r) => r.topic === "change-log").map((r) => r.checkedAt).filter(Boolean).sort().pop() || "-";
    const logHtml = log.slice(0, 3).map((x) => `<li><span class="hm-date">${esc(ymdText(x.d))}</span><span class="hm-tx"><b>${esc(x.r.title.slice(x.d.length).trim() || x.r.title)}</b></span><span class="hm-bd">${badges(x.r)}</span>${link(x.r)}</li>`).join("") || '<li class="muted">기록 없음</li>';

    // 5) 관심 학교 카드
    const card = (id) => {
      const m = summary.find((x) => x.schoolId === id); if (!m) return "";
      const cr = curricula.find((x) => x.schoolId === id)?.creative;
      return `<section class="hm-school"><header>${nm(id, nameOf(schools, id), 34)} <button class="star" data-id="${esc(id)}" aria-label="관심 해제">★</button></header>
        <div class="hm-line"><b>지정 ${m.creditsRequired}</b> / 선택 ${m.creditsElective}학점</div>
        <div class="muted small">창체 ${m.creditsCreative}학점${cr ? ` · ${cr.totalHours}시간` : ""}</div>
        <a class="btn" href="#select/curriculum?v=compare&s=${esc(id)}">이 학교 과목 보기</a></section>`;
    };
    const favs = stars().filter((id) => summary.some((m) => m.schoolId === id));

    // 추가 카드 (a) 학점제 핵심 규칙 (b) 데이터 상태
    const rules = ["hs-11", "hs-12", "hs-13"].map((id) => P.get(id)).filter(Boolean);
    const unv = policy.filter((r) => r.unverified).length;
    const flags = summary.reduce((a, m) => ({ t: a.t + m.flagsTotal, c: a.c + m.flagsChecked, o: a.o + m.flagsOpen }), { t: 0, c: 0, o: 0 });
    const verified = summary.filter((m) => m.confidence !== "unverified").length; // 사진 대조 전이 아닌 학교
    const ok = canStore();

    const csatCard = `<div class="hm-next hm-csat"><span class="hm-nl">수능까지</span>${hero}${csatRow ? ` <span class="hm-bd">${link(csatRow)}</span>` : ""}</div>`;
    const tab = (id, label, body, on) => ({ id, label, body, on });
    const tabs = [
      tab("tl", "장기 타임라인", `<ol class="hm-tl">${tl}</ol>`, true),
      tab("log", "최근 변경", `<p class="muted small">갱신 ${esc(ymdText(logUpdated))} <a class="hm-more" href="#changelog">전체 보기</a></p><ul class="hm-list">${logHtml}</ul>`),
      tab("rules", "학점제 핵심 규칙", `<ul class="hm-rules">${rules.map((r) => `<li><b>${esc(r.title)}</b> ${esc(r.body)} <span class="hm-bd">${badges(r)}</span> ${link(r)}</li>`).join("") || '<li class="muted">데이터 없음</li>'}</ul>`),
      tab("st", "데이터 상태", `<a class="hm-status" href="#library/status"><div>원문 미확인 <b>${unv}</b>건 <span class="muted small">(제도·일정 ${policy.length}건 중)</span></div><div>편제표 학교 대조 완료 <b>${verified}/${summary.length}</b>개교</div><div class="muted small">flag ${flags.t}건 중 ${flags.c}건 대조 · 열린 flag ${flags.o}건</div></a>`),
    ];
    el.innerHTML = `<div class="hm">
      <div class="hm-ctx"><b>현 중3</b> · ${entryYear}학년도 입학 · ${examYear}학년도 수능 <span class="muted small">오늘 ${dayText(t, t, true)}</span></div>
      <section class="hm-box hm-nowbox" aria-labelledby="hm-now-h"><h3 id="hm-now-h">지금 <span class="muted small">내 대상 기준 · 앞으로 90일</span> <a class="hm-more" href="#schedule">전체 일정</a></h3>${audienceChips(aud, esc)}
        <div class="hm-now"><div id="hm-nx">${nextCard()}</div>${csatCard}</div>
        <ul class="hm-list" id="hm-up">${upList()}</ul></section>
      <div class="hm-mine">
        <section class="hm-box"><h3>내 학교</h3>${favs.length ? `<div class="hm-schools">${favs.map(card).join("")}</div>` : '<p class="muted">학교별 편제표 요약 카드의 ☆를 누르면 여기에 모입니다.</p>'}</section>
        <section class="hm-box"><h3>내 메모/할 일 <span class="muted small">이 브라우저에만 저장</span></h3>${ok ? '<form class="hm-todoform"><input type="text" id="todoin" placeholder="할 일 추가" maxlength="120" autocomplete="off"><button class="btn" type="submit">추가</button></form><ul class="hm-todos" id="todos"></ul>' : '<p class="muted">이 브라우저에서는 저장 공간을 쓸 수 없어 메모를 사용할 수 없습니다.</p>'}</section>
      </div>
      <nav class="hm-go" aria-label="바로가기"><a class="btn primary" href="#select/curriculum">학교별 편제표</a><a class="btn" href="#admission/system">대입 제도</a><a class="btn" href="#schedule">일정</a></nav>
      <section class="hm-box hm-ref"><h3>참고 자료 <span class="muted small">제도·일정 원본 정보</span></h3>
        <div class="hm-tabs" role="tablist">${tabs.map((x) => `<button type="button" role="tab" id="hm-t-${x.id}" aria-controls="hm-p-${x.id}" aria-selected="${!!x.on}" tabindex="${x.on ? 0 : -1}" data-t="${x.id}">${x.label}</button>`).join("")}</div>
        ${tabs.map((x) => `<div class="hm-pane" role="tabpanel" id="hm-p-${x.id}" aria-labelledby="hm-t-${x.id}"${x.on ? "" : " hidden"}>${x.body}</div>`).join("")}</section></div>`;

    // 참고 자료 탭(내용은 모두 DOM에 있고 숨김만 바꾼다)
    const tablist = el.querySelector(".hm-tabs");
    const pick = (id) => { tablist.querySelectorAll("[role=tab]").forEach((b) => { const on = b.dataset.t === id; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; }); el.querySelectorAll(".hm-pane").forEach((p) => (p.hidden = p.id !== `hm-p-${id}`)); };
    tablist.addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (b) pick(b.dataset.t); });
    tablist.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const bs = [...tablist.querySelectorAll("[role=tab]")], i = bs.indexOf(document.activeElement); if (i < 0) return;
      const n = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length]; pick(n.dataset.t); n.focus();
    });

    const upBox = el.querySelector(".hm-nowbox"); // 칩·카드·목록을 감싸는 박스(안쪽만 다시 그려도 리스너 유지)
    upBox?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-aud]"); if (!b) return;
      aud = toggleAudience(aud, b.dataset.aud); saveAudience(store, aud);
      upBox.querySelector(".hm-aud").outerHTML = audienceChips(aud, esc);
      upBox.querySelector("#hm-nx").innerHTML = nextCard();
      upBox.querySelector("#hm-up").innerHTML = upList();
    });

    // 관심 해제
    if (!el._hmStar) { el._hmStar = true; el.addEventListener("click", (e) => { const b = e.target.closest(".star"); if (b) { toggleStar(b.dataset.id); views.home(el); } }); }

    // 메모/할 일
    if (ok) {
      const list = () => store.get("todos", []);
      const draw = () => {
        const items = list();
        el.querySelector("#todos").innerHTML = items.length ? items.map((it, i) => `<li class="${it.done ? "done" : ""}"><label><input type="checkbox" data-i="${i}" ${it.done ? "checked" : ""}> <span>${esc(it.text)}</span></label><button type="button" class="hm-del" data-i="${i}" aria-label="삭제">×</button></li>`).join("") : '<li class="muted small">할 일이 없습니다.</li>';
      };
      el.querySelector(".hm-todoform").addEventListener("submit", (e) => { e.preventDefault(); const v = el.querySelector("#todoin").value.trim(); if (!v) return; store.set("todos", [...list(), { text: v, done: false }]); el.querySelector("#todoin").value = ""; draw(); });
      el.querySelector("#todos").addEventListener("click", (e) => {
        const i = e.target.dataset.i; if (i === undefined) return;
        const items = list();
        if (e.target.classList.contains("hm-del")) items.splice(+i, 1); else if (items[+i]) items[+i].done = e.target.checked;
        store.set("todos", items); draw();
      });
      draw();
    }
  };
}
