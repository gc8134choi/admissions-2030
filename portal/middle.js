// "중학교 배정" 보기("학교" 탭 안): 출신 초등학교 통학구역 중학교 목록, 배정 원칙, 배정 일정 흐름.
// 데이터: middle.json(tools/build-middle.mjs), middle-curriculum.json(교과서 출판사), places.json, files.json(원본 이미지), policy.json의 life-* 행(stage 중입). 확정은 표시하지 않고 보도·추정만 조용히 표시한다.
import { placeInfo } from "./map.js";
import { stageOf, stageTag } from "./stage.js";
const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const tag = (s, esc) => (ES[s] ? `<span class="es ${ES[s][0]}">${ES[s][1]}</span>` : "");
const srcs = (a, esc) => (a || []).map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(" · ");

export async function middleBody(el, { load, esc, mapHref = (id) => `#select/curriculum?v=map&p=${encodeURIComponent(id)}` }) {
  const [mid, pl, policy, cur, files] = await Promise.all([load("middle"), load("places"), load("policy"), load("middle-curriculum"), load("files")]);
  const curBy = new Map(cur.schools.map((c) => [c.placeId, c]));
  const fileId = (f) => (Array.isArray(files) ? files : files.files || []).find((x) => x.file === f)?.id;
  // 학교 상세: 교과서·교과 구성(접이식). 자료가 없으면 학교 공지로 안내한다.
  const textbook = (p) => {
    const c = curBy.get(p.id);
    if (!c) {
      const hp = /^https?:\/\//.test(p.homepage || "") ? p.homepage : `https://search.naver.com/search.naver?query=${encodeURIComponent(p.name + " 홈페이지")}`;
      return `<p class="muted small">공개 자료를 아직 못 찾았어요 · 학교 공지에서 확인 <a href="${esc(hp)}" target="_blank" rel="noopener">${p.homepage ? "학교 홈페이지" : "홈페이지 찾기"}</a></p>`;
    }
    const g = (v) => (v ? esc(v) : '<span class="muted">-</span>');
    const img = (c.sources || []).map((x) => (x.file && fileId(x.file) ? `<a href="#library/files?open=${encodeURIComponent(fileId(x.file))}">원본 이미지 보기</a>` : "")).filter(Boolean)[0] || "";
    const rows = c.subjects.map((j) => `<tr><td>${esc(j.subject)}</td><td>${g(j.publishers[1])}</td><td>${g(j.publishers[2])}</td><td>${g(j.publishers[3])}</td>${j.note ? `<td class="muted small">${esc(j.note)}</td>` : "<td></td>"}</tr>`).join("");
    return `<details class="pl-tb"><summary>${stageTag("중입", esc)} 교과서·교과 구성 ${tag(c.status, esc)}</summary>
      <p class="muted small">학교 공지 기준(공식 문서로 확인 중이에요) · ${esc(c.schoolYear)}학년도</p>
      <div class="pl-tbw"><table class="ed-tbl"><thead><tr><th>교과</th><th>1학년</th><th>2학년</th><th>3학년</th><th>비고</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="muted small">1학년 때 배부하고 2·3학년까지 사용해요.${c.footnote ? ` ${esc(c.footnote)}` : ""}</p>
      <p class="ed-s">출처 ${srcs(c.sources, esc)} ${img}</p></details>`;
  };
  const zoneNotice = policy.find((r) => /중학구/.test(r.title + r.body) && /의견 ?수렴/.test(r.title + r.body));
  const place = new Map(pl.places.map((p) => [p.id, p]));
  const flow = policy.filter((r) => r.topic === "life-schedule" && r.stage === "중입");
  if (!mid.from || !mid.zoneSchools.length) { el.innerHTML = `<div class="ed"><h2>중학교 배정</h2><p class="muted">아직 정리 중이에요.</p></div>`; return; }
  const near = mid.principles.find((p) => /근거리/.test(p.title));
  const from = place.get(mid.from.placeId);
  const zone = mid.zoneSchools.map((z) => {
    const p = place.get(z.placeId);
    if (!p) return "";
    return `<li class="pl-z"><div>${placeInfo(p, esc)}${z.note ? `<div class="muted small">${esc(z.note)}</div>` : ""}${textbook(p)}${tag(z.status, esc) && p.status === z.status ? "" : tag(z.status, esc)}</div>
      <div class="pl-zb">${p.lat != null ? `<a class="pl-map-btn" href="${esc(mapHref(p.id))}">지도</a>` : ""}</div><div class="ed-s">출처 ${srcs(z.sources, esc)}</div></li>`;
  }).join("");
  const flowRows = flow.map((r) => `<li>${stageTag(stageOf(r), esc)} <b>${esc(r.title)}</b> <span class="muted">${esc(r.body)}</span> ${tag(r.status, esc)}</li>`).join("");
  // 한 흐름: ① 배정 원칙(절차) → ② 일정 → ③ 갈 수 있는 학교 → ④ 지도. 아직 정해지지 않은 것은 맨 위에 "미정"으로 모아 보인다.
  const unsettled = [zoneNotice ? "학교군·중학구(용인교육지원청 의견 수렴 중)" : "", near ? "근거리 중학교 명단(공식 자료 확인 전)" : ""].filter(Boolean);
  const anyMap = mid.zoneSchools.some((z) => place.get(z.placeId)?.lat != null);
  el.innerHTML = `<div class="ed mid-flow"><h2>${stageTag("중입", esc)}중학교 배정</h2>
    <p class="ed-b">${from ? `<b>${esc(from.name)}</b> 통학구역에서 갈 수 있는 중학교예요.` : "통학구역에서 갈 수 있는 중학교예요."}${mid.from.note ? ` ${esc(mid.from.note)}` : ""}</p>
    ${unsettled.length ? `<p class="mid-un"><b>미정</b> ${unsettled.map(esc).join(" · ")} — 바뀔 수 있어요.${zoneNotice && zoneNotice.sourceUrl ? ` <a href="${esc(zoneNotice.sourceUrl)}" target="_blank" rel="noopener">${esc(zoneNotice.sourceName || "출처")}</a>` : ""}</p>` : ""}
    <div class="w-page w-2r">
      <div class="w-body">
        ${mid.principles.length ? `<section class="mid-step"><h3><em>1</em>배정 원칙(절차)</h3><div class="ed-rows">${mid.principles.map((p) => `<article class="ed-row"><div class="ed-st">${tag(p.status, esc)}</div><h3>${esc(p.title)}</h3><p class="ed-b">${esc(p.body)}</p><p class="ed-s">출처 ${srcs(p.sources, esc)}</p></article>`).join("")}</div></section>` : ""}
        ${flowRows ? `<section class="mid-step"><h3><em>2</em>배정 일정 흐름</h3><ol class="pl-flow">${flowRows}</ol><p class="muted small">날짜는 일정 화면과 같아요. 학교·교육지원청 공지로 다시 확인해 주세요.</p></section>` : ""}
      </div>
      <aside class="w-aside mid-step"><h3><em>3</em>갈 수 있는 학교</h3>${anyMap ? `<p class="mid-map"><em>4</em><a class="lnk" href="${esc(mapHref(mid.zoneSchools.map((z) => z.placeId).find((id) => place.get(id)?.lat != null)))}&lv=middle">지도에서 한꺼번에 보기</a></p>` : ""}
        <ul class="pl-zone">${zone}</ul>
        ${near ? `<p class="muted small">근거리 중학교 명단은 아직 공식 자료로 확인하지 못했어요. 학교 공지로 확인해 주세요.${near.sources?.length ? ` 출처 ${srcs(near.sources, esc)}` : ""}</p>` : ""}</aside>
    </div></div>`;
}
