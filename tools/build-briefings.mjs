// research/data/school-briefings-draft.json(조사 세션) → portal/data/briefings.json (학교 설명회 노트).
//   - 학교 설명회 녹음을 AI가 요약한 노트이며 학교 공식 문서가 아니다. 신뢰도는 항목마다 consistent|inferred|reference.
//   - schoolId는 schools.json에 있어야 한다. 초안이 없으면 빈 목록을 만든다(화면은 노트가 있는 학교에서만 접이식을 보여 준다).
// 사용: node tools/build-briefings.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "research/data/school-briefings-draft.json";
const draft = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, briefings: [] };
const schema = JSON.parse(readFileSync("schema/school-briefings.schema.json", "utf8"));
const schoolsRaw = JSON.parse(readFileSync("portal/data/schools.json", "utf8"));
const schoolIds = new Set((Array.isArray(schoolsRaw) ? schoolsRaw : schoolsRaw.schools).map((s) => s.id));
const CONF = schema.$defs.item.properties.confidence.enum;
const errs = [];
const ids = new Set();
let items = 0;
const walk = (list, where) => {
  if (!Array.isArray(list)) { errs.push(`${where}: items는 배열`); return; }
  list.forEach((it, i) => {
    items++;
    if (!it.text || typeof it.text !== "string") errs.push(`${where}[${i}]: text 없음`);
    if (!CONF.includes(it.confidence)) errs.push(`${where}[${i}]: confidence "${it.confidence}"는 ${CONF.join("|")} 중 하나`);
    if (it.children) walk(it.children, `${where}[${i}].children`);
  });
};
for (const b of draft.briefings) {
  for (const k of schema.properties.briefings.items.required) if (b[k] == null || b[k] === "") errs.push(`${b.id ?? "?"}: ${k} 없음`);
  if (!new RegExp(schema.properties.briefings.items.properties.id.pattern).test(b.id || "")) errs.push(`${b.id}: id 형식`);
  if (ids.has(b.id)) errs.push(`${b.id}: id 중복`); ids.add(b.id);
  if (!schoolIds.has(b.schoolId)) errs.push(`${b.id}: schoolId ${b.schoolId}가 schools.json에 없음`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.heldAt || "")) errs.push(`${b.id}: heldAt은 YYYY-MM-DD`);
  if (!b.source?.name) errs.push(`${b.id}: source.name 없음`);
  (b.sections || []).forEach((s, i) => { if (!s.title) errs.push(`${b.id}.sections[${i}]: title 없음`); walk(s.items, `${b.id}.sections[${i}].items`); });
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
