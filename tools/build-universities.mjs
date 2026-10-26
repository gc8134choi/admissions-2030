// tools/universities-manual.json(관심 대학 정본) → portal/data/universities.json (대학 id·이름·입학처 URL).
//   - id는 s-900~s-999 전용(학교 id와 분리). 조사 초안(research/data/admission-rules-draft.json)의 universities 맵이 이 목록과 어긋나면 실패한다.
//   - admission-rules·matches 생성기와 대학 선택 화면이 이 목록을 대학의 기준으로 쓴다(요강이 없는 대학도 목록에는 남는다).
// 사용: node tools/build-universities.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";

const rd = (p) => JSON.parse(readFileSync(p, "utf8"));
const man = rd("tools/universities-manual.json");
const errs = [];
const ids = new Set(), names = new Set();
for (const u of man.universities) {
  if (!/^s-9\d\d$/.test(u.id)) errs.push(`${u.id}: 대학 id는 s-900~999 구간이어야 함`);
  if (ids.has(u.id)) errs.push(`${u.id}: id 중복`);
  if (names.has(u.name)) errs.push(`${u.name}: 이름 중복`);
  ids.add(u.id); names.add(u.name);
  if (u.admissionsUrl != null && !/^https:\/\//.test(u.admissionsUrl)) errs.push(`${u.id}: admissionsUrl은 https 주소 또는 null`);
}
let draft = null; try { draft = rd("research/data/admission-rules-draft.json"); } catch {}
if (draft) for (const [id, name] of Object.entries(draft._meta.universities || {})) {
  const u = man.universities.find((x) => x.id === id);
  if (!u) errs.push(`조사 초안의 ${id}(${name})가 universities-manual.json에 없음`);
  else if (u.name !== name) errs.push(`${id}: 이름 불일치(정본 ${u.name} / 초안 ${name})`);
}
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }

const out = { _meta: { note: "관심 대학 목록(생성물, 손으로 고치지 않는다). tools/universities-manual.json에서 tools/build-universities.mjs가 만든다. 대학 id는 s-900~s-999 전용.", count: man.universities.length }, universities: man.universities };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/universities.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("universities.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(`${man.universities.length} universities (입학처 URL ${man.universities.filter((u) => u.admissionsUrl).length})`);
