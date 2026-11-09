// 화면 문구 전수 점검: 화면(23개 주소, 1440px, 접이식 모두 펼침)에서 '없어요·아직·찾지 못했어요·모으지 못했어요·확인하지 못했어요' 같은
// 부정·미비 문장을 모아 (1) 검토 목록(REVIEWED)에 없는 새 문장이면 실패(데이터와 대조한 뒤 목록에 추가), (2) 데이터에 따라 달라지는 문장은
// 술어(check)로 데이터와 1:1 대조한다(오래된 '아직 모으지 못했어요'가 새 데이터와 모순되는 것을 잡는다).
// 쓰는 법: python3 -m http.server 8000 & node tools/check-screen-claims.mjs [http://localhost:8000/portal/]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const root = resolve(new URL("..", import.meta.url).pathname), require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = (process.argv[2] || "http://localhost:8000/portal/").replace(/\/?$/, "/");
const data = (n) => JSON.parse(readFileSync(`${root}/portal/data/${n}.json`, "utf8"));
const policy = data("policy"), row = (id) => policy.find((r) => r.id === id);

// 검토한 문장(앞 일부) → { why: 근거, check?: 데이터 대조 술어(true면 문장이 사실) }
const REVIEWED = [
  { re: /학교별 입학설명회는 외고·국제고·자사고 설명회 날짜와 용인외대부고 본교 설명회만 모았어요/, why: "gg-22(외고·국제고·자사고 설명회 날짜)와 용인외대부고 본교 11.7 설명회가 정책 데이터에 있음", check: () => /외대부고/.test(JSON.stringify(row("gg-22") || "")) && !!row("gg-22") },
  { re: /추정은 아직 공고 전이라 바뀔 수 있어요/, why: "수능 일정 안내(미래 시점 진술)" },
  { re: /아직 확정 전인 날짜는 날짜 뒤에 예정이라고 붙여요/, why: "표기 규칙 설명" },
  { re: /다른 학교는 2027학년도 안내가 아직 없어 2026학년도 목록이 참고예요/, why: "middle-curriculum: 성복중만 2027, 나머지 학교는 2026 목록", check: () => { const d = data("middle-curriculum"); const by = (y) => d.schools.filter((s) => s.schoolYear === y).length; return by(2027) >= 1 && d.schools.length - by(2027) >= 1; } },
  { re: /2027학년도 신입생 안내가 게시된 학교는 아직 확인하지 못했어요/, why: "middle-guide(2026.11 조사 시점 진술, 데이터 기재 문장)" },
  { re: /조건에 맞는 항목이 없어요/, why: "필터 결과 빈 상태(동적)" },
  { re: /"–"는 아직 확인하지 못한 칸이에요/, why: "비교표 범례" },
  { re: /2026학년도 목록이며 2027학년도 안내는 아직 게시 전/, why: "middle-curriculum footnote(2026.10.26 확인 표기)" },
  { re: /학교별 입학설명회·학부모 설명회는 2026\.11\.2 기준 공고를 찾지 못함/, why: "날짜를 밝힌 조사 진술(gg-22는 외고·국제고·자사고 설명회라 이 문장과 범위가 다름)" },
  { re: /2027학년도 용인외대부고 모집요강은 2026\.11\.2 기준 공식 문서로 찾지 못함/, why: "날짜를 밝힌 조사 진술" },
  { re: /교육과정·면접·내신.{0,3}배점은 학교별 모집요강\(입학전형 시행계획\)에만 있고 학교알리미 공시 목록에 없어요/, why: "학교알리미 공시 항목 목록(46개) 대조 결과(hs-compare univStats nullReason과 같은 근거)" },
  { re: /페이지 본문에 이사·전입 서류는 적혀 있지 않아 확인하지 못함/, why: "middle-guide 조사 진술(교육지원청 안내 본문 기준, 문의처를 함께 안내)" },
  { re: /우리 집 주소로 배정 구역을 바로 알려 주는 기능은 아직 없어요/, why: "기능 진술(주소 입력 기능 없음)" },
  { re: /일부 과목은 석차등급.{0,3}이 없어요/, why: "성취평가제 과목 설명" },
];

const ROUTES = ["home", "schedule?t=hs", "schedule?t=univ", "schedule?t=road", "schedule?t=life", "select/curriculum?v=middle", "select/curriculum?v=schools&lv=middle", "select/curriculum?v=schools&lv=middle&show=map", "select/curriculum?v=schools&lv=high", "select/curriculum?v=schools&lv=high&show=subj", "select/curriculum?v=schools&lv=high&show=map", "select/curriculum?v=types", "select/curriculum?v=univ", "life/credit", "planner/plan", "admission/system", "admission/system?t=types", "changelog", "library", "library/sources", "library/files", "library/settings", "library/links"];
const PAT = /없어요|아직|찾지 못|모으지 못|확인 못|확인하지 못|정리 중|준비 중|공개하지 않|비어 있/;
const b = await chromium.launch(), c = await b.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } }), p = await c.newPage();
const found = new Map();
for (const r of ROUTES) {
  await p.goto(`${base}#${r}`); await p.waitForTimeout(2800);
  const t = await p.evaluate(() => { document.querySelectorAll("#main details").forEach((d) => (d.open = true)); return document.querySelector("#main").innerText; });
  for (const s of t.split(/\n/)) for (const x of s.split(/(?<=[.요다])\s+/)) { const k = x.trim(); if (k.length > 6 && PAT.test(k)) { (found.get(k) || found.set(k, new Set()).get(k)).add(r); } }
}
await b.close();
const bad = [], ok = [];
for (const [k, routes] of found) {
  const rv = REVIEWED.find((x) => x.re.test(k) || x.re.test([...found.keys()].filter((y) => y !== k && k.length < 40 && y.includes(k)).join(" ")));
  if (!rv) { bad.push(`검토 안 된 문장: '${k.slice(0, 90)}' (${[...routes][0]})`); continue; }
  if (rv.check && !rv.check()) { bad.push(`데이터와 어긋난 문장: '${k.slice(0, 80)}' — ${rv.why}`); continue; }
  ok.push(`${rv.check ? "데이터 대조" : "검토"}: ${k.slice(0, 50)}`);
}
for (const l of ok) console.log("  ✓", l);
if (bad.length) { for (const l of bad) console.log("  ✗", l); console.log(`실패 ${bad.length}건 / 문장 ${found.size}개`); process.exit(1); }
console.log(`OK: 화면 ${ROUTES.length}곳의 부정·미비 문장 ${found.size}개를 모두 검토 목록·데이터와 대조`);
