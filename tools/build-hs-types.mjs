// research/data/hs-types-draft.json(조사 세션) → portal/data/hs-types.json (고교 유형 비교·경기 고입 달력·원서 절차·서류).
//   내부 점검 사정 문구는 portal/plain.js 규칙으로 사용자 말로 바꿔 내보낸다. 초안이 없으면 빈 구조를 만든다.
// 사용: node tools/build-hs-types.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "research/data/hs-types-draft.json";
const draft = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, types: [], calendar: [], procedure: [], documents: [] };
const { plain } = await import("../portal/plain.js");
const ST = ["confirmed", "reported", "estimated"];
const errs = [];
const needSrc = (w, x) => { if (!x?.name) errs.push(`${w}: source.name 없음`); };

const ids = new Set();
for (const t of draft.types) {
  if (ids.has(t.id)) errs.push(`types ${t.id} 중복`); ids.add(t.id);
  if (!Number.isInteger(t.order)) errs.push(`${t.id}: order(정수) 필요`);
  for (const k of ["selection", "timing", "cost", "curriculum", "admissionTraits"]) {
    const c = t[k];
    if (!c) { errs.push(`${t.id}.${k}: 없음`); continue; }
    if (c.value == null) { if (!c.nullReason) errs.push(`${t.id}.${k}: value가 null이면 nullReason 필요`); }
    else { if (!ST.includes(c.status)) errs.push(`${t.id}.${k}: status ${c.status}`); needSrc(`${t.id}.${k}`, c.source); }
  }
  if (!Array.isArray(t.pros) || !Array.isArray(t.cons)) errs.push(`${t.id}: pros·cons는 배열`);
}
for (const c of draft.calendar) { if (!/^\d{4}-\d{2}(-\d{2})?(~\d{4}-\d{2}(-\d{2})?)?$/.test(c.when || "")) errs.push(`calendar ${c.id}: when 형식`); if (!ST.includes(c.status)) errs.push(`calendar ${c.id}: status`); needSrc(`calendar ${c.id}`, c.source); }
draft.procedure.forEach((p, i) => { if (p.step !== i + 1) errs.push(`procedure: step이 ${i + 1}번째에 ${p.step}`); needSrc(`procedure ${p.step}`, p.source); });
for (const d of draft.documents) needSrc(`documents ${d.id}`, d.source);
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const clean = (v) => (typeof v === "string" ? plain(v) : Array.isArray(v) ? v.map(clean) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "url" ? x : clean(x)])) : v);
const body = clean(Object.fromEntries(Object.entries(draft).filter(([k]) => k !== "_meta")));
const out = { _meta: { note: "고교 유형 비교·경기 고입 달력·원서 절차·서류(생성물, 손으로 고치지 않는다). research/data/hs-types-draft.json에서 tools/build-hs-types.mjs가 만든다.", checkedAt: draft._meta?.checkedAt ?? null }, ...body };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/hs-types.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("hs-types.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(`유형 ${draft.types.length}개, 달력 ${draft.calendar.length}행, 절차 ${draft.procedure.length}단계, 서류 ${draft.documents.length}개`);
