// 학교 설명회 노트: 학교 상세에 붙이는 접이식 블록. 데이터: briefings.json(tools/build-briefings.mjs).
//   import { briefingBlock } from "./briefing.js";
//   html += briefingBlock(await load("briefings"), schoolId, esc);   // 노트가 없으면 빈 문자열
// 신뢰도는 배지 없이 조용한 글자(일관/추정/참고만)로 항목 끝에 붙인다. 학교 공식 문서가 아니라 녹음을 AI가 요약한 내용이다.
import { stageTag } from "./stage.js";
const CONF = { consistent: "일관", inferred: "추정", reference: "참고만" };
const dot = (d) => d.replace(/-/g, ".");

export function briefingBlock(data, schoolId, esc) {
  const list = ((data && data.briefings) || []).filter((b) => b.schoolId === schoolId);
  if (!list.length) return "";
  const li = (it) => `<li>${esc(it.text)} <span class="bf-c">${CONF[it.confidence] || ""}</span>${(it.children || []).length ? `<ul>${it.children.map(li).join("")}</ul>` : ""}</li>`;
  return list.map((b) => `<details class="bf"><summary>${stageTag("고입", esc)}설명회 노트(${esc(dot(b.heldAt))})</summary>
    <p class="muted small">설명회 녹음을 AI가 요약한 내용이에요. 숫자는 틀렸을 수 있어요.</p>
    ${(b.readingNotes || []).length ? `<ul class="bf-notes muted small">${b.readingNotes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
    ${b.sections.map((s) => `<section class="bf-s">${s.part ? `<p class="bf-part muted small">${esc(s.part)}</p>` : ""}<h4>${esc(s.title)}</h4><ul>${s.items.map(li).join("")}</ul></section>`).join("")}
    <p class="ed-s">출처 ${b.source.url ? `<a href="${esc(b.source.url)}" target="_blank" rel="noopener">${esc(b.source.name)}</a>` : esc(b.source.name)}</p></details>`).join("");
}
