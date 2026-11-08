// 대입 제도 > "전형 한눈에": 교과·학종·논술·정시·수능 최저 설명, 한눈에 표, 전형별 비중.
// 데이터: admission-types.json(tools/build-admission-types.mjs, 용어 설명)과 policy.json의 비중 행(related.policyRows).
// 확정은 표시하지 않고 보도·추정만 조용히 표시하며, 비중은 출처 종류(공식/매체)를 구분한다.
import { stageTag } from "./stage.js";
import { cmpTable } from "./compare-table.js";
const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const KIND = { official: "공식", media: "매체", opinion: "의견" };
const tag = (s) => (ES[s] ? `<span class="es ${ES[s][0]}">${ES[s][1]}</span>` : "");

export async function typesBody(el, { load, esc }) {
  const [d, policy] = await Promise.all([load("admission-types"), load("policy")]);
  if (!d.terms.length) { el.innerHTML = `<div class="ed"><h2>${stageTag("대입", esc)}전형 한눈에</h2><p class="muted">아직 정리 중이에요.</p></div>`; return; }
  // 전형 한눈에: 공용 비교 표(대상=전형 열, 항목=행). 시기·무엇을 보나·유리한 학생·주의할 점을 견준다.
  const whenOf = new Map(d.seasons.map((x) => [x.id, `${x.name} · ${x.when}`]));
  const tRows = [
    { id: "when", label: "시기", group: "기본", kind: "text", get: (t) => ({ text: whenOf.get(d.terms.find((x) => x.id === t.id).season) || "" }) },
    { id: "what", label: "무엇을 보나", group: "기본", kind: "text", get: (t) => ({ text: d.terms.find((x) => x.id === t.id).what }) },
    { id: "favors", label: "유리한 학생", group: "기본", kind: "text", get: (t) => { const v = d.terms.find((x) => x.id === t.id).favors; return v ? { text: v } : { empty: true }; } },
    { id: "caveat", label: "살펴볼 점", group: "살펴볼 점", kind: "text", get: (t) => { const v = d.terms.find((x) => x.id === t.id).caveat; return v ? { text: v } : { empty: true }; } },
  ];
  const ov = `<div id="adt-cmp"></div>`;
  const rows = (d.related.policyRows || []).map((id) => policy.find((r) => r.id === id)).filter(Boolean);
  const src = (r) => { const list = r.sources || (r.sourceName ? [{ name: r.sourceName, url: r.sourceUrl }] : []); return `${KIND[r.sourceKind] ? `<span>${KIND[r.sourceKind]}</span> · ` : ""}${list.map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(" · ")}`; };
  const shares = rows.length ? `<h3>전형별 비중</h3><div class="ed-rows">${rows.map((r) => `<article class="ed-row"><div class="ed-st">${tag(r.status)}</div><h3>${esc(r.title)}</h3><p class="ed-b">${esc(r.body)}</p><p class="ed-s">출처 ${src(r)}</p></article>`).join("")}</div>${d.related.note ? `<p class="muted small">${esc(d.related.note)}</p>` : ""}` : "";
  // 와이드: 본문(전형 설명) + 오른쪽 보조(한눈에 표·비중). 좁은 화면에서는 1단으로 쌓인다.
  // 전형별 비중 3행은 같은 화면 아래 "대입 전형 구조"에 모두 있어 여기서는 따로 되풀이하지 않는다
  el.innerHTML = `<div class="ed">${ov}${d.related.note ? `<p class="muted small">${esc(d.related.note)}</p>` : ""}</div>`;
  const host = el.querySelector("#adt-cmp");
  if (host) cmpTable(host, { esc, title: "전형 한눈에", summary: "전형을 가로로 놓고 견줘요",
    targets: d.terms.map((t) => ({ id: t.id, name: t.name.replace(/\(.*\)/, ""), sub: d.seasons.find((x) => x.id === t.season)?.name || "", href: "#admission/system?t=types", search: t.name })),
    rows: tRows, select: { key: "portal.adm.types", param: "ty", def: d.terms.map((t) => t.id), defN: 5, max: 6, min: 2 }, diff: false,
    sources: [{ name: d.__meta?.source?.name || "사용자 제공 정리", url: null }] });
}
