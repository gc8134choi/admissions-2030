// research/data/middle-curriculum-draft.json(조사 세션) → portal/data/middle-curriculum.json (중학교 교과서 출판사 표).
//   - placeId는 places-draft.json의 중학교여야 하고, sources[].file이 있으면 portal/ 아래에 실제 파일이 있어야 한다.
//   - 초안이 없으면 빈 구조를 만든다. 교과서 저자·교사 이름은 저장하지 않는다(출판사만).
// 사용: node tools/build-middle-curriculum.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "research/data/middle-curriculum-draft.json", PL = "research/data/places-draft.json";
const draft = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, schools: [], notFound: [] };
const level = new Map((existsSync(PL) ? JSON.parse(readFileSync(PL, "utf8")).items : []).map((p) => [p.placeId, p.level]));
const ST = ["confirmed", "reported", "estimated"];
const errs = [];
const seen = new Set();
const place = (id, where) => {
  if (!level.has(id)) errs.push(`${where}: placeId ${id}가 places 초안에 없음`);
  else if (level.get(id) !== "middle") errs.push(`${where}: ${id}는 중학교가 아님`);
  if (seen.has(id)) errs.push(`${where}: ${id}가 schools·notFound에 중복`);
  seen.add(id);
};
for (const s of draft.schools) {
  place(s.placeId, "schools");
  if (!ST.includes(s.status)) errs.push(`${s.placeId}: status ${s.status}`);
  if (!(s.sources || []).length) errs.push(`${s.placeId}: sources 비어 있음`);
  for (const x of s.sources || []) if (x.file && !existsSync("portal/" + x.file)) errs.push(`${s.placeId}: 원본 파일 portal/${x.file} 없음`);
  if (!(s.subjects || []).length) errs.push(`${s.placeId}: subjects 비어 있음`);
  for (const j of s.subjects || []) {
    for (const g of ["1", "2", "3"]) if (!(g in (j.publishers || {}))) errs.push(`${s.placeId} ${j.subject}: ${g}학년 출판사 칸 없음(없으면 null)`);
    for (const v of Object.values(j.publishers || {})) if (v != null && typeof v !== "string") errs.push(`${s.placeId} ${j.subject}: 출판사는 문자열 또는 null`);
  }
}
for (const n of draft.notFound) { place(n.placeId, "notFound"); if (!n.reason) errs.push(`${n.placeId}: notFound 사유 없음`); }
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const out = { _meta: { note: "중학교 교과서 출판사 표(생성물, 손으로 고치지 않는다). research/data/middle-curriculum-draft.json에서 tools/build-middle-curriculum.mjs가 만든다.", checkedAt: draft._meta?.checkedAt ?? null, status: draft._meta?.status ?? null, count: draft.schools.length }, schools: draft.schools, notFound: draft.notFound };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/middle-curriculum.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("middle-curriculum.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(`교과서 표 ${draft.schools.length}교, 자료 없음 ${draft.notFound.length}교`);
