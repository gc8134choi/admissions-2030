// 홈 대시보드 패널. 상황 5허브(=사이트맵), 찾기 줄, 내 계획표 요약, 고교 한눈에, 전형 한눈에, 중학교 배정 미니.
// 데이터는 모두 portal/data의 생성물이고, 계획표는 이 브라우저(localStorage)에 저장된 것을 읽는다. 패널은 각 화면의 요약일 뿐 계산은 화면과 같은 규칙이다.
import { stageTag } from "./stage.js";
import { hsCompareBody, hsCompareSummary } from "./hs-compare.js";

// 상황 5허브: 메뉴(menu.js)와 같은 도착 화면. 라벨은 부모가 쓰는 상황 말. 링크 앞 2개는 늘 보이고 나머지는 "현재/고정" 허브에서만 펼쳐진다.
export const HUBS = [
  { id: "mid-enter", stage: "중입", t: "중학교 배정 준비", sub: "중학교 입학", links: [["중학교 배정 절차·일정", "#select/curriculum?v=middle"], ["학교 지도(중학교)", "#select/curriculum?v=map&lv=middle"], ["배정 일정 모아 보기", "#schedule?t=life"], ["교과서·교과 구성", "#select/curriculum?v=middle"]] },
  { id: "mid-life", stage: "중입", t: "중학교 생활", sub: "중학교 생활", links: [["중학교 시기 일정", "#schedule?t=life"], ["교과서", "#select/curriculum?v=middle"], ["중학교 생활", "#mid/life"]] },
  { id: "hs-enter", stage: "고입", t: "고교 고르기", sub: "고등학교 입학", links: [["학교 비교(유형·과목·지도)", "#select/curriculum?v=hs"], ["학교별 과목표", "#select/curriculum"], ["고교 유형·전형", "#select/types"], ["설명회 노트(홍천고)", "#select/curriculum?bf=1"]] },
  { id: "hs-life", stage: "고입", t: "고교 생활·과목 선택", sub: "고등학교 생활", links: [["내 계획표", "#planner/plan"], ["고교학점제 이해", "#life/credit"], ["학년별 로드맵", "#schedule?t=road"]] },
  { id: "admit", stage: "대입", t: "대입 준비", sub: "대입", links: [["수능·내신 규칙", "#admission/system"], ["대학 요건 맞춰보기", "#select/curriculum?v=univ"], ["전형 한눈에", "#admission/system?t=types"], ["입시 일정", "#schedule?t=univ"]] },
];
export const STAGE_HUB = { 중입: "mid-enter", 고입: "hs-enter", 대입: "admit" };
export const PIN_KEY = "portal.home.pins"; // "자주 보는 단계"(브라우저에만 저장, 최대 2개). 프로필이 아니다.

export const searchHtml = () => `<button type="button" class="dp dsearch" data-open-search aria-label="검색 열기"><span class="hand">찾기</span><span class="dsearch-t">학교, 과목, 일정, 용어…</span><kbd>/</kbd></button>`;

// 현재 단계(고정 + 자동) 허브는 크게(.cur), 나머지는 제목+숫자+링크 2개. 모바일은 접어 두고 제목을 누르면 펼친다.
export function hubsHtml(esc, counts = {}, { pins = [], auto = null } = {}) {
  const cur = new Set(pins.length ? pins : auto ? [auto] : []);
  return `<nav class="dhubs" style="--hc:${HUBS.length + cur.size}" aria-label="상황별 바로가기">${HUBS.map((h, i) => {
    const on = cur.has(h.id), pinned = pins.includes(h.id), n = counts[h.stage];
    return `<section class="dp hub t${i % 3}${on ? " cur open" : ""}" data-hub="${h.id}"><h2><button type="button" class="hub-t" aria-expanded="${on}" aria-controls="hl-${h.id}"><em>${esc(h.sub)}</em>${esc(h.t)}${n && (h.id === "mid-enter" || h.id === "hs-enter" || h.id === "admit") ? `<small class="num">곧 ${n}건</small>` : ""}</button>
      <button type="button" class="pin" data-pin="${h.id}" aria-pressed="${pinned}" title="자주 보는 단계로 고정">${pinned ? "고정됨" : "고정"}</button></h2>
      <ul id="hl-${h.id}">${h.links.map(([t, u], j) => `<li${j >= 2 ? ' class="more"' : ""}><a href="${esc(u)}">${esc(t)}</a></li>`).join("")}</ul></section>`;
  }).join("")}</nav>`;
}

const ymd = (s) => String(s || "").slice(5).replace("-", ".");

// 내 계획표 요약: 마지막으로 연 학교의 저장된 계획에서 학점 합계·필수 이수·대학 권장 충족을 센다.
export async function planPanel({ load, esc, store }) {
  const [schools, offerings, ix, summary, pr, matches, rules, ul] = await Promise.all(["schools", "offerings", "offerings-index", "summary", "planner-rules", "matches", "admission-rules", "universities"].map((n) => load(n)));
  const last = store.get("portal.plan.last", null);
  const sid = schools.some((s) => s.id === last) ? last : schools[0].id;
  const school = schools.find((s) => s.id === sid);
  const offs = offerings.filter((o) => o.schoolId === sid);
  const saved = store.get("portal.plan." + sid, null);
  const picks = new Set(saved && Array.isArray(saved.picks) ? saved.picks : []);
  const chosen = offs.filter((o) => o.slot === "required" || picks.has(o.id));
  const cr = (xs) => xs.reduce((a, o) => a + (o.credits || 0), 0);
  const sum = summary.find((m) => m.schoolId === sid) || {};
  const subj = cr(chosen), creative = sum.creditsCreative ?? 18, goalAll = sum.creditsTotal ?? 192;
  const rba = pr.graduation.requiredByArea, reqTotal = pr.graduation.requiredCredits.value;
  const G = ["기술·가정/정보", "제2외국어/한문/교양"];
  const inA = (a) => cr(chosen.filter((o) => o.area === a));
  const rows = [...rba.items.map((i) => ({ t: i.area, need: i.credits, have: inA(i.area) })), ...(rba.groupItems || []).map((g) => ({ t: g.label.replace(/ 합$/, ""), need: g.credits, have: G.reduce((a, x) => a + inA(x), 0) }))];
  const reqHave = rows.reduce((a, r) => a + Math.min(r.have, r.need), 0);
  const lack = rows.filter((r) => r.have < r.need).sort((a, b) => b.need - b.have - (a.need - a.have)).slice(0, 2);
  // 대학 권장: 이 학교로 계산된 데이터가 있는 첫 대학의 모집단위 중 충족 수
  const ms = matches.matches.filter((m) => m.schoolId === sid && m.requirements);
  const uid = ms[0]?.universityId, uname = ul.universities.find((u) => u.id === uid)?.name;
  const planned = new Set(chosen.map((o) => ix.byOffering[o.id]).filter(Boolean));
  let uni = "";
  if (uid) {
    const units = ms.filter((m) => m.universityId === uid).map((m) => {
      const rs = m.requirements.map((q) => { const ids = new Set([...(q.guaranteed || []), ...(q.selectable || [])].map((x) => x.subjectId || x)); const have = [...planned].filter((id) => ids.has(id)).length; return { label: q.label, ok: have >= q.minCount }; });
      return { name: rules.rules.find((r) => r.ruleId === m.ruleId)?.unitName || m.ruleId, ok: rs.every((x) => x.ok), miss: rs.filter((x) => !x.ok) };
    });
    const met = units.filter((u) => u.ok).length, near = units.filter((u) => !u.ok).sort((a, b) => a.miss.length - b.miss.length)[0];
    uni = `<li><b>${esc(uname)} 권장</b> <span class="num ${met === units.length ? "done" : ""}">${met}/${units.length} 모집단위 충족</span>${near ? `<small class="warn">${esc(near.name)}: ${esc(near.miss[0].label)}</small>` : ""}</li>`;
  }
  const none = !picks.size;
  return `<section class="dp plan t1"><h2><em>계획</em>내 계획표 요약<a href="#planner/plan">열기 ›</a></h2>
    <div class="plan-n"><span class="big ac num">${subj + creative}</span><span class="muted">/ ${goalAll}학점 · ${esc(school.name)}</span></div>
    <div class="pbar" aria-hidden="true"><i class="r" style="width:${Math.min(100, (cr(chosen.filter((o) => o.slot === "required")) / goalAll) * 100)}%"></i><i class="e" style="width:${Math.min(100, (cr(chosen.filter((o) => o.slot !== "required")) / goalAll) * 100)}%"></i></div>
    <ul><li><b>필수 이수</b> <span class="num ${reqHave >= reqTotal ? "done" : ""}">${reqHave}/${reqTotal}</span>${lack.length ? `<small>${lack.map((r) => `${esc(r.t)} ${r.have}/${r.need}`).join(" · ")} 부족</small>` : ""}</li>${uni}
    ${none ? `<li><small>아직 고른 과목이 없어요. 계획표에서 학기별로 골라 보세요.</small></li>` : ""}</ul>
    <p class="plan-go"><a href="#planner/plan">과목 고르기</a> <a href="#select/curriculum?v=univ">대학 요건 맞춰보기</a></p></section>`;
}

// 고교 한눈에: 학교별 핵심 지표 한 줄씩 + 지도·설명회 노트 바로가기
export async function comparePanel({ load, esc }) {
  const [summary, places, briefings, hs] = await Promise.all([load("summary"), load("places"), load("briefings").catch(() => null), load("hs-compare").catch(() => null)]);
  const lines = new Map(hsCompareSummary(hs, { max: 5 }).filter((x) => x.schoolId).map((x) => [x.schoolId, x.line]));
  const pl = (sid) => places.places.find((p) => p.schoolId === sid)?.id;
  const bf = (sid) => ((briefings && briefings.briefings) || []).some((b) => b.schoolId === sid);
  const M = [["creditsRequired", "필수 학점", "r"], ["creditsElective", "내가 고르는 학점", "e"], ["candidateSubjects", "후보 과목", ""], ["breadth", "선택 폭", ""]];
  const stat = M.map(([k]) => { const v = summary.map((m) => +m[k]); return { max: Math.max(...v), min: Math.min(...v) }; });
  // 차이 먼저: 학교 사이에 가장 크게 다른 두 항목을 맨 위에 적는다
  const diffs = M.map(([k, l], i) => ({ l, lo: stat[i].min, hi: stat[i].max, d: stat[i].max ? (stat[i].max - stat[i].min) / stat[i].max : 0 })).sort((a, b) => b.d - a.d).slice(0, 2);
  const cell = (m, i) => { const [k, l, c] = M[i], v = +m[k], st = stat[i]; return `<span class="cm ${c}${v === st.max && st.max !== st.min ? " hi" : ""}" title="${esc(l)}"><b class="num">${v}</b><span class="cm-b"><i style="width:${st.max ? (v / st.max) * 100 : 0}%"></i></span></span>`; };
  return `<section class="dp hscmp t2 glass"><h2><em>비교</em>고교 한눈에<a href="#select/curriculum?v=hs">자세히 ›</a></h2>
    <p class="cmx-d"><b>가장 다른 점</b> ${diffs.map((d) => `${esc(d.l)} <span class="num">${d.lo}~${d.hi}</span>`).join(" · ")}</p>
    <ul class="cmx"><li class="cmx-h" aria-hidden="true"><span>학교</span>${M.map(([, l]) => `<span>${esc(l)}</span>`).join("")}</li>${summary.map((m) => `<li><div class="cmx-n"><a href="#select/curriculum?v=compare&s=${esc(m.schoolId)}"><b>${esc(m.schoolName)}</b></a><small title="${esc(lines.get(m.schoolId) || "")}">${esc(m.schoolType)}·${esc(m.founding)}${lines.get(m.schoolId) ? ` · ${esc(lines.get(m.schoolId))}` : ""}</small>
      <span class="cmx-g"><a href="#select/curriculum?v=map${pl(m.schoolId) ? "&p=" + esc(pl(m.schoolId)) : ""}">지도</a>${bf(m.schoolId) ? ` · <a href="#select/curriculum?v=summary&bf=${esc(m.schoolId)}">설명회 노트</a>` : ""}</span></div>${M.map((_, i) => cell(m, i)).join("")}</li>`).join("")}</ul></section>`;
}

// 전형 한눈에 미니 표
export async function admPanel({ load, esc }) {
  const d = await load("admission-types").catch(() => null);
  if (!d || !(d.terms || []).length) return "";
  const season = new Map((d.seasons || []).map((s) => [s.id, s.name]));
  const one = (t) => { const f = String(t || "").split(/(?<=[.。다])\s/)[0] || ""; return f.length > 46 ? f.slice(0, 45) + "…" : f; };
  return `<section class="dp adm t0"><h2>${stageTag("대입", esc)}<em>대입</em>전형 한눈에<a href="#admission/system?t=types">자세히 ›</a></h2><table><thead><tr><th>전형</th><th>시기</th><th>한 줄</th></tr></thead><tbody>${d.terms.slice(0, 5).map((t) => `<tr><td><b>${esc(t.name.replace(/\(.*\)/, ""))}</b></td><td>${esc(season.get(t.season) || "")}</td><td>${esc(one(t.what))}</td></tr>`).join("")}</tbody></table><p class="muted small">2028학년도 기준 참고 구조예요. 2030학년도에는 달라질 수 있어요.</p></section>`;
}

// 중학교 배정 미니: 학교군 학교 이름과 남은 배정 일정
export async function midPanel({ load, esc, policy }) {
  const [mid, places] = await Promise.all([load("middle"), load("places")]);
  const names = (mid.zoneSchools || []).map((z) => places.places.find((p) => p.id === z.placeId)?.name).filter(Boolean);
  const ids = ["life-04", "life-06", "life-07"];
  const rows = ids.map((id) => policy.find((r) => r.id === id)).filter(Boolean).map((r) => ({ t: r.title.replace(/\(.*\)/, "").trim(), d: ymd(r.events?.[0]?.start) }));
  return `<section class="dp mid t1"><h2>${stageTag("중입", esc)}<em>중입</em>중학교 배정<a href="#select/curriculum?v=middle">열기 ›</a></h2>
    <p class="mid-s"><b>성복초 → 수지1중학군</b> <small class="muted">${names.length ? `${esc(names.slice(0, 3).join(" · "))}${names.length > 3 ? ` 외 ${names.length - 3}` : ""}` : "학교 목록은 배정 화면에서"}</small></p>
    <ul>${rows.map((r) => `<li><span>${esc(r.t)}</span> <b class="num">${esc(r.d)}</b></li>`).join("")}</ul></section>`;
}

// 고등학교 > 입학 > 학교 비교(고교 선택 정보 허브): 지금 있는 지표 표 + 데이터가 모이면 와이드 비교표
export async function hsHubBody(el, { load, esc }) {
  const top = await comparePanel({ load, esc }).catch(() => "");
  el.innerHTML = `<div class="ed hub-hs">${top}<div id="hs-wide"></div><p class="muted small">필수·내가 고르는 학점과 후보 과목 수는 학교 배부 편제표 기준이에요. 학교를 누르면 과목표로 갑니다.</p></div>`;
  const host = el.querySelector("#hs-wide");
  try { await hsCompareBody(host, { load, esc }); } catch { host.innerHTML = ""; }
}
