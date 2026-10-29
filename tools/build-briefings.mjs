// research/data/school-briefings-draft.json(조사 세션) → portal/data/briefings.json (학교 설명회 노트).
//   - 학교 설명회 녹음을 AI가 요약한 노트이며 학교 공식 문서가 아니다. 항목 level은 일관|추정|참고만|null(소제목).
//   - schoolId는 schools.json에 있어야 한다. 초안이 없으면 빈 목록을 만든다(화면은 노트가 있는 학교에서만 접이식을 보여 준다).
// 사용: node tools/build-briefings.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "research/data/school-briefings-draft.json";
const draft = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, briefings: [] };
const schema = JSON.parse(readFileSync("schema/school-briefings.schema.json", "utf8"));
const B = schema.properties.briefings.items;
const schoolsRaw = JSON.parse(readFileSync("portal/data/schools.json", "utf8"));
const schoolIds = new Set((Array.isArray(schoolsRaw) ? schoolsRaw : schoolsRaw.schools).map((s) => s.id));
const LEVELS = B.properties.sections.items.properties.items.items.properties.level.enum;
const errs = [];
const ids = new Set();
let items = 0;
for (const b of draft.briefings) {
  for (const k of B.required) if (b[k] == null || b[k] === "") errs.push(`${b.briefingId ?? "?"}: ${k} 없음`);
  if (!new RegExp(B.properties.briefingId.pattern).test(b.briefingId || "")) errs.push(`${b.briefingId}: briefingId 형식`);
  if (ids.has(b.briefingId)) errs.push(`${b.briefingId}: id 중복`); ids.add(b.briefingId);
  if (!schoolIds.has(b.schoolId)) errs.push(`${b.briefingId}: schoolId ${b.schoolId}가 schools.json에 없음`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) errs.push(`${b.briefingId}: date는 YYYY-MM-DD`);
  if (!b.source?.name) errs.push(`${b.briefingId}: source.name 없음`);
  if (!B.properties.status.enum.includes(b.status)) errs.push(`${b.briefingId}: status ${b.status}`);
  (b.sections || []).forEach((s, i) => {
    if (!s.name) errs.push(`${b.briefingId}.sections[${i}]: name 없음`);
    (s.items || []).forEach((it, j) => {
      items++;
      if (!it.text) errs.push(`${b.briefingId}.sections[${i}].items[${j}]: text 없음`);
      if (!LEVELS.includes(it.level ?? null)) errs.push(`${b.briefingId}.sections[${i}].items[${j}]: level "${it.level}"는 일관|추정|참고만|null`);
    });
  });
}
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const out = { _meta: { note: "학교 설명회 노트(생성물, 손으로 고치지 않는다). research/data/school-briefings-draft.json에서 tools/build-briefings.mjs가 만든다. 녹음을 AI가 요약한 내용이며 학교 공식 문서가 아니다.", checkedAt: draft._meta?.checkedAt ?? null, count: draft.briefings.length }, briefings: draft.briefings };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/briefings.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("briefings.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(`설명회 노트 ${draft.briefings.length}건, 항목 ${items}개`);
