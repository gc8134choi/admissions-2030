// 학교 설명회 노트: 학교 상세에 붙이는 접이식 블록. 데이터: briefings.json(tools/build-briefings.mjs).
//   import { briefingBlock } from "./briefing.js";
//   html += briefingBlock(await load("briefings"), schoolId, esc);   // 노트가 없으면 빈 문자열
// 신뢰도는 배지 없이 조용한 글자(일관/추정/참고만)로 항목 끝에 붙인다. 학교 공식 문서가 아니라 녹음을 AI가 요약한 내용이다.
import { stageTag } from "./stage.js";
const dot = (d) => d.replace(/-/g, ".");

export function briefingBlock(data, schoolId, esc) {
  const list = ((data && data.briefings) || []).filter((b) => b.schoolId === schoolId);
  if (!list.length) return "";
  const lv = (it) => (it.level ? `<span class="bf-c">${esc(it.level)}</span>` : "") + (it.verify ? '<span class="bf-c">숫자 확인 필요</span>' : "");
  // 같은 발표(topic) 안에서 group이 없는 항목이 뼈대, level이 없는 항목은 소제목이다(그 소제목을 group으로 가진 항목이 아래에 붙는다).
  const topic = (items) => {
    const kids = (t) => items.filter((x) => x.group === t);
    return `<ul>${items.filter((x) => !x.group).map((x) => (x.level == null && kids(x.text).length ? `<li class="bf-h"><b>${esc(x.text)}</b><ul>${kids(x.text).map((k) => `<li>${esc(k.text)} ${lv(k)}</li>`).join("")}</ul></li>` : x.level == null ? `<li class="bf-h"><b>${esc(x.text)}</b></li>` : `<li>${esc(x.text)} ${lv(x)}</li>`)).join("")}</ul>`;
  };
  const section = (s) => {
    const order = [];
    for (const it of s.items) { const k = `${it.part ?? ""}|${it.topic ?? ""}`; if (!order.includes(k)) order.push(k); }
    return `<section class="bf-s"><h4>${esc(s.name)}</h4>${order.map((k) => {
      const its = s.items.filter((it) => `${it.part ?? ""}|${it.topic ?? ""}` === k), f = its[0];
      return `${f.topic ? `<p class="bf-part muted small">${f.part ? `${esc(f.part)} · ` : ""}${esc(f.topic)}</p>` : ""}${topic(its)}`;
    }).join("")}</section>`;
  };
  return list.map((b) => `<details class="bf"><summary>${stageTag("고입", esc)}설명회 노트(${esc(dot(b.date))})</summary>
    <p class="muted small">설명회 녹음을 AI가 요약한 내용이에요. 숫자는 틀렸을 수 있어요.</p>
    ${b.qualityNote ? `<p class="muted small">${esc(b.qualityNote)}</p>` : ""}
    ${b.sections.map(section).join("")}
    <p class="ed-s">출처 ${b.source.url ? `<a href="${esc(b.source.url)}" target="_blank" rel="noopener">${esc(b.source.name)}</a>` : esc(b.source.name)}</p></details>`).join("");
}
