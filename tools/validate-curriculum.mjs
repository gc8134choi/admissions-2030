// content/curriculum/*.json 의 학점 합계를 표에 인쇄된 값(declared)과 대조한다.
// 사용: node tools/validate-curriculum.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(fileURLToPath(new URL("..", import.meta.url)), "content", "curriculum");
const TERMS = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
let failures = 0;

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const d = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  const problems = [];
  const check = (label, actual, expected) => {
    if (expected !== undefined && actual !== expected) problems.push(`${label}: 계산 ${actual} ≠ 표 ${expected}`);
  };
  const fixedOf = (t) => sum(d.courses.filter((c) => c.term === t).map((c) => c.credits));
  const electiveOf = (t) => sum(d.electiveGroups.filter((g) => g.term === t).map((g) => g.pick * g.creditsEach));
  const outsideOf = (t) => sum((d.outsideSchool || []).filter((c) => c.term === t).map((c) => c.credits));

  for (const t of TERMS) {
    check(`${t} 학기 합계`, fixedOf(t) + electiveOf(t), d.declared.termCredits[t]);
    check(`${t} 학교지정`, fixedOf(t), d.declared.termFixed?.[t]);
    check(`${t} 선택`, electiveOf(t), d.declared.termElective?.[t]);
  }
  const subjectTotal = sum(TERMS.map((t) => fixedOf(t) + electiveOf(t)));
  check("교과 총 학점", subjectTotal, d.declared.subjectCredits);
  check("교과+창체", subjectTotal + d.declared.creativeCredits, d.declared.totalCredits);
  check("학교지정 합계", sum(TERMS.map(fixedOf)), d.declared.fixedCredits);
  check("선택 합계", sum(TERMS.map(electiveOf)), d.declared.electiveCredits);

  for (const [area, expected] of Object.entries(d.declared.areaTotals || {})) {
    check(`영역 ${area}`, sum(d.courses.filter((c) => c.area === area).map((c) => c.credits)), expected);
  }
  if (d.declared.requiredByArea) {
    check("영역별 필수이수학점 합계", sum(d.declared.requiredByArea.map((r) => r.credits)), d.declared.requiredCredits);
  }
  for (const g of d.electiveGroups) {
    if (g.options.length < g.pick) problems.push(`${g.id}: 선택지 ${g.options.length}개 < 택${g.pick}`);
  }
  const unread = d.courses.filter((c) => !c.subject || !c.credits);
  if (unread.length) problems.push(`빈 과목/학점 ${unread.length}건`);

  const low = d.flags.filter((f) => f.confidence === "low").length;
  console.log(`${problems.length ? "✗" : "✓"} ${d.school}  (${d.courses.length}과목, 선택군 ${d.electiveGroups.length}개, 확인 필요 ${d.flags.length}건/low ${low})`);
  problems.forEach((p) => console.log(`    - ${p}`));
  failures += problems.length;
}
process.exit(failures ? 1 : 0);
