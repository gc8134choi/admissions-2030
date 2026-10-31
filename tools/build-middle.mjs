// research/data/middle-school-draft.json(조사 세션) → portal/data/middle.json (출신 초등학교 통학구역 중학교와 배정 원칙).
//   - placeId는 places-draft.json에 있어야 한다. 초안이 없으면 빈 구조를 만든다(화면은 빈 상태 문구).
//   - 배정 일정은 policy.json의 life-* 행(stage 중입)을 화면이 그대로 쓰므로 여기에 넣지 않는다.
// 사용: node tools/build-middle.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "research/data/middle-school-draft.json", PL = "research/data/places-draft.json";
const draft = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : null;
const places = existsSync(PL) ? JSON.parse(readFileSync(PL, "utf8")).items : [];
const level = new Map(places.map((p) => [p.placeId, p.level]));
const ST = ["confirmed", "reported", "estimated"];
const errs = [];
const chk = (where, x) => {
  if (!ST.includes(x.status)) errs.push(`${where}: status ${x.status}`);
  if (!(x.sources || []).length) errs.push(`${where}: sources 비어 있음`);
};
let out;
// 초안은 초등학교 한 곳(from + zoneSchools) 또는 여러 곳(areas[{from, zoneSchools}])을 쓸 수 있다. 출력은 항상 areas[]이고,
// 첫 구역의 from·zoneSchools를 기존 키로도 남긴다(홈 등 옛 소비자 호환). principles(배정 원칙·절차)는 구역 공통이다.
const checkArea = (a, w) => {
  if (!level.has(a.from?.placeId)) errs.push(`${w}: from.placeId ${a.from?.placeId}가 places 초안에 없음`);
  else if (level.get(a.from.placeId) !== "elementary") errs.push(`${w}: from은 초등학교여야 함`);
  for (const z of a.zoneSchools || []) {
    if (!level.has(z.placeId)) errs.push(`${z.placeId}: places 초안에 없음`);
    else if (level.get(z.placeId) !== "middle") errs.push(`${z.placeId}: 중학교가 아님`);
    chk(`${w}/${z.placeId}`, z);
  }
};
if (!draft) out = { _meta: { note: "초등학교 → 중학교 배정(생성물). 조사 초안이 아직 없어 비어 있다.", count: 0 }, areas: [], from: null, zoneSchools: [], principles: [] };
else {
  const areas = draft.areas ? draft.areas : [{ from: draft.from, zoneSchools: draft.zoneSchools || [] }];
  const seenFrom = new Set();
  areas.forEach((a, i) => { checkArea(a, `areas[${i}]`); if (seenFrom.has(a.from?.placeId)) errs.push(`areas[${i}]: 초등학교 ${a.from?.placeId} 중복`); seenFrom.add(a.from?.placeId); });
  const pid = new Set();
  for (const p of draft.principles || []) { if (pid.has(p.id)) errs.push(`${p.id}: 원칙 id 중복`); pid.add(p.id); chk(p.id, p); }
  const outAreas = areas.map((a) => ({ from: { placeId: a.from.placeId, note: a.from.note ?? null }, zoneSchools: a.zoneSchools || [] }));
  out = { _meta: { note: "초등학교 → 중학교 배정(생성물, 손으로 고치지 않는다). research/data/middle-school-draft.json에서 tools/build-middle.mjs가 만든다.", checkedAt: draft._meta?.checkedAt ?? null, count: outAreas.reduce((n, a) => n + a.zoneSchools.length, 0), areaCount: outAreas.length }, areas: outAreas, from: outAreas[0].from, zoneSchools: outAreas[0].zoneSchools, principles: draft.principles || [] };
}
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/middle.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("middle.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(`초등학교 구역 ${out.areas.length}곳, 중학교 ${out._meta.count}곳(구역별 합), 원칙 ${out.principles.length}건`);
