import { stageOf } from "./stage.js";
import { decorateTerms, initTerms } from "./terms.js";
import { srcWrap, noticeHint } from "./src-ref.js";
import { GROUPS } from "./menu-tree.js";
// 홈 화면(A안 에디토리얼). 데이터: policy.json(일정·변경 로그·학점제 규칙·마일스톤), summary/curricula/schools(관심 학교).
// policy.json·policy.js는 읽기만 한다(서브 세션 담당).
const PST = { confirmed: "확정", reported: "보도", estimated: "추정", unknown: "미정" };
const DAY = 864e5;

// ---- 일정 대상 필터(칩): 일정 화면 등 다른 화면에서 같은 키·함수를 재사용할 수 있게 분리 ----
let HOME_PICK = false; // 단계 선택 창을 열어 둔 상태(홈을 다시 그려도 유지)
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


// ---- 홈(2026-11-08 개편): 왼쪽 열(고등학교로 가는 쪽) · 오른쪽 열(중학교로 가는 쪽) 2분할 ----
// 행: [이름] [곧 있을 일] [고등학교|중학교 일정] [고등학교|중학교 소개]. 홈에서는 보도·추정·미정 칩을 내지 않는다(출처 팝오버 안에서만 상태를 보인다).
const COLS = [
  { id: "A", side: "고등학교", stage: "고입", stones: /졸업|입학식/, intro: ["select/curriculum?v=hs&ty=1", "select/curriculum?v=hs", "select/curriculum?v=compare", "life/credit"], all: "#schedule?t=hs" },
  { id: "B", side: "중학교", stage: "중입", stones: /졸업|입학식/, intro: ["select/curriculum?v=middle", "select/curriculum?v=middle&open=cmp", "select/curriculum?v=middle&open=guide", "select/curriculum?v=map&lv=middle"], all: "#schedule?t=life" },
];
const MENU = new Map(GROUPS.flatMap((g) => g.items.map((it) => [it.id, it])));
const PSTX = { reported: "보도", estimated: "추정", unknown: "미정" };

export function registerHome(views, { esc, load, store, profiles }) {
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const two = (n) => String(n).padStart(2, "0");
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  const span = (s, e) => {
    const p = (t) => { const [y, m, d] = t.split("-").map(Number); return d ? { a: new Date(y, m - 1, d), b: new Date(y, m - 1, d), month: false } : { a: new Date(y, m - 1, 1), b: new Date(y, m, 0), month: true }; };
    const a = p(s), b = e ? p(e) : a;
    return { start: a.a, end: b.b, month: a.month };
  };
  const dayText = (d, t, withYear) => `${withYear || d.getFullYear() !== t.getFullYear() ? d.getFullYear() + "." : ""}${two(d.getMonth() + 1)}.${two(d.getDate())}(${WD[d.getDay()]})`;
  const fmtDate = (sp, t) => (sp.month ? `${sp.start.getFullYear()}.${two(sp.start.getMonth() + 1)}` : dayText(sp.start, t, true));
  const fmtRange = (sp, t, e) => {
    if (sp.month) return e && e.end && e.end !== e.start ? `${fmtDate(sp, t)}~${e.end.slice(0, 4)}.${e.end.slice(5, 7)}` : fmtDate(sp, t);
    if (sp.end > sp.start) return `${dayText(sp.start, t, true)}~${dayText(sp.end, t, sp.end.getFullYear() !== sp.start.getFullYear())}`;
    return fmtDate(sp, t);
  };
  const dLabel = (sp, t) => {
    if (sp.start <= t && t <= sp.end) return sp.month ? "이번 달" : "진행 중";
    const n = Math.round((sp.start - t) / DAY);
    return n === 0 ? "오늘" : `D-${n.toLocaleString()}`;
  };
  const DRE = /^\d{4}-\d{2}(-\d{2})?$/;
  const eventsOf = (r) => {
    if (r.events) return r.events;
    const [a, b] = String(r.date || "").split("~").map((x) => x.trim());
    return DRE.test(a) ? [{ label: "", start: a, ...(b && DRE.test(b) ? { end: b } : {}) }] : [];
  };
  // 확정이 아닌 날짜는 칩 대신 "예정"이라는 일반 낱말로만 밝힌다
  const tentative = (r) => !!(r && PSTX[r.status]);
  // 출처 팝오버: 출처·확인일에 더해 상태(보도/추정/미정)와 확인 중 안내를 여기서만 보인다
  const srcOf = (r) => {
    if (!r) return "";
    const list = r.sources || (r.sourceName ? [{ name: r.sourceName, url: r.sourceUrl }] : []);
    const links = list.map((x) => (x.url && /^https?:\/\//.test(x.url) ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)} ↗</a>${noticeHint(x.url)}` : esc(x.name))).join(" · ");
    const st = tentative(r) ? ` <span class="srcd">상태 ${PSTX[r.status]}</span>` : "";
    const un = r.unverified ? ` <span class="srcd">공식 문서로 확인 중이에요</span>` : "";
    return srcWrap(links + st + un, { checked: r.checkedAt || "" });
  };
  const dayN = (s, t) => { const [y, m, d] = s.split("-").map(Number); return Math.round((new Date(y, m - 1, d) - t) / DAY); };

  views.home = async (el) => {
    const [policy] = await Promise.all([load("policy")]);
    const t = today(), P = new Map(policy.map((r) => [r.id, r]));
    const learners = profiles();
    const SCHED = new Set(["hs-schedule", "gg-hs-entry", "exam-schedule", "life-schedule"]);
    const isG3 = (r, e) => (e?.audience || r.audience || []).includes("grade3");
    const related = (r, L) => r.entryYear === L.entryYear || r.examYear === L.examYear || (r.entryYear == null && r.examYear == null);

    const evRow = (x, big) => `<li class="h2-ev${big ? " first" : ""}"><span class="h2-d num${x.sp.start <= t ? " live" : ""}">${dLabel(x.sp, t)}</span><div class="h2-b"><b>${esc(x.label || x.r.title)}</b>${x.label ? `<small>${esc(x.r.title)}</small>` : ""}<span class="num">${esc(x.date)}${x.tent ? " 예정" : ""} ${srcOf(x.r)}</span></div></li>`;
    const stoneCard = (m) => { const n = dayN(m.date, t); return `<li class="ms h2-ms" data-ms="${esc("life:" + m.id)}" data-kind="${m.kind}"><div class="ms-t"><span class="ms-k">${esc(m.label)}</span>
        <b class="ms-n num">${n === 0 ? "오늘" : `D-${n.toLocaleString()}`}</b>
        <span class="ms-s num">${esc(m.dateText)}${m.tent ? " 예정" : ""} ${srcOf(m.r)}</span>
        <span class="ms-a"><button type="button" class="lnk" data-add>사진 넣기</button><button type="button" class="lnk" data-del hidden>삭제</button><input type="file" accept="image/*" hidden></span></div>
        <div class="ms-p" aria-hidden="true">${ART[m.kind] || ART.graduation}</div></li>`; };

    const colHtml = (C) => {
      const L = learners.find((x) => x.id === C.id) || { id: C.id, entryYear: 0, examYear: 0, name: C.side, label: "" };
      let aud; try { aud = loadAudience(store); } catch { aud = AUDIENCE_DEFAULT; }
      const evs = policy.filter((r) => SCHED.has(r.topic) && related(r, L) && stageOf(r) === C.stage && r.region !== "seoul")
        .flatMap((r) => eventsOf(r).map((e) => ({ r, e, sp: span(e.start, e.end) })))
        .filter((x) => x.sp.end >= t && !isG3(x.r, x.e) && audienceMatch(x.e.audience || x.r.audience, aud))
        .sort((a, b) => a.sp.start - b.sp.start || a.sp.end - b.sp.end)
        .map((x) => ({ r: x.r, sp: x.sp, label: x.e.label || "", title: x.r.title + (x.e.label ? ` · ${x.e.label}` : ""), date: fmtRange(x.sp, t, x.e), tent: tentative(x.r), isStone: x.r.topic === "life-schedule" && C.stones.test(x.r.title) && DRE.test(x.e.start) && x.e.start.length === 10 ? x : null, start: x.e.start }));
      // 가장 가까운 졸업·입학 한 건은 D-day 카드(사진 넣기)로
      const sc = evs.find((x) => x.isStone), stone = sc ? { id: sc.r.id, label: sc.r.title, date: sc.start, dateText: fmtRange(sc.sp, t, null), tent: sc.tent, r: sc.r, kind: /졸업/.test(sc.r.title) ? "graduation" : "entrance" } : null;
      const rest = evs.filter((x) => x !== sc);
      const soon = rest.slice(0, 2), later = rest.slice(2, 8);
      // 수능 D-day는 왼쪽 열 '곧 있을 일' 안에 한 줄로
      let dd = "";
      if (C.id === "A" && L.csat?.date && DRE.test(L.csat.date)) {
        const row = P.get(L.csat.policyRowId || "sch-12") || P.get("sch-07"), n = dayN(L.csat.date.length === 10 ? L.csat.date : L.csat.date + "-15", t), sp0 = span(L.csat.date);
        const tent = L.csat.status !== "confirmed";
        dd = `<p class="h2-dd"><span>${L.examYear}학년도 수능</span> <b class="num">D-${n.toLocaleString()}</b> <span class="num">${esc(fmtDate(sp0, t))}${tent ? " 예정" : ""}</span> ${srcOf(row)}</p>`;
      }
      const intro = C.intro.map((id) => MENU.get(id)).filter(Boolean).map((it) => `<li><a href="#${esc(it.id)}"><b>${esc(it.title)}</b><span>${esc(it.desc || "")}</span></a></li>`).join("");
      const nm = esc(C.side); // 열 머리글은 학교급(사람 이름은 화면에 쓰지 않는다, 사용자 결정 2026-11-08)
      return `<div class="hm2-col" data-col="${C.id}">
        <header class="hm2-h"><h2 class="hm2-name">${nm}</h2><p class="hm2-sub">${L.examYear ? `${L.examYear}학년도 대입` : ""}</p></header>
        <section class="dp hm2-b soonp" aria-label="${nm} 곧 있을 일"><div class="sec-h"><h3>곧 있을 일</h3></div>
          ${stone ? `<ul class="mss">${stoneCard(stone)}</ul>` : ""}
          ${soon.length ? `<ul class="h2-evs">${soon.map((x, i) => evRow(x, !stone && i === 0)).join("")}</ul>` : stone ? "" : `<p class="muted">곧 있을 일정이 아직 없어요.</p>`}
          ${dd}${stone ? '<p class="hint">사진은 이 기기에만 저장돼요.</p>' : ""}</section>
        <details class="dp hm2-b hm2-sch" open><summary><h3>${C.side} 일정</h3><a class="h2-all" href="${C.all}">전체 일정 ›</a></summary>
          ${later.length ? `<ul class="h2-evs">${later.map((x) => evRow(x)).join("")}</ul>` : '<p class="muted">앞으로 예정된 일정이 아직 없어요.</p>'}</details>
        <details class="dp hm2-b hm2-intro" open><summary><h3>${C.side} 소개</h3></summary><ul class="h2-go">${intro}</ul></details>
      </div>`;
    };
    el.innerHTML = `<div class="hm hm2">${COLS.map(colHtml).join("")}</div>`;
    decorateTerms(el, ".dp"); initTerms();
    if (matchMedia("(max-width:899px)").matches) el.querySelectorAll(".hm2-intro").forEach((d) => d.removeAttribute("open")); // 모바일 홈 높이: 소개는 눌러서 연다
    { // 검색 결과 등에서 "#home?open=soonp"(곧 있을 일)로 오면 그 자리로 간다
      const want = new URLSearchParams(location.hash.split("?")[1] || "").get("open");
      const pn = want && /^[a-z]+$/.test(want) ? el.querySelector(`.${want}`) : null;
      if (pn) setTimeout(() => pn.scrollIntoView({ block: "start" }), 60);
    }
    // 졸업·입학 사진: 이 기기에만 저장
    el.querySelectorAll("[data-ms]").forEach(async (li) => {
      const key = li.dataset.ms, art = li.querySelector(".ms-p"), add = li.querySelector("[data-add]"), del = li.querySelector("[data-del]"), inp = li.querySelector("input[type=file]"), kind = li.dataset.kind;
      let url = null;
      const show = (blob) => { if (url) URL.revokeObjectURL(url); url = blob ? URL.createObjectURL(blob) : null; art.classList.toggle("photo", !!blob); if (blob) art.innerHTML = `<img src="${url}" alt="">`; else art.innerHTML = ART[kind] || ART.graduation; add.hidden = !!blob; del.hidden = !blob; };
      if (typeof indexedDB === "undefined") { add.hidden = true; return; }
      show(await photoGet(key));
      add.addEventListener("click", () => inp.click());
      inp.addEventListener("change", async () => { const f = inp.files[0]; if (!f) return; try { const b = await resizePhoto(f); await photoPut(key, b); show(b); } catch { add.textContent = "사진을 못 읽었어요"; } inp.value = ""; });
      del.addEventListener("click", async () => { await photoDel(key).catch(() => {}); show(null); });
    });
  };
}
