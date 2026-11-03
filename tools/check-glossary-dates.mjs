// 용어 풀이(glossary.json) ↔ 정책 행(policy.json) 날짜 교차 점검: 용어 풀이가 말하는 시기가 정책 행의 날짜와 모순되면 실패한다.
//   규칙표(RULES)에 용어 id, 풀이에서 달(月)을 뽑는 식, 근거 정책 행 id를 적는다. 새 용어에 날짜를 쓰면 여기에 한 줄 추가한다.
// 사용: node tools/check-glossary-dates.mjs
import { readFileSync } from "node:fs";
const gl = JSON.parse(readFileSync("portal/data/glossary.json", "utf8")).terms;
const pol = JSON.parse(readFileSync("portal/data/policy.json", "utf8"));
const rows = new Map(); (function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (o.id && o.title && o.topic) rows.set(o.id, o); Object.values(o).forEach(walk); } })(pol);
const monthsOf = (r) => new Set((r.events || []).map((e) => Number(String(e.start).slice(5, 7))).filter(Boolean));
const RULES = [
  { term: "gl-012", label: "수시 원서(9월)", re: /원서[를은는]?\s*(?:내는|낸다|내요)?[^.]*?\((\d{1,2})월\)/, row: "sch-04" },
  { term: "gl-012", label: "수시 원서 달", re: /(\d{1,2})월\)에 원서/, row: "sch-04" },
  { term: "gl-013", label: "정시 원서 달", re: /원서는\s*(\d{1,2})월/, row: "sch-13" },
];
const errs = [];
for (const r of RULES) {
  const t = gl.find((x) => x.id === r.term); if (!t) { errs.push(`${r.term}: 용어 없음`); continue; }
  const tx = `${t.short || ""} ${t.detail || ""}`, m = r.re.exec(tx); if (!m) continue; // 풀이에 그 말이 없으면 건너뜀
  const row = rows.get(r.row); if (!row) { errs.push(`${r.term}: 근거 행 ${r.row} 없음`); continue; }
  const ms = monthsOf(row), n = Number(m[1]);
  if (ms.size && !ms.has(n)) errs.push(`${r.term} '${t.term}' 풀이의 ${r.label} ${n}월이 ${r.row}(${row.title})의 달 ${[...ms].join("·")}월과 다름`);
}
// 정시 풀이에 '12월 말' 같은 접수 시기가 남아 있으면(대교협 2027~2029 모두 1월 초) 실패
const jeongsi = gl.find((x) => x.id === "gl-013"); if (jeongsi && /12월\s*말/.test(`${jeongsi.short} ${jeongsi.detail}`)) errs.push("gl-013: 정시 원서를 '12월 말'로 적음(근거: sch-13, 2027~2029학년도 정시 접수 1월 초)");
// 수능 '11월 셋째 목요일' 관행이 정책 행의 시행일과 맞는지
for (const id of ["sch-03", "sch-12"]) { const r = rows.get(id), e = r?.events?.[0]?.start; if (e && /^\d{4}-\d{2}-\d{2}$/.test(e)) { const d = new Date(e + "T00:00:00Z"); if (d.getUTCMonth() !== 10 || d.getUTCDay() !== 4 || Math.ceil(d.getUTCDate() / 7) !== 3) errs.push(`${id}: 수능 시행일 ${e}이 '11월 셋째 목요일'이 아님(용어 풀이 gl-013과 모순)`); } }
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
console.log(`OK: 용어 풀이 ↔ 정책 행 날짜 교차 점검 통과(규칙 ${RULES.length}건)`);
