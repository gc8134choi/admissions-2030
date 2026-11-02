// 비교 표 공용 컴포넌트(기준 문서: COMPARE-TABLE.md). 비교 대상(학교·유형·전형·대학 …)은 항상 열, 항목은 항상 행.
//   import { cmpTable } from "./compare-table.js";
//   cmpTable(el, {
//     title: "학교 비교", summary: "한 줄 요약", stage: "고입",                 // 캡션(표 제목)과 요약 한 줄, 단계 태그(선택)
//     targets: [{ id, name, sub: "유형·지역", href: "#…", search: "검색용 글자", filterVal: { type: "일반고" } }],
//     rows: [{ id, label, unit, group, kind: "text|number|bool", get: (t) => ({ html?, text, num?, status?, empty?, why? }) }],
//     select: { key: "portal.xx", param: "s", def: ["id", …], max: 8, min: 2, filters: [{ id: "type", label: "유형", options: [...] }] },
//     diff: true,                                                              // "차이만 보기" 토글(기본 꺼짐)
//     emptyNext: { label, url },                                               // 빈칸 안내의 다음 행동(empty.js)
//     sources: [{ name, url }], esc,
//   })
// get()이 돌려주는 text는 같은 값 비교(차이만 보기)와 숫자 막대에 쓰고, html이 있으면 그것을 그린다. status는 reported|estimated만 점으로 보인다(확정은 표시하지 않는다).
// 선택은 주소(?param=a,b,c)와 이 브라우저(localStorage key)에 저장하고, 대상이 2개 미만이면 "하나 더 골라 보세요"만 보인다.
import { stageTag } from "./stage.js";
import { srcFooter } from "./src-ref.js";
import { nextLink } from "./empty.js";
import "./policy-css.js";

const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const lsGet = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return Array.isArray(v) ? v : null; } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const urlGet = (p) => { const c = new URLSearchParams(location.hash.split("?")[1] || "").get(p); return c ? c.split(",").filter(Boolean) : null; };
const urlSet = (p, ids) => { try { const [path, q = ""] = location.hash.split("?"); const sp = new URLSearchParams(q); if (ids.length) sp.set(p, ids.join(",")); else sp.delete(p); history.replaceState(null, "", `${path}${sp.toString() ? "?" + sp.toString().replace(/%2C/g, ",") : ""}`); } catch {} };

export function cmpTable(el, cfg) {
  const esc = cfg.esc || ((s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
  const sel0 = cfg.select || {}, MAX = sel0.max || 8, MIN = sel0.min ?? 2, param = sel0.param || "s", key = sel0.key || `portal.cmp.${cfg.title}`;
  const byId = new Map(cfg.targets.map((t) => [t.id, t]));
  const valid = (a) => (a || []).filter((id) => byId.has(id)).slice(0, MAX);
  const groups = [...new Set(cfg.rows.map((r) => r.group || ""))];
  const st = (el.__cmp ||= { sel: valid(urlGet(param)).length ? valid(urlGet(param)) : valid(lsGet(key)).length ? valid(lsGet(key)) : valid(sel0.def || cfg.targets.map((t) => t.id)).slice(0, sel0.defN || 4), diff: false, open: new Set([groups[0]]), addOpen: false, q: "", f: {} });
  const selectable = cfg.targets.length > Math.min(MAX, 4) || !!sel0.always;
  const save = () => { lsSet(key, st.sel); urlSet(param, st.sel); };

  const cellHtml = (r, c) => {
    if (!c || c.empty) return `<td class="cmp-null" title="${esc(c?.why || "확인하지 못했어요")}"><span class="muted">–</span></td>`;
    const tag = ES[c.status] ? ` <span class="es ${ES[c.status][0]}" title="${ES[c.status][1]}">${ES[c.status][1]}</span>` : "";
    const bar = c.num != null && r._max ? `<i class="cmp-bar" style="width:${Math.max(4, Math.round((c.num / r._max) * 100))}%" aria-hidden="true"></i>` : "";
    return `<td class="${r.kind === "number" ? "num" : ""}"><div class="cmp-v${r.kind === "text" ? "" : " cmp-n"}">${c.html ?? esc(c.text)}${tag}</div>${bar}</td>`;
  };

  const draw = () => {
    const S = st.sel.map((id) => byId.get(id)).filter(Boolean);
    const rows = cfg.rows.map((r) => { const rr = { ...r }; if (r.kind === "number") rr._max = r.max ?? Math.max(0, ...S.map((t) => r.get(t)?.num ?? 0)); /* max: 막대 기준값 고정(비중 %는 100) */ return rr; });
    const cells = new Map(); for (const r of rows) for (const t of S) cells.set(r.id + "|" + t.id, r.get(t));
    const same = (r) => { const vs = S.map((t) => { const c = cells.get(r.id + "|" + t.id); return !c || c.empty ? "∅" : c.text ?? c.html; }); return vs.every((x) => x === vs[0]); };
    const gHtml = groups.map((g) => {
      const rs = rows.filter((r) => (r.group || "") === g);
      const open = st.open.has(g) || !g;
      const body = rs.map((r) => { const sm = S.length > 1 && same(r); if (st.diff && sm) return ""; return `<tr class="cmp-r${sm ? " same" : S.length > 1 ? " diff" : ""}"${open ? "" : " hidden"} data-g="${esc(g)}"><th scope="row" class="cmp-f">${esc(r.label)}${r.unit ? ` <span class="muted small">(${esc(r.unit)})</span>` : ""}</th>${S.map((t) => cellHtml(r, cells.get(r.id + "|" + t.id))).join("")}</tr>`; }).join("");
      if (!body) return "";
      return g ? `<tr class="cmp-gh"><th colspan="${S.length + 1}" scope="colgroup"><button type="button" class="cmp-gb" data-gt="${esc(g)}" aria-expanded="${open}">${open ? "▾" : "▸"} ${esc(g)} <span class="muted small">${rs.length}</span></button></th></tr>${body}` : body;
    }).join("");
    const addList = cfg.targets.filter((t) => !st.sel.includes(t.id) && (!st.q || (t.name + " " + (t.search || "")).includes(st.q)) && (sel0.filters || []).every((f) => !st.f[f.id] || t.filterVal?.[f.id] === st.f[f.id]));
    const picker = selectable ? `<details class="cmp-add"${st.addOpen ? " open" : ""}><summary>${esc(sel0.addLabel || "추가·빼기")} <span class="muted small">(최대 ${MAX}개)</span></summary>
      <div class="cmp-f2"><input type="search" placeholder="이름 검색" value="${esc(st.q)}" data-q aria-label="검색">${(sel0.filters || []).map((f) => `<select data-f="${esc(f.id)}" aria-label="${esc(f.label)}"><option value="">모든 ${esc(f.label)}</option>${f.options.map((o) => `<option${o === st.f[f.id] ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`).join("")}</div>
      <ul class="cmp-pick">${addList.map((t) => `<li><button type="button" data-add="${esc(t.id)}"${st.sel.length >= MAX ? " disabled" : ""}>＋ ${esc(t.name)}${t.sub ? `<span class="muted small"> ${esc(t.sub)}</span>` : ""}</button></li>`).join("") || '<li class="muted small">조건에 맞는 항목이 없어요.</li>'}</ul></details>` : "";
    const table = S.length >= MIN ? `<div class="w-table cmp" tabindex="0" role="region" aria-label="${esc(cfg.title)} 표(가로로 밀어 보세요)"><table class="ed-tbl cmp-tbl" style="--n:${S.length}"><caption class="cmp-cap"><b>${esc(cfg.title)}</b>${cfg.summary ? ` <span class="muted small">${esc(cfg.summary)}</span>` : ""}</caption><colgroup><col style="width:88px">${S.map(() => "<col>").join("")}</colgroup>
      <thead><tr><th scope="col" class="cmp-f cmp-corner">항목</th>${S.map((t) => `<th scope="col" class="cmp-s"><a href="${esc(t.href || "#")}">${esc(t.name)}</a>${t.sub ? `<div class="muted small">${esc(t.sub)}</div>` : ""}${selectable ? `<button type="button" class="cmp-x" data-rm="${esc(t.id)}" aria-label="${esc(t.name)} 빼기">×</button>` : ""}</th>`).join("")}</tr></thead><tbody>${gHtml}</tbody></table></div>`
      : `<p class="muted cmp-few">${S.length ? "하나 더 골라 보세요." : "비교할 것을 골라 주세요."}</p>`;
    el.innerHTML = `<div class="ed cmp-wrap"><h2>${cfg.stage ? stageTag(cfg.stage, esc) : ""}${esc(cfg.title)} <span class="muted small">${S.length}개</span></h2>
      <div class="cmp-bar2">${picker}${cfg.diff !== false ? `<label class="cmp-diff"><input type="checkbox" data-diff${st.diff ? " checked" : ""}> 차이만 보기</label>` : ""}</div>${table}
      <p class="muted small">이름을 누르면 상세 화면으로 가요. 같은 값은 흐리게, 다른 값은 진하게 보여요. "–"는 아직 확인하지 못한 칸이에요.${nextLink(cfg.emptyNext, esc)}</p>${cfg.sources?.length ? srcFooter(cfg.sources, "이 표의 출처") : ""}</div>`;
  };
  el.onclick = (e) => {
    const rm = e.target.closest("[data-rm]"), add = e.target.closest("[data-add]"), gt = e.target.closest("[data-gt]");
    if (rm) { st.sel = st.sel.filter((id) => id !== rm.dataset.rm); save(); draw(); }
    else if (add && st.sel.length < MAX) { st.sel = [...st.sel, add.dataset.add]; save(); draw(); }
    else if (gt) { const g = gt.dataset.gt; st.open.has(g) ? st.open.delete(g) : st.open.add(g); draw(); }
    else { const t = e.target.closest(".cmp-v"); if (t) t.classList.toggle("open"); }
  };
  el.addEventListener("toggle", (e) => { if (e.target.matches?.(".cmp-add")) st.addOpen = e.target.open; }, true);
  el.onchange = (e) => { if (e.target.matches("[data-diff]")) { st.diff = e.target.checked; draw(); } else if (e.target.matches("[data-f]")) { st.f[e.target.dataset.f] = e.target.value; draw(); } };
  el.oninput = (e) => { if (e.target.matches("[data-q]")) { st.q = e.target.value; const pos = e.target.selectionStart; draw(); const q = el.querySelector("[data-q]"); q.focus(); q.setSelectionRange(pos, pos); } };
  draw();
}
