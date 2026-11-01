// research/data/timeline-draft.json(조사 세션) → portal/data/timeline.json (초6 기준 큰 그림 연표).
//   내부 점검 사정 문구는 portal/plain.js 규칙으로 사용자 말로 바꿔 내보낸다. 초안이 없으면 빈 구조를 만든다.
// 사용: node tools/build-timeline.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "research/data/timeline-draft.json";
const draft = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, events: [] };
const { plain } = await import("../portal/plain.js");
const ST = ["confirmed", "reported", "estimated"];
const errs = [];
const needSrc = (w, x) => { if (!x?.name) errs.push(`${w}: source.name 없음`); };

const policy = new Set(JSON.parse(readFileSync("portal/data/policy.json", "utf8")).map((r) => r.id));
const STAGE = ["초6", "중1", "중2", "중3", "고1", "고2", "고3", "대입"];
const eid = new Set();
for (const e of draft.events) {
  if (eid.has(e.id)) errs.push(`events ${e.id} 중복`); eid.add(e.id);
  if (!STAGE.includes(e.stage)) errs.push(`${e.id}: stage ${e.stage}`);
  if (!/^\d{4}-\d{2}(~\d{4}-\d{2})?$/.test(e.when || "")) errs.push(`${e.id}: when은 YYYY-MM[~YYYY-MM]`);
  if (!ST.includes(e.status)) errs.push(`${e.id}: status ${e.status}`);
  if (e.source) needSrc(e.id, e.source); else if (e.status !== "estimated") errs.push(`${e.id}: source 없으면 estimated여야 함`);
  for (const p of e.policyIds || []) if (!policy.has(p)) errs.push(`${e.id}: policyIds ${p}가 policy.json에 없음`);
}
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const clean = (v) => (typeof v === "string" ? plain(v) : Array.isArray(v) ? v.map(clean) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "url" ? x : clean(x)])) : v);
const body = clean(Object.fromEntries(Object.entries(draft).filter(([k]) => k !== "_meta")));
const out = { _meta: { note: "초6 기준 큰 그림 연표(생성물, 손으로 고치지 않는다). research/data/timeline-draft.json에서 tools/build-timeline.mjs가 만든다.", checkedAt: draft._meta?.checkedAt ?? null }, ...body };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/timeline.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("timeline.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(`연표 ${draft.events.length}건`);
