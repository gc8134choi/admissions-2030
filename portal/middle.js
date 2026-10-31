// "중학교 배정" 보기("학교" 탭 안): 초등학교를 고르면 통학구역 중학교 표, 배정 원칙(접이식), 배정 일정 흐름.
// 데이터가 있는 초등학교(middle.json areas[])만 고를 수 있고, 그 밖의 학교는 교육지원청 근거리표 링크로 안내한다. 같은 문장이 반복되는 항목은 한 번만 적어 길이를 줄였다.
// 데이터: middle.json(tools/build-middle.mjs), middle-curriculum.json(교과서 출판사), places.json, files.json(원본 이미지), policy.json의 life-* 행(stage 중입). 확정은 표시하지 않고 보도·추정만 조용히 표시한다.
import { placeInfo } from "./map.js";
import { stageOf, stageTag } from "./stage.js";
import { plain } from "./plain.js";
const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const tag = (s, esc) => (ES[s] ? `<span class="es ${ES[s][0]}">${ES[s][1]}</span>` : "");
const srcs = (a, esc) => (a || []).map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(" · ");

export async function middleBody(el, { load, esc, mapHref = (id) => `#select/curriculum?v=map&p=${encodeURIComponent(id)}` }) {
  const [mid, pl, policy, cur, files] = await Promise.all([load("middle"), load("places"), load("policy"), load("middle-curriculum"), load("files")]);
  const curBy = new Map(cur.schools.map((c) => [c.placeId, c]));
  const fileId = (f) => (Array.isArray(files) ? files : files.files || []).find((x) => x.file === f)?.id;
  const place = new Map(pl.places.map((p) => [p.id, p]));
  const areas = mid.areas && mid.areas.length ? mid.areas : mid.from ? [{ from: mid.from, zoneSchools: mid.zoneSchools }] : [];
  if (!areas.length || !areas[0].zoneSchools.length) { el.innerHTML = `<div class="ed"><h2>중학교 배정</h2><p class="muted">아직 정리 중이에요.</p></div>`; return; }
  const st = (el.__mid ||= { from: areas[0].from.placeId });
  if (!areas.some((a) => a.from.placeId === st.from)) st.from = areas[0].from.placeId;

  const zoneNotice = policy.find((r) => /중학구/.test(r.title + r.body) && /의견 ?수렴/.test(r.title + r.body));
  const flow = policy.filter((r) => r.topic === "life-schedule" && r.stage === "중입");
  const near = mid.principles.find((p) => /근거리/.test(p.title));
  const nearUrl = (near?.sources || []).find((x) => x.url)?.url || (mid.principles.flatMap((p) => p.sources || []).find((x) => x.url) || {}).url;

  // 교과서 표(자료가 있는 학교만): 표 아래 접이식
  const textbook = (p) => {
    const c = curBy.get(p.id); if (!c) return "";
    const g = (v) => (v ? esc(v) : '<span class="muted">-</span>');
    const img = (c.sources || []).map((x) => (x.file && fileId(x.file) ? `<a href="#library/files?open=${encodeURIComponent(fileId(x.file))}">원본 이미지 보기</a>` : "")).filter(Boolean)[0] || "";
    const rows = c.subjects.map((j) => `<tr><td>${esc(j.subject)}</td><td>${g(j.publishers[1])}</td><td>${g(j.publishers[2])}</td><td>${g(j.publishers[3])}</td>${j.note ? `<td class="muted small">${esc(j.note)}</td>` : "<td></td>"}</tr>`).join("");
    return `<details class="pl-tb"><summary>${esc(p.name)} 교과서·교과 구성 ${tag(c.status, esc)}</summary>
      <p class="muted small">학교 공지를 옮겨 적은 표예요 · 공식 문서로 확인 중이에요 · ${esc(c.schoolYear)}학년도</p>
      <div class="pl-tbw"><table class="ed-tbl"><thead><tr><th>교과</th><th>1학년</th><th>2학년</th><th>3학년</th><th>비고</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="muted small">1학년 때 배부하고 2·3학년까지 사용해요.${c.footnote ? ` ${esc(c.footnote)}` : ""}</p>
      <p class="ed-s">출처 ${srcs(c.sources, esc)} ${img}</p></details>`;
  };

  const draw = () => {
    const area = areas.find((a) => a.from.placeId === st.from);
    const from = place.get(area.from.placeId);
    const zs = area.zoneSchools.map((z) => ({ z, p: place.get(z.placeId) })).filter((x) => x.p);
    // 모든 학교에 같은 문장·같은 출처·같은 상태면 한 번만 적는다.
    const same = (f) => zs.length > 1 && zs.every((x) => JSON.stringify(f(x)) === JSON.stringify(f(zs[0])));
    const commonNote = same((x) => x.z.note ?? null) ? zs[0].z.note : null;
    const commonSrc = same((x) => x.z.sources) ? zs[0].z.sources : null;
    const commonSt = same((x) => x.z.status) ? zs[0].z.status : null;
    const hp = (p) => (/^https?:\/\//.test(p.homepage || "") ? `<a href="${esc(p.homepage)}" target="_blank" rel="noopener">홈페이지</a>` : `<a href="https://search.naver.com/search.naver?query=${encodeURIComponent(p.name + " 홈페이지")}" target="_blank" rel="noopener">홈페이지 찾기</a>`);
    const rows = zs.map(({ z, p }) => `<tr><th scope="row" class="mid-nm">${esc(p.name)}${commonSt ? "" : ` ${tag(z.status, esc)}`}${!commonNote && z.note ? `<div class="muted small">${esc(z.note)}</div>` : ""}</th>
      <td class="muted small">${esc(p.address)}${p.coordApprox ? " (위치 근사)" : ""}</td><td class="mid-lk">${p.lat != null ? `<a href="${esc(mapHref(p.id))}">지도</a>` : ""} ${hp(p)}${!commonSrc ? `<div class="ed-s">출처 ${srcs(z.sources, esc)}</div>` : ""}</td></tr>`).join("");
    const tbs = zs.map(({ p }) => textbook(p)).join("");
    const noTb = zs.filter(({ p }) => !curBy.has(p.id)).length;
    const unsettled = [zoneNotice ? "학교군·중학구(용인교육지원청 의견 수렴 중)" : "", near ? "근거리 중학교 명단(교육지원청 공지 첨부에서 확인)" : ""].filter(Boolean);
    const anyMap = zs.some(({ p }) => p.lat != null);
    const flowRows = flow.map((r) => `<li>${stageTag(stageOf(r), esc)} <b>${esc(plain(r.title))}</b> <span class="muted">${esc(plain(r.body))}</span> ${tag(r.status, esc)}</li>`).join("");
    el.innerHTML = `<div class="ed mid-flow"><h2>${stageTag("중입", esc)}중학교 배정</h2>
    <div class="mid-pick"><label class="flabel" for="mid-from">초등학교</label>
      <select id="mid-from" aria-label="초등학교 선택">${areas.map((a) => `<option value="${esc(a.from.placeId)}"${a.from.placeId === st.from ? " selected" : ""}>${esc(place.get(a.from.placeId)?.name || a.from.placeId)}</option>`).join("")}</select>
      ${nearUrl ? `<a class="mid-btn" href="${esc(nearUrl)}" target="_blank" rel="noopener">다른 초등학교는 교육지원청 근거리표에서 확인</a>` : ""}</div>
    <p class="ed-b">${from ? `<b>${esc(from.name)}</b> 통학구역에서 갈 수 있는 중학교예요.` : ""}${area.from.note ? ` ${esc(area.from.note)}` : ""}</p>
    ${unsettled.length ? `<p class="mid-un"><b>미정</b> ${unsettled.map(esc).join(" · ")} — 바뀔 수 있어요.${zoneNotice && zoneNotice.sourceUrl ? ` <a href="${esc(zoneNotice.sourceUrl)}" target="_blank" rel="noopener">${esc(zoneNotice.sourceName || "출처")}</a>` : ""}</p>` : ""}
    <div class="w-page w-2r">
      <div class="w-body">
        ${mid.principles.length ? `<section class="mid-step"><h3><em>1</em>배정 원칙(절차)</h3>${mid.principles.map((p, i) => `<details class="mid-pr"${i === 0 ? " open" : ""}><summary>${esc(plain(p.title))} ${tag(p.status, esc)}</summary><p class="ed-b">${esc(plain(p.body))}</p><p class="ed-s">출처 ${srcs(p.sources, esc)}</p></details>`).join("")}</section>` : ""}
        ${flowRows ? `<section class="mid-step"><h3><em>2</em>배정 일정 흐름</h3><ol class="pl-flow">${flowRows}</ol><p class="muted small">날짜는 일정 화면과 같아요. 학교·교육지원청 공지로 다시 확인해 주세요.</p></section>` : ""}
      </div>
      <aside class="w-aside mid-step"><h3><em>3</em>갈 수 있는 학교 <span class="muted small">${zs.length}개교</span></h3>${commonNote ? `<p class="muted small">${esc(commonNote)}</p>` : ""}
        ${anyMap ? `<p class="mid-map"><em>4</em><a class="lnk" href="${esc(mapHref(zs.find(({ p }) => p.lat != null).p.id))}&lv=middle">지도에서 한꺼번에 보기</a></p>` : ""}
        <div class="w-table mid-tbl"><table class="ed-tbl"><thead><tr><th>학교</th><th>주소</th><th>바로가기</th></tr></thead><tbody>${rows}</tbody></table></div>
        ${commonSrc ? `<p class="ed-s">출처 ${srcs(commonSrc, esc)} ${commonSt ? tag(commonSt, esc) : ""}</p>` : ""}
        ${tbs}${noTb ? `<p class="muted small">교과서 출판사 표가 없는 학교(${noTb}개교)는 학교 공지에서 확인해 주세요.</p>` : ""}
        ${near ? `<p class="muted small">근거리 중학교 명단은 교육지원청 공지 첨부에서 확인할 수 있어요.${near.sources?.length ? ` 출처 ${srcs(near.sources, esc)}` : ""}</p>` : ""}</aside>
    </div></div>`;
    el.querySelector("#mid-from").onchange = (e) => { st.from = e.target.value; draw(); };
  };
  draw();
}
