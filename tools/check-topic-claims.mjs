// '학교 이름 + 주제' 검색 안내(search-claims.js)가 말하는 화면에 그 값이 실제로 있는지 데이터로 대조한다.
// 쓰는 법: node tools/check-topic-claims.mjs   (어긋나면 종료 코드 1)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const load = (n) => JSON.parse(readFileSync(`${root}/portal/data/${n}.json`, "utf8"));
const { CLAIMS, SAY, sayOf, noneText } = await import(`${root}/portal/search-claims.js`);
const bad = [], ok = [];
const has = (v) => v && v.value != null && v.value !== "";
for (const c of CLAIMS) {
  const tag = `${c.label}${c.level ? `(${c.level === "high" ? "고" : "중"})` : ""}`;
  if (c.kind === "field") {
    const d = load(c.data), f = d.fields.find((x) => x.id === c.field);
    if (!f) { bad.push(`${tag}: ${c.data}에 항목 ${c.field}가 없어요`); continue; }
    if (!f.label.includes(c.fieldLabel)) { bad.push(`${tag}: 화면 칸 이름이 '${f.label}'인데 문구는 '${c.fieldLabel}'`); continue; }
    const n = d.schools.filter((s) => has(s.values?.[c.field])).length;
    if (!n) bad.push(`${tag}: '${f.label}' 칸에 값이 있는 학교가 0곳`); else ok.push(`${tag} → ${c.data} '${f.label}' 값 ${n}/${d.schools.length}곳`);
  } else if (c.kind === "types") {
    const d = load("hs-types"), n = d.types.filter((t) => has(t[c.key])).length;
    if (!n) bad.push(`${tag}: hs-types에 ${c.key} 값이 없어요`); else ok.push(`${tag} → 고교 종류 '${c.screenText}' 값 ${n}/${d.types.length}유형`);
  } else if (c.kind === "section") {
    const d = load(c.data), n = (d.sections || []).filter((x) => x.title.includes(c.title)).length;
    if (!n) bad.push(`${tag}: ${c.data}에 '${c.title}' 구역이 없어요`); else ok.push(`${tag} → ${c.data} '${c.title}' 구역 있음`);
  } else if (c.kind === "absent") {
    const hit = c.data.flatMap((n) => load(n).fields.filter((f) => c.words.test(f.label + f.id)).map((f) => `${n}:${f.label}`));
    if (hit.length) bad.push(`${tag}: 없다고 안내하는데 비교 화면에 ${hit.join(", ")} 칸이 있어요`); else ok.push(`${tag} → 비교 화면에 없음(안내 문구와 일치)`);
  }
}
// 학교급 × 항목 전수: 모든 대응표 항목을 고·중 학교 각각에 대해 문구·주소·확인처를 대조한다
const NAME = [[/고교 종류/, /v=types/], [/고교 보기/, /v=schools&lv=high/], [/중학교 보기/, /v=schools&lv=middle/], [/학교 요약/, /[?&]s=/], [/고교 일정/, /schedule\?t=hs/], [/중학교 일정/, /schedule\?t=life/], [/배정·입학 준비/, /v=middle/]];
const menu = readFileSync(`${root}/portal/menu-tree.js`, "utf8"), allData = readFileSync(`${root}/portal/data/policy.json`, "utf8") + ["hs-types", "middle-guide", "hs-compare", "middle-compare"].map((n) => readFileSync(`${root}/portal/data/${n}.json`, "utf8")).join("");
const SCREEN = ["고교 종류", "고교 보기", "중학교 보기", "고교 일정", "중학교 일정", "배정·입학 준비"]; // 문구가 부르는 화면 이름이 메뉴에 실제로 있어야 한다
for (const nm of SCREEN) if (!menu.includes(nm)) bad.push(`문구가 쓰는 화면 이름 '${nm}'이 메뉴(menu-tree.js)에 없어요`);
let combos = 0;
for (const [label, e] of Object.entries(SAY)) {
  if (!["both", "high", "middle"].includes(e.level)) bad.push(`${label}: level(high/middle/both)이 없어요`);
  for (const lv of ["high", "middle"]) {
    const pl = { level: lv, schoolId: lv === "high" ? "school-pungdeok" : undefined }, r = sayOf(label, pl); combos++;
    const shown = r?.href ? r.text : r?.none || noneText(label), tag = `${label}(${lv === "high" ? "고" : "중"})`;
    if (e.level === "high" && lv === "middle" && r) bad.push(`${tag}: level=high인데 중학교에 안내가 있어요`);
    if (e.level === "middle" && lv === "high" && r) bad.push(`${tag}: level=middle인데 고교에 안내가 있어요`);
    if (lv === "middle" && /고입|고교 |고등학교/.test(shown)) bad.push(`${tag}: 중학교 질의에 고교 확인처 문구가 있어요 → ${shown.slice(0, 40)}`);
    if (lv === "high" && /중학교 보기|배정·입학 준비|배정 인원|용인교육지원청/.test(shown)) bad.push(`${tag}: 고교 질의에 중학교 확인처 문구가 있어요 → ${shown.slice(0, 40)}`);
    if (!r?.href) continue;
    if (/학교별 비교 화면/.test(r.text || "")) bad.push(`${tag}: 도착하지 않는 '학교별 비교 화면'이라는 이름을 씀`);
    const first = NAME.map(([n, h]) => [(r.text || "").search(n), n, h]).filter(([i]) => i >= 0).sort((a, b) => a[0] - b[0])[0]; // 문구에서 가장 먼저 나오는 화면 이름이 도착 화면이어야 한다
    if (first && !first[2].test(r.href)) bad.push(`${tag}: 문구는 '${first[1].source}'인데 주소는 ${r.href}`);
    const hl = new URLSearchParams(r.href.split("?")[1]).get("hl"); // hl이 가리키는 글이 데이터에 있어야 한다(도착 화면에 그 줄이 있음)
    if (hl && !/[?&]s=/.test(r.href) && !allData.includes(hl.slice(0, 8))) bad.push(`${tag}: hl '${hl}'이 데이터에 없어요`);
  }
}
ok.push(`대응표 ${Object.keys(SAY).length}항목 × 고·중 ${combos}조합의 문구·주소·확인처 대조`);
for (const l of ok) console.log("  ✓", l);
if (bad.length) { for (const l of bad) console.log("  ✗", l); console.log(`실패 ${bad.length}건`); process.exit(1); }
console.log(`OK: 학교+주제 안내 ${ok.length}항목이 가리키는 화면에 값이 있어요`);
