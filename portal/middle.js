// "중학교 배정" 보기("학교" 탭 안): 출신 초등학교 통학구역 중학교 목록, 배정 원칙, 배정 일정 흐름.
// 데이터: middle.json(tools/build-middle.mjs), places.json, policy.json의 life-* 행(stage 중입). 확정은 표시하지 않고 보도·추정만 조용히 표시한다.
import { placeInfo } from "./map.js";
const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const tag = (s, esc) => (ES[s] ? `<span class="es ${ES[s][0]}">${ES[s][1]}</span>` : "");
const srcs = (a, esc) => (a || []).map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(" · ");

export async function middleBody(el, { load, esc, mapHref = (id) => `#select/curriculum?v=map&p=${encodeURIComponent(id)}` }) {
  const [mid, pl, policy] = await Promise.all([load("middle"), load("places"), load("policy")]);
  const place = new Map(pl.places.map((p) => [p.id, p]));
  const flow = policy.filter((r) => r.topic === "life-schedule" && r.stage === "중입");
  if (!mid.from || !mid.zoneSchools.length) { el.innerHTML = `<div class="ed"><h2>중학교 배정</h2><p class="muted">아직 정리 중이에요.</p></div>`; return; }
  const near = mid.principles.find((p) => /근거리/.test(p.title));
  const from = place.get(mid.from.placeId);
  const zone = mid.zoneSchools.map((z) => {
    const p = place.get(z.placeId);
    if (!p) return "";
    return `<li class="pl-z"><div>${placeInfo(p, esc)}${z.note ? `<div class="muted small">${esc(z.note)}</div>` : ""}${tag(z.status, esc) && p.status === z.status ? "" : tag(z.status, esc)}</div>
      <div class="pl-zb">${p.lat != null ? `<a class="pl-map-btn" href="${esc(mapHref(p.id))}">지도</a>` : ""}</div><div class="ed-s">출처 ${srcs(z.sources, esc)}</div></li>`;
  }).join("");
  const flowRows = flow.map((r) => `<li><b>${esc(r.title)}</b> <span class="muted">${esc(r.body)}</span> ${tag(r.status, esc)}</li>`).join("");
  el.innerHTML = `<div class="ed"><h2>중학교 배정</h2>
    <p class="ed-b">${from ? `<b>${esc(from.name)}</b> 통학구역에서 갈 수 있는 중학교예요.` : "통학구역에서 갈 수 있는 중학교예요."}${mid.from.note ? ` ${esc(mid.from.note)}` : ""}</p>
    <ul class="pl-zone">${zone}</ul>
    ${near ? `<p class="muted small">근거리 중학교 명단은 아직 공식 자료로 확인하지 못했어요. 학교 공지로 확인해 주세요.${near.sources?.length ? ` 출처 ${srcs(near.sources, esc)}` : ""}</p>` : ""}
    ${mid.principles.length ? `<h3>배정 원칙</h3><div class="ed-rows">${mid.principles.map((p) => `<article class="ed-row"><div class="ed-st">${tag(p.status, esc)}</div><h3>${esc(p.title)}</h3><p class="ed-b">${esc(p.body)}</p><p class="ed-s">출처 ${srcs(p.sources, esc)}</p></article>`).join("")}</div>` : ""}
    ${flowRows ? `<h3>배정 일정 흐름</h3><ol class="pl-flow">${flowRows}</ol><p class="muted small">날짜는 일정 화면과 같아요. 학교·교육지원청 공지로 다시 확인해 주세요.</p>` : ""}</div>`;
}
