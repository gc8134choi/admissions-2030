// '학교 이름 + 주제' 검색 안내(search-claims.js)가 말하는 화면에 그 값이 실제로 있는지 데이터로 대조한다.
// 쓰는 법: node tools/check-topic-claims.mjs   (어긋나면 종료 코드 1)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const load = (n) => JSON.parse(readFileSync(`${root}/portal/data/${n}.json`, "utf8"));
const { CLAIMS, TOPIC_SAY, sayOf } = await import(`${root}/portal/search-claims.js`);
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
  } else if (c.kind === "absent") {
    const hit = c.data.flatMap((n) => load(n).fields.filter((f) => c.words.test(f.label + f.id)).map((f) => `${n}:${f.label}`));
    if (hit.length) bad.push(`${tag}: 없다고 안내하는데 비교 화면에 ${hit.join(", ")} 칸이 있어요`); else ok.push(`${tag} → 비교 화면에 없음(안내 문구와 일치)`);
  }
}
// 문구가 '학교별 비교 화면'처럼 도착하지 않는 화면 이름을 쓰지 않는지: 각 라벨의 href와 문구 속 화면 이름이 맞아야 한다
const NAME = [[/고교 종류/, /v=types/], [/고교 보기/, /v=schools&lv=high/], [/중학교 보기/, /v=schools&lv=middle/], [/학교 요약/, /[?&]s=/], [/고교 일정/, /schedule\?t=hs/], [/중학교 일정/, /schedule\?t=life/]];
for (const label of Object.keys(TOPIC_SAY)) for (const pl of [{ level: "high", schoolId: "school-pungdeok" }, { level: "middle", schoolId: "x" }]) {
  const r = sayOf(label, pl); if (!r || !r.href || !r.text) continue;
  if (/학교별 비교 화면/.test(r.text)) bad.push(`${label}: 도착하지 않는 '학교별 비교 화면'이라는 이름을 씀`);
  const first = NAME.map(([n, h]) => [r.text.search(n), n, h]).filter(([i]) => i >= 0).sort((a, b) => a[0] - b[0])[0]; // 문구에서 가장 먼저 나오는 화면 이름이 도착 화면이어야 한다
  if (first && !first[2].test(r.href)) bad.push(`${label}(${pl.level}): 문구는 '${first[1].source}'인데 주소는 ${r.href}`);
}
for (const l of ok) console.log("  ✓", l);
if (bad.length) { for (const l of bad) console.log("  ✗", l); console.log(`실패 ${bad.length}건`); process.exit(1); }
console.log(`OK: 학교+주제 안내 ${ok.length}항목이 가리키는 화면에 값이 있어요`);
