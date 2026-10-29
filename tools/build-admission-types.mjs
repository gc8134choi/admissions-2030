// research/data/admission-types-draft.json(조사 세션) → portal/data/admission-types.json (대입 제도 > 전형 한눈에: 용어 설명).
//   - 전형별 비중 수치는 policy.json 행(related.policyRows)에 있어 화면이 거기서 읽는다. 여기서는 그 행이 policy.json에 있는지 확인한다.
//   - 초안이 없으면 빈 구조를 만든다(화면은 "아직 정리 중이에요").
// 사용: node tools/build-admission-types.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "research/data/admission-types-draft.json";
const draft = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, seasons: [], terms: [], overview: { columns: [], rows: [] }, related: { policyRows: [] } };
const policy = new Set(JSON.parse(readFileSync("portal/data/policy.json", "utf8")).map((r) => r.id));
const errs = [];
const tid = new Set();
for (const t of draft.terms) {
  if (tid.has(t.id)) errs.push(`terms: ${t.id} 중복`); tid.add(t.id);
  if (!["susi", "jeongsi"].includes(t.season)) errs.push(`${t.id}: season ${t.season}`);
  if (!t.name || !t.what) errs.push(`${t.id}: name·what 필요`);
}
for (const s of draft.seasons) { if (!s.name || !s.when) errs.push(`seasons ${s.id}: name·when 필요`); for (const c of s.contains || []) if (!tid.has(c)) errs.push(`seasons ${s.id}: contains ${c}가 terms에 없음`); }
const cols = draft.overview.columns.length;
for (const r of draft.overview.rows) if (r.length !== cols) errs.push(`overview: 행 "${r[0]}"의 칸 수 ${r.length} ≠ ${cols}`);
for (const id of draft.related?.policyRows || []) if (!policy.has(id)) errs.push(`related.policyRows: ${id}가 policy.json에 없음`);
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const out = { _meta: { note: "전형 한눈에(생성물, 손으로 고치지 않는다). research/data/admission-types-draft.json에서 tools/build-admission-types.mjs가 만든다. 전형별 비중 수치는 policy.json 행에서 읽는다.", checkedAt: draft._meta?.checkedAt ?? null, status: draft._meta?.status ?? null, source: draft._meta?.source ?? null }, seasons: draft.seasons, terms: draft.terms, overview: draft.overview, related: draft.related ?? { policyRows: [] } };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/admission-types.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("admission-types.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(`용어 ${draft.terms.length}개, 시기 ${draft.seasons.length}개, 비중 행 ${(draft.related?.policyRows || []).length}개`);
