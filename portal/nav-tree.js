// 좌측 트리 메뉴(사용자 결정 2026-11-06, A안). 메뉴를 고르는 곳은 이 트리 하나다(하단 탭·헤더 보관함·화면 안 글자 탭을 대신한다).
// 모양은 menu.js의 TABS와 같다(탭 = 1단계 그룹 1개, 그 안의 items = 2단계). 되돌리려면 app.js·search.js의 import를 "./menu.js"로 되돌리고 이 파일·nav-tree.css 링크를 지운다.
// 항목 id는 이동 주소(해시)이고 m(id, query)은 지금 화면이 그 항목인지 알려 준다. 해시 주소·REDIRECT는 그대로다(menu.js의 REDIRECT).
export { REDIRECT } from "./menu.js";
const cur = (f) => (id, q) => id === "select/curriculum" && f(q.get("v") || "summary", q.get("lv"), q);
const at = (rid) => (id) => id === rid;
const sch = (t) => (id, q) => id === "schedule" && q.get("t") === t;
export const TABS = [
  { id: "now", title: "지금 할 일", groups: [{ key: "", title: "", items: [
    { id: "home", title: "오늘 할 일", m: at("home") },
    { id: "schedule", title: "전체 일정", m: (id, q) => id === "schedule" && !["life", "road", "univ", "hs"].includes(q.get("t")) },
    { id: "changelog", title: "바뀐 소식", m: at("changelog") }] }] },
  { id: "mid", title: "중학교", groups: [{ key: "", title: "", items: [
    { id: "select/curriculum?v=middle", title: "중학교 배정", m: cur((v) => v === "middle") },
    { id: "select/curriculum?v=map&lv=middle", title: "중학교 지도", m: cur((v, lv) => v === "map" && lv === "middle") },
    { id: "mid/life", title: "중학교 생활", m: at("mid/life") },
    { id: "schedule?t=life", title: "중입 일정", m: sch("life") }] }] },
  { id: "high", title: "고등학교", groups: [{ key: "", title: "", items: [
    { id: "select/curriculum?v=hs&ty=1", title: "고교 종류", m: cur((v, lv, q) => v === "hs" && q.get("ty") === "1") },
    { id: "schedule?t=hs", title: "고입 일정", m: sch("hs") },
    { id: "select/curriculum?v=hs", title: "학교 비교", m: cur((v, lv, q) => (v === "hs" && q.get("ty") !== "1") || v === "summary" || v === "compare") },
    { id: "select/curriculum?v=map", title: "고교 지도", m: cur((v, lv) => v === "map" && lv !== "middle") },
    { id: "life/credit", title: "학점제 쉬운 설명", m: at("life/credit") },
    { id: "planner/plan", title: "내 과목 계획", m: at("planner/plan") },
    { id: "schedule?t=road", title: "학년별 할 일", m: sch("road") }] }] },
  { id: "admit", title: "대학 입시", groups: [{ key: "", title: "", items: [
    { id: "admission/system", title: "수능과 내신", m: at("admission/system") },
    { id: "select/curriculum?v=univ", title: "대학별 조건", m: cur((v) => v === "univ") },
    { id: "schedule?t=univ", title: "입시 일정", m: sch("univ") }], soon: ["대학·학과 찾기", "학교별 시뮬레이션", "목표 학과 체크"] }] },
  { id: "lib", title: "자료", groups: [{ key: "", title: "", items: [
    { id: "library", title: "바로가기 모음", m: at("library") },
    { id: "library/sources", title: "출처 목록", m: at("library/sources") },
    { id: "library/status", title: "갱신 기록", m: at("library/status") },
    { id: "library/files", title: "원본 사진", m: at("library/files") }] }] },
];
export const hrefOf = (it) => "#" + it.id;
export const tabHref = (t) => hrefOf(t.groups[0].items[0]);
export const allItems = () => TABS.flatMap((t) => t.groups.flatMap((g) => g.items.map((it) => ({ ...it, tab: t.title, group: g.title }))));
export function locate(id, query) {
  for (const t of TABS) for (const g of t.groups) for (const it of g.items) if (it.m(id, query)) return { tab: t, group: g, item: it };
  if (id === "select/curriculum") return { tab: TABS[2], group: TABS[2].groups[0], item: TABS[2].groups[0].items[2] };
  return null;
}
// 트리 HTML: 데스크톱 사이드바와 모바일 서랍이 같은 것을 쓴다. 마인드맵처럼 1단계 줄기에 2단계 가지가 선으로 이어진다.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const treeHtml = (loc) => TABS.map((t, i) => `<section class="nt-g${loc && loc.tab === t ? " on" : ""}"><h2 class="nt-h"><span class="nt-n" aria-hidden="true">${i + 1}</span>${esc(t.title)}</h2><ul>${t.groups.flatMap((g) => g.items).map((it) => `<li><a href="${esc(hrefOf(it))}"${loc && loc.item === it ? ' aria-current="page"' : ""}>${esc(it.title)}</a></li>`).join("")}</ul></section>`).join("");
