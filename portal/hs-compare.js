// 고등학교 > "학교 비교": 학교는 항상 가로(열), 항목은 세로(행). 비교할 학교를 4개(최대 8개) 골라 보고, 항목 그룹은 접이식, "차이만 보기" 토글. 데이터: hs-compare.json(tools/build-hs-compare.mjs).
// 선택은 주소(?c=placeId,…)와 이 브라우저(localStorage portal.hs.compare)에 저장한다. 기본값은 성복초에서 가까운 고교 4곳.
import { srcFooter } from "./src-ref.js";
// 값마다 기준연도·상태·출처가 있다. 확정은 표시하지 않고 보도·추정만 조용히 표시하며, 확인 못 한 칸은 "-"(사유는 마우스를 올리면 보인다).
// 공용: hsCompareSummary(data, opts)는 홈의 "고교 비교 요약"이 학교마다 핵심 지표 한 줄을 만들 때 쓴다.
import { stageTag } from "./stage.js";
import { WHERE, nextLink } from "./empty.js";
const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const SUMMARY_FIELDS = ["type", "founding", "coed", "students", "classes"];

// 값 하나를 화면 글자로(링크는 제외). 숫자는 단위를 붙이고 불리언은 예/아니요.
export function formatValue(f, v) {
  if (!v || v.value == null) return null;
  if (f.type === "boolean") return v.value ? "예" : "아니요";
  if (f.type === "number") return `${Number(v.value).toLocaleString("ko-KR")}${f.unit || ""}`;
  return String(v.value);
}

// 홈 요약용: [{ placeId, schoolId, name, line, parts:[{id,label,text}] }]. 값이 있는 핵심 지표만 이어 붙인다(최대 opts.max개).
export function hsCompareSummary(data, { fields = SUMMARY_FIELDS, max = 4 } = {}) {
  if (!data || !data.schools || !data.schools.length) return [];
  const byId = new Map(data.fields.map((f) => [f.id, f]));
  // 요약 한 줄에서는 문자열 값의 괄호 설명(설립일 등)을 뺀다
  return data.schools.map((s) => {
    const parts = fields.map((id) => { const f = byId.get(id), raw = f && formatValue(f, s.values[id]), text = f && raw && f.type !== "number" ? raw.replace(/\s*\([^)]*\)/g, "").trim() : raw; return text ? { id, label: f.label, text: f.type === "number" ? `${f.label} ${text}` : text } : null; }).filter(Boolean).slice(0, max);
    return { placeId: s.placeId, schoolId: s.schoolId || null, name: s.name, line: parts.map((p) => p.text).join(" · "), parts };
  });
}

const KEY = "portal.hs.compare", MAX = 8, DEFAULT_N = 4;
const lsGet = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return Array.isArray(v) ? v : null; } catch { return null; } };
const lsSet = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
const urlGet = () => { const c = new URLSearchParams(location.hash.split("?")[1] || "").get("c"); return c ? c.split(",").filter(Boolean) : null; };
const urlSet = (ids) => { try { const [path, q = ""] = location.hash.split("?"); const sp = new URLSearchParams(q); if (ids.length) sp.set("c", ids.join(",")); else sp.delete("c"); history.replaceState(null, "", `${path}${sp.toString() ? "?" + sp.toString().replace(/%2C/g, ",") : ""}`); } catch {} };
const km = (a, b) => { const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

export async function hsCompareBody(el, { load, esc, schoolHref = (s) => (s.schoolId ? `#select/curriculum?s=${encodeURIComponent(s.schoolId)}` : `#select/curriculum?v=map&p=${encodeURIComponent(s.placeId)}`) }) {
  const [d, pl] = await Promise.all([load("hs-compare"), load("places").catch(() => ({ places: [] }))]);
  if (!d.schools.length) { el.innerHTML = `<div class="ed"><h2>${stageTag("고입", esc)}학교 비교</h2><p class="muted">아직 정리 중이에요.</p></div>`; return; }
  const byPid = new Map(d.schools.map((s) => [s.placeId, s]));
  // 기본 선택: 성복초에서 가까운 순 4곳(좌표가 없으면 목록 순서)
  const place = new Map(pl.places.map((p) => [p.id, p]));
  const origin = pl.places.find((p) => p.level === "elementary" && p.lat != null);
  const nearest = [...d.schools].sort((a, b) => { const pa = place.get(a.placeId), pb = place.get(b.placeId); const da = origin && pa?.lat != null ? km(origin, pa) : 1e9, db = origin && pb?.lat != null ? km(origin, pb) : 1e9; return da - db; }).map((s) => s.placeId);
  const valid = (a) => (a || []).filter((id) => byPid.has(id)).slice(0, MAX);
  const st = (el.__hsc ||= { sel: valid(urlGet()).length ? valid(urlGet()) : valid(lsGet()).length ? valid(lsGet()) : nearest.slice(0, DEFAULT_N), addOpen: false, diff: false, open: new Set([d.fields[0]?.group]), q: "", type: "" });
  const groups = [...new Set(d.fields.map((f) => f.group))];
  const typeOf = (s) => (formatValue(d.fields.find((f) => f.id === "type") || {}, s.values.type) || "").replace(/\s*\([^)]*\)/g, "");
  const types = [...new Set(d.schools.map(typeOf).filter(Boolean))];
  const save = () => { lsSet(st.sel); urlSet(st.sel); };

  const cell = (f, v) => {
    if (!v || v.value == null) return `<td class="hsc-null" title="${esc(v?.nullReason || "확인하지 못했어요")}"><span class="muted">-</span></td>`;
    const tag = ES[v.status] ? ` <span class="es ${ES[v.status][0]}">${ES[v.status][1]}</span>` : "";
    const body = f.type === "link" ? `<a href="${esc(v.value)}" target="_blank" rel="noopener">열기</a>` : `<span class="hsc-t">${esc(formatValue(f, v))}</span>`;
    return `<td>${body}${tag}</td>`;
  };
  const draw = () => {
    const S = st.sel.map((id) => byPid.get(id)).filter(Boolean);
    const rowSame = (f) => { const vs = S.map((s) => formatValue(f, s.values[f.id]) ?? "∅"); return vs.every((x) => x === vs[0]); };
    const gBody = groups.map((g) => {
      const fs = d.fields.filter((f) => f.group === g);
      const open = st.open.has(g);
      const rows = fs.map((f) => { const same = S.length > 1 && rowSame(f); if (st.diff && same) return ""; return `<tr class="hsc-r${same ? " same" : S.length > 1 ? " diff" : ""}"${open ? "" : " hidden"} data-g="${esc(g)}"><th scope="row" class="hsc-f">${esc(f.label)}${f.unit && f.type !== "number" ? ` <span class="muted small">${esc(f.unit)}</span>` : ""}</th>${S.map((s) => cell(f, s.values[f.id])).join("")}</tr>`; }).join("");
      return rows ? `<tr class="hsc-gh"><th colspan="${S.length + 1}"><button type="button" class="hsc-gb" data-gt="${esc(g)}" aria-expanded="${open}">${open ? "▾" : "▸"} ${esc(g)}</button></th></tr>${rows}` : "";
    }).join("");
    const addList = d.schools.filter((s) => !st.sel.includes(s.placeId) && (!st.type || typeOf(s) === st.type) && (!st.q || (s.name + (s.values.address?.value || "")).includes(st.q)));
    el.innerHTML = `<div class="ed hsc-wrap"><h2>${stageTag("고입", esc)}학교 비교 <span class="muted small">${S.length}개교</span></h2>
      <div class="hsc-bar"><span class="flabel">비교 학교</span><div class="hsc-chips">${S.map((s) => `<span class="hsc-chip"><a href="${esc(schoolHref(s))}">${esc(s.name)}</a><button type="button" class="hsc-x" data-rm="${esc(s.placeId)}" aria-label="${esc(s.name)} 빼기">×</button></span>`).join("")}</div></div>
      <div class="hsc-bar"><details class="hsc-add"${st.addOpen ? " open" : ""}><summary>학교 추가·빼기 <span class="muted small">(최대 ${MAX}개교)</span></summary>
        <div class="hsc-f2"><input type="search" placeholder="학교 이름·주소 검색" value="${esc(st.q)}" data-q aria-label="학교 검색"><select data-type aria-label="학교 유형"><option value="">모든 유형</option>${types.map((t) => `<option${t === st.type ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
        <ul class="hsc-pick">${addList.map((s) => `<li><button type="button" data-add="${esc(s.placeId)}"${st.sel.length >= MAX ? " disabled" : ""}>＋ ${esc(s.name)}<span class="muted small"> ${esc(typeOf(s))}</span></button></li>`).join("") || '<li class="muted small">조건에 맞는 학교가 없어요.</li>'}</ul></details>
        <label class="hsc-diff"><input type="checkbox" data-diff${st.diff ? " checked" : ""}> 차이만 보기</label></div>
      ${S.length ? `<div class="w-table hsc"><table class="ed-tbl hsc-tbl" style="--n:${S.length}"><colgroup><col style="width:80px">${S.map(() => "<col>").join("")}</colgroup><thead><tr><th class="hsc-f hsc-corner">항목</th>${S.map((s) => `<th scope="col" class="hsc-s"><a href="${esc(schoolHref(s))}">${esc(s.name)}</a></th>`).join("")}</tr></thead><tbody>${gBody}</tbody></table></div>` : '<p class="muted">비교할 학교를 골라 주세요.</p>'}
      <p class="muted small">학교 이름을 누르면 그 학교의 과목표·설명회 노트·지도로 가요. 같은 값은 흐리게, 다른 값은 진하게 보여요. "-"는 아직 확인하지 못한 칸이에요.${nextLink(WHERE.schoolinfo, esc)}</p>${srcFooter(S.flatMap((sc) => Object.values(sc.values).map((v) => v?.source).filter(Boolean)), "이 표의 출처")}</div>`;
  };
  el.onclick = (e) => {
    const rm = e.target.closest("[data-rm]"), add = e.target.closest("[data-add]"), gt = e.target.closest("[data-gt]");
    if (rm) { st.sel = st.sel.filter((id) => id !== rm.dataset.rm); save(); draw(); }
    else if (add && st.sel.length < MAX) { st.sel = [...st.sel, add.dataset.add]; save(); draw(); }
    else if (gt) { const g = gt.dataset.gt; st.open.has(g) ? st.open.delete(g) : st.open.add(g); draw(); }
    else { const t = e.target.closest(".hsc-t"); if (t) t.classList.toggle("open"); }
  };
  el.addEventListener("toggle", (e) => { if (e.target.matches(".hsc-add")) st.addOpen = e.target.open; }, true);
  el.onchange = (e) => {
    if (e.target.matches("[data-diff]")) { st.diff = e.target.checked; draw(); }
    else if (e.target.matches("[data-type]")) { st.type = e.target.value; draw(); }
  };
  el.oninput = (e) => { if (e.target.matches("[data-q]")) { st.q = e.target.value; const pos = e.target.selectionStart; draw(); const q = el.querySelector("[data-q]"); q.focus(); q.setSelectionRange(pos, pos); } };
  draw();
}
