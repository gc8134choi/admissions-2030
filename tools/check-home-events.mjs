// 홈 일정 줄 ↔ 원본 events 1:1 대조: 시계를 11월~3월 여러 날짜로 맞춰 홈을 열고, 고교·중학교 열의 모든 일정 줄(날짜·제목)이 policy.json events의 실제 한 건과 같은지 본다.
// 서로 다른 단계(접수·면접·발표)가 한 줄로 섞이거나 없는 날짜가 만들어지면 실패한다.
// 쓰는 법: python3 -m http.server 8000 & node tools/check-home-events.mjs [http://localhost:8000/portal/]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const root = resolve(new URL("..", import.meta.url).pathname), require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = (process.argv[2] || "http://localhost:8000/portal/").replace(/\/?$/, "/");
const policy = JSON.parse(readFileSync(`${root}/portal/data/policy.json`, "utf8"));
const evs = policy.flatMap((r) => (r.events || []).map((e) => ({ title: r.title, label: e.label || "", start: e.start, end: e.end || e.start })));
const md = (d) => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(d || ""); return m ? `${+m[1]}.${+m[2]}` : null; };
const norm = (s) => String(s).replace(/ⓘ/g, "").replace(/\s+/g, "");
const dates = []; for (let d = new Date("2026-11-09T09:00:00+09:00"); d < new Date("2027-04-01T00:00:00+09:00"); d = new Date(d.getTime() + 5 * 864e5)) dates.push(new Date(d));
const b = await chromium.launch(), bad = []; let rows = 0;
for (const w of [1440]) for (const d of dates) {
  const c = await b.newContext({ viewport: { width: w, height: 900 }, serviceWorkers: "block" }), p = await c.newPage(); await p.clock.install({ time: d });
  await p.goto(`${base}#home`); await p.waitForTimeout(1500);
  const list = await p.evaluate(() => [...document.querySelectorAll(".hm2-b li.h2-ev, .h2-list li.h2-ev, li.h2-ev")].map((li) => ({ date: li.querySelector(".h2-d")?.innerText.replace(/\n/g, " ") || "", main: li.querySelector(".h2-b b")?.innerText || "", sub: li.querySelector(".h2-b small")?.innerText || "", extra: li.querySelector(".h2-b .num")?.innerText || "" })));
  const day = d.toISOString().slice(0, 10);
  for (const r of list) { rows++;
    const clean = (r.date + " " + r.extra).replace(/D-[\d,]+/g, " ").replace(/\d{4}\.\d{1,2}(?!\.?\d)/g, " ").replace(/\d{4}\./g, " "), toks = [...clean.matchAll(/(\d{1,2})\.(\d{1,2})/g)].map((m) => `${+m[1]}.${+m[2]}`); if (!toks.length) continue; /* D-day만 있는 줄(수능)은 날짜 대조 대상 아님 */
    const main = norm(r.main), cands = evs.filter((e) => { const t = norm(e.label || e.title); return t.includes(main) || main.includes(t) || norm(e.title).includes(main); });
    const okE = cands.some((e) => { const s = md(e.start), en = md(e.end); const inRange = e.start <= day && day <= e.end; return toks.every((t) => t === s || t === en) || (toks.length === 1 && inRange); });
    if (!okE) bad.push(`${day} '${r.main}' [${toks.join(",")}] — 같은 제목·날짜의 원본 일정이 없어요 (${r.date.slice(0, 30)})`);
    if (toks.length > 1 && !cands.some((e) => md(e.start) === toks[0] && md(e.end) === toks[toks.length - 1] && e.start !== e.end)) bad.push(`${day} '${r.main}' 여러 날짜 줄 [${toks.join("·")}]이 원본의 한 기간이 아니에요`);
  }
  await c.close();
}
await b.close();
if (bad.length) { [...new Set(bad)].slice(0, 40).forEach((x) => console.log("  ✗", x)); console.log(`실패 ${new Set(bad).size}건 / 줄 ${rows}`); process.exit(1); }
console.log(`OK: ${dates.length}개 날짜의 홈 일정 줄 ${rows}개를 원본 events와 1:1 대조`);
