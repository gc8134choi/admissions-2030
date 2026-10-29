// research/data/admission-types-draft.json(조사 세션) → portal/data/admission-types.json (대입 제도 > 전형 한눈에).
//   - 비중 묶음(shares)마다 상태(status)·출처 종류(official|media)·출처를 요구한다. 계산한 비율은 percentKind=derived로 구분한다.
//   - 초안이 없으면 빈 구조를 만든다(화면은 "아직 정리 중이에요").
// 사용: node tools/build-admission-types.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "research/data/admission-types-draft.json";
const draft = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, types: [], glance: [], shares: [] };
const schema = JSON.parse(readFileSync("schema/admission-types.schema.json", "utf8"));
const P = schema.properties;
const typeEnum = P.types.items.properties.id.enum, seasonEnum = P.types.items.properties.season.enum;
const sp = P.shares.items.properties;
const errs = [];
const tid = new Set();
for (const t of draft.types) {
  if (!typeEnum.includes(t.id)) errs.push(`types: id "${t.id}"는 ${typeEnum.join("|")}`);
  if (tid.has(t.id)) errs.push(`types: ${t.id} 중복`); tid.add(t.id);
  if (!seasonEnum.includes(t.season)) errs.push(`${t.id}: season ${t.season}`);
  if (!t.name || !t.summary) errs.push(`${t.id}: name·summary 필요`);
}
for (const g of draft.glance) { if (!tid.has(g.typeId)) errs.push(`glance: typeId ${g.typeId}가 types에 없음`); if (!g.focus || !g.favors) errs.push(`glance ${g.typeId}: focus·favors 필요`); }
const sid = new Set();
for (const s of draft.shares) {
  for (const k of P.shares.items.required) if (s[k] == null || s[k] === "") errs.push(`shares ${s.id ?? "?"}: ${k} 없음`);
  if (sid.has(s.id)) errs.push(`shares: ${s.id} 중복`); sid.add(s.id);
  if (!sp.status.enum.includes(s.status)) errs.push(`${s.id}: status ${s.status}`);
  if (!sp.sourceKind.enum.includes(s.sourceKind)) errs.push(`${s.id}: sourceKind ${s.sourceKind}는 official|media`);
  if (!(s.sources || []).length) errs.push(`${s.id}: sources 비어 있음`);
  for (const r of s.rows || []) {
    if (r.typeId && !tid.has(r.typeId)) errs.push(`${s.id}: row typeId ${r.typeId}가 types에 없음`);
    if (r.percent != null && !(r.percent >= 0 && r.percent <= 100)) errs.push(`${s.id} ${r.label}: percent 범위`);
    if (r.percent != null && !["reported", "derived"].includes(r.percentKind)) errs.push(`${s.id} ${r.label}: percent에는 percentKind(reported|derived)가 필요`);
  }
}
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const out = { _meta: { note: "전형 한눈에(생성물, 손으로 고치지 않는다). research/data/admission-types-draft.json에서 tools/build-admission-types.mjs가 만든다. 비중은 출처 종류와 상태를 묶음마다 붙인다.", checkedAt: draft._meta?.checkedAt ?? null }, types: draft.types, glance: draft.glance, shares: draft.shares, notes: draft.notes || [] };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/admission-types.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("admission-types.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(`전형 ${draft.types.length}종, 한눈에 ${draft.glance.length}행, 비중 묶음 ${draft.shares.length}개`);
