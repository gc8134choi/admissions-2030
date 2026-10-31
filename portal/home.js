import { showProfiles } from "./profile-ui.js";
import { STAGES, stageOf, stageTag } from "./stage.js";
import { hubsHtml, planPanel, comparePanel, admPanel, midPanel, STAGE_HUB, PIN_KEY } from "./dash.js";
import { decorateTerms, initTerms } from "./terms.js";
// 홈 화면(A안 에디토리얼). 데이터: policy.json(일정·변경 로그·학점제 규칙·마일스톤), summary/curricula/schools(관심 학교).
// policy.json·policy.js는 읽기만 한다(서브 세션 담당).
const PST = { confirmed: "확정", reported: "보도", estimated: "추정", unknown: "확인 못 함" };
const DAY = 864e5;

// ---- 일정 대상 필터(칩): 일정 화면 등 다른 화면에서 같은 키·함수를 재사용할 수 있게 분리 ----
export const AUDIENCES = [["general", "일반고"], ["science", "과학·영재"], ["private", "자사·외·국제"]];
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
  const badges = (r) => `${stageTag(stageOf(r), esc)}${r.status && r.status !== "confirmed" ? `<span class="pst ${r.status}">${PST[r.status] || r.status}</span>` : ""}${r.unverified ? ` <span class="unv-i" tabindex="0" role="img" aria-label="원문은 아직 못 봤어요${r.reason || r.note ? `: ${esc(r.reason || r.note)}` : ""}" title="원문은 아직 못 봤어요${r.reason || r.note ? ` — ${esc(r.reason || r.note)}` : ""}">ⓘ</span>` : ""}`;
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
    const pf = profile(), SHOW = showProfiles(), isB = SHOW && pf.key === "b";
    const entryYear = pf.entryYear, examYear = pf.examYear;
    const ev0 = (id) => P.get(id)?.events?.[0];
    

    // 2) 다음 일정: 관련 있는 행만(연도 비어 있으면 공통). 현 고3 일정은 화면에 내지 않는다.
    const limit = new Date(t.getTime() + 90 * DAY);
    let aud = isB ? [] : loadAudience(store);
    const related = (r) => r.topic === "life-schedule" || (r.examYear == null && r.entryYear == null) || r.examYear === examYear || r.entryYear === entryYear; // 졸업·입학은 항상, 대입 일정은 2030학년도 대입 기준만
    const isG3 = (r, e) => (e?.audience || r.audience || []).includes("grade3"); // 데이터에 남아 있어도 화면에는 내지 않는다
    const upcoming = policy.filter((r) => r.topic === "hs-schedule" || r.topic === "gg-hs-entry" || r.topic === "exam-schedule" || r.topic === "life-schedule")
      .flatMap((r) => eventsOf(r).map((e) => ({ r, e, sp: span(e.start, e.end) })))
      .filter((x) => x.sp.end >= t && x.sp.start <= limit)
      .sort((a, b) => (a.r.region === "seoul") - (b.r.region === "seoul") || a.sp.start - b.sp.start || a.sp.end - b.sp.end);
    const upRows = () => upcoming.filter((x) => !isG3(x.r, x.e) && related(x.r) && audienceMatch(x.e.audience || x.r.audience, aud));
    const row = (x) => `<li class="row"><span class="d${x.sp.start <= t ? " live" : " num"}">${dLabel(x.sp, t)}</span>
      <div><h3>${esc(x.r.title)}${x.e.label ? ` · ${esc(x.e.label)}` : ""}</h3><p class="num">${fmtRange(x.sp, t, x.e)}</p><div class="meta">${badges(x.r)} ${link(x.r)}</div></div></li>`;
    const upList = () => { const rs = upRows().slice(0, 4); return rs.length ? rs.map(row).join("") : `<li class="row"><div class="empty"><span class="z" aria-hidden="true">0</span><p>아직 모인 일정이 없어요.</p><small>${isB ? "학교를 고르면 그 학교 일정이 여기에 모입니다." : "앞으로 90일 안에 해당하는 일정이 없어요."}</small></div></li>`; };

    // 3) 곧 있을 일(졸업·입학 D-day + 사진)
    const lifeRows = policy.filter((r) => r.topic === "life-schedule" && /졸업|입학/.test(r.title) && r.events?.[0]?.start);
    const stones = lifeRows.map((r) => ({ id: r.id, label: r.title, date: r.events[0].start, kind: /졸업/.test(r.title) ? "graduation" : "entrance", row: r })).filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.date)).sort((a, b) => a.date.localeCompare(b.date));
    const stoneHtml = (m) => {
      const n = dayN(m.date, t), past = n < 0;
      return `<li class="ms${past ? " past" : ""}" data-ms="${esc("life:" + m.id)}"><div class="ms-t"><span class="ms-k">${esc(m.label)}</span>
        <b class="ms-n num">${past ? "지났어요" : n === 0 ? "오늘" : `D-${n.toLocaleString()}`}</b>
        <span class="ms-s num">${esc(ymdText(m.date))} ${link(m.row)}</span>
        <span class="ms-a"><button type="button" class="lnk" data-add>사진 넣기</button><button type="button" class="lnk" data-del hidden>삭제</button><input type="file" accept="image/*" hidden></span></div>
        <div class="ms-p" aria-hidden="true">${ART[m.kind] || ART.graduation}</div></li>`;
    };

    // 히어로 = 가장 가까운 한 가지 일(일정 또는 졸업·입학). 그다음 몇 개는 헤어라인 목록.
    const oneLine = (b) => { const t1 = String(b || "").split(/(?<=[.。다요])\s/)[0] || ""; return t1.length > 80 ? t1.slice(0, 78) + "…" : t1; };
    const feed = () => {
      const stoneIds = new Set(stones.map((m) => m.id));
      const evs = upRows().filter((x) => !stoneIds.has(x.r.id)).map((x) => ({ kind: "ev", row: x.r, seoul: x.r.region === "seoul", sp: x.sp, title: x.r.title + (x.e.label ? ` · ${x.e.label}` : ""), date: fmtRange(x.sp, t, x.e), line: oneLine(x.r.body), meta: `${badges(x.r)} ${link(x.r)}` }));
      const sts = stones.filter((m) => dayN(m.date, t) >= 0).map((m) => ({ kind: "stone", row: m.row, m, sp: span(m.date), title: m.label, date: ymdText(m.date), line: "", meta: `${badges(m.row)} ${link(m.row)}` }));
      return [...evs, ...sts].sort((a, b) => !!a.seoul - !!b.seoul || a.sp.start - b.sp.start || a.sp.end - b.sp.end); // 서울 행은 경기·전국 행 다음
    };
    // 가까운 일정 장부: 히어로 없이 한 줄씩(D-day · 제목 · 기간 · 단계/상태·출처). 가장 가까운 일은 같은 줄에서 굵기·색으로만 강조.
    // 주로 보는 단계(이름·프로필 아님, 이 브라우저에만 저장). 처음 한 번 고르고 언제든 바꾼다. 고른 단계는 "자주 보는 단계"(허브 고정)와 합쳐진다.
    const FK = "portal.focus", FOPT = [["중입", "중학교 입학 준비"], ["고입", "고교 고르기·고교 생활"], ["대입", "대입 준비"]];
    const fsaved = store.get(FK, null);
    let focus = Array.isArray(fsaved) && fsaved.filter((x) => STAGES.includes(x)).length ? fsaved.filter((x) => STAGES.includes(x)) : [...STAGES];
    let fpicking = !Array.isArray(fsaved);
    const feedF = () => { const f = feed(), m = f.filter((it) => { const g = stageOf(it.row); return !g || focus.includes(g); }); return m.length ? m : f; };
    const rest = () => { const f = feedF().slice(0, 3);
      if (!f.length) return `<li class="lg"><div class="empty"><p>아직 모인 일정이 없어요.</p><small>${isB ? "학교를 고르면 그 학교 일정이 여기에 모입니다." : "앞으로 90일 안에 해당하는 일정이 없어요."}</small></div></li>`;
      return f.map((it, i) => { const live = it.sp.start <= t, left = Math.round((it.sp.end - t) / DAY), g = stageOf(it.row);
        const dl = live ? (left > 0 ? `진행 중 · ${left}일 남음` : "진행 중") : dLabel(it.sp, t);
        const meta = String(it.meta).replace(/<span class="stg">.*?<\/span>/, "").trim();
        return `<li class="lg${i === 0 ? " first" : ""}"><span class="lg-s">${g ? esc(g) : ""}</span><span class="d${live ? " live" : " num"}">${dl}</span><b class="lg-t">${esc(it.title)}</b><span class="lg-d num">${it.date}</span><span class="lg-m">${meta}</span></li>`; }).join(""); };
    const focusBar = () => fpicking
      ? `<div class="fpick" role="group" aria-label="주로 보는 단계"><p class="fpick-q">주로 보는 단계를 골라 주세요. 여러 개 고를 수 있고, 언제든 바꿀 수 있어요.</p><div class="chips">${FOPT.map(([k, t]) => `<button type="button" class="fchip${focus.includes(k) ? " on" : ""}" data-f="${k}" aria-pressed="${focus.includes(k)}">${t}</button>`).join("")}</div><button type="button" class="btn primary" data-fsave>이대로 보기</button></div>`
      : `<p class="fbar muted">보는 단계 <b>${FOPT.filter(([k]) => focus.includes(k)).map(([, t]) => esc(t)).join(" · ")}</b> <button type="button" class="lnk" data-fedit>바꾸기</button></p>`;

    // 4) 바뀐 소식 1줄
    const log0 = policy.filter((r) => r.topic === "change-log").map((r) => ({ r, d: dateOf(r.title) })).filter((x) => x.d && span(x.d).start <= t);
    // 감시 봇이 최근 30일 안에 "바뀌었다"고 기록한 페이지도 같은 목록에 넣는다(내용은 아직 확인 전, 추정 표시). 읽지 못하면 조용히 건너뛴다.
    const watchLog = await (async () => {
      try {
        const [st, wl] = await Promise.all([fetch("../research/data/watch-state.json").then((r) => (r.ok ? r.json() : {})), fetch("../research/data/watchlist.json").then((r) => (r.ok ? r.json() : { items: [] }))]);
        return Object.entries(st).filter(([, v]) => v.changedAt && t - new Date(v.changedAt) < 30 * DAY).map(([id, v]) => {
          const it = (wl.items || []).find((x) => x.id === id); if (!it) return null;
          const c = new Date(v.changedAt), d = `${c.getFullYear()}-${two(c.getMonth() + 1)}-${two(c.getDate())}`;
          return { d, r: { title: `${d} ${it.name} 페이지가 바뀌었어요`, status: "estimated", unverified: true, reason: "감시 봇이 감지했고 내용은 아직 확인 전", sources: [{ name: "원문 열기", url: it.url }] } };
        }).filter(Boolean);
      } catch { return []; }
    })();
    const log = [...log0, ...watchLog].sort((a, b) => span(b.d).start - span(a.d).start);
    // 마지막 확인 일시(데이터 checkedAt 최신값)와 새 소식(지난 방문 이후, 이 브라우저에만 저장)
    const checked = policy.map((r) => r.checkedAt).filter(Boolean).sort().pop() || "";
    const VK = "portal.visit"; const iso = `${t.getFullYear()}-${two(t.getMonth() + 1)}-${two(t.getDate())}`;
    const vis = store.get(VK, null) || { last: null, prev: null };
    if (vis.last !== iso) { vis.prev = vis.last; vis.last = iso; store.set(VK, vis); }
    // 읽음 표시: 지난 방문 이후 올라온 소식 중 눌러 보지 않은 것에 "새". 눌러 본 것은 이 브라우저에만 기억한다.
    const RK = "portal.read", readSet = new Set(store.get(RK, []));
    const keyOf = (x) => x.r.id || x.r.title;
    const isNew = (x) => !!vis.prev && span(x.d).start > new Date(vis.prev + "T00:00:00") && !readSet.has(keyOf(x));
    const fresh = log.filter(isNew).length;
    const logRow = (x) => `<li class="row nw${isNew(x) ? " is-new" : ""}" data-rk="${esc(keyOf(x))}"><div><h3>${isNew(x) ? '<b class="new">새</b> ' : ""}${esc(x.r.title.slice(x.d.length).trim() || x.r.title)}</h3><p class="num">${esc(ymdText(x.d))}</p><div class="meta">${badges(x.r)} ${link(x.r)}</div></div></li>`;

    // 5) 학교 · 학점제 숫자
    const mine = summary.filter((m) => pf.schoolIds.includes(m.schoolId));
    const m0 = summary[0];
    const sch = (m) => { const tot = m.creditsTotal || 1; return `<li><a class="sr" href="#select/curriculum?v=compare&s=${esc(m.schoolId)}">${hasLogo(m.schoolId) ? `<img src="img/schools/256/${esc(m.schoolId)}.png" alt="" width="28" height="28">` : "<span></span>"}<span class="nm">${esc(m.schoolName)}<span class="sub">필수 ${m.requiredCount}과목 · 선택 후보 ${m.candidateSubjects}개</span></span><span class="fig"><b class="num">${m.creditsRequired}+${m.creditsElective}</b>필수 + 내가 고르는</span><span class="seg" style="grid-column:2 / 4" aria-hidden="true"><i class="r" style="width:${(m.creditsRequired / tot) * 100}%"></i><i class="e" style="width:${(m.creditsElective / tot) * 100}%"></i><i class="o"></i></span></a></li>`; };

    // 6) 앞으로 3년(큰 흐름). 모든 마일스톤을 policy.json 행에서 읽는다.
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

    // 수능 D-day는 작은 한 줄로(추정 표기 유지)
    const cs = ev0("sch-12") || ev0("sch-07"), csRow = P.get("sch-12") || P.get("sch-07");
    const csDays = cs && !cs.start.endsWith("-") ? (() => { const sp0 = span(cs.start, cs.end); return Math.round(((sp0.month ? new Date(sp0.start.getFullYear(), sp0.start.getMonth(), 15) : sp0.start) - t) / DAY); })() : null;
    const ddline = csDays != null ? `<span class="aux me"><span class="aux-d num">${examYear}학년도 수능 <b>${csDays.toLocaleString()}일</b></span> ${badges(csRow)}</span>` : "";

    // 알림 후보: 7일 안에 시작하거나 진행 중인 일정과 지난 방문 이후 새 소식을 한 줄로(없으면 숨김). 브라우저 알림은 쓰지 않는다.
    const pingLine = () => {
      const wk = upRows().filter((x) => x.sp.start <= new Date(t.getTime() + 7 * DAY));
      if (!wk.length && !fresh) return "";
      const first = wk[0], head = first ? `${esc(first.r.title)}${wk.length > 1 ? ` 외 ${wk.length - 1}건` : ""}` : "";
      return `<p class="hm-ping" role="status">${wk.length ? `<a href="#schedule"><b>이번 주</b> ${head}</a>` : ""}${wk.length && fresh ? '<span class="stg-sep" aria-hidden="true">·</span>' : ""}${fresh ? `<a href="#changelog"><b>새 소식</b> ${fresh}건</a>` : ""}</p>`;
    };

    // 단계 줄: 지금 가장 가까운 일이 속한 단계를 강조하고, 누르면 그 단계 일정으로 간다(앞으로 90일 안 일정 수 함께).
    const STG_HREF = { 중입: "#select/curriculum?v=middle", 고입: "#select/curriculum", 대입: "#admission/system" }; // 단계별 첫 화면(중학교 배정 / 학교별 과목표 / 수능·내신 규칙)
    const stageLine = () => {
      const cnt = Object.fromEntries(STAGES.map((g) => [g, 0]));
      upRows().forEach((x) => { const g = stageOf(x.r); if (g) cnt[g]++; });
      const first = feed()[0], cur = first ? (first.kind === "stone" ? stageOf(first.m.row) : stageOf(upcoming.find((x) => x.r.title + (x.e.label ? ` · ${x.e.label}` : "") === first.title)?.r)) : null;
      return STAGES.map((g) => `<a href="${STG_HREF[g]}"${g === cur ? ' class="on" aria-current="true"' : ""}><b>${g}</b><small class="num">${cnt[g] ? `곧 ${cnt[g]}건` : "—"}</small></a>`).join('<span class="stg-sep" aria-hidden="true">—</span>');
    };

    // 대시보드 패널(읽지 못한 패널은 조용히 빼고 나머지는 그대로 보여 준다)
    const ctx = { load, esc, store, policy };
    const safe = (f) => f(ctx).catch(() => "");
    const [planH, cmpH, admH, midH] = isB ? ["", "", "", ""] : await Promise.all([safe(planPanel), safe(comparePanel), safe(admPanel), safe(midPanel)]);
    const hubCounts = {}; STAGES.forEach((g) => { hubCounts[g] = upRows().filter((x) => stageOf(x.r) === g).length; });

    const pins = (store.get(PIN_KEY, []) || []).filter((x) => typeof x === "string").slice(0, 2);
    const autoHub = STAGE_HUB[stageOf(feedF()[0]?.row)] || null;
    el.innerHTML = `<div class="hm">
      ${ddline ? `<div class="auxbar" aria-label="수능 D-day">${ddline}</div>` : ""}
      ${pingLine()}
      <div class="h-row2">
        <div class="h-main">
          <section class="dp ledger" aria-labelledby="lgh"><div class="sec-h"><h2 id="lgh"><em>지금</em>지금 할 일 3가지</h2><a href="#schedule">전체 일정 ›</a></div>
            <div id="hm-focus">${focusBar()}</div><ul class="lgs" id="hm-up">${rest()}</ul></section>
        <section class="dp soonp t2"><div class="sec-h"><h2><em>곧</em>곧 있을 일</h2></div>
          ${stones.length ? `<ul class="mss">${stones.map(stoneHtml).join("")}</ul><p class="hint">사진은 이 기기에만 저장돼요.</p>` : '<div class="empty"><span class="z" aria-hidden="true">0</span><p>아직 모인 일정이 없어요.</p></div>'}</section>
        </div>
        <div class="h-side">
        <section class="dp news t0"><div class="sec-h"><h2><em>소식</em>바뀐 소식</h2><a href="#changelog">전체 ›</a></div>
          <p class="fresh num">${checked ? `마지막 확인 ${esc(ymdText(checked))}` : ""}${fresh ? ` · <b>새 소식 ${fresh}건</b>` : ""}</p>
          ${log.length ? `<ul class="rows">${log.slice(0, 2).map(logRow).join("")}</ul>` : '<div class="empty"><p>아직 바뀐 소식이 없어요.</p></div>'}</section>
        <section class="dp todop t1"><div class="sec-h"><h2><em>할 일</em>이번 주 할 일</h2><span class="muted small" id="tdc"></span></div>
          ${ok ? `<ul class="todo" id="todos"></ul><form class="hm-todoform"><input type="text" id="todoin" placeholder="할 일 추가" maxlength="120" autocomplete="off" aria-label="할 일 추가"><button class="btn" type="submit">추가</button></form>` : '<p class="muted">이 브라우저에서는 저장 공간을 쓸 수 없어 메모를 사용할 수 없어요.</p>'}</section>
        </div>
      </div>
      <div id="hm-hubs">${hubsHtml(esc, hubCounts, { pins, auto: autoHub })}</div>
      <div class="h-row4">
        ${planH}
        ${cmpH}
      </div>
      <div class="h-row5">
        <div class="h-col">${admH}${midH}</div>
        ${isB ? "" : `<section class="dp road t0"><div class="sec-h"><h2><em>3년</em>앞으로 3년</h2><a href="#schedule?t=road" id="rm-link">학년별 로드맵</a></div><ol class="tl">${tl}</ol></section>`}
      </div>
      <div class="h-rest">
        <section class="dp gl t1"><div class="sec-h"><h2><em>학점</em>학점제 한눈에</h2><a href="#life/credit">자세히</a></div>
        <p class="glance-lead">3년 동안 <mark>${m0.creditsTotal}학점</mark>을 스스로 채웁니다.</p>
        <div class="glance"><div class="g"><span class="v num">${m0.creditsSubject}</span><span class="k">교과 학점</span><span class="n">공통·선택 과목으로 채웁니다</span></div><div class="g"><span class="v num">${m0.creditsCreative}</span><span class="k">창의적 체험활동</span><span class="n">동아리·봉사·진로</span></div></div>
        ${isB ? `<p class="src-line"><span class="pst estimated">추정</span> ${esc(pf.name)}이 입학하는 ${entryYear}학년도에도 같을지는 아직 확인되지 않았어요. 지금 학년도 기준 숫자입니다.</p>` : ""}</section>
      </div>
    </div>`;
    decorateTerms(el, ".dp");
    initTerms();
    // 모바일에서는 덜 급한 패널(3년·학점제·전형)을 접어 두고 제목 줄의 버튼으로 편다(홈 높이를 줄인다)
    el.querySelectorAll(".road,.gl,.adm").forEach((pn) => { pn.classList.add("m-fold"); const h = pn.querySelector(".sec-h,h2"); if (h) h.insertAdjacentHTML("beforeend", '<button type="button" class="m-tg" aria-expanded="false">펼치기</button>'); });

    // 허브: 고정(자주 보는 단계, 최대 2개) / 모바일 접기·펼치기 / 읽음 표시
    el.addEventListener("click", (e) => {
      const pin = e.target.closest("[data-pin]");
      if (pin) { let ps = store.get(PIN_KEY, []) || []; const id = pin.dataset.pin; ps = ps.includes(id) ? ps.filter((x) => x !== id) : [...ps, id].slice(-2); store.set(PIN_KEY, ps);
        el.querySelector("#hm-hubs").innerHTML = hubsHtml(esc, hubCounts, { pins: ps, auto: autoHub }); decorateTerms(el.querySelector("#hm-hubs"), ".dp"); return; }
      const mt = e.target.closest(".m-tg");
      if (mt) { const pn = mt.closest(".m-fold"), on = !pn.classList.contains("m-open"); pn.classList.toggle("m-open", on); mt.setAttribute("aria-expanded", on); mt.textContent = on ? "접기" : "펼치기"; return; }
      const tg = e.target.closest(".hub-t");
      if (tg) { const h = tg.closest(".hub"); const on = !h.classList.contains("open"); h.classList.toggle("open", on); tg.setAttribute("aria-expanded", on); return; }
      const rk = e.target.closest(".nw a");
      if (rk) { const k = rk.closest(".nw").dataset.rk; const cur = new Set(store.get(RK, [])); cur.add(k); store.set(RK, [...cur].slice(-200)); rk.closest(".nw").classList.remove("is-new"); rk.closest(".nw").querySelector(".new")?.remove(); }
    });

    // 주로 보는 단계 선택·변경: 저장하면 허브 고정(자주 보는 단계)도 같이 맞춘다
    const fRedraw = () => { el.querySelector("#hm-focus").innerHTML = focusBar(); el.querySelector("#hm-up").innerHTML = rest(); };
    el.querySelector("#hm-focus").addEventListener("click", (e) => {
      const ch = e.target.closest("[data-f]");
      if (ch) { const k = ch.dataset.f; focus = focus.includes(k) ? focus.filter((x) => x !== k) : [...focus, k]; if (!focus.length) focus = [k]; fRedraw(); return; }
      if (e.target.closest("[data-fsave]")) { fpicking = false; store.set(FK, focus);
        const ps = STAGES.filter((g) => focus.includes(g)).map((g) => STAGE_HUB[g]).slice(0, 2); store.set(PIN_KEY, ps);
        el.querySelector("#hm-hubs").innerHTML = hubsHtml(esc, hubCounts, { pins: ps, auto: autoHub }); decorateTerms(el.querySelector("#hm-hubs"), ".dp"); fRedraw(); return; }
      if (e.target.closest("[data-fedit]")) { fpicking = true; fRedraw(); }
    });
    // 중학교 입학 준비만 고르면 수능 D-day·학점제·3년 로드맵은 아래로 접는다
    if (focus.length === 1 && focus[0] === "중입" && !fpicking) {
      const rest2 = [el.querySelector(".auxbar"), el.querySelector(".gl"), el.querySelector(".road")].filter(Boolean);
      if (rest2.length) { const d = document.createElement("details"); d.className = "dp more-panels"; d.innerHTML = "<summary>다른 단계 정보 보기 (수능 D-day · 학점제 · 3년 로드맵)</summary>"; rest2.forEach((n) => { n.classList.remove("m-fold"); d.appendChild(n); }); el.querySelector(".hm").appendChild(d); }
    }

    // 보조 D-day 줄: 그 사람 화면으로 전환
    el.querySelector(".auxbar")?.addEventListener("click", (e) => { const b = e.target.closest("[data-pf]"); if (b) document.querySelector(`#pf [data-pf="${b.dataset.pf}"]`)?.click(); });

    // 졸업·입학 사진: 이 기기에만 저장
    function bindPhotos(scope) { (scope || el).querySelectorAll("[data-ms]").forEach(async (li) => {
      const key = li.dataset.ms, art = li.querySelector(".ms-p"), add = li.querySelector("[data-add]"), del = li.querySelector("[data-del]"), inp = li.querySelector("input[type=file]");
      let url = null;
      const show = (blob) => { if (url) URL.revokeObjectURL(url); url = blob ? URL.createObjectURL(blob) : null; art.classList.toggle("photo", !!blob); if (blob) art.innerHTML = `<img src="${url}" alt="">`; else art.innerHTML = ART[(pf.milestones || []).find((m) => pf.id + ":" + m.id === key)?.kind] || ART.graduation; add.textContent = blob ? "사진 바꾸기" : "사진 넣기"; del.hidden = !blob; };
      if (typeof indexedDB === "undefined") { add.hidden = true; return; }
      show(await photoGet(key));
      add.addEventListener("click", () => inp.click());
      inp.addEventListener("change", async () => { const f = inp.files[0]; if (!f) return; try { const b = await resizePhoto(f); await photoPut(key, b); show(b); } catch { add.textContent = "사진을 못 읽었어요"; } inp.value = ""; });
      del.addEventListener("click", async () => { await photoDel(key).catch(() => {}); show(null); });
    }); }
    bindPhotos(el.querySelector(".mss"));

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
