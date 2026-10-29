// 고등학교 > 입학 > "학교 비교": 학교별 행 × 항목 열의 와이드 표. 데이터: hs-compare.json(tools/build-hs-compare.mjs).
// 값마다 기준연도·상태·출처가 있다. 확정은 표시하지 않고 보도·추정만 조용히 표시하며, 확인 못 한 칸은 "-"(사유는 마우스를 올리면 보인다).
// 공용: hsCompareSummary(data, opts)는 홈의 "고교 비교 요약"이 학교마다 핵심 지표 한 줄을 만들 때 쓴다.
import { stageTag } from "./stage.js";
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

export async function hsCompareBody(el, { load, esc, schoolHref = (s) => (s.schoolId ? `#select/curriculum?s=${encodeURIComponent(s.schoolId)}` : `#select/curriculum?v=map&p=${encodeURIComponent(s.placeId)}`) }) {
  const d = await load("hs-compare");
  if (!d.schools.length) { el.innerHTML = `<div class="ed"><h2>${stageTag("고입", esc)}학교 비교</h2><p class="muted">아직 정리 중이에요.</p></div>`; return; }
  const groups = [...new Set(d.fields.map((f) => f.group))];
  const st = (el.__hsc ||= { group: "all" });
  const chip = (v, t) => `<button type="button" class="chip ${v === st.group ? "on" : ""}" data-g="${esc(v)}" aria-pressed="${v === st.group}">${esc(t)}</button>`;
  const cell = (f, v) => {
    if (!v || v.value == null) return `<td class="hsc-null" title="${esc(v?.nullReason || "확인하지 못했어요")}"><span class="muted">-</span></td>`;
    const tag = ES[v.status] ? ` <span class="es ${ES[v.status][0]}">${ES[v.status][1]}</span>` : "";
    const meta = [v.asOf != null ? `${v.asOf} 기준` : "", v.source?.name || ""].filter(Boolean).join(" · ");
    const body = f.type === "link" ? `<a href="${esc(v.value)}" target="_blank" rel="noopener">열기</a>` : esc(formatValue(f, v));
    return `<td><div>${body}${tag}</div>${meta ? `<div class="muted small hsc-meta">${v.source?.url ? `<a href="${esc(v.source.url)}" target="_blank" rel="noopener">${esc(meta)}</a>` : esc(meta)}</div>` : ""}</td>`;
  };
  const draw = () => {
    const fs = d.fields.filter((f) => st.group === "all" || f.group === st.group);
    el.innerHTML = `<div class="ed"><h2>${stageTag("고입", esc)}학교 비교</h2>
      <div class="chipbar"><span class="flabel">항목</span><div class="chips">${chip("all", "전체")}${groups.map((g) => chip(g, g)).join("")}</div></div>
      <div class="w-table hsc"><table class="ed-tbl"><thead><tr><th class="hsc-name">학교</th>${fs.map((f) => `<th>${esc(f.label)}${f.unit && f.type !== "number" ? ` <span class="muted small">${esc(f.unit)}</span>` : ""}</th>`).join("")}</tr></thead>
      <tbody>${d.schools.map((s) => `<tr><th class="hsc-name" scope="row"><a href="${esc(schoolHref(s))}">${esc(s.name)}</a></th>${fs.map((f) => cell(f, s.values[f.id])).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="muted small">학교 이름을 누르면 그 학교의 과목표·설명회 노트·지도로 가요. 기준연도와 출처는 칸 아래에 작게 적었어요.</p></div>`;
  };
  el.onclick = (e) => { const b = e.target.closest("button[data-g]"); if (!b) return; st.group = b.dataset.g; draw(); };
  draw();
}
