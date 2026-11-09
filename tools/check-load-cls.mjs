// 화면별 로드 CLS 점검: 주요 화면을 390·1440에서 새로 열어(RUNS회, 기본 3) CLS 최대를 잰다. THROTTLE=4면 CPU 4배(느린 기기). 0.1 초과면 실패, 0.03 초과는 주의로 표시.
// 쓰는 법: python3 -m http.server 8000 & RUNS=20 node tools/check-load-cls.mjs [http://localhost:8000/portal/]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = (process.argv[2] || "http://localhost:8000/portal/").replace(/\/?$/, "/"), RUNS = Number(process.env.RUNS || 3);
const ROUTES = ["home", "schedule?t=hs", "schedule?t=univ", "schedule?t=road", "schedule?t=life", "select/curriculum?v=types", "select/curriculum?v=univ", "select/curriculum?v=middle", "select/curriculum?v=schools&lv=high", "select/curriculum?v=schools&lv=high&g=%EC%83%9D%ED%99%9C", "select/curriculum?v=schools&lv=middle", "select/curriculum?v=schools&lv=high&show=map", "select/curriculum?v=hs&g=%EA%B8%B0%EB%B3%B8&in=tr&c=pl-011,pl-014", "select/curriculum?v=hs&g=%EA%B8%B0%EB%B3%B8&in=tr&c=pl-012,pl-014&col=%EC%84%B1%EB%B3%B5%EA%B3%A0%EB%93%B1%ED%95%99%EA%B5%90", "life/credit", "planner/plan", "admission/system", "admission/system?t=types", "changelog", "library", "library/sources"];
const b = await chromium.launch(), rows = [], bad = [];
for (const w of [390, 1440]) for (const r of ROUTES) { let max = 0; const vals = [];
  for (let i = 0; i < RUNS; i++) { const c = await b.newContext({ serviceWorkers: "block", viewport: { width: w, height: w === 390 ? 844 : 900 } }), p = await c.newPage(); if (process.env.THROTTLE) { const cdp = await c.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.THROTTLE) }); }
    await p.addInitScript(() => { window.__s = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__s += e.value; }).observe({ type: "layout-shift", buffered: true }); });
    await p.goto(`${base}#${r}`); await p.waitForTimeout(process.env.THROTTLE ? 4500 : 3000); const s = await p.evaluate(() => window.__s); vals.push(s); max = Math.max(max, s); await c.close(); }
  rows.push([w, r, max]); if (max > 0.1) bad.push(`${w}px ${r.slice(0, 80)} CLS 최대 ${max.toFixed(3)} (${vals.map((v) => v.toFixed(2)).join(" ")})`); }
await b.close();
const worst = rows.slice().sort((a, c) => c[2] - a[2]).slice(0, 6); console.log(`  · 화면 ${ROUTES.length}곳 × 390·1440 × ${RUNS}회${process.env.THROTTLE ? ` (CPU ${process.env.THROTTLE}배)` : ""}: CLS 최대 ${Math.max(...rows.map((x) => x[2])).toFixed(3)}, 0.03 초과 ${rows.filter((x) => x[2] > 0.03).length}곳`); worst.forEach((x) => console.log(`    ${x[2].toFixed(3)} ${x[0]}px ${x[1].slice(0, 70)}`));
if (bad.length) { bad.forEach((x) => console.log("  ✗", x)); console.log(`실패 ${bad.length}건`); process.exit(1); }
console.log("OK: 화면별 로드 CLS 0.1 이하");
