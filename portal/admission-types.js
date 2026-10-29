// 대입 제도 > "전형 한눈에": 교과·학종·논술·정시·수능 최저 설명, 한눈에 표, 전형별 비중.
// 데이터: admission-types.json(tools/build-admission-types.mjs, 용어 설명)과 policy.json의 비중 행(related.policyRows).
// 확정은 표시하지 않고 보도·추정만 조용히 표시하며, 비중은 출처 종류(공식/매체)를 구분한다.
import { stageTag } from "./stage.js";
const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const KIND = { official: "공식", media: "매체", opinion: "의견" };
const tag = (s) => (ES[s] ? `<span class="es ${ES[s][0]}">${ES[s][1]}</span>` : "");

export async function typesBody(el, { load, esc }) {
  const [d, policy] = await Promise.all([load("admission-types"), load("policy")]);
  if (!d.terms.length) { el.innerHTML = `<div class="ed"><h2>${stageTag("대입", esc)}전형 한눈에</h2><p class="muted">아직 정리 중이에요.</p></div>`; return; }
  const term = (t) => `<article class="ed-row"><h3>${esc(t.name)}</h3><p class="ed-b">${esc(t.what)}</p>${t.caveat ? `<p class="muted small">${esc(t.caveat)}</p>` : ""}${t.favors ? `<p class="ed-s">유리한 학생: ${esc(t.favors)}</p>` : ""}</article>`;
  const seasons = d.seasons.map((s) => `<h3>${esc(s.name)} <span class="muted small">${esc(s.when)}</span></h3><div class="ed-rows">${d.terms.filter((t) => t.season === s.id).map(term).join("")}</div>`).join("");
  const ov = d.overview.rows.length ? `<h3>한눈에 보기</h3><div class="w-table"><table class="ed-tbl"><thead><tr>${d.overview.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${d.overview.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "";
  const rows = (d.related.policyRows || []).map((id) => policy.find((r) => r.id === id)).filter(Boolean);
  const src = (r) => { const list = r.sources || (r.sourceName ? [{ name: r.sourceName, url: r.sourceUrl }] : []); return `${KIND[r.sourceKind] ? `<span>${KIND[r.sourceKind]}</span> · ` : ""}${list.map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(" · ")}`; };
  const shares = rows.length ? `<h3>전형별 비중</h3><div class="ed-rows">${rows.map((r) => `<article class="ed-row"><div class="ed-st">${tag(r.status)}</div><h3>${esc(r.title)}</h3><p class="ed-b">${esc(r.body)}</p><p class="ed-s">출처 ${src(r)}</p></article>`).join("")}</div>${d.related.note ? `<p class="muted small">${esc(d.related.note)}</p>` : ""}` : "";
  // 와이드: 본문(전형 설명) + 오른쪽 보조(한눈에 표·비중). 좁은 화면에서는 1단으로 쌓인다.
  el.innerHTML = `<div class="ed"><h2>${stageTag("대입", esc)}전형 한눈에</h2><div class="w-page w-2r"><div class="w-body">${seasons}</div><aside class="w-aside"><div class="piece r2">${ov}</div><div class="piece r3">${shares}</div></aside></div></div>`;
}
