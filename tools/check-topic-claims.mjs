// '학교 이름 + 주제' 검색 안내(search-claims.js)가 말하는 화면에 그 값이 실제로 있는지 데이터로 대조한다.
// 쓰는 법: node tools/check-topic-claims.mjs   (어긋나면 종료 코드 1)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const load = (n) => JSON.parse(readFileSync(`${root}/portal/data/${n}.json`, "utf8"));
const { CLAIMS, SAY, sayOf, noneText, REGION_WORDS, GG_WORDS, REGION_ALIAS, regionKnown, pyeongCities, CITY_OF } = await import(`${root}/portal/search-claims.js`);
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
import { readdirSync } from "node:fs";
const elIds = load("places").places.filter((p) => p.level === "elementary").map((p) => p.id), ALLOW = new Set(["places.json", "middle.json", "school-codes.json", "changes.json", "index.json", "sources.json", "facets.json"]);
const elDataOutside = readdirSync(`${root}/portal/data`).filter((f) => f.endsWith(".json") && !ALLOW.has(f)).filter((f) => { const t = readFileSync(`${root}/portal/data/${f}`, "utf8"); return elIds.some((id) => t.includes(`"${id}"`)); });
{ const mid = load("middle"), have = new Set((mid.areas || []).map((a) => a.from.placeId)), miss = elIds.filter((id) => !have.has(id)); if (miss.length) bad.push(`학교군 안내(초등): middle.json areas에 없는 초등학교 ${miss.length}곳`); else ok.push(`초등학교 ${elIds.length}곳 모두 배정·입학 준비 화면(middle.json)에 학교군·갈 수 있는 중학교가 있음`); }
let combos = 0;
for (const [label, e] of Object.entries(SAY)) {
  if (!["both", "all", "high", "middle"].includes(e.level)) bad.push(`${label}: level(high/middle/both)이 없어요`);
  for (const lv of ["high", "middle", "elementary"]) {
    const pl = { level: lv, schoolId: lv === "high" ? "school-pungdeok" : undefined }, r = sayOf(label, pl); combos++;
    if (lv === "elementary" && !("elementary" in e)) { bad.push(`${label}: elementary를 명시하지 않았어요`); continue; }
    if (lv === "elementary" && !r) { // 없다는 안내: 초등학교 id가 든 데이터가 허용 목록 밖에 없어야 한다(있으면 연결해야 한다)
      const sh = noneText(label, "elementary"); if (/고입|고교|고등학교|배정|중학교 보기/.test(sh)) bad.push(`${label}(초): 초등학교 없음 문구에 다른 학교급 확인처가 있어요`);
      if (elDataOutside.length) bad.push(`${label}(초): 없다고 안내하는데 초등학교 값이 ${elDataOutside.join(", ")}에도 있어요`);
      continue; }
    const shown = r?.href ? r.text : r?.none || noneText(label, lv), tag = `${label}(${lv === "high" ? "고" : "중"})`;
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
ok.push(`대응표 ${Object.keys(SAY).length}항목 × 초·중·고 ${combos}조합의 문구·주소·확인처 대조`);
// 다른 지역 '없어요' 선언(search-extra other-region): 질의 지역 낱말 목록이 코드와 같고, 데이터에 있는 지역은 선언하지 않으며(런타임 규칙), 선언하는 지역(데이터에 없는 것)은 실제로 어떤 데이터에도 없어야 한다
{
  const ex = readFileSync(`${root}/portal/search-extra.js`, "utf8"), line = ex.split("\n").find((l) => l.includes('id: "other-region"')) || "", alt = line.slice(line.indexOf("(?<![가-힣(])(") + 12, line.indexOf(")(?!대)")).replace("(?!과학|한성|영재|[·,)])", "");
  const inLine = alt.replace(/\(\?![^)]*\)/g, "").split("|"), miss = REGION_WORDS.filter((w) => !inLine.includes(w)), extra = inLine.filter((w) => w && !REGION_WORDS.includes(w));
  if (miss.length || extra.length) bad.push(`다른 지역 낱말 목록이 search-claims.js(REGION_WORDS)와 달라요: 빠짐 ${miss.join(",")} / 더 있음 ${extra.join(",")}`);
  const files = readdirSync(`${root}/portal/data`).filter((f) => f.endsWith(".json") && !["sources.json", "changes.json", "files.json", "school-codes.json"].includes(f));
  const hay = JSON.stringify(load("policy")), ADDR = new Set(["places.json", "schools.json", "middle-compare.json", "hs-compare.json", "middle.json"]), // 주소(도로명)에 지역 낱말이 든 파일은 지역을 다룬다는 근거가 아니다
     anyData = files.map((f) => [f, readFileSync(`${root}/portal/data/${f}`, "utf8")]);
  const known = [], absent = [], gaiLine = [], gg = [];
  for (const w of REGION_WORDS) {
    if (REGION_ALIAS[w] === "서울") { known.push(w); continue; } // 서울(구 이름)은 서울 데이터가 있으면 연결
    if (GG_WORDS.includes(w)) { gg.push(w); if (!/경기/.test(hay)) bad.push("경기 지역 낱말 안내가 말하는 '경기' 일정이 정책 데이터에 없어요"); continue; } // 경기 지역 낱말은 선언하지 않고 경기 일정으로 연결
    const covPat = new RegExp(w + "(외국어고|외고|국제고|자사고|외대부고)"), hasEo = covPat.test(hay);
    const ctx = new RegExp(w + ".{0,6}(일반고|고등학교|중학교|평준화|후기고)"), where = anyData.filter(([f, t]) => !ADDR.has(f) && ctx.test(t)).map(([f]) => f); // 그 지역의 일반 고입·학교 자료가 있으면 '없어요'를 선언하면 안 된다
    if (where.length) bad.push(`지역 '${w}': 없다고 선언하는데 그 지역 고입·학교 자료가 데이터(${where.join(", ")})에 있어요`);
    else (hasEo ? gaiLine : absent).push(w);
  }
  ok.push(`다른 지역 선언: 서울(${known.join("·")})은 서울 데이터로 연결, 경기 지역 ${gg.length}곳은 경기 일정으로 연결, 외고·국제고·자사고 질의는 ${gaiLine.length}곳(${gaiLine.join("·")}) 학교 이름이 데이터에 있어 연결, 그 밖의 ${absent.length + gaiLine.length}곳은 일반 고입 자료가 어떤 데이터에도 없음`);
  { // 경기 지역 낱말의 평준화 여부 안내는 gg-25(확정)의 9학군 목록에서 읽는다: 목록이 읽히고 용인을 포함해야 하며, 낱말마다 소속/비소속이 결정되어야 한다
    const set = pyeongCities(load("policy")), g25 = load("policy").find((r) => r.id === "gg-25");
    if (!set || set.size < 9 || !set.has("용인")) bad.push(`평준화 9학군 목록을 gg-25에서 읽지 못했어요(${set ? [...set].join(",") : "null"})`);
    else if (g25.status !== "confirmed") bad.push("gg-25가 확정 상태가 아니에요(지역 낱말 안내의 근거)");
    else ok.push(`경기 지역 낱말 ${GG_WORDS.length}곳 평준화 구분: 9학군(${[...set].join("·")}) 소속 ${GG_WORDS.filter((w) => set.has(CITY_OF[w] || w)).join("·")} / 비소속은 '학교별 전형'으로(시·군 목록은 gg-26 추정이라 사실처럼 말하지 않음)`);
  }
  if (!/서울/.test(hay)) bad.push("안내 문구가 말하는 '서울'이 정책 데이터에 없어요");
}
for (const l of ok) console.log("  ✓", l);
if (bad.length) { for (const l of bad) console.log("  ✗", l); console.log(`실패 ${bad.length}건`); process.exit(1); }
console.log(`OK: 학교+주제 안내 ${ok.length}항목이 가리키는 화면에 값이 있어요`);
