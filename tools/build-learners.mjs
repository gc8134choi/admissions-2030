// portal/data/learners.json(손 관리 정본) → portal/data/profiles.json(하위 호환 사본: { _meta, profiles }).
// examYear = entryYear + 3 규칙을 검증한다. 사용: node tools/build-learners.mjs  (--check: 사본이 정본과 다르면 종료코드 1)
import { readFileSync, writeFileSync } from "node:fs";

const src = JSON.parse(readFileSync("portal/data/learners.json", "utf8"));
const errs = [];
for (const l of src.learners) {
  if (l.examYear !== l.entryYear + 3) errs.push(`${l.id}: examYear(${l.examYear}) != entryYear(${l.entryYear}) + 3`);
  if (/birth|출생/i.test(JSON.stringify(l))) errs.push(`${l.id}: 출생연도 필드는 둘 수 없다`);
  // milestones[](졸업 등 개인 일정): id·label·date(YYYY-MM-DD 또는 YYYY-MM)·status·sourceName이 있어야 한다.
  for (const m of l.milestones || []) {
    if (!m.id || !m.label || !/^\d{4}-\d{2}(-\d{2})?$/.test(m.date || "")) errs.push(`${l.id}: milestone ${m.id || "?"}에 id·label·date(YYYY-MM[-DD])가 필요하다`);
    if (!["confirmed", "reported", "estimated"].includes(m.status)) errs.push(`${l.id}: milestone ${m.id}의 status는 confirmed|reported|estimated`);
    if (!m.sourceName) errs.push(`${l.id}: milestone ${m.id}에 sourceName(출처)이 필요하다`);
  }
}
if (src.learners.filter((l) => l.enabled && l.primary).length !== 1) errs.push("enabled이면서 primary인 학습자는 정확히 한 명이어야 한다");
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const compat = {
  _meta: { note: "하위 호환 사본. 정본은 learners.json이며 이 파일은 tools/build-learners.mjs가 만든다(손으로 고치지 않는다).", entryYearRule: src._meta.entryYearRule },
  profiles: src.learners.filter((l) => l.enabled).map(({ id, name, label, entryYear, examYear, schoolIds, csat, milestones }) => ({ id, name, label, entryYear, examYear, schoolIds, csat, ...(milestones ? { milestones } : {}) })),
};
const json = JSON.stringify(compat, null, 2) + "\n";
const target = "portal/data/profiles.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("profiles.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(compat.profiles.length, "learners");
