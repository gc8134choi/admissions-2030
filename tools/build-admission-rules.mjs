// research/data/admission-rules-draft.json(조사 세션) → portal/data/admission-rules.json (대학 요강 참고 구조, 2028학년도 기준).
//   - subjectIds: 조사 초안의 legacyKey(공백 없는 과목 키) → subjects.lock.json의 sj 코드로 바꾼다. 못 찾으면 목록을 출력하고 실패한다.
//   - 교과군 단위 권장(subjectIds가 비고 orGroupLabel만 있는 항목)은 라벨을 읽어 group{area,kind,subjectIds}로 풀어 둔다. 못 읽으면 group을 null로 두고 사유를 적는다.
//   - 대학 id(s-9xx)는 학교 id(school-*, 새 학교 s-001~)와 겹치지 않도록 s-900~s-999 구간을 대학 전용으로 고정한다.
// 사용: node tools/build-admission-rules.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";

const rd = (p) => JSON.parse(readFileSync(p, "utf8"));
const draft = rd("research/data/admission-rules-draft.json");
const lock = rd("portal/data/subjects.lock.json").codes;
const master = rd("portal/data/subject-master.json").subjects;
const info = rd("portal/data/subject-info.json").subjects;
const schools = rd("portal/data/schools.json");
const schema = rd("schema/admission_rules.schema.json");
const errs = [];
const UNIV = /^s-9\d\d$/;
for (const s of (Array.isArray(schools) ? schools : schools.schools || [])) if (/^s-9\d\d$/.test(s.id)) errs.push(`학교 id ${s.id}가 대학 전용 구간(s-900~999)과 겹침`);

const norm = (t) => t.replace(/\s+/g, "").replace(/[·ㆍ・]/g, "·");
const infoArea = new Map(info.map((x) => [norm(x.name), x.area]));
const byId = new Map(master.map((m) => [m.subjectId, m]));
// 교과군 라벨 → 마스터에서 후보 과목 집합. 읽을 수 있는 라벨: "<교과군> 교과(군) ... [진로 선택] ... N과목 이상"
const AREA_LABELS = { "제2외국어/한문": (m) => m.infoMatch === "auto" && ["제2외국어", "한문"].includes(infoArea.get(norm(m.infoName || ""))), 수학: (m) => m.area === "수학", 과학: (m) => m.area === "과학", 국어: (m) => m.area === "국어", 영어: (m) => m.area === "영어", 사회: (m) => m.area === "사회" };
function groupOf(label) {
  const m = /^(제2외국어\/한문|수학|과학|국어|영어|사회)\s*교과\(군\)/.exec(label || "");
  if (!m) return null;
  const kind = /진로\s*선택/.test(label) ? "진로" : null;
  const ids = master.filter((x) => !x.isComposite && AREA_LABELS[m[1]](x) && (!kind || x.kind === kind)).map((x) => x.subjectId);
  return { area: m[1], kind, subjectIds: ids };
}

const miss = [];
const rules = draft.items.map((it) => {
  if (!UNIV.test(it.universityId)) errs.push(`${it.ruleId}: universityId ${it.universityId}는 s-900~999 구간이어야 함`);
  for (const k of schema.required) if (it[k] == null) errs.push(`${it.ruleId}: ${k} 없음`);
  if (!new RegExp(schema.properties.ruleId.pattern).test(it.ruleId)) errs.push(`${it.ruleId}: ruleId 형식`);
  if (!schema.properties.track.enum.includes(it.track)) errs.push(`${it.ruleId}: track ${it.track}`);
  if (!schema.properties.status.enum.includes(it.status)) errs.push(`${it.ruleId}: status ${it.status}`);
  if (!(it.sources || []).length) errs.push(`${it.ruleId}: sources 비어 있음`);
  const requirements = (it.requirements || []).map((r) => {
    if (!schema.$defs.requirement.properties.strength.enum.includes(r.strength)) errs.push(`${it.ruleId}: strength ${r.strength}`);
    const ids = (r.subjectIds || []).map((k) => { const c = lock[norm(k)] || lock[k]; if (!c) miss.push(`${it.ruleId}: ${k}`); return c || null; });
    const out = { subjectIds: ids.filter(Boolean), legacyKeys: r.subjectIds || [], minCount: r.minCount ?? 1, strength: r.strength };
    if (r.orGroupLabel) out.orGroupLabel = r.orGroupLabel;
    if (!out.subjectIds.length) {
      const g = groupOf(r.orGroupLabel);
      out.group = g;
      if (!g) out.groupNullReason = "교과군 라벨을 읽지 못해 과목 집합을 만들지 않음";
    }
    return out;
  });
  return { ...it, requirements };
});
if (miss.length) errs.push("마스터에 없는 과목 키:\n" + miss.map((x) => "  - " + x).join("\n"));
if (new Set(rules.map((r) => r.ruleId)).size !== rules.length) errs.push("ruleId 중복");
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const out = {
  _meta: { note: "대학 요강 참고 구조(생성물, 손으로 고치지 않는다). research/data/admission-rules-draft.json에서 tools/build-admission-rules.mjs가 만든다. 대학 id는 s-900~s-999 전용.", version: draft._meta.version, checkedAt: draft._meta.checkedAt, admissionYear: 2028, universities: draft._meta.universities, referenceNote: "2028학년도 기준 참고 구조이며 2030학년도에는 달라질 수 있어요", blockedSites: draft._meta.blockedSites || [] },
  rules,
};
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/admission-rules.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("admission-rules.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
const withReq = rules.filter((r) => r.requirements.length).length;
console.log(`${rules.length} rules (요건 있음 ${withReq}, 없음 ${rules.length - withReq})`);
