// "중학교 배정" 보기("학교" 탭 안): 초등학교를 고르면 통학구역 중학교 표, 배정 원칙(접이식), 배정 일정 흐름.
// 데이터가 있는 초등학교(middle.json areas[])만 고를 수 있고, 그 밖의 학교는 교육지원청 근거리표 링크로 안내한다. 같은 문장이 반복되는 항목은 한 번만 적어 길이를 줄였다.
// 데이터: middle.json(tools/build-middle.mjs), middle-curriculum.json(교과서 출판사), places.json, files.json(원본 이미지), policy.json의 life-* 행(stage 중입). 확정은 표시하지 않고 보도·추정만 조용히 표시한다.
import { placeInfo } from "./map.js";
import { stageOf, stageTag } from "./stage.js";
import { plain } from "./plain.js";
import { fmtWhen } from "./when.js";
import { densify } from "./fold.js";
import { srcWrap } from "./src-ref.js";
import { cmpTable } from "./compare-table.js";
import { compareRows } from "./hs-compare.js";
import { WHERE } from "./empty.js";
import { preloadGlossary, decorateGlossary } from "./glossary.js";
const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const tag = (s, esc) => (ES[s] ? `<span class="es ${ES[s][0]}">${ES[s][1]}</span>` : "");
const srcs = (a, esc) => (a || []).map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)} ↗</a>` : esc(x.name))).join(" · ");
const srcb = (a, esc, extra = "") => srcWrap(`${srcs(a, esc)}${extra ? ` ${extra}` : ""}`); // 출처는 항목 끝 "출처" 버튼 뒤로

// 교과서 표(자료가 있는 학교만): 학교 보기의 "학교별 교과서"와 같은 표
const textbookHtml = (p, curBy, fileId, esc) => {
    const c = curBy.get(p.id); if (!c) return "";
    const g = (v) => (v ? esc(v) : '<span class="muted">-</span>');
    const img = (c.sources || []).map((x) => (x.file && fileId(x.file) ? `<a href="#library/files?open=${encodeURIComponent(fileId(x.file))}">원본 이미지 보기</a>` : "")).filter(Boolean)[0] || "";
    const rows = c.subjects.map((j) => `<tr><td>${esc(j.subject)}</td><td>${g(j.publishers[1])}</td><td>${g(j.publishers[2])}</td><td>${g(j.publishers[3])}</td>${j.note ? `<td class="muted small">${esc(j.note)}</td>` : "<td></td>"}</tr>`).join("");
    return `<details class="pl-tb"><summary>${esc(p.name)} 교과서·교과 구성 ${tag(c.status, esc)}</summary>
      <div class="pl-tbw"><table class="ed-tbl"><thead><tr><th>교과</th><th>1학년</th><th>2학년</th><th>3학년</th><th>비고</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="muted small">1학년 때 배부하고 2·3학년까지 사용해요.${c.footnote ? ` ${esc(c.footnote)}` : ""}</p>
      <p class="ed-s0">${srcb(c.sources, esc, img)}</p></details>`;
};

export async function middleBody(el, { load, esc, mapHref = (id) => `#select/curriculum?v=map&p=${encodeURIComponent(id)}` }) {
  const [mid, pl, policy, cur, files, guide, tl, mc] = await Promise.all([load("middle"), load("places"), load("policy"), load("middle-curriculum"), load("files"), load("middle-guide").catch(() => ({ sections: [] })), load("timeline").catch(() => ({ events: [] })), load("middle-compare").catch(() => ({ fields: [], schools: [] }))]);
  const curBy = new Map(cur.schools.map((c) => [c.placeId, c]));
  const fileId = (f) => (Array.isArray(files) ? files : files.files || []).find((x) => x.file === f)?.id;
  const place = new Map(pl.places.map((p) => [p.id, p]));
  const areas = mid.areas && mid.areas.length ? mid.areas : mid.from ? [{ from: mid.from, zoneSchools: mid.zoneSchools }] : [];
  if (!areas.length || !areas[0].zoneSchools.length) { el.innerHTML = `<div class="ed"><h2>중학교 배정</h2><p class="muted">아직 정리 중이에요. 배정 일정은 일정 화면에서 먼저 볼 수 있어요.</p></div>`; return; }
  const LSK = "portal.mid.from"; // 마지막으로 고른 초등학교(이 브라우저에만 저장, 기본은 첫 구역=성복초)
  const lsFrom = () => { try { return localStorage.getItem(LSK); } catch { return null; } };
  const st = (el.__mid ||= { from: areas.some((a) => a.from.placeId === lsFrom()) ? lsFrom() : areas[0].from.placeId, q: "" });
  if (!areas.some((a) => a.from.placeId === st.from)) st.from = areas[0].from.placeId;

  const zoneNotice = policy.find((r) => /중학구/.test(r.title + r.body) && /의견 ?수렴/.test(r.title + r.body) && r.status !== "confirmed" && !/고시 확정/.test(r.title)); // 이미 고시가 확정된 행(의견 수렴은 지난 과정)은 '미정'으로 보이지 않게
  const flow = policy.filter((r) => r.topic === "life-schedule" && r.stage === "중입");
  const near = mid.principles.find((p) => /근거리/.test(p.title));
  const nearUrl = (near?.sources || []).find((x) => x.url)?.url || (mid.principles.flatMap((p) => p.sources || []).find((x) => x.url) || {}).url;

  const textbook = (p) => textbookHtml(p, curBy, fileId, esc);

  const optHtml = () => { const q = st.q.trim(); const list = areas.filter((a) => a.from.placeId === st.from || !q || (place.get(a.from.placeId)?.name || "").includes(q)); return list.map((a) => `<option value="${esc(a.from.placeId)}"${a.from.placeId === st.from ? " selected" : ""}>${esc(place.get(a.from.placeId)?.name || a.from.placeId)}</option>`).join(""); };
  // 선택한 초등학교에 맞춘 배정 원칙: 학교군 이름·중학교 수·공동학군은 구역 데이터에서 만들고, 성복초 이름이 박힌 문장은 선택 학교로 바꾼다.
  // 수지1중학군에만 해당하는 문장(근거리 5교 지망)은 수지1중학군 소속일 때만 보이고, 그 밖에는 "이 학교군의 규정은 교육지원청 안내에서 확인"으로 바꾼다.
  const principlesFor = (area, zs) => {
    const fromName = place.get(area.from.placeId)?.name || "이 초등학교";
    const short = fromName.replace(/초등학교$/, "초");
    const text = `${area.from.note || ""} ${area.zoneSchools.map((z) => z.note || "").join(" ")}`;
    const groups = [...new Set(text.match(/수지\d중학군/g) || [])];
    const joint = /공동학군/.test(text);
    const s1 = groups.includes("수지1중학군");
    const names = zs.map(({ p }) => p.name.replace(/중학교$/, "중"));
    const group = groups.length ? groups.join("·") : "정해진 학교군";
    return mid.principles.map((p) => {
      if (/수지1중학군/.test(p.title) || p.id === "mp-01") {
        return { ...p, title: `${short}는 ${group}${joint ? "(공동학군)" : ""}`, body: `${fromName}는 ${group}에 속해요.${joint ? " 공동학군이라 두 학교군의 중학교를 함께 지원할 수 있어요." : ""} 갈 수 있는 중학교는 ${names.join("·")} ${names.length}교예요. 2027학년도 고시 기준이고, 2030학년도 입학 시점 구성은 그해 고시에서 정해져요.` };
      }
      const fix = (t) => String(t).replaceAll("성복초등학교", fromName).replaceAll("성복초", short);
      if (s1) return { ...p, title: fix(p.title), body: fix(p.body) };
      if (/근거리/.test(p.title) || /수지1중학군/.test(p.body)) {
        const general = String(p.body).split(/(?<=[.다])\s+/).filter((x) => !/수지1중학군|성복초|근거리/.test(x)).join(" ");
        return { ...p, title: /근거리/.test(p.title) ? `${short}의 근거리 중학교 명단은 교육지원청 안내에서 확인` : p.title, body: general || `이 학교군의 지망·근거리 규정은 용인교육지원청 중학교 신입생 배정 안내에서 확인할 수 있어요.` };
      }
      return { ...p, title: fix(p.title), body: fix(p.body) };
    });
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
      <td class="muted small">${esc(p.address)}${p.coordApprox ? " (위치 근사)" : ""}</td><td class="mid-lk">${p.lat != null ? `<a href="${esc(mapHref(p.id))}">지도</a>` : ""} ${hp(p)}${!commonSrc ? srcb(z.sources, esc) : ""}</td></tr>`).join("");
    const unsettled = [zoneNotice ? "학교군·중학구(용인교육지원청 의견 수렴 중)" : "", near ? "근거리 중학교 명단(교육지원청 공지 첨부에서 확인)" : ""].filter(Boolean);
    const anyMap = zs.some(({ p }) => p.lat != null);
    const flowRows = flow.map((r) => `<li>${stageTag(stageOf(r), esc)} <b>${esc(plain(r.title))}</b> <span class="muted">${esc(plain(r.body))}</span> ${tag(r.status, esc)}</li>`).join("");
    // 입학 준비 가이드(체크리스트)와 초6 기준 큰 그림 연표: 접이식 섹션
    const gsrc = (s) => (s && s.name ? ` ${srcWrap(s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>` : esc(s.name))}` : "");
    const guideHtml = (guide.sections || []).length ? `<details class="hst mid-sec" id="mid-guide"><summary>${stageTag("중입", esc)}입학 준비 가이드 <span class="muted small">${guide.sections.reduce((n, s) => n + s.items.length, 0)}개</span></summary>${guide.sections.map((s) => `<section class="mg-s"><h4>${esc(s.title)}</h4><ul class="mg-l">${s.items.map((it) => `<li>${it.when ? `<b class="hst-d">${esc(fmtWhen(it.when))}</b> ` : ""}${esc(it.text)} ${tag(it.status, esc)}${it.source ? gsrc(it.source) : it.nullReason ? ` <span class="muted small">${esc(it.nullReason)}</span>` : ""}</li>`).join("")}</ul></section>`).join("")}</details>` : "";
    const STG = ["초6", "중1", "중2", "중3", "고1", "고2", "고3", "대입"];
    const tlHtml = (tl.events || []).length ? `<details class="hst mid-sec"><summary>${stageTag("중입", esc)}큰 그림 연표 (초6 → 대입) <span class="muted small">${tl.events.length}건</span></summary>${STG.map((g) => { const es = tl.events.filter((e) => e.stage === g).sort((a, b) => a.when.localeCompare(b.when)); return es.length ? `<p class="tl-st">${g}</p><ul class="mg-l">${es.map((e) => `<li><b class="hst-d">${esc(fmtWhen(e.when))}</b> ${esc(e.what)} ${tag(e.status, esc)}${e.note ? `<div class="muted small">${esc(e.note)}</div>` : ""}${e.source ? gsrc(e.source) : ""}</li>`).join("")}</ul>` : ""; }).join("")}<p class="muted small">2030학년도 이후 세부는 그해 고시·시행계획에서 정해져요.</p></details>` : "";
    // 중학교 비교: 공용 비교 표(대상=중학교 열). 접이식을 처음 열 때 그린다.
        el.innerHTML = `<div class="ed mid-flow"><h2>${stageTag("중입", esc)}중학교 배정</h2>
    <div class="mid-pick"><label class="flabel" for="mid-from">초등학교</label>
      <input type="search" id="mid-q" class="mid-q" placeholder="초등학교 검색" value="${esc(st.q)}" aria-label="초등학교 검색"><select id="mid-from" aria-label="초등학교 선택">${optHtml()}</select>
      ${nearUrl ? `<a class="mid-btn" href="${esc(nearUrl)}" target="_blank" rel="noopener">다른 초등학교는 교육지원청 근거리표에서 확인</a>` : ""}</div>
    <p class="ed-b">${from ? `<b>${esc(from.name)}</b> 통학구역에서 갈 수 있는 중학교예요.` : ""}${area.from.note ? ` ${esc(area.from.note)}` : ""}</p>
    ${from ? `<p class="muted small mid-fi">${esc(from.address)}${/^https?:\/\//.test(from.homepage || "") ? ` · <a href="${esc(from.homepage)}" target="_blank" rel="noopener">학교 홈페이지</a>` : ""}${from.lat != null ? ` · <a href="${esc(mapHref(from.id))}">지도에서 보기</a>` : " · 지도 위치는 확인 중이에요"}</p>` : ""}
    ${unsettled.length ? `<p class="mid-un"><b>미정</b> ${unsettled.map(esc).join(" · ")} — 바뀔 수 있어요.${zoneNotice && zoneNotice.sourceUrl ? ` ${srcWrap(`<a href="${esc(zoneNotice.sourceUrl)}" target="_blank" rel="noopener">${esc(zoneNotice.sourceName || "출처")} ↗</a>`)}` : ""}</p>` : ""}
    <div class="w-page w-2r">
      <div class="w-body">
        ${mid.principles.length ? `<section class="mid-step"><h3><em>1</em>배정 원칙(절차)</h3>${principlesFor(area, zs).map((p, i) => `<details class="mid-pr"${i === 0 ? " open" : ""}><summary>${esc(plain(p.title))} ${tag(p.status, esc)}</summary><p class="ed-b">${esc(plain(p.body))}</p><p class="ed-s0">${srcb(p.sources, esc)}</p></details>`).join("")}</section>` : ""}
        ${flowRows ? `<section class="mid-step"><h3><em>2</em>배정 일정 흐름</h3><ol class="pl-flow">${flowRows}</ol><p class="muted small">날짜는 일정 화면과 같아요. 학교·교육지원청 공지로 다시 확인해 주세요.</p></section>` : ""}
        ${guideHtml}${tlHtml}
      </div>
      <aside class="w-aside mid-step"><h3><em>3</em>갈 수 있는 학교 <span class="muted small">${zs.length}개교</span></h3>${commonNote ? `<p class="muted small">${esc(commonNote)}</p>` : ""}
        <ul class="mid-names">${zs.map(({ p }) => `<li>${esc(p.name)}</li>`).join("")}</ul>
        <p class="mid-map"><a class="lnk" href="#select/curriculum?v=schools&lv=middle&m=${zs.map(({ p }) => p.id).join(",")}">학교 보기에서 표로 견주기 ›</a> <a class="lnk" href="#select/curriculum?v=schools&lv=middle&show=map">지도로 보기 ›</a></p>
        ${near ? `<p class="muted small">근거리 중학교 명단은 교육지원청 공지 첨부에서 확인할 수 있어요.${near.sources?.length ? ` ${srcb(near.sources, esc)}` : ""}</p>` : ""}</aside>
    </div></div>`;
    el.querySelector("#mid-from").onchange = (e) => { st.from = e.target.value; st.q = ""; try { localStorage.setItem(LSK, st.from); } catch {} draw(); };
    el.querySelector("#mid-q").oninput = (e) => { st.q = e.target.value; const sel = el.querySelector("#mid-from"); sel.innerHTML = optHtml(); };
    densify(el, { open: [0], keep: 5, chars: 100, groups: false });
    { /* 메뉴 항목 '중학교 비교'·'입학 준비'는 같은 화면의 접이식을 열어 그 자리로 간다(open=cmp|guide) */
      const op = new URLSearchParams((decodeURIComponent(location.hash.slice(1)).split("?")[1]) || "").get("open"), tg = op === "cmp" ? el.querySelector("#mid-cmpd") : op === "guide" ? el.querySelector("#mid-guide") : null;
      if (tg) { const go = () => { if (!tg.isConnected) return; tg.open = true; tg.scrollIntoView({ block: "start" }); }; go(); setTimeout(go, 350); setTimeout(go, 1200); } } // 첫 섹션(배정 원칙)만 펼치고 나머지는 한 줄 요약
    decorateGlossary(el); // 학교군·지망·재배정 등 용어 ⓘ
  };
  await preloadGlossary(load);
  draw();
}

// 중학교 "학교 보기"(v=schools&lv=middle): 비교표 | 지도 한 화면. 표는 중학교 13곳을 모두 놓고(고르기 가능), 아래에 학교별 교과서 표를 둔다.
export async function middleSchoolsBody(el, { load, esc, show = "table", focus = null }) {
  const [pl, cur, files, mc] = await Promise.all([load("places"), load("middle-curriculum"), load("files"), load("middle-compare")]);
  await preloadGlossary(load);
  const place = new Map(pl.places.map((p) => [p.id, p])), curBy = new Map(cur.schools.map((c) => [c.placeId, c]));
  const fileId = (f) => (Array.isArray(files) ? files : files.files || []).find((x) => x.file === f)?.id;
  const st = (el.__ms ||= { show: show === "map" ? "map" : "table", focus });
  el.innerHTML = `<div class="ed ms-wrap"><div class="vtog" id="ms-tog" role="group" aria-label="보기"><span>보기</span><button type="button" data-show="table">비교표</button><button type="button" data-show="map">지도</button></div><div id="ms-body"></div></div>`;
  const body = el.querySelector("#ms-body"), tog = el.querySelector("#ms-tog");
  const sync = () => { try { const q = new URLSearchParams((location.hash.split("?")[1]) || ""); q.set("v", "schools"); q.set("lv", "middle"); if (st.show === "map") q.set("show", "map"); else q.delete("show"); if (st.show !== "map") q.delete("p"); history.replaceState(null, "", `#select/curriculum?${q.toString().replace(/%2C/g, ",")}`); } catch {} };
  const draw = async () => {
    tog.querySelectorAll("[data-show]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.show === st.show)));
    sync();
    if (st.show === "map") { body.innerHTML = ""; await (await import("./map.js")).mapBody(body, { load, esc, focus: st.focus, level: "middle" }); return; }
    body.innerHTML = `<div id="ms-cmp"></div><section class="ms-tb"><h2>학교별 교과서</h2><p class="muted small">학교 공지를 옮겨 적은 표예요. 학교를 눌러 열어 보세요.</p><div id="ms-tbs"></div></section><p class="muted small ms-uni">교복 가격은 2026.9 학교알리미 공시 기준이에요. 2027학년도 신입생 낙찰금액은 <a href="#select/curriculum?v=middle&open=guide">배정·입학 준비</a>에서 볼 수 있어요.</p>`;
    cmpTable(body.querySelector("#ms-cmp"), { esc, title: "중학교 비교", summary: "중학교를 가로로 놓고 견줘요", stage: "중입",
      targets: mc.schools.map((s) => ({ id: s.placeId, name: s.name.replace(/중학교$/, "중"), sub: [s.values.founding?.value, s.values.coed?.value].filter(Boolean).join("·"), href: `#select/curriculum?v=schools&lv=middle&show=map&p=${encodeURIComponent(s.placeId)}`, search: `${s.name} ${s.values.address?.value || ""}` })),
      rows: compareRows(mc, esc), select: { key: "portal.mid.compare", param: "m", def: mc.schools.map((s) => s.placeId), defN: mc.schools.length, max: mc.schools.length, min: 2, always: true, addLabel: "중학교 추가·빼기" },
      emptyNext: WHERE.schoolinfo, sources: mc.schools.flatMap((sc) => Object.values(sc.values).map((v) => v?.source).filter(Boolean)) });
    const tbs = mc.schools.map((s) => place.get(s.placeId)).filter(Boolean).map((p) => textbookHtml(p, curBy, fileId, esc)).filter(Boolean).join("");
    const noTb = mc.schools.filter((s) => !curBy.has(s.placeId)).length;
    body.querySelector("#ms-tbs").innerHTML = (tbs || '<p class="muted">아직 정리 중이에요.</p>') + (noTb ? `<p class="muted small">교과서 출판사 표가 없는 학교(${noTb}개교)는 학교 공지에서 확인해 주세요.</p>` : "");
    decorateGlossary(body);
  };
  tog.addEventListener("click", (e) => { const b = e.target.closest("[data-show]"); if (!b || b.dataset.show === st.show) return; st.show = b.dataset.show; if (st.show === "table") st.focus = null; draw(); });
  await draw();
}
