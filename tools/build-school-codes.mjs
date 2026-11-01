// research/data/school-codes-draft.json → portal/data/school-codes.json (학교 외부 코드 대응표, 생성물).
//   점검: 형식(NEIS 시도교육청코드 ^[A-Z]\d{2}$ + 표준학교코드 ^\d{7}$, 학교알리미 ^[A-Z]\d{9}$), 코드 중복,
//         placeId가 places.json에 있음, schoolId가 schools.json에 있음, 코드 없음에는 사유(nullReason) 필수.
//   코드가 있으면 places.json·hs-compare.json·middle-compare.json 행의 externalIds로도 들어간다(각 생성기).
// 사용: node tools/build-school-codes.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "research/data/school-codes-draft.json";
const draft = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, items: [] };
const places = new Map(JSON.parse(readFileSync("portal/data/places.json", "utf8")).places.map((p) => [p.id, p]));
const schools = new Set(JSON.parse(readFileSync("portal/data/schools.json", "utf8")).map((s) => s.id));
const FMT = { neis: { atptCode: /^[A-Z]\d{2}$/, code: /^\d{7}$/ }, schoolinfo: { code: /^[A-Z]\d{9}$/ } };
const errs = [], seenPlace = new Set(), seenCode = new Map(), seenSchool = new Map();
for (const it of draft.items) {
  const w = it.placeId ?? it.name ?? "?";
  if (!it.placeId || !places.has(it.placeId)) errs.push(`${w}: placeId가 places.json에 없음`);
  if (seenPlace.has(it.placeId)) errs.push(`${w}: placeId 중복`); seenPlace.add(it.placeId);
  if (it.schoolId) { if (!schools.has(it.schoolId)) errs.push(`${w}: schoolId ${it.schoolId}가 schools.json에 없음`); if (seenSchool.has(it.schoolId)) errs.push(`${w}: schoolId ${it.schoolId}가 ${seenSchool.get(it.schoolId)}와 중복`); seenSchool.set(it.schoolId, w); }
  if (places.has(it.placeId) && it.name && places.get(it.placeId).name !== it.name) errs.push(`${w}: 이름 "${it.name}"이 places.json "${places.get(it.placeId).name}"과 다름`);
  const sys = new Set();
  for (const x of it.ids ?? []) {
    const f = FMT[x.system];
    if (!f) { errs.push(`${w}: 알 수 없는 system ${x.system}`); continue; }
    if (sys.has(x.system)) errs.push(`${w}: ${x.system} 코드 중복 기재`); sys.add(x.system);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x.asOf ?? "")) errs.push(`${w} ${x.system}: asOf 형식`);
    if (x.code == null) { if (!x.nullReason) errs.push(`${w} ${x.system}: 코드 없음에 nullReason 없음`); continue; }
    if (!f.code.test(String(x.code))) errs.push(`${w} ${x.system}: 코드 형식 "${x.code}"`);
    if (x.system === "neis" && !f.atptCode.test(x.atptCode ?? "")) errs.push(`${w} neis: atptCode 형식 "${x.atptCode}"`);
    const key = `${x.system}|${x.atptCode ?? ""}|${x.code}`;
    if (seenCode.has(key)) errs.push(`${w}: ${x.system} 코드 ${x.code}가 ${seenCode.get(key)}와 중복`); seenCode.set(key, w);
  }
}
if (errs.length) { console.error(errs.slice(0, 30).join("\n")); process.exit(1); }

const out = { _meta: { note: "학교 외부 코드 대응표(생성물, 손으로 고치지 않는다). research/data/school-codes-draft.json에서 tools/build-school-codes.mjs가 만든다. system: neis(시도교육청코드 atptCode + 표준학교코드 code), schoolinfo(학교알리미 학교코드).", checkedAt: draft._meta?.checkedAt ?? null, count: draft.items.length, withNeis: draft.items.filter((i) => i.ids?.some((x) => x.system === "neis" && x.code)).length, withSchoolinfo: draft.items.filter((i) => i.ids?.some((x) => x.system === "schoolinfo" && x.code)).length }, items: draft.items };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/school-codes.json";
if (process.argv.includes("--check")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== json) { console.error("school-codes.json이 초안과 다르다 — node tools/build-school-codes.mjs"); process.exit(1); }
  console.log(`OK: school-codes ${out._meta.count}곳(NEIS ${out._meta.withNeis}, 학교알리미 ${out._meta.withSchoolinfo})`);
} else { writeFileSync(target, json); console.log(`school-codes ${out._meta.count}곳(NEIS ${out._meta.withNeis}, 학교알리미 ${out._meta.withSchoolinfo})`); }
