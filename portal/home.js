// 홈 화면(A안 에디토리얼). 데이터: policy.json(일정·변경 로그·학점제 규칙·마일스톤), summary/curricula/schools(관심 학교).
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


// ---- 사진(졸업·입학 D-day): 이 기기(IndexedDB)에만 저장한다. 서버·저장소로 보내지 않는다. ----
const photoDB = () => new Promise((res, rej) => { try { const q = indexedDB.open("portal-photos", 1); q.onupgradeneeded = () => q.result.createObjectStore("p"); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); } catch (e) { rej(e); } });
const photoOp = async (mode, fn) => { const db = await photoDB(); return new Promise((res, rej) => { const tx = db.transaction("p", mode), r = fn(tx.objectStore("p")); tx.oncomplete = () => res(r?.result); tx.onerror = () => rej(tx.error); }); };
const photoGet = (k) => photoOp("readonly", (s) => s.get(k)).catch(() => null);
const photoPut = (k, blob) => photoOp("readwrite", (s) => s.put(blob, k));
const photoDel = (k) => photoOp("readwrite", (s) => s.delete(k));
// 긴 변 1200px로 줄여 JPEG로 저장
async function resizePhoto(file) {
  const bmp = await createImageBitmap(file), s = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("resize"))), "image/jpeg", 0.85));
}
// 직접 그린 선 일러스트(흑백 선 + 강조색 1개). 사진이 없을 때의 기본 그림.
const ART = {
  graduation: '<svg viewBox="0 0 96 72" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M6 28 48 10l42 18-42 18z"/><path d="M24 38v14c0 5 11 10 24 10s24-5 24-10V38"/><path d="M84 31v22" stroke="var(--accent)"/><circle cx="84" cy="57" r="3.2" fill="var(--accent)" stroke="none"/></svg>',
  entrance: '<svg viewBox="0 0 96 72" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M10 66V24M86 66V24M10 24h76M4 24h88"/><path d="M10 66h76"/><path d="M26 66V34h44v32M48 34v32" /><path d="M36 20 48 8l12 12" stroke="var(--accent)"/></svg>',
};

export function registerHome(views, { esc, load, store, nm, stars, toggleStar, nameOf, TERMS, hasLogo, profile, profiles }) {
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
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
  const fmtRange = (sp, t, e) => {
    if (sp.month) return e && e.end && e.end !== e.start ? `${fmtDate(sp, t)}~${e.end.slice(0, 4)}.${e.end.slice(5, 7)}` : fmtDate(sp, t);
    if (sp.end > sp.start) return `${dayText(sp.start, t)}~${dayText(sp.end, t, sp.end.getFullYear() !== sp.start.getFullYear())}`;
    return fmtDate(sp, t);
  };
  // D-day 글자: 진행 중이면 "진행 중", 아니면 D-n
  const dLabel = (sp, t) => {
    if (sp.start <= t && t <= sp.end) return sp.month ? "이번 달" : "진행 중";
    const n = Math.round((sp.start - t) / DAY);
    return n === 0 ? "오늘" : `D-${n.toLocaleString()}`;
  };
  const link = (r) => {
    const s = (r.sources && r.sources[0]) || (r.sourceName ? { name: r.sourceName, url: r.sourceUrl } : null);
    if (!s) return "";
    return s.url && /^https?:\/\//.test(s.url) ? `<a class="src" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>` : `<span class="src">${esc(s.name)}</span>`;
  };
  // 상태 표시: 확정은 표시하지 않는다(확인된 것은 조용히). 보도·추정·원문 미확인만 점+글자로.
  const badges = (r) => `${r.status && r.status !== "confirmed" ? `<span class="pst ${r.status}">${PST[r.status] || r.status}</span>` : ""}${r.unverified ? ` <span class="unv-i" tabindex="0" role="img" aria-label="원문은 아직 못 봤어요${r.reason || r.note ? `: ${esc(r.reason || r.note)}` : ""}" title="원문은 아직 못 봤어요${r.reason || r.note ? ` — ${esc(r.reason || r.note)}` : ""}">ⓘ</span>` : ""}`;
  const DRE = /^\d{4}-\d{2}(-\d{2})?$/;
  const eventsOf = (r) => {
    if (r.events) return r.events;
    const [a, b] = String(r.date || "").split("~").map((x) => x.trim());
    return DRE.test(a) ? [{ label: "", start: a, ...(b && DRE.test(b) ? { end: b } : {}) }] : [];
  };
  const dateOf = (t) => (t.match(/^\d{4}(-\d{2}){0,2}/) || [""])[0];
  const canStore = () => { try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); return true; } catch { return false; } };
  const dayN = (s, t) => { const [y, m, d] = s.split("-").map(Number); return Math.round((new Date(y, m - 1, d) - t) / DAY); };

  views.home = async (el) => {
    const [schools, summary, curricula, policy] = await Promise.all([load("schools"), load("summary"), load("curricula"), load("policy")]);
    const t = today();
    const P = new Map(policy.map((r) => [r.id, r]));
    const pf = profile(), isB = pf.key === "b", others = profiles().filter((q) => q.id !== pf.id);
    const entryYear = pf.entryYear, examYear = pf.examYear;
    const ev0 = (id) => P.get(id)?.events?.[0];
    const one = store.get("portal.oneperson", false);

    // 1) 큰 D-day: 활성 학습자의 수능
    const csatRowB = isB ? policy.find((r) => r.examYear === examYear && /수능/.test(r.title) && !/기본계획|원서|정시|수시/.test(r.title) && r.events?.length) : null;
    const pcsat = pf.csat && !csatRowB ? { id: "pf-csat", status: pf.csat.status, sourceName: pf.csat.sourceName, title: "수능", reason: pf.csat.note, events: [{ start: pf.csat.date, label: "수능 시행일(잠정 예상)" }] } : null;
    const csatRow = isB ? csatRowB || pcsat : P.get("sch-12") || P.get("sch-07"), csat = isB ? csatRow?.events?.[0] : ev0("sch-12") || ev0("sch-07");
    let heroDays = null, heroMeta = "수능 날짜를 아직 못 가져왔어요";
    if (csat) {
      const sp = span(csat.start, csat.end);
      const target = sp.month ? new Date(sp.start.getFullYear(), sp.start.getMonth(), 15) : sp.start;
      heroDays = Math.round((target - t) / DAY);
      heroMeta = `<span class="num">${fmtRange(sp, t, csat)} · ${esc(csat.label)}</span> ${badges(csatRow)} ${link(csatRow)}`;
    }

    // 2) 다음 일정: 학습자와 관련 있는 행만(연도 비어 있으면 공통). 현고3 칩을 켜면 다른 해·현고3 행도 보인다.
    const limit = new Date(t.getTime() + 90 * DAY);
    let aud = isB ? [] : loadAudience(store);
    const related = (r) => (r.examYear == null && r.entryYear == null) || r.examYear === examYear || r.entryYear === entryYear;
    const only3 = (r, e) => { const a = e?.audience || r.audience; return !!a && a.length > 0 && a.every((x) => x === "grade3"); };
    const upcoming = policy.filter((r) => r.topic === "hs-schedule" || r.topic === "gg-hs-entry" || r.topic === "exam-schedule")
      .flatMap((r) => eventsOf(r).map((e) => ({ r, e, sp: span(e.start, e.end) })))
      .filter((x) => x.sp.end >= t && x.sp.start <= limit)
      .sort((a, b) => (a.r.region === "seoul") - (b.r.region === "seoul") || a.sp.start - b.sp.start || a.sp.end - b.sp.end);
    const upRows = () => upcoming.filter((x) => {
      const g3 = aud.includes("grade3");
      if (only3(x.r, x.e)) return g3;
      if (!related(x.r) && !g3) return false;
      return audienceMatch(x.e.audience || x.r.audience, aud);
    });
    const row = (x) => `<li class="row${only3(x.r, x.e) ? " g3" : ""}"><span class="d${x.sp.start <= t ? " live" : " num"}">${dLabel(x.sp, t)}</span>
      <div><h3>${esc(x.r.title)}${x.e.label ? ` · ${esc(x.e.label)}` : ""}</h3><p class="num">${fmtRange(x.sp, t, x.e)}</p><div class="meta">${badges(x.r)} ${link(x.r)}</div></div></li>`;
    const upList = () => { const rs = upRows().slice(0, 4); return rs.length ? rs.map(row).join("") : `<li class="row"><div class="empty"><span class="z" aria-hidden="true">0</span><p>아직 모인 일정이 없어요.</p><small>${isB ? "학교를 고르면 그 학교 일정이 여기에 모입니다." : "앞으로 90일 안에 해당하는 일정이 없어요."}</small></div></li>`; };

    // 3) 곧 있을 일(졸업·입학 D-day + 사진)
    const stones = (pf.milestones || []).filter((m) => m.date);
    const stoneHtml = (m) => {
      const n = dayN(m.date, t), past = n < 0;
      return `<li class="ms${past ? " past" : ""}" data-ms="${esc(pf.id + ":" + m.id)}"><div class="ms-t"><span class="ms-k">${esc(m.label)}</span>
        <b class="ms-n num">${past ? "지났어요" : n === 0 ? "오늘" : `D-${n.toLocaleString()}`}</b>
        <span class="ms-s num">${esc(ymdText(m.date))} ${m.sourceName ? `<span class="muted">· ${esc(m.sourceName)}</span>` : ""}</span>
        <span class="ms-a"><button type="button" class="lnk" data-add>사진 넣기</button><button type="button" class="lnk" data-del hidden>삭제</button><input type="file" accept="image/*" hidden></span></div>
        <div class="ms-p" aria-hidden="true">${ART[m.kind] || ART.graduation}</div></li>`;
    };

    // 4) 바뀐 소식 1줄
    const log = policy.filter((r) => r.topic === "change-log").map((r) => ({ r, d: dateOf(r.title) })).filter((x) => x.d && span(x.d).start <= t).sort((a, b) => span(b.d).start - span(a.d).start);
    // 마지막 확인 일시(데이터 checkedAt 최신값)와 새 소식(지난 방문 이후, 이 브라우저에만 저장)
    const checked = policy.map((r) => r.checkedAt).filter(Boolean).sort().pop() || "";
    const VK = "portal.visit"; const iso = `${t.getFullYear()}-${two(t.getMonth() + 1)}-${two(t.getDate())}`;
    const vis = store.get(VK, null) || { last: null, prev: null };
    if (vis.last !== iso) { vis.prev = vis.last; vis.last = iso; store.set(VK, vis); }
    const fresh = vis.prev ? log.filter((x) => span(x.d).start > new Date(vis.prev + "T00:00:00")).length : 0;
    const logRow = (x) => `<li class="row"><div><h3>${esc(x.r.title.slice(x.d.length).trim() || x.r.title)}</h3><p class="num">${esc(ymdText(x.d))}</p><div class="meta">${badges(x.r)} ${link(x.r)}</div></div></li>`;

    // 5) 학교(예나) · 학점제 숫자
    const mine = summary.filter((m) => pf.schoolIds.includes(m.schoolId));
    const m0 = summary[0];
    const sch = (m) => { const tot = m.creditsTotal || 1; return `<li><a class="sr" href="#select/curriculum?v=compare&s=${esc(m.schoolId)}">${hasLogo(m.schoolId) ? `<img src="img/schools/256/${esc(m.schoolId)}.png" alt="" width="28" height="28">` : "<span></span>"}<span class="nm">${esc(m.schoolName)}<span class="sub">지정 ${m.requiredCount}과목 · 선택 후보 ${m.candidateSubjects}개</span></span><span class="fig"><b class="num">${m.creditsRequired}+${m.creditsElective}</b>지정 + 선택</span><span class="seg" style="grid-column:2 / 4" aria-hidden="true"><i class="r" style="width:${(m.creditsRequired / tot) * 100}%"></i><i class="e" style="width:${(m.creditsElective / tot) * 100}%"></i><i class="o"></i></span></a></li>`; };

    // 6) 앞으로 3년(큰 흐름): 예나만. 모든 마일스톤을 policy.json 행에서 읽는다.
    const rng = (e) => fmtRange(span(e.start, e.end), t, e);
    const mk = (id, label, suffix = "") => { const r = P.get(id), e = ev0(id); return { label, row: r, key: e?.start, date: e ? rng(e) + suffix : "" }; };
    const subs = ["sch-11", "sch-12", "sch-13"].map((id) => ({ r: P.get(id), e: ev0(id) })).filter((x) => x.r && x.e);
    const ms = [
      mk("hs-05", "고입 후기 전형"),
      { label: "중장기 대입 개편안 공표", row: P.get("log-10"), key: dateOf(P.get("log-10")?.title || ""), date: dateOf(P.get("log-10")?.title || "").replace("-", ".") },
      mk("sch-09", "입학"),
      mk("sch-08", "수능 시행 기본계획 공고", " 전후"),
      { label: `${examYear}학년도 대입`, row: null, key: subs.map((x) => x.e.start).sort()[0], date: "", subs },
    ];
    const tl = ms.map((m) => { const past = m.key && span(m.key).end < t; return `<li class="${past ? "past" : ""}"><span class="tl-d num">${esc(m.date || "")}</span><div><b>${esc(m.label)}</b> ${m.row ? badges(m.row) : ""} ${m.row ? link(m.row) : ""}${m.subs ? `<div class="tl-sub">${m.subs.map((x) => `<span class="num">${rng(x.e)}</span> ${esc(x.r.title.replace(`${examYear}학년도 `, ""))} ${badges(x.r)}`).join("<br>")}</div>` : ""}</div></li>`; }).join("");

    const ok = canStore();
    const todosKey = isB ? "todos:b" : "todos";
    const region = (summary[0]?.region || "").split(/\s+/).slice(0, 2).map((x) => x.replace(/시$/, "")).join("·");
    const myChips = () => { const l = isB ? "일반고" : AUDIENCES.filter(([k]) => aud.includes(k)).map(([, v]) => v).join("·"); return `<span>${esc(pf.label)}</span>${l ? `<span>${esc(l)}</span>` : ""}${region ? `<span>${esc(region)}</span>` : ""}`; };

    // 예은(보조) D-day 줄: 한 명만 보기가 켜져 있으면 숨긴다. 누르면 그 사람 화면으로.
    const oth = one ? "" : others.map((q) => q.csat ? `<button type="button" class="aux" data-pf="${q.id}"><span class="aux-n">${esc(q.name)}</span><span class="aux-d num">${esc(q.examYear)}학년도 수능까지 <b>D-${dayN(q.csat.date, t).toLocaleString()}</b></span><span class="pst estimated">추정</span></button>` : "").join("");

    el.innerHTML = `<div class="hm">
      ${oth ? `<div class="auxbar">${oth}</div>` : ""}
      <div class="hero-grid">
        <section class="hero" aria-labelledby="hh">
          <p class="hello" id="hh">${esc(pf.name)}님, 오늘도 한 칸씩.</p>
          <p class="kicker">${examYear}학년도 수능까지</p>
          <button type="button" class="dday" id="dday" aria-live="polite"><span class="sr-only">수능까지 남은 날. 누르면 단위가 바뀝니다. </span><span class="big num" id="ddn">${heroDays == null ? "-" : heroDays.toLocaleString()}</span><span class="unit" id="ddu">일</span></button>
          <p class="hero-meta">${heroMeta}</p>
          <p class="hint">숫자를 누르면 주·달로 바뀌어요.</p>
        </section>
        <aside class="hero-aside" aria-label="다음 일정"><div class="sec-h"><h2><em>지금</em>다음 일정</h2><a href="#schedule">전체 일정</a></div>
          ${isB ? "" : `<div class="hm-aud-wrap">${audienceChips(aud, esc)}</div>`}
          <ul class="rows" id="hm-up">${upList()}</ul></aside>
      </div>
      <div class="two">
        <section class="sec"><div class="sec-h"><h2><em>01</em>${isB ? esc(pf.name) + "의 학교" : "우리 " + mine.length + "개교"}</h2>${isB ? "" : '<a href="#select/curriculum?v=compare">과목표 비교</a>'}</div>
          ${isB || !mine.length ? '<div class="empty"><span class="z" aria-hidden="true">0</span><p>학교를 고르면 여기에 모입니다.</p><small>후보 학교를 담아 두면 지정·선택 학점과 개설 과목을 나란히 볼 수 있어요.</small><a href="#select/curriculum">학교 고르러 가기 →</a></div>' : `<ul class="schools">${mine.map(sch).join("")}</ul><p class="legend">네 학교 모두 <b>${m0.creditsTotal}학점</b>. 막대: <b style="color:var(--req)">지정</b> · <b style="color:var(--ele)">선택</b> · 나머지는 창의적 체험활동.</p>`}</section>
        <section class="sec"><div class="sec-h"><h2><em>02</em>곧 있을 일</h2></div>
          ${stones.length ? `<ul class="mss">${stones.map(stoneHtml).join("")}</ul><p class="hint">사진은 이 기기에만 저장돼요.</p>` : '<div class="empty"><span class="z" aria-hidden="true">0</span><p>아직 모인 일정이 없어요.</p></div>'}</section>
      </div>
      <div class="two">
        <section class="sec"><div class="sec-h"><h2><em>03</em>이번 주 할 일</h2><span class="muted small" id="tdc"></span></div>
          ${ok ? `<ul class="todo" id="todos"></ul><form class="hm-todoform"><input type="text" id="todoin" placeholder="할 일 추가" maxlength="120" autocomplete="off" aria-label="할 일 추가"><button class="btn" type="submit">추가</button></form>` : '<p class="muted">이 브라우저에서는 저장 공간을 쓸 수 없어 메모를 사용할 수 없어요.</p>'}</section>
        <section class="sec"><div class="sec-h"><h2><em>04</em>바뀐 소식</h2><a href="#changelog">전체 보기</a></div>
          <p class="fresh num">${checked ? `마지막 확인 ${esc(ymdText(checked))}` : ""}${vis.prev ? ` · ${fresh ? `<b>새 소식 ${fresh}건</b>` : "새 소식 없음"}` : ""}</p>
          ${log.length ? `<ul class="rows">${log.slice(0, 3).map(logRow).join("")}</ul>` : '<div class="empty"><p>아직 바뀐 소식이 없어요.</p></div>'}</section>
      </div>
      <section class="sec"><div class="sec-h"><h2><em>05</em>학점제 한눈에</h2><a href="#life/credit">자세히</a></div>
        <p class="glance-lead">3년 동안 <mark>${m0.creditsTotal}학점</mark>을 스스로 채웁니다.</p>
        <div class="glance"><div class="g"><span class="v num">${m0.creditsSubject}</span><span class="k">교과 학점</span><span class="n">공통·선택 과목으로 채웁니다</span></div><div class="g"><span class="v num">${m0.creditsCreative}</span><span class="k">창의적 체험활동</span><span class="n">동아리·봉사·진로</span></div></div>
        ${isB ? `<p class="src-line"><span class="pst estimated">추정</span> ${esc(pf.name)}이 입학하는 ${entryYear}학년도에도 같을지는 아직 확인되지 않았어요. 지금 학년도 기준 숫자입니다.</p>` : ""}</section>
      ${isB ? "" : `<section class="sec"><div class="sec-h"><h2><em>06</em>앞으로 3년</h2><a href="#roadmap" id="rm-link" hidden>학년별 로드맵</a></div><ol class="tl">${tl}</ol></section>`}
    </div>`;

    // D-day 숫자 단위 전환(일 → 주 → 개월)
    if (heroDays != null) {
      const modes = [["일", heroDays], ["주", Math.floor(heroDays / 7)], ["개월 안팎", Math.round(heroDays / 30.44)]]; let mi = 0;
      el.querySelector("#dday").addEventListener("click", () => { mi = (mi + 1) % 3; el.querySelector("#ddn").textContent = modes[mi][1].toLocaleString(); el.querySelector("#ddu").textContent = modes[mi][0]; });
    }
    // 대상 칩(예나) → 다음 일정만 다시 그린다
    const hs = el.querySelector(".hero-aside");
    hs.addEventListener("click", (e) => {
      const b = e.target.closest("[data-aud]"); if (!b) return;
      aud = toggleAudience(aud, b.dataset.aud); saveAudience(store, aud);
      hs.querySelector(".hm-aud").outerHTML = audienceChips(aud, esc);
      hs.querySelector("#hm-up").innerHTML = upList();
    });
    // 보조 D-day 줄: 그 사람 화면으로 전환
    el.querySelector(".auxbar")?.addEventListener("click", (e) => { const b = e.target.closest("[data-pf]"); if (b) document.querySelector(`#pf [data-pf="${b.dataset.pf}"]`)?.click(); });

    // 졸업·입학 사진: 이 기기에만 저장
    el.querySelectorAll(".ms").forEach(async (li) => {
      const key = li.dataset.ms, art = li.querySelector(".ms-p"), add = li.querySelector("[data-add]"), del = li.querySelector("[data-del]"), inp = li.querySelector("input[type=file]");
      let url = null;
      const show = (blob) => { if (url) URL.revokeObjectURL(url); url = blob ? URL.createObjectURL(blob) : null; art.classList.toggle("photo", !!blob); if (blob) art.innerHTML = `<img src="${url}" alt="">`; else art.innerHTML = ART[(pf.milestones || []).find((m) => pf.id + ":" + m.id === key)?.kind] || ART.graduation; add.textContent = blob ? "사진 바꾸기" : "사진 넣기"; del.hidden = !blob; };
      if (typeof indexedDB === "undefined") { add.hidden = true; return; }
      show(await photoGet(key));
      add.addEventListener("click", () => inp.click());
      inp.addEventListener("change", async () => { const f = inp.files[0]; if (!f) return; try { const b = await resizePhoto(f); await photoPut(key, b); show(b); } catch { add.textContent = "사진을 못 읽었어요"; } inp.value = ""; });
      del.addEventListener("click", async () => { await photoDel(key).catch(() => {}); show(null); });
    });

    // 이번 주 할 일(체크리스트, 이 브라우저에만 저장)
    if (ok) {
      const list = () => store.get(todosKey, []);
      const draw = () => {
        const items = list();
        el.querySelector("#todos").innerHTML = items.length ? items.map((it, i) => `<li><label><input type="checkbox" data-i="${i}" ${it.done ? "checked" : ""}><span><b>${esc(it.text)}</b></span></label><button type="button" class="hm-del" data-i="${i}" aria-label="삭제">×</button></li>`).join("") : '<li class="empty-li"><div class="empty"><p>오늘은 챙길 게 없어요.</p><small>아래에 적어 두면 여기에 떠요.</small></div></li>';
        el.querySelector("#tdc").textContent = items.length ? `${items.filter((x) => x.done).length}/${items.length}` : "";
      };
      el.querySelector(".hm-todoform").addEventListener("submit", (e) => { e.preventDefault(); const v = el.querySelector("#todoin").value.trim(); if (!v) return; store.set(todosKey, [...list(), { text: v, done: false }]); el.querySelector("#todoin").value = ""; draw(); });
      el.querySelector("#todos").addEventListener("click", (e) => {
        const i = e.target.dataset.i; if (i === undefined) return;
        const items = list();
        if (e.target.classList.contains("hm-del")) items.splice(+i, 1); else if (items[+i]) items[+i].done = e.target.checked;
        store.set(todosKey, items); draw();
      });
      draw();
    }
  };
}
