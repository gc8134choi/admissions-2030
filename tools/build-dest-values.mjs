// 검색 결과 '본문에만 있어요' 안내 자동 판정용: 정책 행이 가리키는 도착 화면(routeOf)마다 본문 속 값 토큰(날짜·큰 수, portal/val-tokens.js 정규화)을 모아 portal/data/dest-values.json에 쓴다.
// 쓰는 법: python3 -m http.server 8000 & node tools/build-dest-values.mjs [주소] [--check]   (--check: 파일이 최신인지만 확인, 다르면 종료코드 1)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const root = resolve(new URL("..", import.meta.url).pathname), require = createRequire(import.meta.url), { chromium } = require("playwright");
const args = process.argv.slice(2), check = args.includes("--check"), base = (args.find((a) => /^http/.test(a)) || "http://localhost:8000/portal/").replace(/\/?$/, "/");
const { routeOf } = await import(`${root}/portal/search.js`), { valTokens, phraseMissing } = await import(`${root}/portal/val-tokens.js`);
const pol = JSON.parse(readFileSync(`${root}/portal/data/policy.json`, "utf8")), rows = pol.items || pol.policy || (Array.isArray(pol) ? pol : Object.values(pol));
const routes = [...new Set(rows.map((r) => routeOf(r)).filter(Boolean))].sort();
const byRoute = new Map(); for (const r of rows) { const rt = routeOf(r); if (rt) (byRoute.get(rt) || byRoute.set(rt, []).get(rt)).push(r); }
const phrase = {};
const b = await chromium.launch(), p = await (await b.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } })).newPage(), out = {};
for (const rt of routes) { await p.goto(base + rt); await p.waitForTimeout(1400); const t = await p.evaluate(() => { document.querySelectorAll("#main details").forEach((x) => (x.open = true)); return document.getElementById("main")?.textContent || document.body.textContent; }); out[rt] = [...valTokens(t)].sort(); for (const r of byRoute.get(rt) || []) if (phraseMissing(r.body, t)) (phrase[rt] ||= []).push(r.title); }
await b.close();
const file = `${root}/portal/data/dest-values.json`, json = JSON.stringify({ note: "생성물: 검색 결과가 가리키는 도착 화면별 값 토큰. 손으로 고치지 않는다.", routes: out, phrase }, null, 1) + "\n";
if (check) { let cur = ""; try { cur = readFileSync(file, "utf8"); } catch {} const cj = JSON.parse(cur || "{}"), a = cj.routes || {}, bad = routes.filter((rt) => JSON.stringify(a[rt]) !== JSON.stringify(out[rt]) || JSON.stringify((cj.phrase || {})[rt] || []) !== JSON.stringify(phrase[rt] || [])); if (bad.length) { console.log(`✗ dest-values.json이 오래됐어요(${bad.length}개 화면): ${bad.join(", ")} → node tools/build-dest-values.mjs`); process.exit(1); } console.log(`OK: dest-values.json 최신(${routes.length}개 도착 화면)`); }
else { writeFileSync(file, json); console.log(`쓴 곳: portal/data/dest-values.json (${routes.length}개 도착 화면, 토큰 ${Object.values(out).reduce((n, a) => n + a.length, 0)}개)`); }
