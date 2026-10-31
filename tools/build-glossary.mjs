// research/data/glossary-draft.json(조사 세션) → portal/data/glossary.json (용어사전, ⓘ 풀이).
//   - term·aliases는 서로 겹치지 않아야 한다(화면이 본문에서 용어를 찾아 ⓘ를 붙이기 때문). 초안이 없으면 빈 목록을 만든다.
// 사용: node tools/build-glossary.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "research/data/glossary-draft.json";
const draft = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, terms: [] };
const schema = JSON.parse(readFileSync("schema/glossary.schema.json", "utf8"));
const T = schema.properties.terms.items;
const errs = [];
const ids = new Set(), words = new Map();
for (const t of draft.terms) {
  for (const k of T.required) if (t[k] == null || t[k] === "" || (Array.isArray(t[k]) && !t[k].length)) errs.push(`${t.id ?? t.term ?? "?"}: ${k} 없음`);
  if (!new RegExp(T.properties.id.pattern).test(t.id || "")) errs.push(`${t.id}: id 형식(gl-NNN)`);
  if (ids.has(t.id)) errs.push(`${t.id}: id 중복`); ids.add(t.id);
  if (!T.properties.category.enum.includes(t.category)) errs.push(`${t.id}: category "${t.category}"`);
  if (!T.properties.status.enum.includes(t.status)) errs.push(`${t.id}: status ${t.status}`);
  for (const w of [t.term, ...(t.aliases || [])]) {
    if (!w || w.length < 2) { errs.push(`${t.id}: 표기 "${w}"는 2자 이상`); continue; }
    if (words.has(w)) errs.push(`${t.id}: 표기 "${w}"가 ${words.get(w)}와 겹침`);
    words.set(w, t.id);
  }
}
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const out = { _meta: { note: "용어사전(생성물, 손으로 고치지 않는다). research/data/glossary-draft.json에서 tools/build-glossary.mjs가 만든다.", checkedAt: draft._meta?.checkedAt ?? null, count: draft.terms.length }, terms: draft.terms };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/glossary.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("glossary.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(`용어 ${draft.terms.length}개, 표기 ${words.size}개`);
