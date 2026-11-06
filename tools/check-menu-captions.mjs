// 메뉴 설명 줄 점검: portal/menu-tree.js의 각 항목 desc에 적은 핵심어(keys)가 ① 설명 줄 안에 있고 ② 그 항목이 여는 화면의 글자에 실제로 있는지 확인한다.
// 화면에 없는 내용을 설명 줄에 적지 않기 위한 장치(2026-11-06 32차 B). Playwright로 화면을 열어 접이식을 모두 펼친 뒤 글자를 모은다.
// 사용: python3 -m http.server 8000 (다른 창) → node tools/check-menu-captions.mjs [기본주소=http://localhost:8000/portal/]
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname;
const { HOME, GROUPS } = await import(`${root}portal/menu-tree.js`);
const base = process.argv[2] || "http://localhost:8000/portal/";
let srv = null;
try { await fetch(base); } catch { srv = spawn("python3", ["-m", "http.server", "8000"], { cwd: root, stdio: "ignore" }); await new Promise((r) => setTimeout(r, 1200)); }
const items = [HOME, ...GROUPS.flatMap((g) => g.items)];
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const bad = [];
for (const it of items) {
  if (!it.desc) continue;
  if (!it.keys || !it.keys.length) { bad.push(`${it.title}: keys(핵심어)가 없어요`); continue; }
  for (const k of it.keys) if (!it.desc.includes(k)) bad.push(`${it.title}: 핵심어 '${k}'가 설명 줄('${it.desc}')에 없어요`);
  await p.goto(base + "#" + it.id); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll("#main details").forEach((d) => (d.open = true))); await p.waitForTimeout(600);
  let txt = await p.evaluate(() => document.getElementById("main").textContent.replace(/\s+/g, " "));
  for (const x of it.chk || []) { /* chk: 같은 항목의 다른 탭(주소)에만 있는 핵심어도 인정 */
    await p.goto(base + "#" + x); await p.waitForTimeout(2500);
    await p.evaluate(() => document.querySelectorAll("#main details").forEach((d) => (d.open = true))); await p.waitForTimeout(600);
    txt += " " + (await p.evaluate(() => document.getElementById("main").textContent.replace(/\s+/g, " "))); }
  for (const k of it.keys) if (!txt.includes(k)) bad.push(`${it.title}: 설명 줄의 '${k}'가 화면(${it.id})에 없어요`);
}
await b.close(); srv?.kill();
if (bad.length) { console.log(`메뉴 설명 줄 ${bad.length}건 어긋남`); bad.forEach((x) => console.log(" ✗", x)); process.exit(1); }
console.log(`OK: 메뉴 설명 줄 ${items.filter((i) => i.desc).length}개의 핵심어가 모두 해당 화면에 있어요`);
