// hl 링크 CLS·재이동 측정: 검색이 만드는 hl 링크(고교 비교·편제표·정책 행 등) 40개를 390·1440에서 열어 CLS 최대·0.1 초과 수와 도착 뒤 60px+ 재이동 수를 센다.
// 쓰는 법: python3 -m http.server 8000 & node tools/check-hl-cls.mjs [http://localhost:8000/portal/] [개수=40]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const root = resolve(new URL("..", import.meta.url).pathname), require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = (process.argv[2] || "http://localhost:8000/portal/").replace(/\/?$/, "/"), N = Number(process.argv[3] || 40);
const { makeSearcher, buildSearchData } = await import(`${root}/portal/search.js`), { loadSearchExtra } = await import(`${root}/portal/search-extra.js`);
const load = async (n) => JSON.parse(readFileSync(`${root}/portal/data/${n}.json`, "utf8")), store = { get: (k, d) => d, set() {} };
const parts = await Promise.all([load("policy"), load("summary"), load("links"), load("subject-info"), load("places"), loadSearchExtra(load)]), S = makeSearcher(store); S.setData(buildSearchData(parts, store));
const qs = ["풍덕고 교복", "홍천고 매점", "성복고 설명회", "수지고 주소", "신봉고 학생수", "구성고 교복", "기흥고 설명회", "풍덕중 교복", "성서중 급식", "손곡중 학생수", "문정중 통학", "상현중 교복", "수지중 교과서", "대지고 편제표", "현암고 교육과정 특징", "죽전고 설명회", "특성화고 입학", "중학교 졸업", "2028학년도 대입전형", "석차등급 폐지", "대체 과목", "고교학점제 졸업", "수시 수능최저", "정시 학생부", "평준화 배정", "외고 자사고", "선택과목 탐구", "내신 5등급", "한국사 필수", "공통과목 수능", "졸업 요건 192학점", "중학교 배정 원칙", "경기 과학고 소집면접", "원서접수 날짜", "외대부고 합격자 발표"];
const set = new Set(); for (const q of qs) for (const [, l] of S.search(q)) for (const x of l) if (/hl=/.test(x.href || "") && /^#/.test(x.href) && !/library|^#home/.test(x.href)) set.add(decodeURIComponent(x.href));
const links = [...set].slice(0, N), b = await chromium.launch(), bad = [], rep = [];
for (const w of [390, 1440]) { let max = 0, over = 0, jump = 0;
  for (const u of links) { const c = await b.newContext({ serviceWorkers: "block", viewport: { width: w, height: w === 390 ? 844 : 900 } }), p = await c.newPage(); if (process.env.THROTTLE) { const cdp = await c.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.THROTTLE) }); } /* THROTTLE=4: 느린 기기 흉내 */
    await p.addInitScript(() => { window.__s = 0; window.__log = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__s += e.value; }).observe({ type: "layout-shift", buffered: true }); let last = -1; const poll = () => { const y = Math.round(scrollY); if (y !== last) { window.__log.push(y); last = y; } requestAnimationFrame(poll); }; requestAnimationFrame(poll); });
    await p.goto(`${base}${encodeURI(u)}`); await p.waitForTimeout(3800);
    const r = await p.evaluate(() => ({ s: window.__s, log: window.__log })); const big = r.log.filter((y) => y > 0); max = Math.max(max, r.s); if (r.s > 0.1) { over++; bad.push(`${w}px CLS ${r.s.toFixed(3)} — ${u.slice(0, 90)}`); } if (big.length && Math.abs(r.log[r.log.length - 1] - big[0]) >= 60) { jump++; bad.push(`${w}px 도착 뒤 ${Math.abs(r.log[r.log.length - 1] - big[0])}px 재이동 — ${u.slice(0, 90)}`); } await c.close(); }
  rep.push(`${w}px: 링크 ${links.length}개, CLS 최대 ${max.toFixed(3)}, 0.1 초과 ${over}개, 60px+ 재이동 ${jump}개`); }
await b.close(); rep.forEach((x) => console.log("  ·", x));
if (bad.length) { bad.slice(0, 30).forEach((x) => console.log("  ✗", x)); console.log(`실패 ${bad.length}건`); process.exit(1); }
console.log("OK: hl 링크 CLS 0.1 이하·재이동 없음");
