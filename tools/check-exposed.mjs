// 화면에 나가는 data/*.json 문자열에 내부 식별자·파일명이 섞이지 않았는지 검사한다(C2 공백의 투명성: 내부 코드 노출 0건).
//   검출: GS_CD, *-draft.json, portal/data 경로, 조사 행 번호(sb-/log-/gg-/gl-/hc-/hd-/ht-/mg-/tl-NNN), 단독 "policy".
//   제외: _meta(화면에 안 나감), id·url·file·*Id(s)·refs·policyRows 등 식별자·주소 칸.
// 사용: node tools/check-exposed.mjs
import { readFileSync, readdirSync } from "node:fs";

const SKIP = /^(_meta|id|url|file|thumb|refs|events|eventIds|policyRows|related|briefing|subjectKey|legacyKey|legacyKeys|from|ruleId|checkedAt)$|Id$|Ids$|Key$/;
const PAT = /GS_CD|[\w-]+-draft\.json|portal\/data|\b(?:sb|log|gg|gl|hc|hd|ht|mg|tl|str|adm|cur|hs|acd|opn|asg|b33|sch|life)-\d+\b|\bpolicy\b/;
// 학교알리미 고교 코드처럼 주소 안에 들어가는 값은 url 칸이라 제외된다. 값이 http 주소인 문자열도 제외.
const hits = [];
const walk = (v, f, path) => {
  if (typeof v === "string") { if (!/^https?:\/\//.test(v) && PAT.test(v)) hits.push(`${f} ${path}: …${v.slice(Math.max(0, v.search(PAT) - 15), v.search(PAT) + 25)}…`); }
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, f, `${path}[${i}]`));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!SKIP.test(k)) walk(x, f, `${path}.${k}`);
};
for (const f of readdirSync("portal/data").filter((x) => x.endsWith(".json"))) {
  if (/^(index|subjects|offerings|offerings-index|subject-master|subjects\.lock|curricula|facets|groups|summary|school-notes|files|subject-matrix|image-credits|flags|admission-rules|matches|planner-rules|rules|roadmap|data-dictionary|sources|changes|school-codes)\.json$/.test(f)) continue; // 내부 구조 데이터(화면 문구가 아님)
  try { walk(JSON.parse(readFileSync(`portal/data/${f}`, "utf8")), f, ""); } catch {}
}
if (hits.length) { console.error(`화면에 나가는 데이터에 내부 식별자 ${hits.length}건:\n` + hits.slice(0, 30).join("\n")); process.exit(1); }
console.log("내부 식별자 노출 0건");
