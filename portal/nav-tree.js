// 좌측 트리 메뉴(사용자 결정 2026-11-06, A안). 메뉴를 고르는 곳은 이 트리 하나다. 항목 구성·이름·설명은 menu-tree.js 한 파일이고, 이 파일은 그것을 화면에서 쓰는 모양(TABS)·찾기(locate)·그리기(treeHtml)로 바꾼다.
// TABS는 menu.js의 옛 TABS와 같은 모양이라 app.js·search.js·pagefoot.js가 그대로 쓴다. 되돌리려면 그 import를 "./menu.js"로 되돌린다. 해시 주소·REDIRECT는 그대로다.
import { HOME, GROUPS, BOTTOM } from "./menu-tree.js";
export { REDIRECT } from "./menu.js";
export { BOTTOM };
// q 조건 하나가 맞는지: 값/값 배열/null(없어야 함)/"!값"/"*"(아무 값이나 있어야 함)
const ok = (cond, got) => (cond === null ? !got : cond === "*" ? !!got : Array.isArray(cond) ? cond.includes(got) : typeof cond === "string" && cond[0] === "!" ? got !== cond.slice(1) : got === cond);
const mk = (it) => (id, q) => (id === it.r || (it.also || []).includes(id)) && Object.entries(it.q || {}).every(([k, c]) => ok(c, k === "v" ? (q.get("v") || "summary") : q.get(k)));
const wrap = (it) => ({ id: it.id, title: it.title, sub: it.sub, soon: it.soon, page: it.page, desc: it.desc, keys: it.keys, vals: it.vals, m: mk(it) });
export const TABS = [
  { id: "home", title: HOME.title, groups: [{ key: "", title: "", items: [wrap(HOME)] }] },
  ...GROUPS.map((g) => ({ id: g.id, title: g.title, leaf: !!g.leaf, foot: !!g.foot, groups: [{ key: "", title: "", items: g.items.map(wrap), soon: g.soon }] })),
];
export const hrefOf = (it) => "#" + it.id;
export const tabHref = (t) => hrefOf(t.groups[0].items[0]);
export const allItems = () => TABS.flatMap((t) => t.groups.flatMap((g) => g.items.map((it) => ({ ...it, tab: t.title, group: g.title }))));
export function locate(id, query) {
  for (const t of TABS) for (const g of t.groups) for (const it of g.items) if (it.m(id, query)) return { tab: t, group: g, item: it };
  if (id === "select/curriculum") { const t = TABS.find((x) => x.id === "hs"); return { tab: t, group: t.groups[0], item: t.groups[0].items[1] }; }
  return null;
}
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const link = (it, loc, cls = "") => `<a href="${esc(hrefOf(it))}"${cls ? ` class="${cls}"` : ""}${loc && loc.item === it ? ' aria-current="page"' : ""}><b>${esc(it.title)}</b>${it.desc ? `<small>${esc(it.desc)}</small>` : ""}</a>`;
// 트리 HTML: 데스크톱 사이드바와 모바일 서랍이 같은 것을 쓴다. 1단계 줄기에 2단계 가지가 선으로 이어진다.
export const treeHtml = (loc, fold = false) => {
  // fold=true(모바일 서랍): 현재 그룹만 펴고 나머지는 머리글 한 줄(눌러서 연다). 홈은 로고·하단 바 '오늘'로, 자료·소식은 맨 아래 작은 링크로 가므로 여기엔 없다.
  const shown = TABS.filter((t) => t.id !== "home" && !t.foot), anyOn = shown.some((t) => loc && loc.tab === t); // 현재 그룹이 없으면(홈·자료실) 두 그룹을 모두 펴서 연다
  return shown.map((t, gi) => {
    const items = t.groups.flatMap((g) => g.items), on = loc && loc.tab === t, open = on || !anyOn;
    const list = `<ul id="ntg-${gi}">${items.map((it) => `${it.sub ? `<li class="nt-sub" aria-hidden="true">${esc(it.sub)}</li>` : ""}<li>${link(it, loc)}</li>`).join("")}</ul>`;
    if (fold) return `<section class="nt-g${on ? " on" : ""}${open ? " open" : ""}"><h2 class="nt-h"><button type="button" class="nt-gt" aria-expanded="${open ? "true" : "false"}" aria-controls="ntg-${gi}">${esc(t.title)}</button></h2>${list}</section>`;
    return `<section class="nt-g${on ? " on" : ""}"><h2 class="nt-h">${esc(t.title)}</h2>${list}</section>`;
  }).join("");
};
// 메뉴 맨 아래 작은 글자 링크(바뀐 소식·관련 사이트·출처·확인일·원본 파일·화면 설정)
export const footLinks = (loc) => TABS.filter((t) => t.foot).flatMap((t) => t.groups.flatMap((g) => g.items)).map((it) => `<a href="${esc(hrefOf(it))}"${loc && loc.item === it ? ' aria-current="page"' : ""}>${esc(it.title)}</a>`).join("");
