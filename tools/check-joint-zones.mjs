// 공동학군 해석 점검: middle.json의 모든 초등학교 학교군이 none/all/part로 분류되는지(unknown이면 실패 — 고시 비고 문구가 바뀌어 정규식이 조용히 못 읽는 경우),
// 알려진 기준(고기초=일부 공동, 매봉·용인심곡·이현·풍천초=전체 공동)과 검색 문구·배정 화면 문구가 일치하는지 본다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const { jointOf, zoneText } = await import(`${root}/portal/joint-zone.js`);
const mid = JSON.parse(readFileSync(`${root}/portal/data/middle.json`, "utf8")), places = JSON.parse(readFileSync(`${root}/portal/data/places.json`, "utf8")).places;
const name = (id) => places.find((p) => p.id === id)?.name || id, bad = [], cnt = { none: 0, all: 0, part: 0 };
const EXPECT = { 고기초등학교: "part", 매봉초등학교: "all", 용인심곡초등학교: "all", 이현초등학교: "all", 풍천초등학교: "all" };
for (const a of mid.areas || []) {
  const j = jointOf(a), n = name(a.from.placeId); if (j.type === "unknown") bad.push(`${n}: 공동학군 범위를 읽지 못했어요(비고 문구 변경?) → ${j.raw.slice(0, 80)}`); else cnt[j.type]++;
  if (EXPECT[n] && EXPECT[n] !== j.type) bad.push(`${n}: 기대 ${EXPECT[n]} ≠ ${j.type}`);
  if (j.type === "part" && (!j.scope || !j.other || !j.home)) bad.push(`${n}: 일부 공동인데 범위·상대 학군·소속이 비었어요`);
  if (j.type === "part") { const t = zoneText(j); if (!/학구 일부/.test(t) || !t.includes(j.scope) || !t.includes(j.other)) bad.push(`${n}: 안내 문구에 범위가 없어요 → ${t}`); }
  if (j.type === "all" && j.groups.length < 2) bad.push(`${n}: 전체 공동인데 학군이 둘 미만`);
}
for (const n of Object.keys(EXPECT)) if (!mid.areas.some((a) => name(a.from.placeId) === n)) bad.push(`${n}: 학교군 데이터에 없어요`);
const g = jointOf(mid.areas.find((a) => name(a.from.placeId) === "고기초등학교")); if (g.scope && !/^분당구 운중동/.test(g.scope)) bad.push(`고기초 범위 문구가 예상과 달라요: ${g.scope}`);
// 배정 화면 문구: 학교 전체가 두 학군으로 읽히는 문장이 일부 공동에 붙지 않는지(소스 점검)
const ms = readFileSync(`${root}/portal/middle.js`, "utf8"); if (/공동학군이라 두 학교군의 중학교를 함께/.test(ms) && !/jz\.type === "all"/.test(ms)) bad.push("middle.js: 공동학군 문장이 type별로 갈리지 않아요");
if (bad.length) { bad.forEach((b) => console.log("  ✗", b)); process.exit(1); }
console.log(`OK: 학교군 ${mid.areas.length}곳 — 공동 없음 ${cnt.none}, 전체 공동 ${cnt.all}, 학구 일부 공동 ${cnt.part}, 미분류 0`);
