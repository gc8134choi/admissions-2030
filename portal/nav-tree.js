// 좌측 트리 메뉴(사용자 결정 2026-11-06, A안). 메뉴를 고르는 곳은 이 트리 하나다. 항목 구성·이름·설명은 menu-tree.js 한 파일이고, 이 파일은 그것을 화면에서 쓰는 모양(TABS)·찾기(locate)·그리기(treeHtml)로 바꾼다.
// TABS는 menu.js의 옛 TABS와 같은 모양이라 app.js·search.js·pagefoot.js가 그대로 쓴다. 되돌리려면 그 import를 "./menu.js"로 되돌린다. 해시 주소·REDIRECT는 그대로다.
import { HOME, GROUPS, BOTTOM } from "./menu-tree.js";
export { REDIRECT } from "./menu.js";
export { BOTTOM };
// q 조건 하나가 맞는지: 값/값 배열/null(없어야 함)/"!값"/"*"(아무 값이나 있어야 함)
const ok = (cond, got) => (cond === null ? !got : cond === "*" ? !!got : Array.isArray(cond) ? cond.includes(got) : typeof cond === "string" && cond[0] === "!" ? got !== cond.slice(1) : got === cond);
const mk = (it) => (id, q) => (id === it.r || (it.also || []).includes(id)) && Object.entries(it.q || {}).every(([k, c]) => ok(c, k === "v" ? (q.get("v") || "summary") : q.get(k)));
const wrap = (it) => ({ id: it.id, title: it.title, desc: it.desc, m: mk(it) });
export const TABS = [
  { id: "home", title: HOME.title, groups: [{ key: "", title: "", items: [wrap(HOME)] }] },
  ...GROUPS.map((g) => ({ id: g.id, title: g.title, leaf: !!g.leaf, soon: g.soon, groups: [{ key: "", title: "", items: g.items.map(wrap), soon: g.soon }] })),
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
export const treeHtml = (loc) => {
  let n = 0;
  return TABS.map((t) => {
    const items = t.groups.flatMap((g) => g.items), on = loc && loc.tab === t;
    if (t.id === "home") return `<section class="nt-g nt-home${on ? " on" : ""}">${link(items[0], loc, "nt-hl")}</section>`;
    n++;
    if (t.leaf) return `<section class="nt-g leaf${on ? " on" : ""}">${link(items[0], loc, "nt-hl")}</section>`;
    return `<section class="nt-g${on ? " on" : ""}"><h2 class="nt-h"><span class="nt-n" aria-hidden="true">${n}</span>${esc(t.title)}</h2><ul>${items.map((it) => `<li>${link(it, loc)}</li>`).join("")}</ul></section>`;
  }).join("");
};
