// 위치·사유를 말하는 문장 점검 3종 (Playwright): ① '○○ 화면에 있어요/일정 목록에 있어요' 류 위치 문장이 가리키는 화면을 실제로 열어 핵심 값이 있는지(등록부)
// + portal/*.js에 등록부에 없는 새 위치 문장이 생기면 실패, ② 검색이 만드는 안내 문장(univ-result)의 숫자·구분을 hs-compare.json과 1:1 대조,
// ③ 비교표에서 학교 조합을 바꿔 (수지구 5교 기본 + 열지 않은 학교 추가) 빈 칸 사유가 학교별 nullReason과 맞는지.
// 쓰는 법: python3 -m http.server 8000 & node tools/check-location-claims.mjs [http://localhost:8000/portal/]
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const root = resolve(new URL("..", import.meta.url).pathname), require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = (process.argv[2] || "http://localhost:8000/portal/").replace(/\/?$/, "/");
const data = (n) => JSON.parse(readFileSync(`${root}/portal/data/${n}.json`, "utf8"));
const bad = [], ok = [];
// ① 위치 문장 등록부: 문장(앞 일부) → 가리키는 화면 주소와 그 화면에 있어야 하는 값
const LOC = [
  { phrase: "(일정 목록에 있어요)", screen: "고교 일정", route: "schedule?t=hs", need: [/수원외고 설명회/, /안양외고[^\n]*설명회/, /동탄국제고 설명회/, /외대부고 본교 설명회/] },
  { phrase: "고교 종류 화면에 있어요", screen: "고교 종류", route: "select/curriculum?v=types", need: [/외·국·자|외고·국제고·자사고/] },
  { phrase: "빈 칸의 사유", route: "select/curriculum?v=schools&lv=high&g=%EC%A7%84%ED%95%99", need: [/빈 칸 \d+곳의 사유/, /대학 진학 현황/] },
  { phrase: "고교 일정 화면에서 고입 전형 일정", screen: "고교 일정", route: "schedule?t=hs", need: [/전형/, /원서접수/] },
  { phrase: "중학교 일정 화면에서 배정·입학 일정", screen: "중학교 일정", route: "schedule?t=life", need: [/배정/, /입학/] },
  { phrase: "배정·입학 준비 화면에서 학교를 고르면 학교군", screen: "배정·입학 준비", route: "select/curriculum?v=middle", need: [/학교군/, /갈 수 있는 중학교/] },
  { phrase: "대학 요건 화면에서 모집단위별", screen: "대학 요건", route: "select/curriculum?v=univ", need: [/모집단위/, /필수|권장/] },
  { phrase: "학교 보기 화면에서 설명회 노트", screen: "학교 보기", route: "select/curriculum?v=schools&lv=high", need: [/설명회 노트/] },
  { phrase: "'고교 일정' 화면의 '대학 입시' 탭에서(수능 날짜)", screen: "고교 일정", route: "schedule?t=univ", need: [/2029\.11\.15/, /수능/] },
];
const files = readdirSync(`${root}/portal`).filter((f) => f.endsWith(".js"));
const PHR = /[가-힣·\s]{0,12}(?:화면|목록)에 있어요/g, found = new Map();
for (const f of files) { const src = readFileSync(`${root}/portal/${f}`, "utf8"); for (const m of src.matchAll(PHR)) found.set(m[0].trim(), f); }
const CLAIM = /([가-힣·]+(?: [가-힣·]+)?) 화면(?:의 '([^']+)' 탭)?에서 ([^.'"`\n]{2,30}?) ?(볼 수 있어요|있어요|확인해요|확인할 수 있어요|나와요|알 수 있어요)/g, IGN = /^(일정은 일정|인쇄)$/;
for (const f of files) { const src = readFileSync(`${root}/portal/${f}`, "utf8"); src.split("\n").forEach((l, i) => { for (const m of l.replace(/\/\*.*?\*\//g, " ").matchAll(CLAIM)) { const scr = m[2] ? "고교 일정" : m[1]; if (IGN.test(m[1])) continue; if (!LOC.some((x) => x.screen === scr)) bad.push(`등록 안 된 '○○ 화면에서 …' 문장: '${m[0].slice(0, 50)}' (${f}:${i + 1}) — LOC에 screen '${scr}'를 등록`); } }); }
const KNOWN_OTHER = [/^(배정·입학 준비|학교 보기|고교 종류|일정|비교|학교 비교|고교 일정|중학교 일정) 화면에 있어요$/]; // 다른 점검(check-menu-captions·check-screen-claims)이 보는 일반 안내
for (const [ph, f] of found) if (!LOC.some((l) => ph.includes(l.phrase.replace(/[()]/g, "")) || l.phrase.includes(ph)) && !KNOWN_OTHER.some((r) => r.test(ph))) bad.push(`등록 안 된 위치 문장: '${ph}' (${f}) — 가리키는 화면의 값을 확인하고 tools/check-location-claims.mjs LOC에 등록`);
const b = await chromium.launch(), c = await b.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } }), p = await c.newPage();
for (const l of LOC) {
  await p.goto(`${base}#${l.route}`); await p.waitForTimeout(2600);
  const t = await p.evaluate(() => { document.querySelectorAll("#main details").forEach((d) => (d.open = true)); return document.querySelector("#main").innerText; });
  for (const re of l.need) if (!re.test(t)) bad.push(`위치 문장 '${l.phrase}' → ${l.route} 화면에 ${re} 이(가) 없어요`);
  ok.push(`위치 문장 '${l.phrase}' → ${l.route}: 값 ${l.need.length}개 확인`);
}
// ② 검색 안내 univ-result
{
  const { gapDocs } = await import(`${root}/portal/search-extra.js`), hc = data("hs-compare"), d = gapDocs({ pol: [], hc, mc: data("middle-compare") }).find((g) => g.gap === "univ-result");
  const vals = hc.schools.map((s) => s.values.univStats), has = vals.filter((v) => v && v.value != null && v.value !== "").length, empty = vals.length - has, open = vals.filter((v) => !(v && v.value != null && v.value !== "") && /열어 보지 못|직접 확인이 필요/.test(v?.nullReason || "")).length;
  const s = d?.s || "";
  if (!s.includes(`고교 ${hc.schools.length}곳 중 ${has}곳만 값이 있어요`)) bad.push(`univ-result 숫자가 데이터와 달라요: ${s.slice(0, 80)}`);
  if (open && !s.includes(`${open}곳은 아직 열어 보지 못해`) && !s.includes(`빈 칸 ${open}곳은 학교알리미를 아직 열어 보지 못해`)) bad.push(`univ-result가 '열어 보지 못한' ${open}곳을 말하지 않아요: ${s.slice(0, 160)}`);
  if (!open && /열어 보지 못/.test(s)) bad.push("univ-result가 데이터에 없는 '열어 보지 못함'을 말해요");
  if (empty - open > 0 && open && !s.includes(`${empty - open}곳은 학교알리미 공시 목록에 그 항목이 없고`)) bad.push(`univ-result가 '공시 목록에 없음' ${empty - open}곳을 말하지 않아요`);
  ok.push(`univ-result: 값 ${has}곳·빈 칸 ${empty}곳(열어 보지 못함 ${open})을 데이터와 대조`);
}
// ②-b 검색이 만드는 '값이 있는 개수' 문장: 대학별 '○개 전형·모집단위의 …' 개수는 규칙 전체가 아니라 requirements가 비어 있지 않은 규칙 수여야 하고, 0이면 개수 문장이 아니라 '아직 찾지 못했어요' 안내여야 한다
{
  const { loadSearchExtra } = await import(`${root}/portal/search-extra.js`), load = async (n) => data(n);
  const docs = await loadSearchExtra(load), rules = data("admission-rules").rules, uns = data("universities").universities; let nu = 0;
  for (const u of uns) {
    const want = rules.filter((r) => r.universityId === u.id && Array.isArray(r.requirements) && r.requirements.length > 0).length, all = rules.filter((r) => r.universityId === u.id).length, ds = docs.filter((d) => d.t === `${u.name} · 과목 요건(대학 요건)`); if (!all) continue; nu++;
    if (!ds.length) { bad.push(`${u.name}: 대학 요건 검색 행이 없어요`); continue; }
    for (const d of ds) { const m = /^(\d+)개 전형/.exec(d.s || ""); if (want && (!m || Number(m[1]) !== want)) bad.push(`${u.name}: 개수 문장이 '값이 있는 ${want}개'와 달라요 → ${(d.s || "").slice(0, 60)}`); if (!want && (m || /\d+개 전형/.test(d.s || ""))) bad.push(`${u.name}: 요건이 하나도 없는데 개수를 말해요 → ${(d.s || "").slice(0, 60)}`); }
  }
  ok.push(`대학 요건 개수 문장 ${nu}개 대학을 requirements가 있는 규칙 수와 대조`);
}
// ②-c 화면에 따로 그려지지 않는 행(NO_HL: sch-04·hs-11·log-13·b33-06)과 2028 참고 행: 도착 화면에 값이 없으면 검색 결과에서 본문이 바로 보여야 한다(결과 항목 inline + 본문 앞 260자에 핵심 값)
{
  const { makeSearcher, buildSearchData, NO_HL } = await import(`${root}/portal/search.js`), { loadSearchExtra } = await import(`${root}/portal/search-extra.js`), load = async (n) => data(n), store = { get: (k, d) => d, set() {} };
  const parts = await Promise.all([load("policy"), load("summary"), load("links").catch(() => ({ items: [] })), load("subject-info").catch(() => ({ subjects: [] })), load("places"), loadSearchExtra(load)]), S = makeSearcher(store); S.setData(buildSearchData(parts, store));
  let nn = 0;
  for (const id of NO_HL) { const row = parts[0].find((r) => r.id === id); if (!row) continue; nn++;
    const key = (row.body || "").match(/\d[\d.~()월화수목금토일]*\d|\d{2,}/)?.[0] || row.title, flat = S.search(row.title).flatMap(([, l]) => l), hit = flat.find((x) => x.t === row.title);
    if (!hit) { bad.push(`NO_HL ${id}: 제목으로 검색해도 행이 안 나와요`); continue; }
    if (!`${hit.inline ? hit.x || "" : ""} ${hit.s || ""}`.slice(0, 300).includes(key)) bad.push(`NO_HL ${id}(${row.title}): 결과에 본문이 바로 보이지 않아요(핵심 값 '${key}')`); }
  ok.push(`화면에 안 그려지는 행 ${nn}건: 검색 결과에서 본문(핵심 값)이 바로 보임`);
}
// ③ 비교표 학교 조합별 빈 칸 사유
{
  const hc = data("hs-compare"), reasonOf = (name) => hc.schools.find((s) => s.name === name)?.values?.univStats?.nullReason || "";
  const names = hc.schools.map((s) => s.name), combos = [[], names.filter((n) => /구성고|기흥고/.test(n)).slice(0, 2), names.filter((n) => !/풍덕|성복|죽전|수지|신봉/.test(n)).slice(0, 3)];
  for (const add of combos) {
    const cx = await b.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } }), pg = await cx.newPage(); /* 조합마다 새 저장소(앞 조합의 선택이 남지 않게) */
    await pg.goto(`${base}#select/curriculum?v=schools&lv=high&g=%EC%83%9D%ED%99%9C`); await pg.waitForTimeout(2600);
    if (add.length && (await pg.locator("[data-add]:disabled").count())) for (let i = 0; i < add.length; i++) { await pg.locator("[data-rm]").first().click(); await pg.waitForTimeout(300); } /* 최대 개수면 앞쪽 학교를 빼서 자리를 만든다 */
    for (const n of add) { await pg.evaluate(() => { const d = document.querySelector("details.cmp-add"); if (d) d.open = true; }); const btn = pg.locator(`[data-add]`, { hasText: n }).first(); if (await btn.count()) { await btn.click(); await pg.waitForTimeout(400); } }
    const shown = await pg.evaluate(() => [...document.querySelectorAll("table.cmp-tbl thead th.cmp-s a")].map((a) => a.textContent.trim()));
    const gaps = await pg.evaluate(() => { document.querySelectorAll("details.cmp-gaps").forEach((d) => (d.open = true)); return document.querySelector(".cmp-gaps")?.innerText || ""; });
    const row = (gaps.split("\n").find((l) => l.startsWith("대학 진학 현황")) || "").replace(/ⓘ/g, "");
    const want = [...new Set(shown.map((n) => reasonOf(n)).filter(Boolean))];
    for (const w of want) if (!row.includes(w.replace(/ⓘ/g, "").slice(0, 25))) bad.push(`비교표 [${shown.join("·")}] '대학 진학 현황' 사유에 학교 데이터 사유 '${w.slice(0, 30)}…'가 없어요 → ${row.slice(0, 90)}`);
    await cx.close(); ok.push(`비교표 조합 [${shown.length}교${add.length ? " +" + add.join("·") : " 기본"}] 진학 사유 ${want.length}종 대조`);
  }
}
await b.close();
for (const l of ok) console.log("  ✓", l);
if (bad.length) { for (const l of bad) console.log("  ✗", l); console.log(`실패 ${bad.length}건`); process.exit(1); }
console.log(`OK: 위치 문장 ${LOC.length}종·검색 생성 문장·비교표 조합 점검 통과`);
