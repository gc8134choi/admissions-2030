// 고등학교 > "학교 비교": 공용 비교 표(compare-table.js, 기준 문서 COMPARE-TABLE.md)의 첫 사용처. 학교=열, 항목=행.
// 선택은 주소(?c=placeId,…)와 이 브라우저(localStorage portal.hs.compare)에 저장한다. 기본값은 성복초에서 가까운 고교 4곳. 데이터: hs-compare.json(tools/build-hs-compare.mjs).
// 값마다 기준연도·상태·출처가 있다. 확정은 표시하지 않고 보도·추정만 조용히 표시하며, 확인 못 한 칸은 "-"(사유는 마우스를 올리면 보인다).
// 공용: hsCompareSummary(data, opts)는 홈의 "고교 비교 요약"이 학교마다 핵심 지표 한 줄을 만들 때 쓴다.
import { stageTag } from "./stage.js";
import { WHERE } from "./empty.js";
import { cmpTable } from "./compare-table.js";
import { emptyLine } from "./empty.js";
import { electiveRows, electivesPanel, bindElectives } from "./electives.js";
import { examRows, examPanel, bindExam } from "./exam-trends.js";
const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const SUMMARY_FIELDS = ["type", "founding", "coed", "students", "classes"];

// 값 하나를 화면 글자로(링크는 제외). 숫자는 단위를 붙이고 불리언은 예/아니요.
export function formatValue(f, v) {
  if (!v || v.value == null) return null;
  if (f.type === "boolean") return v.value ? "예" : "아니요";
  if (f.type === "number") return `${Number(v.value).toLocaleString("ko-KR")}${f.unit || ""}`;
  return String(v.value);
}

// 홈 요약용: [{ placeId, schoolId, name, line, parts:[{id,label,text}] }]. 값이 있는 핵심 지표만 이어 붙인다(최대 opts.max개).
export function hsCompareSummary(data, { fields = SUMMARY_FIELDS, max = 4, electives = null } = {}) {
  const tend = new Map((electives?.items ?? []).map((e) => e.summary ? [e.placeId, `선택과목 ${e.summary.tendency}(인원 기준)`] : e.classProxy?.rows?.length ? [e.placeId, `선택과목 ${e.classProxy.tendency}(학급 수 기준 추정)`] : null).filter(Boolean)); // 성향 한 줄(선택 비중 기준 추정)
  if (!data || !data.schools || !data.schools.length) return [];
  const byId = new Map(data.fields.map((f) => [f.id, f]));
  // 요약 한 줄에서는 문자열 값의 괄호 설명(설립일 등)을 뺀다
  return data.schools.map((s) => {
    const parts = fields.map((id) => { const f = byId.get(id), raw = f && formatValue(f, s.values[id]), text = f && raw && f.type !== "number" ? raw.replace(/\s*\([^)]*\)/g, "").trim() : raw; return text ? { id, label: f.label, text: f.type === "number" ? `${f.label} ${text}` : text } : null; }).filter(Boolean).slice(0, max);
    if (tend.has(s.placeId)) parts.push({ id: "electives", label: "성향", text: tend.get(s.placeId) });
    return { placeId: s.placeId, schoolId: s.schoolId || null, name: s.name, line: parts.map((p) => p.text).join(" · "), parts };
  });
}

const km = (a, b) => { const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const short = (t) => String(t || "").replace(/\s*\([^)]*\)/g, "").replace(/고등학교$/, "고");

// 비교 데이터(fields + schools[].values)를 공용 비교 표의 행으로. 고교·중학교 비교가 같이 쓴다.
export function compareRows(d, esc, hrefOf = () => "#select/curriculum?v=hs") {
  return d.fields.map((f) => ({ id: f.id, label: f.label, unit: f.type === "number" ? f.unit : "", group: f.group, kind: f.type === "number" ? "number" : f.type === "boolean" ? "bool" : "text",
    get: (t) => { const v = d.schools.find((s) => s.placeId === t.id)?.values[f.id]; if (!v || v.value == null) return { empty: true, why: v?.nullReason }; if (f.id === "briefing") return { text: "설명회 노트", html: `<a href="${esc(hrefOf(v, t))}">설명회 노트 보기</a>`, status: v.status };
    const text = f.type === "boolean" ? (v.value ? "있음" : "없음") : f.type === "number" ? String(v.value) : formatValue(f, v); return { text: f.type === "number" ? Number(v.value).toLocaleString("ko-KR") : text, num: f.type === "number" ? Number(v.value) : undefined, status: v.status, html: f.type === "link" ? `<a href="${esc(v.value)}" target="_blank" rel="noopener">열기</a>` : undefined }; } }));
}

export async function hsCompareBody(el, { load, esc, schoolHref = (s) => (s.schoolId ? `#select/curriculum?s=${encodeURIComponent(s.schoolId)}` : `#select/curriculum?v=map&p=${encodeURIComponent(s.placeId)}`) }) {
  const [d, pl, elec, fl, exam] = await Promise.all([load("hs-compare"), load("places").catch(() => ({ places: [] })), load("electives").catch(() => ({ items: [] })), load("files").catch(() => []), load("exam-trends").catch(() => ({ items: [] }))]);
  const files = new Map((Array.isArray(fl) ? fl : fl.files || []).map((f) => [f.id, f]));
  if (!d.schools.length) { el.innerHTML = `<div class="ed"><h2>${stageTag("고입", esc)}학교 비교</h2><p class="muted">아직 정리 중이에요.</p></div>`; return; }
  const place = new Map(pl.places.map((p) => [p.id, p]));
  const origin = pl.places.find((p) => p.level === "elementary" && p.lat != null);
  const nearest = [...d.schools].sort((a, b) => { const pa = place.get(a.placeId), pb = place.get(b.placeId); return (origin && pa?.lat != null ? km(origin, pa) : 1e9) - (origin && pb?.lat != null ? km(origin, pb) : 1e9); }).map((s) => s.placeId);
  const F = new Map(d.fields.map((f) => [f.id, f]));
  const typeOf = (s) => short(formatValue(F.get("type") || {}, s.values.type));
  const types = [...new Set(d.schools.map(typeOf).filter(Boolean))];
  if (!el.querySelector("[data-hsc-t]")) el.innerHTML = `<div data-hsc-t></div><div data-hsc-e></div>`; // 표는 다시 그려져도 아래 상세가 지워지지 않게 따로 둔다
  const gl = await import("./glossary.js"); await gl.preloadGlossary(load).catch(() => {}); const deco = (r) => { try { gl.decorateGlossary(r); } catch {} };
  const host = el.querySelector("[data-hsc-t]"), extra = el.querySelector("[data-hsc-e]");
  extra.innerHTML = electivesPanel(elec, esc, files); bindElectives(extra, elec, esc, files);
  const exOpts = { hrefOf: (e) => { const s = d.schools.find((x) => x.placeId === e.placeId); return s ? schoolHref(s) : null; } };
  extra.insertAdjacentHTML("beforeend", examPanel(exam, esc, exOpts)); bindExam(extra, exam, esc, exOpts); deco(extra); // 선택과목 현황 바로 아래, 같은 화면
  cmpTable(host, {
    afterDraw: deco,
    esc, stage: "고입", title: "학교 비교", summary: "학교를 가로로 놓고 항목을 견줘요",
    targets: d.schools.map((s) => ({ id: s.placeId, name: s.name.replace(/^용인(?!고등학교$)/, ""), sub: typeOf(s), href: schoolHref(s), search: `${s.name} ${s.values.address?.value || ""}`, filterVal: { type: typeOf(s) } })),
    rows: [...compareRows(d, esc, (v, t) => t.href), ...electiveRows(elec, esc), ...examRows(exam, esc)],
    jump: ["선택과목 현황", "내신 출제"],
    select: { key: "portal.hs.compare", param: "c", def: ["pl-014", "pl-011", "pl-012", "pl-013", "pl-022"].filter((id) => d.schools.some((s) => s.placeId === id)).length >= 2 ? ["pl-014", "pl-011", "pl-012", "pl-013", "pl-022"].filter((id) => d.schools.some((s) => s.placeId === id)) : nearest.slice(0, 4), max: 8, min: 2, always: true, defN: 5, addLabel: "학교 추가·빼기", filters: [{ id: "type", label: "유형", options: types }] },
    emptyNext: WHERE.schoolinfo,
    sources: d.schools.flatMap((sc) => Object.values(sc.values).map((v) => v?.source).filter(Boolean)),
  });
}
