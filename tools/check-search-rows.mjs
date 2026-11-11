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
const TOK = /\d{4}\.\d{1,2}\.\d{1,2}|\d{4}\.\d{1,2}(?![\d.])|\d{4}년\s?\d{1,2}월|(?<![\d.])\d{1,2}\.\d{1,2}(?:~\d{1,2}(?:\.\d{1,2})?)?(?![\d.])|\d{5,}(?:명)?/;
const b = await chromium.launch(), p = await (await b.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } })).newPage(), cache = new Map(), bad = []; let n = 0;
for (const row of rows) {
  /* 제목·제목+본문 첫머리·본문 첫머리 세 가지로 찾아, 행 제목으로 나온 모든 결과(바로 안내·가이드 변형 포함)를 대조한다 */
  const found = []; for (const q of [row.title, `${row.title} ${String(row.body || "").slice(0, 14)}`, String(row.body || "").slice(0, 24)]) for (const [, l] of S.search(q)) for (const y of l) if ((y.t === row.title || String(y.t).startsWith(`${row.title} · `)) && y.href && /^#/.test(y.href) && !found.some((z) => z.href === y.href && z.t === y.t)) found.push(y);
  for (const item of found) {
  if (/^#home(?![a-z/])/.test(item.href) && TOK.test(String(item.s || ""))) { n++; bad.push(`${row.id} '${row.title.slice(0, 30)}' 요약에 값이 있는데 링크가 #home(값 없는 화면)이에요`); continue; }
  if (item.inline && TOK.test(String(row.body || "").replace(/\([^)]*\)/g, " ")) && !TOK.test(String(item.x || "").slice(0, 260).replace(/\([^)]*\)/g, " "))) { n++; bad.push(`${row.id} '${row.title.slice(0, 30)}' 결과가 직접 보여 주는 본문(inline)에 값(날짜·수)이 없어요(검색용 낱말 나열이 보이는지 확인): ${String(item.x || "").slice(0, 40)}`); continue; }
  if (item.inline && !item.note && !TOK.test(String(item.s || "").replace(/\(\s*[월화수목금토일]\s*\)/g, "").replace(/\([^)]*\)/g, " "))) { const key0 = item.href.replace(/[&?]hl=[^&]*/, ""); let b0 = cache.get(key0); if (b0 == null) { await p.goto(base + key0); await p.waitForTimeout(1300); b0 = norm((await p.evaluate(() => { document.querySelectorAll("#main details").forEach((x) => (x.open = true)); return document.querySelector("#main").textContent; })).replace(/\(\s*[월화수목금토일]\s*\)/g, "")); cache.set(key0, b0); } const wd = (String(item.x || "").slice(0, 90).replace(/\([^)]*\)/g, " ").match(/[가-힣]{3,}|\d+(?:\.\d+)+/g) || []), hit = wd.filter((w) => b0.includes(w)).length; /* 요약 앞 90자의 낱말·날짜가 도착 화면에 40% 이상 있어야(표기가 달라도 같은 내용) */ if (wd.length >= 3 && hit < Math.ceil(wd.length * 0.4)) { n++; bad.push(`${row.id} '${row.title.slice(0, 30)}' 결과 본문('${String(item.x).slice(0, 16)}…')의 낱말·날짜 ${hit}/${wd.length}만 ${key0.slice(0, 40)} 화면에 있는데 '결과에만 있어요' 안내가 없어요`); continue; } }
  const tok = TOK.exec(String(item.s || "").replace(/\(\s*[월화수목금토일]\s*\)/g, "").replace(/\([^)]*\)/g, " ")); /* 괄호 속 출처 날짜(보도 입력일 등)는 값이 아니다 */ if (!tok) continue; n++;
  const key = item.href.replace(/[&?]hl=[^&]*/, ""); let body = cache.get(key);
  if (body == null) { await p.goto(base + key); await p.waitForTimeout(1300); body = norm(await p.evaluate(() => { document.querySelectorAll("#main details").forEach((x) => (x.open = true)); return document.querySelector("#main").textContent; })); cache.set(key, body); }
  if (process.env.LIST) console.log(row.id, item.inline ? "inline" : "plain", body.includes(norm(tok[0])) ? "has" : "MISSING", tok[0], key.slice(0, 40));
  if (body.includes(norm(tok[0])) && item.note) bad.push(`${row.id} '${row.title.slice(0, 30)}' 요약의 '${tok[0]}'이 ${key.slice(0, 50)} 화면에 있는데 '결과에만 있어요' 안내(inline)가 붙었어요(거짓 안내)`);
  if (!body.includes(norm(tok[0])) && !item.note) bad.push(`${row.id} '${row.title.slice(0, 30)}' 요약의 '${tok[0]}'이 ${key.slice(0, 50)} 화면에 없는데 '결과에만 있어요' 안내(inline)가 없어요`);
  }
}
/* 요약 절단: 말줄임표 없이 천 단위 쉼표 중간(11,44 · 11,)에서 끝나는 요약을 용어·가이드·정책·검색 문서 전 행에서 찾는다 */
{ const cutBad = (where, t, s0) => { s0 = String(s0 || ""); if (/\d,\d{0,2}$/.test(s0) || /\d,…$/.test(s0) || s0.split("(").length > s0.split(")").length) { n++; bad.push(`${where} '${String(t).slice(0, 30)}' 요약이 숫자 중간에서 끊겼어요: …${s0.slice(-14)}`); } };
  for (const d of parts[5]) cutBad("검색 문서", d.t, d.s);
  for (const row of rows) cutBad("정책 행", row.title, row.summary || row.s);
  const isKw = (sg) => { const tk = String(sg).trim().split(/\s+/); return tk.length >= 4 && !/[\d.,;·()→~]/.test(sg) && tk.every((x) => x.length <= 7 && !/[다요고며서니음함은는을를에로의가도]$/.test(x)); }; /* 낱말 나열(검색용 키워드) 요약 */
  const seen = new Set(); for (const d of parts[5]) { if (seen.size > 400) break; for (const [, l] of S.search(d.t)) for (const y of l) { const k = `${y.t}|${y.s}`; if (seen.has(k)) continue; seen.add(k); if (isKw(y.s)) { n++; bad.push(`낱말 나열 요약 '${String(y.t).slice(0, 30)}': ${String(y.s).slice(0, 40)}`); } } }
  for (const q of ["논술전형", "수시 정시", "수능", "내신", "전형 비율", "모집인원", "응시자", "N수생", "지역균형", "학생부종합", "대교협", "정시 수능 위주 비율", "수시 모집인원 수도권"]) for (const [, l] of S.search(q)) for (const y of l) cutBad("결과", y.t, y.s); }
await b.close();
if (bad.length) { bad.slice(0, 40).forEach((x) => console.log("  ✗", x)); console.log(`실패 ${bad.length}/${n}건`); process.exit(1); }
console.log(`OK: 정책 행 ${n}건의 요약 값이 도착 화면에 있거나 '이 결과에만' 안내가 붙어 있어요`);
