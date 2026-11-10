// 학년별 로드맵(일정 > 학년별 탭). 데이터: data/roadmap.json(학습자별 시기표). 스타일은 policy.css(.ed-*, .rd-*).
// 시기 축 칩(중3 겨울·고1·고2·고3·수능)은 스크롤해도 위에 붙고, 누르면 그 시기로 이동한다. 확정은 표시하지 않고 보도·추정만 조용히 표시한다.
import { STAGES, stageTag } from "./stage.js";
// 로드맵 항목의 입시 단계: 중학교 배정·초등 관련은 중입, 수능·고3·수시·정시는 대입, 나머지는 고입.
const rdStage = (x) => (/중학교 (배정|입학)|초등/.test(x.what) ? "중입" : x.stageKey === "csat" || Number(x.stageKey) >= 2 || /수시|정시|수능|대입/.test(x.what) ? "대입" : "고입");
export async function roadmapView(el, { load, esc, learner, fmt, badgeMain, notice, store }) {
  const d = await load("roadmap");
  // 기준 학년(현재 중3 / 초6): 화면에 이름은 없고 입학연도 기준이다. 선택은 이 브라우저에만 저장한다.
  const BK = "portal.roadmap.base", ids = Object.keys(d._meta?.learners || {});
  const hq = new URLSearchParams((location.hash.split("?")[1] || "")); // 주소의 b(기준 학년)·st(단계)·w(대상)가 저장값보다 우선
  const sv = hq.get("b") || (store ? store.get(BK, null) : null);
  const fo0 = store ? store.get("portal.focus", null) : null; // 홈에서 "중학교 입학 준비"만 켰으면 초6 기준을 먼저
  const byFocus = Array.isArray(fo0) && fo0.length === 1 && fo0[0] === "중입" && ids.includes("B") ? "B" : "";
  const base = ids.includes(sv) ? sv : byFocus || (ids.includes(learner.id) ? learner.id : ids[0]);
  const BASES = [["A", "현재 중3 기준", "중3 기준 학년별 큰 그림이에요."], ["B", "현재 초6 기준", "초6 기준 큰 그림이에요. 중학교 입학 2027 → 고교 입학 2030 → 대입 2033 순서예요. 먼 일정은 대부분 추정이라 바뀔 수 있어요."]].filter(([k]) => ids.includes(k));
  const items = d.items.filter((x) => x.learner === base);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const stages = [];
  for (const x of items) { if (!stages.find((s) => s.key === x.stageKey)) stages.push({ key: x.stageKey, label: x.stage, order: x.stageOrder, first: x.start }); }
  stages.sort((a, b) => a.order - b.order);
  // 지금 시기: 시작일이 오늘 이전인 마지막 시기(없으면 첫 시기).
  const cur = [...stages].reverse().find((s) => s.first.slice(0, 7) <= today.slice(0, 7)) || stages[0];
  const SK = "portal.roadmap.stage"; // 단계 필터(브라우저에만 저장, portal.<화면>.stage 규칙)
  let fs = hq.has("st") ? hq.get("st") : store ? store.get(SK, "") : ""; if (!STAGES.includes(fs)) fs = "";
  let who = ["학생", "학부모"].includes(hq.get("w")) ? hq.get("w") : "";
  const syncRd = () => { try { history.replaceState(null, "", `#schedule?t=road&b=${base}${fs ? "&st=" + encodeURIComponent(fs) : ""}${who ? "&w=" + encodeURIComponent(who) : ""}`); } catch {} };
  const rowHtml = (x) => {
    const last = x.end || x.start;
    const past = last < (last.length === 7 ? today.slice(0, 7) : today); // 월 단위 날짜는 그 달이 지나야 지난 일정
    const lbl = fmt({ start: x.start, ...(x.end ? { end: x.end } : {}) });
    const tags = x.who.map((t) => `<b class="rd-who${t === "학부모" ? " p" : ""}">${esc(t)}</b>`).join(" · ");
    const src = x.sourceName ? `<p class="ed-s">출처 ${x.sourceUrl ? `<a href="${esc(x.sourceUrl)}" target="_blank" rel="noopener">${esc(x.sourceName)}</a>` : esc(x.sourceName)}</p>` : "";
    return `<article class="rd-row${past ? " past" : ""}" data-who="${esc(x.who.join(","))}"><div class="rd-d">${lbl.split("~").map((t, i, arr) => `<span>${i ? "~" : ""}${esc(t)}${i === arr.length - 1 && ["reported", "estimated", "unknown", "material"].includes(x.status) && x.start > today ? " 예정" : ""}</span>`).join("")}</div><div><p class="rd-w">${stageTag(rdStage(x), esc)}${tags}</p><p class="ed-b">${esc(x.what)}</p><div class="ed-st">${badgeMain(x)}</div>${x.note ? `<div class="ed-note">${esc(x.note)}</div>` : ""}${src}</div></article>`;
  };
  const opened = new Set(); // 눌러서 펼친 시기(필터를 바꿔도 유지)
  const draw = () => {
    syncRd();
    $sections.innerHTML = stages.map((s) => {
      const rs = items.filter((x) => x.stageKey === s.key && (!who || x.who.includes(who)) && (!fs || rdStage(x) === fs));
      return rs.length ? `<details class="rd-sec" id="rd-${esc(s.key)}"${s.key === cur.key || opened.has(s.key) ? " open" : ""}><summary><h2>${esc(s.label)}${s.key === cur.key ? '<span class="ed-tag">지금</span>' : ""} <span class="rd-n">${rs.length}건</span></h2></summary>${rs.map(rowHtml).join("")}</details>` : "";
    }).join("") || '<p class="ed-src">이 조건에 맞는 항목이 없어요.</p>';
  };
  el.innerHTML = `<div class="ed"><div class="ed-filter" id="rdbase" role="group" aria-label="기준 학년"><span>기준 학년</span>${BASES.map(([k, t]) => `<button type="button" class="${k === base ? "on" : ""}" data-b="${k}" aria-pressed="${k === base}">${t}</button>`).join("")}</div>
    <p class="ed-top"><b>${esc((BASES.find(([k]) => k === base) || [0, 0, "학년별 큰 그림이에요."])[2])}</b> 추정은 아직 공고 전이라 바뀔 수 있어요.</p>
    <nav class="ed-toc" aria-label="시기 축">${stages.map((s) => `<button type="button" data-go="rd-${esc(s.key)}"${s.key === cur.key ? ' aria-current="true"' : ""}>${esc(s.label)}</button>`).join("")}</nav>
    <div class="ed-filter" id="rdw" role="group" aria-label="누구 할 일"><span>보기</span><button type="button" class="on" data-w="">전체</button><button type="button" data-w="학생">학생</button><button type="button" data-w="학부모">학부모</button></div>
    <div class="chipbar" id="rdstg"></div>
    <div id="rdsec"></div></div>`;
  const $sections = el.querySelector("#rdsec");
  const drawStage = () => { el.querySelector("#rdstg").innerHTML = `<span class="flabel">단계</span><div class="chips">${[["", "전체"], ...STAGES.map((g) => [g, g])].map(([v, t]) => `<button type="button" class="chip${v === fs ? " on" : ""}" data-stage="${v}" aria-pressed="${v === fs}">${t}</button>`).join("")}</div>`; };
  el.querySelectorAll("#rdw button").forEach((x) => x.classList.toggle("on", x.dataset.w === who));
  drawStage(); draw();
  el.querySelector("#rdbase").addEventListener("click", (e) => { const b = e.target.closest("[data-b]"); if (!b || b.dataset.b === base) return; if (store) store.set(BK, b.dataset.b); try { history.replaceState(null, "", `#schedule?t=road&b=${b.dataset.b}`); } catch {} roadmapView(el, { load, esc, learner, fmt, badgeMain, notice, store }); });
  $sections.addEventListener("toggle", (e) => { const d = e.target; if (d.classList?.contains("rd-sec")) { const k = d.id.slice(3); d.open ? opened.add(k) : opened.delete(k); } }, true);
  el.querySelector("#rdstg").addEventListener("click", (e) => { const b = e.target.closest("[data-stage]"); if (!b) return; fs = b.dataset.stage; if (store) store.set(SK, fs); drawStage(); draw(); });
  el.querySelector("#rdw").addEventListener("click", (e) => { const b = e.target.closest("[data-w]"); if (!b) return; who = b.dataset.w; el.querySelectorAll("#rdw button").forEach((x) => x.classList.toggle("on", x === b)); draw(); });
  el.querySelector(".ed-toc").addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) { const t = document.getElementById(b.dataset.go); if (t) { t.open = true; t.scrollIntoView({ behavior: "smooth", block: "start" }); } } });
}
