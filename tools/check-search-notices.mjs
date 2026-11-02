// 검색 안내문 점검: "없어요/아직 없어요" 류 안내가 낡지 않았는지 데이터로 확인한다(portal/search-extra.js의 GAPS).
//   ① 안내가 가리키는 주제의 데이터가 있으면(found) 그 데이터로 연결해야 하고 '없음' 문구가 나오면 안 된다
//   ② 데이터가 없을 때만(none) '없음 + 다음 행동' 안내가 나온다
//   ③ search-extra.js 안의 '아직 없어요' 같은 문구는 none 항목에만 있어야 한다(하드코딩 금지)
// 사용: node tools/check-search-notices.mjs
import { readFileSync, existsSync } from "node:fs";
const { GAPS, gapDocs } = await import("../portal/search-extra.js");
const rd = (n) => (existsSync(`portal/data/${n}.json`) ? JSON.parse(readFileSync(`portal/data/${n}.json`, "utf8")) : null);
const D = { pol: rd("policy"), hc: rd("hs-compare"), mc: rd("middle-compare"), ev: rd("events"), mid: rd("middle")?.principles };
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
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
console.log(`OK: 검색 안내 ${GAPS.length}건(데이터 있음 ${docs.filter((d) => d.found).length}, 없음 안내 ${docs.filter((d) => !d.found).length})`);
