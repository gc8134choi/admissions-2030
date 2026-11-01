// 고등학교 > 입학: 고교 유형 비교, 경기 고입 달력, 원서 절차, 준비 서류 — 접이식 섹션 4개(메뉴·탭을 늘리지 않는다).
// 데이터: hs-types.json(tools/build-hs-types.mjs). 확정은 표시하지 않고 보도·추정만 조용히 표시한다.
import { stageTag } from "./stage.js";
import { fmtWhen } from "./when.js";
import { srcWrap } from "./src-ref.js";
const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const tag = (s) => (ES[s] ? `<span class="es ${ES[s][0]}">${ES[s][1]}</span>` : "");
const srcLink = (s, esc) => (s && s.name ? (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>` : esc(s.name)) : "");
const src = (s, esc) => srcWrap(srcLink(s, esc)); // 출처는 항목 끝 "출처" 버튼 뒤로

export async function hsTypesBody(el, { load, esc }) {
  const d = await load("hs-types");
  if (!d.types.length && !d.calendar.length) { el.innerHTML = `<div class="ed"><p class="muted">아직 정리 중이에요.</p></div>`; return; }
  const ATTR = [["selection", "선발 방식"], ["timing", "시기"], ["cost", "비용"], ["curriculum", "교육과정"], ["admissionTraits", "입시 특징"]];
  const cell = (c) => (c.value == null ? `<span class="muted" title="${esc(c.nullReason || "공식 문서로 확인 중이에요")}">확인 중</span>` : `${esc(c.value)} ${tag(c.status)}<span class="ed-s0">${src(c.source, esc)}</span>`);
  const types = [...d.types].sort((a, b) => a.order - b.order).map((t, i) => `<details class="hst-t"${i === 0 ? " open" : ""}><summary><b>${esc(t.name)}</b></summary>
    <dl class="hst-dl">${ATTR.map(([k, l]) => `<dt>${l}</dt><dd>${cell(t[k])}</dd>`).join("")}</dl>
    ${t.pros.length || t.cons.length ? `<div class="hst-pc"><div><h5>좋은 점</h5><ul>${t.pros.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div><div><h5>살펴볼 점</h5><ul>${t.cons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>` : ""}
    ${t.proConNote ? `<p class="muted small">${esc(t.proConNote)}</p>` : ""}</details>`).join("");
  const cal = [...d.calendar].sort((a, b) => a.when.localeCompare(b.when)).map((c) => `<li><span class="hst-d">${esc(fmtWhen(c.when))}</span><div>${esc(c.what)} ${tag(c.status)}${c.who ? `<div class="muted small">${esc(c.who)}</div>` : ""}<span class="ed-s0">${src(c.source, esc)}</span></div></li>`).join("");
  const proc = d.procedure.map((p) => `<li><b>${esc(p.title)}</b><div>${esc(p.text)}</div><span class="ed-s0">${src(p.source, esc)}</span></li>`).join("");
  const docs = d.documents.map((x) => `<li><b>${esc(x.item)}</b>${x.when ? ` <span class="muted small">${esc(x.when)}</span>` : ""}${x.note ? `<div class="muted small">${esc(x.note)}</div>` : ""}<span class="ed-s0">${src(x.source, esc)}</span></li>`).join("");
  const sec = (title, n, body, open) => (n ? `<details class="hst"${open ? " open" : ""}><summary>${stageTag("고입", esc)}${esc(title)} <span class="muted small">${n}</span></summary>${body}</details>` : "");
  el.innerHTML = `<div class="ed hst-wrap">
    ${sec("일반고 vs 특목·자사고 비교", `${d.types.length}종`, types, true)}
    ${sec("경기 고입 달력", `${d.calendar.length}건`, `<ul class="hst-cal">${cal}</ul><p class="muted small">날짜는 공식 공고 기준이에요. 학교·교육청 공지로 다시 확인해 주세요.</p>`)}
    ${sec("원서 절차", `${d.procedure.length}단계`, `<ol class="hst-proc">${proc}</ol>`)}
    ${sec("준비 서류", `${d.documents.length}개`, `<ul class="hst-doc">${docs}</ul>`)}</div>`;
}
