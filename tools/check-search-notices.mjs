// 검색 안내문 점검: "없어요/아직 없어요" 류 안내가 낡지 않았는지 데이터로 확인한다(portal/search-extra.js의 GAPS).
//   ① 안내가 가리키는 주제의 데이터가 있으면(found) 그 데이터로 연결해야 하고 '없음' 문구가 나오면 안 된다
//   ② 데이터가 없을 때만(none) '없음 + 다음 행동' 안내가 나온다
//   ③ search-extra.js 안의 '아직 없어요' 같은 문구는 none 항목에만 있어야 한다(하드코딩 금지)
// 사용: node tools/check-search-notices.mjs
import { readFileSync, existsSync } from "node:fs";
const { GAPS, gapDocs } = await import("../portal/search-extra.js");
const rd = (n) => (existsSync(`portal/data/${n}.json`) ? JSON.parse(readFileSync(`portal/data/${n}.json`, "utf8")) : null);
const D = { pol: rd("policy"), hc: rd("hs-compare"), mc: rd("middle-compare"), ev: rd("events"), mid: rd("middle")?.principles, el: rd("electives")?.items, tl: rd("timeline")?.events, places: rd("places")?.places?.length, gl: rd("glossary")?.terms?.length };
const errs = [], NONE = /아직 없어요|이 포털에 없|아직 모으지|값은 없어요|없어요 →/;
const docs = gapDocs(D), by = new Map(docs.map((d) => [d.gap, d]));
for (const g of GAPS) {
  const f = g.found(D), d = by.get(g.id);
  if (f) { if (!d || !d.found) errs.push(`${g.id}: 데이터가 있는데 연결하지 않음`); else if (NONE.test(d.s)) errs.push(`${g.id}: 데이터가 있는데 안내에 '없음' 문구 — ${d.s}`); }
  else if (g.none && (!d || d.found)) errs.push(`${g.id}: 데이터가 없는데 없음 안내가 없음`);
  if (!f && !g.none && d) errs.push(`${g.id}: 데이터도 없음 안내도 없는데 문서가 나옴`);
}
// ③ 하드코딩된 '없음' 문구는 GAPS의 none 항목 줄에만
const src = readFileSync("portal/search-extra.js", "utf8").split("\n");
src.forEach((l, i) => { if (!/^\s*\/\//.test(l) && NONE.test(l) && !/none:/.test(l)) errs.push(`search-extra.js ${i + 1}행: '없음' 문구가 none 항목 밖에 있음 — 데이터를 확인해 쓰세요`); });
// ④ 안내 문구의 숫자(○곳·○개교)가 연결한 데이터의 개수와 맞는지: 학교 수는 데이터에서 센 값만 허용한다
{
  const elBy = new Map(); for (const x of D.el || []) elBy.set(x.placeId, (elBy.get(x.placeId) || false) || !x.nullReason);
  const elN = [...elBy.values()].filter(Boolean).length, elM = elBy.size - elN;
  const vc = (d, k) => (d?.schools || []).filter((x) => x.values?.[k] && x.values[k].value != null && x.values[k].value !== "").length; /* 칸별로 값이 있는 학교 수(규모·교육과정·진학)도 데이터에서 센 값 */
  const allowed = new Set([D.hc?.schools?.length, D.mc?.schools?.length, D.places, elN, elM, vc(D.hc, "students"), vc(D.hc, "curriculum"), vc(D.hc, "univStats")].filter((n) => Number.isFinite(n) && n > 0));
  const COUNT_IDS = new Set(["el-count", "other-region", "school-map", "compare-general", "hs-list", "uniform", "meal-mid", "commute"]); // 학교 수를 문구에 쓰는 안내(정책 행 본문에서 가져온 숫자는 제외)
  const ALLOW_FIXED = { "near5-list": [5] }; // 규칙상 고정 숫자(근거리 중학교 5곳)
  for (const d of docs.filter((x) => COUNT_IDS.has(x.gap))) for (const m of (d.t + " " + d.s).matchAll(/(\d+)\s?(곳|개교)/g)) { const n = Number(m[1]); if (!allowed.has(n) && !(ALLOW_FIXED[d.gap] || []).includes(n)) errs.push(`${d.gap}: 안내의 '${m[0]}'이 연결 데이터 개수(${[...allowed].join("·")})와 맞지 않음`); }
  const el = docs.find((d) => d.gap === "el-count");
  if (el && !(el.s.includes(`값이 있는 학교 ${elN}곳`) && (elM ? el.s.includes(`나머지 ${elM}곳`) : true))) errs.push(`el-count: '값이 있는 학교 ${elN}곳, 나머지 ${elM}곳'과 다름 — ${el.s}`);
  // 소스에 개수를 직접 적은 곳(${...} 밖의 ○곳·○개교)은 근거리 5곳 규칙 줄만 허용
  src.forEach((l, i) => { if (/^\s*\/\//.test(l)) return; const bare = l.replace(/\$\{[^}]*\}/g, ""); if (/\d+\s?(곳|개교)/.test(bare) && !/id: "near5-list"/.test(l)) errs.push(`search-extra.js ${i + 1}행: 학교 수를 직접 적었어요 — 데이터에서 세어 쓰세요`); });
}
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
console.log(`OK: 검색 안내 ${GAPS.length}건(데이터 있음 ${docs.filter((d) => d.found).length}, 없음 안내 ${docs.filter((d) => !d.found).length})`);
