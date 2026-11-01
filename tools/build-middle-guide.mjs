// research/data/middle-guide-draft.json(조사 세션) → portal/data/middle-guide.json (중학교 입학 준비 가이드).
//   내부 점검 사정 문구는 portal/plain.js 규칙으로 사용자 말로 바꿔 내보낸다. 초안이 없으면 빈 구조를 만든다.
// 사용: node tools/build-middle-guide.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "research/data/middle-guide-draft.json";
const draft = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, sections: [] };
const { plain } = await import("../portal/plain.js");
const ST = ["confirmed", "reported", "estimated"];
const errs = [];
const needSrc = (w, x) => { if (!x?.name) errs.push(`${w}: source.name 없음`); };

const sid = new Set();
for (const s of draft.sections) {
  if (sid.has(s.id)) errs.push(`sections ${s.id} 중복`); sid.add(s.id);
  s.items.forEach((it, i) => {
    const w = `${s.id}[${i}]`;
    if (!ST.includes(it.status)) errs.push(`${w}: status ${it.status}`);
    if (it.when && !/^\d{4}-\d{2}(-\d{2})?(~\d{4}-\d{2}(-\d{2})?)?$/.test(it.when)) errs.push(`${w}: when 형식`);
    if (!it.source && !it.nullReason) errs.push(`${w}: source 또는 nullReason 필요`);
    if (it.source) needSrc(w, it.source);
  });
}
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const clean = (v) => (typeof v === "string" ? plain(v) : Array.isArray(v) ? v.map(clean) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "url" ? x : clean(x)])) : v);
const body = clean(Object.fromEntries(Object.entries(draft).filter(([k]) => k !== "_meta")));
const out = { _meta: { note: "중학교 입학 준비 가이드(생성물, 손으로 고치지 않는다). research/data/middle-guide-draft.json에서 tools/build-middle-guide.mjs가 만든다.", checkedAt: draft._meta?.checkedAt ?? null }, ...body };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/middle-guide.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("middle-guide.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(`구역 ${draft.sections.length}개, 항목 ${draft.sections.reduce((n, s) => n + s.items.length, 0)}개`);
