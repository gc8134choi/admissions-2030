// 상세 화면 공통 머리·꼬리: 빵부스러기(현재 위치), "같이 볼 것"(3개 이내), 자료 확인일·출처 모음·오류 알리기.
// 새 메뉴가 아니다. 위치 정보는 menu.js의 locate() 결과를 그대로 쓴다.
const REPO = "https://github.com/gc8134choi/admissions-2030";
// 화면(메뉴 항목 id) → 같이 볼 것 [제목, 주소]. 학교 → 일정 → 요건 → 출처 순서로 이어지게 둔다.
export const RELATED = {
  "select/curriculum?v=schools&lv=high": [["고교 종류", "#select/curriculum?v=types"], ["고교 일정", "#schedule?t=hs"], ["대학별 과목", "#select/curriculum?v=univ"]],
  "select/curriculum?v=middle": [["중학교 일정", "#schedule?t=life"], ["학교 보기", "#select/curriculum?v=schools&lv=middle"]],
    "select/curriculum?v=schools&lv=middle": [["배정·입학 준비", "#select/curriculum?v=middle"], ["중학교 일정", "#schedule?t=life"]],
  "life/credit": [["내 계획표", "#planner/plan"], ["학교 보기", "#select/curriculum?v=schools&lv=high"], ["수능과 내신", "#admission/system"]],
  "planner/plan": [["학교 보기", "#select/curriculum?v=schools&lv=high"], ["대학별 과목", "#select/curriculum?v=univ"], ["고교학점제", "#life/credit"]],
  "schedule?t=road": [["고교 일정", "#schedule?t=hs"], ["수능과 내신", "#admission/system"], ["내 계획표", "#planner/plan"]],
  "admission/system": [["대학별 과목", "#select/curriculum?v=univ"], ["일정", "#schedule?t=univ"], ["고교학점제", "#life/credit"]],
  "select/curriculum?v=univ": [["수능과 내신", "#admission/system"], ["일정", "#schedule?t=univ"], ["내 계획표", "#planner/plan"]],
  "schedule?t=hs": [["학교 보기", "#select/curriculum?v=schools&lv=high"], ["수능과 내신", "#admission/system"], ["학년별 할 일", "#schedule?t=road"]],
  "schedule?t=life": [["배정·입학 준비", "#select/curriculum?v=middle"], ["입학 준비", "#select/curriculum?v=middle&open=guide"]],
  "schedule": [["학교 보기", "#select/curriculum?v=schools&lv=high"], ["수능과 내신", "#admission/system"], ["학년별 할 일", "#schedule?t=road"]],
  "changelog": [["출처·확인일", "#library/sources"], ["갱신 현황", "#library/status"]],
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const crumbHtml = (loc, hrefOf, tabHref) => {
  if (!loc || loc.item.id === "home") return "";
  const parts = [`<a href="${esc(tabHref(loc.tab))}">${esc(loc.tab.title)}</a>`, ...(loc.tab.title === loc.item.title ? [] : [`<a href="${esc(hrefOf(loc.item))}">${esc(loc.item.title)}</a>`])];
  return `<nav id="crumb" class="crumb" aria-label="현재 위치">${parts.join('<span aria-hidden="true"> › </span>')}<span class="crumb-s"></span></nav>`;
};

export const footHtml = (loc) => {
  if (!loc || loc.item.id === "home") return "";
  const rel = (RELATED[loc.item.id] || []).slice(0, 3);
  const issue = `${REPO}/issues/new?title=${encodeURIComponent("[오류 제보] " + loc.item.title)}&body=${encodeURIComponent("화면: " + loc.item.title + "\n주소: " + location.href + "\n\n어디가 어떻게 달라야 하나요?\n")}`;
  return `<aside class="pgfoot" aria-label="이 화면 안내">${rel.length ? `<p class="pg-rel"><b>같이 볼 것</b>${rel.map(([t, u]) => `<a href="${esc(u)}">${esc(t)}</a>`).join("")}</p>` : ""}
    <p class="pg-meta"><a class="pg-issue" href="${esc(issue)}" target="_blank" rel="noopener">오류 알리기 ↗</a></p></aside>`;
};

// 이 화면에서 출처 버튼 뒤에 있는 링크를 모아 한 줄 접이식으로
export const sourcesHtml = (root) => {
  const seen = new Map();
  root.querySelectorAll(".srcp a[href^=http], .srcf a[href^=http]").forEach((a) => { const k = a.href; if (!seen.has(k)) seen.set(k, (a.textContent || "").replace(/\s*↗\s*$/, "").trim() || k); });
  if (!seen.size) return "";
  return `<details class="srcf pg-srcf"><summary>이 화면의 출처 ${seen.size}건</summary><ul>${[...seen].map(([u, t]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a></li>`).join("")}</ul></details>`;
};
