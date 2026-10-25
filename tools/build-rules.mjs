// research/data/rules-draft.json(조사 세션) → portal/data/rules.json (수능 체제·내신 산출 시점별 버전).
// 검사: id 중복 없음, status 어휘, sources(name·kind) 필수, appliesTo.learner가 learners.json에 있음, areas 숫자 필드.
// 사용: node tools/build-rules.mjs  (--check: 파일과 결과가 다르면 종료코드 1)
import { readFileSync, writeFileSync } from "node:fs";

const draft = JSON.parse(readFileSync("research/data/rules-draft.json", "utf8"));
const learners = new Set(JSON.parse(readFileSync("portal/data/learners.json", "utf8")).learners.map((l) => l.id));
const VOCAB = new Set(draft._meta?.statusVocabulary || ["confirmed", "reported", "estimated"]);
const errs = [];
const seen = new Set();
const checkSources = (id, list, label) => { for (const s of list || []) if (!s.name || !["official", "media"].includes(s.kind)) errs.push(`${id}: ${label} 출처에 name·kind(official|media)가 필요하다`); };
for (const r of [...draft.csatRegimes, ...draft.gradingRules]) {
  if (seen.has(r.id)) errs.push(`${r.id}: id 중복`);
  seen.add(r.id);
  if (!VOCAB.has(r.status)) errs.push(`${r.id}: status "${r.status}"`);
  if (!(r.sources || []).length) errs.push(`${r.id}: sources가 비어 있다(출처 필수)`);
  checkSources(r.id, r.sources, "sources");
  for (const a of r.appliesTo || []) {
    if (!learners.has(a.learner)) errs.push(`${r.id}: appliesTo.learner "${a.learner}"가 learners.json에 없다`);
    if (!VOCAB.has(a.status)) errs.push(`${r.id}: appliesTo(${a.learner}) status "${a.status}"`);
    checkSources(r.id, a.sources, `appliesTo(${a.learner}) sources`);
  }
}
for (const r of draft.csatRegimes) for (const a of r.areas || []) for (const k of ["items", "points", "minutes"]) if (a[k] != null && typeof a[k] !== "number") errs.push(`${r.id}/${a.area}: ${k}는 숫자여야 한다`);
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const out = { _meta: { note: "수능 체제·내신 산출 시점별 버전(생성물, 손으로 고치지 않는다). research/data/rules-draft.json에서 tools/build-rules.mjs가 만든다.", version: draft._meta?.version, checkedAt: draft._meta?.checkedAt }, csatRegimes: draft.csatRegimes, gradingRules: draft.gradingRules };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/rules.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("rules.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(draft.csatRegimes.length, "csat regimes,", draft.gradingRules.length, "grading rules");
