// 홈 화면. 데이터: policy.json(일정·변경 로그·학점제 규칙·마일스톤), summary/curricula/schools(관심 학교).
// policy.json·policy.js는 읽기만 한다(서브 세션 담당).
const PST = { confirmed: "확정", reported: "보도", estimated: "추정", unknown: "확인 못 함" };
const DAY = 864e5;

export function registerHome(views, { esc, load, store, nm, stars, toggleStar, nameOf, TERMS }) {
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  // "YYYY-MM-DD" 또는 월 단위 "YYYY-MM" → 시작·끝 날짜
  const span = (s, e) => {
    const p = (t) => { const [y, m, d] = t.split("-").map(Number); return d ? { a: new Date(y, m - 1, d), b: new Date(y, m - 1, d), month: false } : { a: new Date(y, m - 1, 1), b: new Date(y, m, 0), month: true }; };
    const a = p(s), b = e ? p(e) : a;
    return { start: a.a, end: b.b, month: a.month };
  };
  const two = (n) => String(n).padStart(2, "0");
  const fmtDate = (sp, t) => {
    const y = sp.start.getFullYear() === t.getFullYear() ? "" : `${sp.start.getFullYear()}.`;
    return sp.month ? `${sp.start.getFullYear()}.${two(sp.start.getMonth() + 1)}` : `${y}${two(sp.start.getMonth() + 1)}.${two(sp.start.getDate())}`;
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
    const csat = ev0("sch-07"), csatRow = P.get("sch-07");
    let hero = "";
    if (csat) {
      const sp = span(csat.start, csat.end);
      const target = sp.month ? new Date(sp.start.getFullYear(), sp.start.getMonth(), 15) : sp.start;
      const n = Math.round((target - t) / DAY);
      hero = `<span class="hm-dday">수능까지 <b>${sp.month ? "약 " : ""}D-${n.toLocaleString()}</b> <span class="pst ${csatRow.status}">${PST[csatRow.status]}</span> <span class="muted small">${fmtDate(sp, t)} · ${esc(csat.label)}</span></span>`;
    } else hero = '<span class="hm-dday muted">수능 시행일 데이터 없음 (2029.11 추정)</span>';

    // 2) 다가오는 일정: 고입·대입 일정 중 오늘~90일, 지난 일정 숨김
    const limit = new Date(t.getTime() + 90 * DAY);
    const upcoming = policy.filter((r) => r.topic === "hs-schedule" || r.topic === "exam-schedule")
      .flatMap((r) => (r.events || []).map((e) => ({ r, e, sp: span(e.start, e.end) })))
      .filter((x) => x.sp.end >= t && x.sp.start <= limit).sort((a, b) => a.sp.start - b.sp.start || a.sp.end - b.sp.end);
    const upHtml = upcoming.length
      ? upcoming.map((x) => `<li><span class="hm-d${x.sp.start <= t ? " now" : ""}">${dLabel(x.sp, t)}</span><span class="hm-date">${fmtDate(x.sp, t)}${x.sp.end > x.sp.start && !x.sp.month ? "~" + two(x.sp.end.getMonth() + 1) + "." + two(x.sp.end.getDate()) : ""}</span><span class="hm-tx"><b>${esc(x.r.title)}</b> · ${esc(x.e.label)}</span><span class="hm-bd">${badges(x.r)}</span>${link(x.r)}</li>`).join("")
      : '<li class="muted">예정된 일정 없음</li>';

    // 3) 장기 타임라인: 마일스톤은 policy.json 행에서 읽는다(없는 항목은 데이터 없음으로 표시).
    const mk = (label, row, key, date) => ({ label, row, key, date });
    const ms = [
      mk("고입 후기 전형", P.get("hs-05"), ev0("hs-05")?.start, ev0("hs-05") && fmtDate(span(ev0("hs-05").start), t)),
      mk("중장기 대입 개편안 공표", P.get("log-10"), dateOf(P.get("log-10")?.title || ""), dateOf(P.get("log-10")?.title || "").replace("-", ".")),
      // 입학: policy.json에 항목이 없어 entryYear로만 표기(월은 상태 판정용 가정, 화면에는 안 보임)
      mk("입학", null, `${entryYear}-03`, `${entryYear}학년도`),
      mk("수능 시행 기본계획 공고", P.get("sch-08"), ev0("sch-08")?.start, ev0("sch-08") && fmtDate(span(ev0("sch-08").start), t) + " 전후"),
      mk(`${examYear}학년도 수능`, P.get("sch-07"), ev0("sch-07")?.start, ev0("sch-07") && fmtDate(span(ev0("sch-07").start), t)),
      mk(`${examYear}학년도 대입`, null, `${examYear}-01`, "일정 미정"),
    ];
    const state = (m) => { if (!m.key) return ""; const sp = span(m.key); return sp.end < t ? "past" : ""; };
    let nextDone = false;
    const tl = ms.map((m) => { let cls = state(m); if (!cls && !nextDone) { cls = "next"; nextDone = true; } return `<li class="${cls}"><span class="hm-dot"></span><span class="hm-mdate">${esc(m.date || "일정 데이터 없음")}</span><b>${esc(m.label)}</b>${m.row ? `<span>${badges(m.row)}</span>` : ""}</li>`; }).join("");

    // 4) 최근 변경: 제도 변경 로그 중 날짜가 있고 오늘 이전인 최신 3건
    const log = policy.filter((r) => r.topic === "change-log").map((r) => ({ r, d: dateOf(r.title) })).filter((x) => x.d && span(x.d).start <= t)
      .sort((a, b) => span(b.d).start - span(a.d).start);
    const logUpdated = policy.filter((r) => r.topic === "change-log").map((r) => r.checkedAt).filter(Boolean).sort().pop() || "-";
    const logHtml = log.slice(0, 3).map((x) => `<li><span class="hm-date">${esc(x.d.replace(/-/g, "."))}</span><span class="hm-tx"><b>${esc(x.r.title.slice(x.d.length).trim() || x.r.title)}</b></span><span class="hm-bd">${badges(x.r)}</span>${link(x.r)}</li>`).join("") || '<li class="muted">기록 없음</li>';

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
    const verified = summary.filter((m) => m.confidence === "verified").length;
    const ok = canStore();

    el.innerHTML = `<div class="hm">
      <div class="hm-hero"><b>현 중3</b> · <b>${entryYear}학년도 입학</b> · <b>${examYear}학년도 수능</b> ${hero}</div>
      <section class="hm-box"><h3>다가오는 일정 <span class="muted small">앞으로 90일 · 오늘 ${t.getFullYear()}.${two(t.getMonth() + 1)}.${two(t.getDate())}</span> <a class="hm-more" href="#schedule">전체 일정</a></h3><ul class="hm-list">${upHtml}</ul></section>
      <section class="hm-box"><h3>장기 타임라인</h3><ol class="hm-tl">${tl}</ol></section>
      <section class="hm-box"><h3>최근 변경 <span class="muted small">갱신 ${esc(logUpdated)}</span> <a class="hm-more" href="#changelog">전체 보기</a></h3><ul class="hm-list">${logHtml}</ul></section>
      <section class="hm-box"><h3>관심 학교</h3>${favs.length ? `<div class="hm-schools">${favs.map(card).join("")}</div>` : '<p class="muted">학교별 편제표 요약 카드의 ☆를 누르면 여기에 모입니다.</p>'}</section>
      <nav class="hm-go"><a class="btn primary" href="#select/curriculum">학교별 편제표</a><a class="btn" href="#admission/system">대입 제도</a><a class="btn" href="#schedule">일정</a></nav>
      <div class="hm-three">
        <section class="hm-box"><h3>고교학점제 핵심 규칙</h3><ul class="hm-rules">${rules.map((r) => `<li><b>${esc(r.title)}</b> ${esc(r.body)} <span class="hm-bd">${badges(r)}</span> ${link(r)}</li>`).join("") || '<li class="muted">데이터 없음</li>'}</ul></section>
        <a class="hm-box hm-status" href="#library/status"><h3>데이터 상태</h3><div>원문 미확인 <b>${unv}</b>건 <span class="muted small">(제도·일정 ${policy.length}건 중)</span></div><div>편제표 학교 대조 완료 <b>${verified}/${summary.length}</b>개교</div><div class="muted small">flag ${flags.t}건 중 ${flags.c}건 대조 · 열린 flag ${flags.o}건</div></a>
        <section class="hm-box"><h3>내 메모/할 일 <span class="muted small">이 브라우저에만 저장</span></h3>${ok ? '<form class="hm-todoform"><input type="text" id="todoin" placeholder="할 일 추가" maxlength="120" autocomplete="off"><button class="btn" type="submit">추가</button></form><ul class="hm-todos" id="todos"></ul>' : '<p class="muted">이 브라우저에서는 저장 공간을 쓸 수 없어 메모를 사용할 수 없습니다.</p>'}</section>
      </div></div>`;

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
