// places.json(학교 위치) 주소가 NEIS 학교기본정보 스냅샷, 그리고 같은 학교의 비교표(middle-compare·hs-compare) 주소와 같은지 검사한다.
// 사용: node tools/check-places-addresses.mjs  (불일치가 있으면 목록을 출력하고 종료 코드 1)
import { readFileSync, existsSync } from "node:fs";
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const places = J("portal/data/places.json").places;
const snap = J("research/data/neis-address-snapshot.json").items;
const bad = [];
const byId = new Map(places.map((p) => [p.id, p]));
for (const s of snap) {
  const p = byId.get(s.placeId);
  if (!p) { bad.push(`${s.placeId} ${s.name}: places.json에 없음`); continue; }
  if (p.address !== s.address) bad.push(`${p.id} ${p.name}: places.json "${p.address}" ≠ NEIS "${s.address}"`);
}
let cmp = 0;
for (const f of ["portal/data/middle-compare.json", "portal/data/hs-compare.json"]) {
  if (!existsSync(f)) continue;
  for (const s of J(f).schools) {
    const a = s.values?.address?.value, p = byId.get(s.placeId);
    if (!a || !p) continue;
    cmp++;
    if (a !== p.address) bad.push(`${p.id} ${p.name}: places.json "${p.address}" ≠ ${f.split("/").pop()} "${a}"`);
  }
}
console.log(`학교 ${snap.length}곳(NEIS)·비교표 ${cmp}곳 주소 대조, 불일치 ${bad.length}건`);
for (const b of bad) console.log(" -", b);
process.exit(bad.length ? 1 : 0);
