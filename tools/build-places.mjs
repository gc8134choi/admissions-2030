// research/data/places-draft.json(조사 세션) → portal/data/places.json (초·중·고 학교 위치, 지도 화면용).
//   - 초안이 아직 없으면 빈 목록을 만든다(화면은 빈 상태 문구). 좌표가 null이면 지도에서만 빠지고 목록에는 남는다.
//   - 지도 링크용 검색어(searchQuery)는 "이름 + 주소"로 만든다. API 키 없이 네이버 지도·카카오맵 검색 URL에 쓴다.
// 사용: node tools/build-places.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "research/data/places-draft.json";
const draft = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, items: [] };
const schema = JSON.parse(readFileSync("schema/places.schema.json", "utf8"));
const errs = [];
const ids = new Set();
const places = draft.items.map((it) => {
  for (const k of schema.required) if (it[k] == null || it[k] === "") errs.push(`${it.placeId ?? it.name}: ${k} 없음`);
  if (!new RegExp(schema.properties.placeId.pattern).test(it.placeId || "")) errs.push(`${it.placeId}: placeId 형식`);
  if (ids.has(it.placeId)) errs.push(`${it.placeId}: placeId 중복`);
  ids.add(it.placeId);
  if (!schema.properties.level.enum.includes(it.level)) errs.push(`${it.placeId}: level ${it.level}`);
  if (!schema.properties.status.enum.includes(it.status)) errs.push(`${it.placeId}: status ${it.status}`);
  if (!(it.sources || []).length) errs.push(`${it.placeId}: sources 비어 있음`);
  const lat = it.lat ?? null, lng = it.lng ?? null;
  if ((lat == null) !== (lng == null)) errs.push(`${it.placeId}: lat·lng는 함께 있거나 함께 null이어야 함`);
  if (lat != null && !(lat > 33 && lat < 39 && lng > 124 && lng < 132)) errs.push(`${it.placeId}: 좌표가 한국 범위 밖(${lat}, ${lng}) — 위도·경도가 바뀌었는지 확인`);
  if (it.homepage && !/^https?:\/\//.test(it.homepage)) errs.push(`${it.placeId}: homepage는 http(s) 주소`);
  return {
    id: it.placeId, schoolId: it.schoolId ?? null, name: it.name, level: it.level, kind: it.kind ?? null, address: it.address,
    lat, lng, coordSource: it.coordSource ?? null, homepage: it.homepage ?? null, phone: it.phone ?? null,
    status: it.status, sources: it.sources, checkedAt: it.checkedAt ?? draft._meta?.checkedAt ?? null,
    searchQuery: `${it.name} ${it.address}`.trim(),
  };
});
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const out = { _meta: { note: "학교 위치(생성물, 손으로 고치지 않는다). research/data/places-draft.json에서 tools/build-places.mjs가 만든다.", checkedAt: draft._meta?.checkedAt ?? null, count: places.length, withCoords: places.filter((p) => p.lat != null).length }, places };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/places.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("places.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(`${places.length} places (좌표 있음 ${out._meta.withCoords})`);
