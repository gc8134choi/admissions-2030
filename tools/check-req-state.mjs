// 대학 요건 화면의 요건 문구 전수 점검: 요건이 있는 규칙마다 화면에 보이는 요건 항목이 데이터의 원문 문구(orGroupLabel)와 같고, 데이터에 없는 단위('N과목 이상')가 덧붙지 않는지 본다.
// (minCount는 과목 매칭 계산에만 쓰고 화면 문구에는 쓰지 않는다.) 쓰는 법: python3 -m http.server 8000 & node tools/check-req-state.mjs [http://localhost:8000/portal/]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const root = resolve(new URL("..", import.meta.url).pathname), require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = (process.argv[2] || "http://localhost:8000/portal/").replace(/\/?$/, "/");
const rules = JSON.parse(readFileSync(`${root}/portal/data/admission-rules.json`, "utf8")).rules, matched = new Set(JSON.parse(readFileSync(`${root}/portal/data/matches.json`, "utf8")).matches.filter((m) => m.summary).map((m) => m.ruleId));
const norm = (s) => String(s).replace(/ⓘ/g, "").replace(/\s+/g, "");
const b = await chromium.launch(), p = await (await b.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } })).newPage(), bad = []; let nq = 0, nr = 0;
for (const uid of [...new Set(rules.map((r) => r.universityId))]) {
  await p.goto(`${base}#select/curriculum?v=univ&u=${encodeURIComponent(uid)}`); await p.waitForTimeout(1500);
  for (const r of rules.filter((x) => x.universityId === uid)) { nr++;
    const chip = p.locator(`button.chip[data-k="rule"][data-v="${r.ruleId}"]`); if (!(await chip.count())) { bad.push(`${r.ruleId}: 모집단위 칩이 없어요`); continue; } await chip.first().click(); await p.waitForTimeout(350);
    const txt = norm(await p.evaluate(() => document.querySelector("#main").textContent)), items = (await p.evaluate(() => [...document.querySelectorAll(".um-req li")].map((x) => x.innerText))).map(norm);
    for (const w of ["sourcePage", "다음 행동", "키워드"]) if (txt.includes(w)) bad.push(`${r.ruleId}: 작업 용어 '${w}'가 화면에 보여요`);
    for (const q of r.requirements) { nq++; const lab = norm(q.orGroupLabel || "");
      if (!txt.includes(lab.slice(0, 40))) bad.push(`${r.ruleId}: 요건 문구가 화면에 없어요 → ${String(q.orGroupLabel).slice(0, 40)}`);
      if (!matched.has(r.ruleId)) { const li = items.find((x) => x.includes(lab.slice(0, 20))); if (!li) bad.push(`${r.ruleId}: 요강 문구 목록에 없어요 → ${String(q.orGroupLabel).slice(0, 30)}`); else { const extra = li.replace(/^(필수|권장|참고)·/, "").slice(lab.length); if (extra) bad.push(`${r.ruleId}: 원문에 없는 꼬리가 붙었어요 → '${extra.slice(0, 20)}' (${String(q.orGroupLabel).slice(0, 20)}…)`); } }
      if (txt.includes(lab) && new RegExp(lab.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\(\\d+과목이상\\)").test(txt)) bad.push(`${r.ruleId}: 원문 뒤에 '(N과목 이상)'을 덧붙였어요`); } }
}
await b.close();
if (bad.length) { bad.slice(0, 30).forEach((x) => console.log("  ✗", x)); console.log(`실패 ${bad.length}건`); process.exit(1); }
console.log(`OK: 요건이 있는 규칙 ${nr}개·요건 항목 ${nq}개의 화면 문구가 원문(orGroupLabel)과 같고 파생 단위가 없어요`);
