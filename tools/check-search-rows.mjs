// 검색 결과 정책 행 점검: 모든 정책 행(policy.json)을 제목으로 검색해 나온 결과 행의 요약(s) 속 첫 날짜·큰 수가, 그 행이 가리키는 도착 화면 본문에 실제 있는지 본다.
// 값이 없는 화면으로 가는 행은 결과 안에 '이 결과의 본문에만 있어요' 안내(inline 행)가 붙어야 한다. 쓰는 법: python3 -m http.server 8000 & node tools/check-search-rows.mjs [http://localhost:8000/portal/]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const root = resolve(new URL("..", import.meta.url).pathname), require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = (process.argv[2] || "http://localhost:8000/portal/").replace(/\/?$/, "/");
const { makeSearcher, buildSearchData } = await import(`${root}/portal/search.js`), { loadSearchExtra } = await import(`${root}/portal/search-extra.js`);
const load = async (n) => JSON.parse(readFileSync(`${root}/portal/data/${n}.json`, "utf8")), st = { get: (k, d) => d, set() {} };
const parts = await Promise.all([load("policy"), load("summary"), load("links"), load("subject-info"), load("places"), loadSearchExtra(load)]), S = makeSearcher(st); S.setData(buildSearchData(parts, st));
const pol = parts[0], rows = pol.items || pol.policy || (Array.isArray(pol) ? pol : Object.values(pol));
const norm = (x) => String(x).replace(/\s+/g, "").replace(/ⓘ/g, "").replace(/(\d),(?=\d{3})/g, "$1");
const TOK = /\d{4}\.\d{1,2}\.\d{1,2}|\d{1,2}\.\d{1,2}(?:~\d{1,2}(?:\.\d{1,2})?)?|\d{4,}(?:명)?/;
const b = await chromium.launch(), p = await (await b.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } })).newPage(), cache = new Map(), bad = []; let n = 0;
for (const row of rows) {
  const res = S.search(row.title), item = res.flatMap(([, l]) => l).find((y) => y.t === row.title); if (!item || !item.href || !/^#/.test(item.href)) continue;
  const tok = TOK.exec(String(item.s || "").replace(/\(\s*[월화수목금토일]\s*\)/g, "")); if (!tok) continue; n++;
  const key = item.href.replace(/[&?]hl=[^&]*/, ""); let body = cache.get(key);
  if (body == null) { await p.goto(base + key); await p.waitForTimeout(1300); body = norm(await p.evaluate(() => { document.querySelectorAll("#main details").forEach((x) => (x.open = true)); return document.querySelector("#main").textContent; })); cache.set(key, body); }
  if (!body.includes(norm(tok[0])) && !item.inline) bad.push(`${row.id} '${row.title.slice(0, 30)}' 요약의 '${tok[0]}'이 ${key.slice(0, 50)} 화면에 없는데 '결과에만 있어요' 안내(inline)가 없어요`);
}
await b.close();
if (bad.length) { bad.slice(0, 40).forEach((x) => console.log("  ✗", x)); console.log(`실패 ${bad.length}/${n}건`); process.exit(1); }
console.log(`OK: 정책 행 ${n}건의 요약 값이 도착 화면에 있거나 '이 결과에만' 안내가 붙어 있어요`);
