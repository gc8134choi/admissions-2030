// research/data/electives-draft.json(조사 세션) → portal/data/electives.json (학교별 선택과목 현황, 학교 비교·상세에서 사용).
//   검산: 학기별 선택 인원 합계 = 현원 × pick(택n). 어긋나면 오류.
//   계산: 학기별 사회·과학 합계와 비중, 학교 전체 비중, 성향(과학 비중 60% 이상 과학 중심 / 40% 이하 사회 중심 / 그 사이 균형).
//   초안이 없으면 빈 목록을 만든다(화면은 빈 상태 문구).
// 사용: node tools/build-electives.mjs [--check] [--src 경로(시험용)]
import { withSourceIds } from "./lib/source-ids.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const argv = process.argv.slice(2);
const SRC = argv.includes("--src") ? argv[argv.indexOf("--src") + 1] : "research/data/electives-draft.json";
const raw = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, items: [] };
const FILES = existsSync("portal/data/files.json") ? JSON.parse(readFileSync("portal/data/files.json", "utf8")) : [];
const fileIdOf = (p) => FILES.find((f) => f.file === String(p).replace(/^portal\//, ""))?.id ?? null; // "portal/files/x.jpg" → files.json id
// 조사 초안(schools[{terms[{rows[{area:탐구-사회,subject,count}]}]}], readingAids) → 이 파일의 입력 모양(items·guide)으로 바꾼다
function convert(r) {
  if (!r.schools) return r;
  const areaOf = (a) => String(a).replace(/^.*-/, "");
  const items = r.schools.map((s) => {
    const ts = s.terms ?? [], first = ts[0];
    const pickN = (t) => Number(String(t.pick ?? "").match(/택\s*(\d+)/)?.[1]) || null;
    const files = [...new Set(ts.flatMap((t) => t.source?.files ?? []))];
    const unknown = files.filter((f) => !fileIdOf(f));
    if (unknown.length) errs0.push(`${s.placeId}: 파일 ${unknown.join(", ")}이 files.json에 없음`);
    const srcs = []; for (const t of ts) { const x = t.source; if (x?.name && !srcs.some((y) => y.name === x.name)) srcs.push({ name: x.name, url: x.url ?? null }); }
    return { placeId: s.placeId, name: s.name, grade: s.cohort?.currentGrade ? `${s.cohort.currentGrade}학년` : null, area: first ? String(first.pick ?? "").replace(/\s*택.*$/, "") || "탐구" : null,
      headcount: s.enrolled ?? null, pick: first ? pickN(first) : null, asOf: ts.map((t) => t.source?.asOf).filter(Boolean).sort().pop() ?? null, sourceKind: first?.source?.type ?? null,
      status: first?.status ?? "reported", sources: srcs, fileIds: files.map(fileIdOf).filter(Boolean), nullReason: s.nullReason ?? null, nextAction: s.nextAction ?? null, _rawTerms: ts,
      terms: ts.map((t) => ({ label: t.term, enrolled: t.enrolled ?? null, indicators: t.indicators ?? null, subjects: (t.rows ?? []).map((x) => ({ name: x.subject, area: areaOf(x.area), count: x.count })) })) };
  });
  const a = r.readingAids ?? {};
  return { _meta: r._meta, items, guide: { intro: a.verdict ?? null, basis: (a.official ?? []).map((o) => ({ text: o.text, source: o.source ? { name: o.source.name, url: o.source.url ?? null, kind: "official" } : undefined })), questions: a.questions ?? [] } };
}
const errs0 = [];
const draft = convert(raw);
const schema = JSON.parse(readFileSync("schema/electives.schema.json", "utf8"));
const I = schema.properties.items.items;
const { plain } = await import("../portal/plain.js");
const places = new Map(JSON.parse(readFileSync("portal/data/places.json", "utf8")).places.map((p) => [p.id, p]));
const fileIds = new Set((existsSync("portal/data/files.json") ? JSON.parse(readFileSync("portal/data/files.json", "utf8")) : []).map((f) => f.id));
const errs = [...errs0], seen = new Set();
const AREAS = ["사회", "과학"];
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const tendency = (sci) => (sci >= 60 ? "과학 중심" : sci <= 40 ? "사회 중심" : "균형");

const items = draft.items.map((it) => {
  const w = it.placeId ?? it.name ?? "?";
  for (const k of I.required) if (it[k] == null || it[k] === "") errs.push(`${w}: ${k} 없음`);
  if (!new RegExp(I.properties.placeId.pattern).test(it.placeId || "")) errs.push(`${w}: placeId 형식`);
  if (seen.has(it.placeId)) errs.push(`${w}: placeId 중복`); seen.add(it.placeId);
  if (!places.has(it.placeId)) errs.push(`${w}: places.json에 없음`);
  else if (places.get(it.placeId).level !== "high") errs.push(`${w}: 고등학교가 아님`);
  if (!I.properties.status.enum.includes(it.status)) errs.push(`${w}: status ${it.status}`);
  for (const f of it.fileIds ?? []) if (!fileIds.has(f)) errs.push(`${w}: fileIds "${f}"가 files.json에 없음`);
  if (it.asOf && !/^\d{4}-\d{2}-\d{2}$/.test(it.asOf)) errs.push(`${w}: asOf 형식`);
  const out = { placeId: it.placeId, name: it.name, grade: it.grade ?? null, area: it.area ?? null, headcount: it.headcount ?? null, pick: it.pick ?? null, asOf: it.asOf ?? null, sourceKind: it.sourceKind ?? null, status: it.status, sources: (it.sources ?? []).map((s) => ({ ...s, name: plain(s.name) })), fileIds: it.fileIds ?? [], note: it.note ? plain(it.note) : null };
  if (!(it.terms ?? []).length) {
    if (!it.nullReason) errs.push(`${w}: terms가 없으면 nullReason 필수`);
    return { ...out, nullReason: it.nullReason ? plain(it.nullReason) : null, nextAction: it.nextAction ? plain(it.nextAction) : null, terms: [], summary: null };
  }
  if (!(it.sources ?? []).length) errs.push(`${w}: sources 비어 있음`);
  if (!it.headcount || !it.pick) errs.push(`${w}: headcount·pick 필요(합계 검산)`);
  const labels = new Set();
  const terms = it.terms.map((t) => {
    if (labels.has(t.label)) errs.push(`${w}: 학기 "${t.label}" 중복`); labels.add(t.label);
    const names = new Set();
    for (const s of t.subjects) {
      if (!AREAS.includes(s.area)) errs.push(`${w} ${t.label} ${s.name}: area "${s.area}"`);
      if (!Number.isInteger(s.count) || s.count < 0) errs.push(`${w} ${t.label} ${s.name}: count ${s.count}`);
      if (names.has(s.name)) errs.push(`${w} ${t.label}: 과목 "${s.name}" 중복`); names.add(s.name);
    }
    const sum = t.subjects.reduce((a, s) => a + s.count, 0);
    if (it.headcount && it.pick && sum !== it.headcount * it.pick) errs.push(`${w} ${t.label}: 합계 ${sum} ≠ 현원 ${it.headcount} × 택${it.pick} = ${it.headcount * it.pick}`);
    const tot = Object.fromEntries(AREAS.map((a) => [a, t.subjects.filter((s) => s.area === a).reduce((x, s) => x + s.count, 0)]));
    if (t.enrolled != null && it.headcount != null && t.enrolled !== it.headcount) errs.push(`${w} ${t.label}: 학기 현원 ${t.enrolled} ≠ 학교 현원 ${it.headcount}`);
    if (t.indicators?.selectionTotal != null && t.indicators.selectionTotal !== sum) errs.push(`${w} ${t.label}: 초안 selectionTotal ${t.indicators.selectionTotal} ≠ 합계 ${sum}`);
    return { label: t.label, total: sum, areaTotals: tot, shares: { 사회: pct(tot.사회, sum), 과학: pct(tot.과학, sum) }, subjects: [...t.subjects].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).map((s) => ({ ...s, share: pct(s.count, sum) })) };
  });
  const all = terms.reduce((a, t) => a + t.total, 0), soc = terms.reduce((a, t) => a + t.areaTotals.사회, 0), sci = terms.reduce((a, t) => a + t.areaTotals.과학, 0);
  const sciShare = pct(sci, all);
  return { ...out, nullReason: null, nextAction: null, terms, summary: { socialShare: pct(soc, all), scienceShare: sciShare, tendency: tendency(sciShare), basis: "선택 비중 기준 추정" } };
});
if (errs.length) { console.error(errs.slice(0, 30).join("\n")); process.exit(1); }

const guide = draft.guide ? { intro: draft.guide.intro ? plain(draft.guide.intro) : null, basis: (draft.guide.basis ?? []).map((b) => ({ ...b, text: plain(b.text) })), questions: (draft.guide.questions ?? []).map((q) => plain(q)) } : { basis: [], questions: [] };
const out = { _meta: { note: "선택과목 현황(생성물, 손으로 고치지 않는다). research/data/electives-draft.json에서 tools/build-electives.mjs가 만든다. 성향은 선택 비중 기준 추정이다.", checkedAt: draft._meta?.checkedAt ?? null, count: items.length, withData: items.filter((i) => i.terms.length).length }, guide, items };
const json = JSON.stringify(withSourceIds(out), null, 1) + "\n";
const target = "portal/data/electives.json";
if (argv.includes("--check")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== json) { console.error("electives.json이 초안과 다르다 — node tools/build-electives.mjs"); process.exit(1); }
  console.log(`OK: electives ${items.length}곳(자료 있음 ${out._meta.withData})`);
} else if (argv.includes("--src")) { console.log(json.slice(0, 1500)); } else { writeFileSync(target, json); console.log(`electives ${items.length}곳(자료 있음 ${out._meta.withData})`); }
