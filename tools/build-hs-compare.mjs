// research/data/hs-compare-draft.json(조사 세션) → portal/data/hs-compare.json (고교 비교표).
//   - 학교는 placeId(places-draft의 고등학교)로 연결하고 schoolId가 있으면 schools.json에 있어야 한다.
//   - value가 null이면 nullReason 필수, 수치 항목(type number 또는 needsAsOf)은 asOf 필수, link 항목은 https 주소.
//   - 초안이 없으면 빈 구조를 만든다(화면은 "아직 정리 중이에요").
// 사용: node tools/build-hs-compare.mjs [--check]
import { externalIdsFor } from "./lib/external-ids.mjs";
import { withSourceIds } from "./lib/source-ids.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "research/data/hs-compare-draft.json", PL = "research/data/places-draft.json";
const draft = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, fields: [], schools: [] };
const level = new Map((existsSync(PL) ? JSON.parse(readFileSync(PL, "utf8")).items : []).map((p) => [p.placeId, p.level]));
const schoolsRaw = JSON.parse(readFileSync("portal/data/schools.json", "utf8"));
const schoolIds = new Set((Array.isArray(schoolsRaw) ? schoolsRaw : schoolsRaw.schools).map((s) => s.id));
const schema = JSON.parse(readFileSync("schema/hs-compare.schema.json", "utf8"));
const FT = schema.properties.fields.items.properties.type.enum;
const ST = ["confirmed", "reported", "estimated"];
const errs = [];
const fid = new Map();
for (const f of draft.fields) {
  for (const k of schema.properties.fields.items.required) if (f[k] == null || f[k] === "") errs.push(`fields ${f.id ?? "?"}: ${k} 없음`);
  if (fid.has(f.id)) errs.push(`fields: ${f.id} 중복`); fid.set(f.id, f);
  if (!FT.includes(f.type)) errs.push(`fields ${f.id}: type "${f.type}"는 ${FT.join("|")}`);
}
const seen = new Set();
for (const s of draft.schools) {
  if (!level.has(s.placeId)) errs.push(`${s.placeId}: places 초안에 없음`);
  else if (level.get(s.placeId) !== "high") errs.push(`${s.placeId}: 고등학교가 아님`);
  if (seen.has(s.placeId)) errs.push(`${s.placeId}: 중복`); seen.add(s.placeId);
  if (s.schoolId && !schoolIds.has(s.schoolId)) errs.push(`${s.placeId}: schoolId ${s.schoolId}가 schools.json에 없음`);
  for (const [id, v] of Object.entries(s.values || {})) {
    const f = fid.get(id), w = `${s.placeId}.${id}`;
    if (!f) { errs.push(`${w}: fields에 없는 항목`); continue; }
    if (v.status && !ST.includes(v.status)) errs.push(`${w}: status ${v.status}`);
    if (v.value == null) { if (!v.nullReason) errs.push(`${w}: value가 null이면 nullReason 필요`); continue; }
    if (!v.status) errs.push(`${w}: status 없음`);
    if (!v.source?.name) errs.push(`${w}: source.name 없음`);
    if ((f.type === "number" || f.needsAsOf) && v.asOf == null) errs.push(`${w}: 수치 항목은 asOf(기준연도) 필요`);
    if (f.type === "number" && typeof v.value !== "number") errs.push(`${w}: number 항목인데 값이 숫자가 아님`);
    if (f.type === "link" && !/^https?:\/\//.test(String(v.value))) errs.push(`${w}: link 항목은 http(s) 주소`);
    if (f.type === "boolean" && typeof v.value !== "boolean") errs.push(`${w}: boolean 항목`);
  }
}
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const { plain } = await import("../portal/plain.js"); // 출처명 안의 내부 행 번호(policy gg-10 등)를 사람이 읽는 말로
const cleanSrc = (v) => (v ? { ...v, ...(v.source?.name ? { source: { ...v.source, name: plain(v.source.name) } } : {}), ...(v.nullReason ? { nullReason: plain(v.nullReason) } : {}) } : v);
for (const s of draft.schools) for (const k of Object.keys(s.values || {})) s.values[k] = cleanSrc(s.values[k]);
const fields = [...draft.fields].sort((a, b) => a.order - b.order);
// 확인하지 못한 표기는 화면에서 뺀다: 용인홍천고의 '단설'(단독 설립) 구분은 확인 전이라 설립(공립)과 설립일만 보인다
for (const s of draft.schools) if (s.placeId === "pl-014" && typeof s.values?.founding?.value === "string") s.values.founding.value = s.values.founding.value.replace("·단설", "");
// 외·국·자(용인한국외국어대부설고)의 배점·교육과정 칸: 모집요강에만 있다는 사유와 다음 행동
const ADM = "학교별 모집요강(입학전형 시행계획)에만 있고 학교알리미 공시 목록에 없어요 → 학교 입학처 요강 공고(보통 6~7월)에서 확인";
for (const s of draft.schools) if (s.placeId === "pl-015") for (const k of ["admission", "curriculum", "subjectCount"]) if (s.values?.[k] && s.values[k].value == null) s.values[k].nullReason = ADM;
for (const s of draft.schools) { const x = externalIdsFor(s.placeId); if (x) s.externalIds = x; } // 외부 코드(NEIS·학교알리미)
const out = { _meta: { note: "고교 비교표(생성물, 손으로 고치지 않는다). research/data/hs-compare-draft.json에서 tools/build-hs-compare.mjs가 만든다. 값마다 기준연도·상태·출처가 붙는다.", checkedAt: draft._meta?.checkedAt ?? null, schoolCount: draft.schools.length }, fields, schools: draft.schools };
const json = JSON.stringify(withSourceIds(out), null, 1) + "\n";
const target = "portal/data/hs-compare.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("hs-compare.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(`항목 ${fields.length}개, 학교 ${draft.schools.length}곳`);
