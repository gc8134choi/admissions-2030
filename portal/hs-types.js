// 고등학교 > 입학: 고교 유형 비교, 경기 고입 달력, 원서 절차, 준비 서류 — 접이식 섹션 4개(메뉴·탭을 늘리지 않는다).
// 데이터: hs-types.json(tools/build-hs-types.mjs). 확정은 표시하지 않고 보도·추정만 조용히 표시한다.
import { stageTag } from "./stage.js";
import { fmtWhen } from "./when.js";
import { srcWrap } from "./src-ref.js";
import { WHERE, emptyLine } from "./empty.js";
import { cmpTable } from "./compare-table.js";
const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const tag = (s) => (ES[s] ? `<span class="es ${ES[s][0]}">${ES[s][1]}</span>` : "");
const srcLink = (s, esc) => (s && s.name ? (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>` : esc(s.name)) : "");
const src = (s, esc) => srcWrap(srcLink(s, esc)); // 출처는 항목 끝 "출처" 버튼 뒤로

export async function hsTypesBody(el, { load, esc }) {
  const d = await load("hs-types");
  if (!d.types.length && !d.calendar.length) { el.innerHTML = `<div class="ed"><p class="muted">아직 정리 중이에요.</p></div>`; return; }
  // 일반고 vs 특목·자사고 비교: 공용 비교 표(대상=유형 열, 항목=행)
  const ATTR = [["selection", "선발 방식", "선발·시기"], ["timing", "시기", "선발·시기"], ["cost", "비용", "비용·교육과정"], ["curriculum", "교육과정", "비용·교육과정"], ["admissionTraits", "입시 특징", "입시 특징·장단점"]];
  const NEXT = { cost: WHERE.schoolinfo, curriculum: WHERE.schoolinfo };
  const tsorted = [...d.types].sort((a, b) => a.order - b.order);
  const list = (a) => (a.length ? `<ul class="cmp-ul">${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  const typeRows = [...ATTR.map(([k, label, group]) => ({ id: k, label, group, kind: "text", get: (t) => { const c = d.types.find((x) => x.id === t.id)[k]; return c.value == null ? { empty: true, why: c.nullReason } : { text: c.value, status: c.status }; } })),
    { id: "pros", label: "좋은 점", group: "입시 특징·장단점", kind: "text", get: (t) => { const x = d.types.find((y) => y.id === t.id); return x.pros.length ? { text: x.pros.join("|"), html: list(x.pros) } : { empty: true }; } },
    { id: "cons", label: "살펴볼 점", group: "입시 특징·장단점", kind: "text", get: (t) => { const x = d.types.find((y) => y.id === t.id); return x.cons.length ? { text: x.cons.join("|"), html: list(x.cons) } : { empty: true }; } }];
  const typesBox = `<div id="hst-cmp"></div>`;
  const cal = [...d.calendar].sort((a, b) => a.when.localeCompare(b.when)).map((c) => `<li><span class="hst-d">${esc(fmtWhen(c.when))}</span><div>${esc(c.what)} ${tag(c.status)}${c.who ? `<div class="muted small">${esc(c.who)}</div>` : ""}<span class="ed-s0">${src(c.source, esc)}</span></div></li>`).join("");
  const proc = d.procedure.map((p) => `<li><b>${esc(p.title)}</b><div>${esc(p.text)}</div><span class="ed-s0">${src(p.source, esc)}</span></li>`).join("");
  const docs = d.documents.map((x) => `<li><b>${esc(x.item)}</b>${x.when ? ` <span class="muted small">${esc(x.when)}</span>` : ""}${x.note ? `<div class="muted small">${esc(x.note)}</div>` : ""}<span class="ed-s0">${src(x.source, esc)}</span></li>`).join("");
  const sec = (title, n, body, open) => (n ? `<details class="hst"${open ? " open" : ""}><summary>${stageTag("고입", esc)}${esc(title)} <span class="muted small">${n}</span></summary>${body}</details>` : "");
  el.innerHTML = `<div class="ed hst-wrap">
    ${sec("일반고 vs 특목·자사고 비교", `${d.types.length}종`, typesBox, true)}
    ${sec("경기 고입 달력", `${d.calendar.length}건`, `<ul class="hst-cal">${cal}</ul><p class="muted small">날짜는 공식 공고 기준이에요. 학교·교육청 공지로 다시 확인해 주세요.</p>`)}
    ${sec("원서 절차", `${d.procedure.length}단계`, `<ol class="hst-proc">${proc}</ol>${emptyLine(esc, { why: "우리 집 주소로 배정 구역을 바로 알려 주는 기능은 아직 없어요.", next: WHERE.goePortal })}`)}
    ${sec("준비 서류", `${d.documents.length}개`, `<ul class="hst-doc">${docs}</ul>`)}</div>`;
  const host = el.querySelector("#hst-cmp");
  if (host) cmpTable(host, { esc, title: "고교 유형 비교", summary: "유형을 가로로 놓고 선발·비용·교육과정을 견줘요",
    targets: tsorted.map((t) => ({ id: t.id, name: t.name, sub: "", href: "#select/curriculum?v=hs", search: t.name })),
    rows: typeRows, select: { key: "portal.hs.types", param: "t", def: tsorted.map((t) => t.id), defN: 5, max: 6, min: 2, always: false, addLabel: "유형 추가·빼기" },
    emptyNext: WHERE.goePortal, sources: tsorted.flatMap((t) => ATTR.map(([k]) => t[k].source).filter(Boolean)) });
}
