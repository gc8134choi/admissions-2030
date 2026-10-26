// 과목 선택 플래너 데이터 → portal/data/planner-rules.json
//   graduation   졸업 요건 구조(총 192학점, 교과 174, 창체 18, 필수 84와 교과군별 표, 국·수·영 81학점 상한, 이수 기준). 정본은 tools/planner-rules-manual.json이고
//                각 값은 policy.json의 근거 행 id로 연결한다. 숫자·키워드가 근거 행 본문에 없으면 실패한다(임의 값 금지). 근거 행이 "경기 적용은 별도 확인"이면 regionNote로 남긴다.
//   schools      학교별 지정/선택 학점 합계(summary.json)와 학기별 지정/선택 학점. 값이 서로 맞는지(지정+선택=교과, 교과+창체=총) 검증한다. outside는 지정·선택에 포함된 교외 개설 학점이다.
//   pickGroups   택n 묶음 제약 목록(groups.json + offerings.json + offerings-index.json): 학기, 고를 개수, 학점, 후보 과목 코드.
//   입력은 읽기만 하며 손으로 고치지 않는다. 사용: node tools/build-planner-rules.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";

const rd = (p) => JSON.parse(readFileSync(p, "utf8"));
const D = "portal/data/";
const man = rd("tools/planner-rules-manual.json");
const policy = new Map(rd(D + "policy.json").map((r) => [r.id, r]));
const summary = rd(D + "summary.json");
const groups = rd(D + "groups.json");
const offerings = rd(D + "offerings.json");
const idx = rd(D + "offerings-index.json");
const errs = [];

const text = (r) => `${r.title} ${r.body}`;
function ground(name, node, extraMust = []) {
  const rows = node.rows.map((id) => policy.get(id));
  node.rows.forEach((id, i) => { if (!rows[i]) errs.push(`${name}: 근거 행 ${id}가 policy.json에 없음`); });
  if (rows.some((r) => !r)) return null;
  const must = [...(node.must || []), ...extraMust];
  // 각 키워드는 근거 행 중 적어도 한 행에 있어야 한다.
  for (const m of must) if (!rows.some((r) => text(r).replace(/\s+/g, " ").includes(m))) errs.push(`${name}: 근거 행(${node.rows.join(",")})에 "${m}"이(가) 없음`);
  const regionNote = rows.some((r) => /경기 적용은 별도 확인/.test(text(r))) ? "경기 적용은 별도 확인" : null;
  const order = ["confirmed", "seoul-verified", "reported", "estimated"];
  const status = rows.map((r) => r.status).sort((a, b) => order.indexOf(b) - order.indexOf(a))[0]; // 가장 낮은 신뢰도
  return { rows: node.rows, status, regionNote };
}
const val = (name, node) => ({ value: node.value, ...(node.derived ? { derived: node.derived } : {}), ...ground(name, node) });

const byArea = man.requiredByArea;
const areaGround = ground("requiredByArea", { rows: byArea.rows });
const areaItems = byArea.items.map((i) => {
  const g = ground(`requiredByArea.${i.area}`, { rows: byArea.rows, must: i.must });
  return { area: i.area, credits: i.credits, ...(i.note ? { note: i.note } : {}), status: g?.status };
});
const groupItems = byArea.groupItems.map((i) => ({ label: i.label, credits: i.credits, ...(ground(`requiredByArea.${i.label}`, { rows: byArea.rows, must: i.must }) ? {} : {}) }));
const areaSum = areaItems.reduce((a, i) => a + i.credits, 0) + groupItems.reduce((a, i) => a + i.credits, 0);
if (areaSum !== man.requiredCredits.value) errs.push(`교과군별 필수 학점 합 ${areaSum} ≠ 필수 ${man.requiredCredits.value}`);
if (man.subjectCredits.value + man.creativeCredits.value !== man.totalCredits.value) errs.push("교과 + 창체 ≠ 총 학점");
if (man.subjectCredits.value - man.requiredCredits.value !== man.freeElectiveCredits.value) errs.push("교과 − 필수 ≠ 자유 선택 학점");

const comp = man.completion;
const graduation = {
  totalCredits: val("totalCredits", man.totalCredits),
  subjectCredits: val("subjectCredits", man.subjectCredits),
  creativeCredits: val("creativeCredits", man.creativeCredits),
  requiredCredits: val("requiredCredits", man.requiredCredits),
  freeElectiveCredits: val("freeElectiveCredits", man.freeElectiveCredits),
  requiredByArea: { rows: byArea.rows, status: areaGround?.status, regionNote: areaGround?.regionNote, items: areaItems, groupItems },
  capKoMaEn: { value: man.capKoMaEn.value, kind: man.capKoMaEn.kind, areas: man.capKoMaEn.areas, ...ground("capKoMaEn", man.capKoMaEn) },
  completion: {
    attendanceMin: val("attendanceMin", comp.attendanceMin),
    commonAchievementMinPercent: val("commonAchievementMinPercent", comp.commonAchievementMinPercent),
    electiveAchievementRequired: { ...val("electiveAchievementRequired", comp.electiveAchievementRequired), appliesFrom: comp.electiveAchievementRequired.appliesFrom },
  },
};

const schools = summary.map((s) => {
  // 교외(outside) 학점은 지정·선택 합계에 이미 들어 있는 값이다(수지고 1-2: 지정 29 안의 2학점).
  if (s.creditsRequired + s.creditsElective !== s.creditsSubject) errs.push(`${s.schoolId}: 지정+선택 ≠ 교과 학점`);
  if (Object.values(s.byTerm).some((v) => v.required + v.elective !== v.total || v.outside > v.total)) errs.push(`${s.schoolId}: 학기별 지정+선택 ≠ 합계`);
  if (s.creditsSubject + s.creditsCreative !== s.creditsTotal) errs.push(`${s.schoolId}: 교과+창체 ≠ 총 학점`);
  if (s.creditsSubject !== man.subjectCredits.value || s.creditsTotal !== man.totalCredits.value) errs.push(`${s.schoolId}: 학교 편제표 총 학점이 졸업 요건과 다름`);
  return {
    schoolId: s.schoolId, curriculumId: s.curriculumId, entryYear: s.entryYear,
    credits: { subject: s.creditsSubject, creative: s.creditsCreative, total: s.creditsTotal, required: s.creditsRequired, elective: s.creditsElective, outside: s.creditsOutside },
    byTerm: Object.fromEntries(Object.entries(s.byTerm).map(([t, v]) => [t, { required: v.required, elective: v.elective, outside: v.outside, total: v.total, groupCount: v.groupCount }])),
    requiredByArea: Object.fromEntries(Object.entries(s.byArea).map(([a, v]) => [a, v.required])),
    confidence: s.confidence,
  };
});

// 택n 묶음: 묶음에 속한 개설 행(groupId)에서 과목 코드를 모은다. 코드가 없는 과목은 subjectIds에서 빠지고 unmatched에 남긴다.
const members = new Map();
for (const o of offerings) if (o.groupId) { (members.get(o.groupId) ?? members.set(o.groupId, []).get(o.groupId)).push(o); }
const pickGroups = groups.map((g) => {
  const rows = members.get(g.id) || [];
  const ids = [...new Set(rows.map((o) => idx.byOffering[o.id]).filter(Boolean))].sort();
  const unmatched = [...new Set(rows.filter((o) => !idx.byOffering[o.id]).map((o) => o.subjectKey))].sort();
  if (rows.length && new Set(rows.map((o) => o.subjectKey)).size !== g.size) errs.push(`${g.id}: 묶음 크기 ${g.size} ≠ 후보 ${new Set(rows.map((o) => o.subjectKey)).size}`);
  if (g.pick > g.size) errs.push(`${g.id}: pick > size`);
  return { id: g.id, schoolId: g.schoolId, term: g.term, pick: g.pick, size: g.size, creditsEach: g.creditsEach, creditsTotal: g.creditsTotal, poolType: g.poolType, sameArea: g.sameArea, areasInPool: g.areasInPool, subjectIds: ids, unmatched };
});

if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
const out = { _meta: { note: "과목 선택 플래너 규칙(생성물, 손으로 고치지 않는다). tools/planner-rules-manual.json + summary·groups·offerings에서 tools/build-planner-rules.mjs가 만든다. 졸업 요건은 policy.json 근거 행으로 연결한다.", schoolCount: schools.length, pickGroupCount: pickGroups.length }, graduation, schools, pickGroups };
const json = JSON.stringify(out, null, 1) + "\n";
const target = D + "planner-rules.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("planner-rules.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(`학교 ${schools.length}곳, 택n 묶음 ${pickGroups.length}개, 코드 없는 후보 ${pickGroups.reduce((a, g) => a + g.unmatched.length, 0)}건`);
