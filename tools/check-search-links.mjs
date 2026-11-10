// 검색 안내(search-extra.js의 모든 항목) 링크 점검: 각 안내의 링크를 실제로 열어(리다이렉트 반영) 문장 속 핵심 낱말(칸 이름·화면 이름·'작은따옴표'로 묶은 말·학생수/학급수/전화/출처 같은 값 낱말)이
// 도착 화면 본문에 있는지 본다. 안내가 말하는 값이 링크 화면에 없으면 실패한다. 쓰는 법: python3 -m http.server 8000 & node tools/check-search-links.mjs [http://localhost:8000/portal/]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const root = resolve(new URL("..", import.meta.url).pathname), require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = (process.argv[2] || "http://localhost:8000/portal/").replace(/\/?$/, "/");
const { loadSearchExtra } = await import(`${root}/portal/search-extra.js`);
const load = async (n) => JSON.parse(readFileSync(`${root}/portal/data/${n}.json`, "utf8"));
const docs = await loadSearchExtra(load);
const labels = new Set(); for (const f of ["hs-compare", "middle-compare"]) for (const x of (await load(f)).fields || []) { const w = String(x.label).replace(/\(.*$/, "").trim(); if (w.length >= 3 && w !== "학교 홈페이지" && w !== "학교알리미") labels.add(w); }
const FIXED = ["학생수", "학급수", "학급당 학생수", "교원수", "전화", "출처", "뜻", "교복", "급식", "진학", "교육과정", "입학 방식", "통학", "매점", "기숙사"];
const LEX = [...new Set([...labels, ...FIXED])];
const norm = (x) => String(x).replace(/\s+/g, "").replace(/ⓘ/g, "");
const b = await chromium.launch(), p = await (await b.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } })).newPage(), bad = [], cache = new Map(); let n = 0;
for (const d of docs) {
  const href = d.href; if (!href || !/^#[a-z]/.test(href) || d.term || href.startsWith("#home") || href.startsWith("#library/links")) continue;
  const text = `${d.t || ""} ${d.s || d.text || ""}`; if (!text.trim()) continue;
  const quoted = [...text.matchAll(/'([^']{2,24})'\s*(?:칸|화면|탭|구역|행|표|버튼)/g)].map((m) => m[1]); /* 출처 이름·문서 이름은 빼고, 화면의 칸·탭·구역·버튼 이름만 */ const lex = LEX.filter((w) => norm(text).includes(norm(w)));
  const want = [...new Set([...quoted, ...lex])]; if (!want.length) continue; n++;
  const key = href.replace(/[&?]hl=[^&]*/, ""); let body = cache.get(key);
  if (body == null) { await p.goto(base + href.replace(/[&?]hl=[^&]*/, "")); await p.waitForTimeout(1400); body = norm(await p.evaluate(() => { document.querySelectorAll("#main details").forEach((x) => (x.open = true)); return document.querySelector("#main").textContent; })); cache.set(key, body); }
  const miss = want.filter((w) => !body.includes(norm(w))); if (miss.length) bad.push(`${d.id || d.t}: '${d.t}' → ${href.slice(0, 60)} 본문에 ${miss.map((m) => `'${m}'`).join("·")} 없음`);
}
await b.close();
if (bad.length) { bad.forEach((x) => console.log("  ✗", x)); console.log(`실패 ${bad.length}/${n}건`); process.exit(1); }
console.log(`OK: 검색 안내 ${n}건의 핵심 낱말이 모두 링크 도착 화면에 있어요`);
