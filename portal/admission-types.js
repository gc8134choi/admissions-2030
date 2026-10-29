// 대입 제도 > "전형 한눈에": 교과·학종·논술·정시·수능 최저 설명, 한눈에 표, 전형별 비중.
// 데이터: admission-types.json(tools/build-admission-types.mjs). 확정은 표시하지 않고 보도·추정만 조용히 표시하며, 비중은 출처 종류(공식/매체)와 계산값을 구분한다.
import { stageTag } from "./stage.js";
const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const SEASON = { susi: "수시", jeongsi: "정시", both: "수시·정시" };
const KIND = { official: "공식", media: "매체" };
const tag = (s) => (ES[s] ? `<span class="es ${ES[s][0]}">${ES[s][1]}</span>` : "");

export async function typesBody(el, { load, esc }) {
  const d = await load("admission-types");
  if (!d.types.length) { el.innerHTML = `<div class="ed"><h2>${stageTag("대입", esc)}전형 한눈에</h2><p class="muted">아직 정리 중이에요.</p></div>`; return; }
  const nameOf = new Map(d.types.map((t) => [t.id, t.name]));
  const types = d.types.map((t) => `<article class="ed-row"><div class="ed-st">${SEASON[t.season] || ""}</div><h3>${esc(t.name)}</h3>${t.period ? `<p class="ed-s">${esc(t.period)}</p>` : ""}<p class="ed-b">${esc(t.summary)}</p>${(t.points || []).length ? `<ul class="ed-ul">${t.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}</article>`).join("");
  const glance = d.glance.length ? `<h3>한눈에 보기</h3><div class="tw"><table class="ed-tbl"><thead><tr><th>전형</th><th>주로 보는 것</th><th>유리한 학생</th></tr></thead><tbody>${d.glance.map((g) => `<tr><td>${esc(nameOf.get(g.typeId) || g.typeId)}</td><td>${esc(g.focus)}</td><td>${esc(g.favors)}</td></tr>`).join("")}</tbody></table></div>` : "";
  const fmtNum = (r) => (r.headcount != null ? `${r.approx ? "약 " : ""}${r.headcount.toLocaleString("ko-KR")}명` : "");
  const shares = d.shares.map((s) => {
    const src = s.sources.map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(" · ");
    const rows = s.rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="num">${esc(fmtNum(r)) || '<span class="muted">-</span>'}</td><td class="num">${r.percent != null ? `${r.percent}%${r.percentKind === "derived" ? ' <span class="muted small">계산값</span>' : ""}` : '<span class="muted">-</span>'}</td></tr>`).join("");
    return `<section class="ed-share"><h4>${esc(s.label)} ${tag(s.status)}</h4><p class="ed-s">${KIND[s.sourceKind]} 자료 · ${src}</p>${s.note ? `<p class="muted small">${esc(s.note)}</p>` : ""}
      <div class="tw"><table class="ed-tbl"><thead><tr><th>전형</th><th>인원</th><th>비중</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }).join("");
  const notes = (d.notes || []).map((n) => `<p class="muted small">${esc(n.text)} ${tag(n.status)}</p>`).join("");
  el.innerHTML = `<div class="ed"><h2>${stageTag("대입", esc)}전형 한눈에</h2><div class="ed-rows">${types}</div>${glance}${shares ? `<h3>전형별 비중</h3>${shares}` : ""}${notes}</div>`;
}
