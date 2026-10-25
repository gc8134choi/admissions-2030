// 편제표(offerings) × 대학 요강(admission-rules) → portal/data/matches.json  (학교 × 모집단위별 "권장 과목" 충족 계산)
//   입력: offerings.json, offerings-index.json, admission-rules.json, groups.json, schools.json (읽기만)
//   계산(요건 하나마다, 요건 과목 집합 C = subjectIds 또는 교과군 group.subjectIds):
//     guaranteed  C 중 학교 지정(required) 과목
//     selectable  C 중 선택(elective) 과목. 택n 묶음(groupId)마다 pick개까지만 고를 수 있다
//     reachable   guaranteed + Σ 묶음별 min(후보 수, pick) — 한 과목이 여러 묶음에 있으면 먼저 나온 묶음에서만 센다
//     blockedBy   후보가 pick보다 많아 다 못 고르는 묶음(같은 택n 묶음 충돌)
//   "개설 후보"는 편제표에 있다는 뜻이고 실제 개설은 학교 확정이 필요하다. 값을 못 만드는 칸은 null + 사유.
// 사용: node tools/build-matches.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";

const rd = (p) => JSON.parse(readFileSync(p, "utf8"));
const D = "portal/data/";
const offerings = rd(D + "offerings.json");
const idx = rd(D + "offerings-index.json").byOffering;
const rules = rd(D + "admission-rules.json");
const groups = new Map(rd(D + "groups.json").map((g) => [g.id, g]));
const schoolsRaw = rd(D + "schools.json");
const schools = (Array.isArray(schoolsRaw) ? schoolsRaw : schoolsRaw.schools).map((s) => s.id);

const bySchool = new Map(schools.map((s) => [s, []]));
for (const o of offerings) bySchool.get(o.schoolId)?.push({ ...o, subjectId: idx[o.id] });

const uniq = (a) => [...new Set(a)];
function evalReq(q, rows) {
  const C = new Set(q.subjectIds.length ? q.subjectIds : q.group?.subjectIds || []);
  const min = q.minCount ?? 1;
  const inC = rows.filter((r) => r.subjectId && C.has(r.subjectId));
  const req = inC.filter((r) => r.slot === "required");
  const guaranteed = uniq(req.map((r) => r.subjectId));
  const taken = new Set(guaranteed);
  const sel = inC.filter((r) => r.slot === "elective" && !taken.has(r.subjectId));
  const gmap = new Map(); // groupId -> {pick,size,term,wanted:Set}
  let free = 0; const freeSet = new Set();
  const seen = new Set();
  for (const r of sel) {
    if (seen.has(r.subjectId)) continue;
    if (r.groupId && groups.has(r.groupId)) {
      const g = groups.get(r.groupId);
      const e = gmap.get(r.groupId) ?? { groupId: r.groupId, label: g.label, term: g.term, pick: g.pick, size: g.size, wanted: [] };
      e.wanted.push(r.subjectId); gmap.set(r.groupId, e); seen.add(r.subjectId);
    } else if (!r.groupId) { freeSet.add(r.subjectId); seen.add(r.subjectId); }
  }
  free = freeSet.size;
  let gain = free; const blockedBy = [];
  for (const e of gmap.values()) { gain += Math.min(e.wanted.length, e.pick); if (e.wanted.length > e.pick) blockedBy.push(e); }
  const offered = guaranteed.length + seen.size;
  const reachable = guaranteed.length + gain;
  const termsOf = (id) => uniq(inC.filter((r) => r.subjectId === id).map((r) => r.term)).sort();
  const state = guaranteed.length >= min ? "guaranteed" : reachable >= min ? "reachable" : offered >= min ? "blocked" : "absent";
  return {
    label: q.orGroupLabel ?? (q.legacyKeys || []).join("·"), minCount: min, strength: q.strength, state,
    counts: { offered: Math.min(offered, min), reachable: Math.min(reachable, min), guaranteed: Math.min(guaranteed.length, min) },
    guaranteed: guaranteed.map((id) => ({ subjectId: id, terms: termsOf(id) })),
    selectable: [...seen].filter((id) => !taken.has(id)).map((id) => { const r = sel.find((x) => x.subjectId === id); return { subjectId: id, terms: termsOf(id), groupId: r.groupId ?? null, pick: r.groupId ? groups.get(r.groupId)?.pick ?? null : null }; }),
    blockedBy: blockedBy.map((e) => ({ groupId: e.groupId, label: e.label, term: e.term, pick: e.pick, size: e.size, wanted: e.wanted })),
  };
}

const matches = [];
for (const schoolId of schools) for (const rule of rules.rules) {
  const base = { schoolId, ruleId: rule.ruleId, universityId: rule.universityId, track: rule.track };
  if (!rule.requirements.length) { matches.push({ ...base, requirements: null, summary: null, nullReason: rule.requirementsNullReason || "과목 요건이 요강에 없음" }); continue; }
  const unreadable = rule.requirements.find((q) => !q.subjectIds.length && !q.group);
  if (unreadable) { matches.push({ ...base, requirements: null, summary: null, nullReason: `교과군 요건을 과목 집합으로 풀지 못함: ${unreadable.orGroupLabel}` }); continue; }
  // 교과군 요건과 특정 과목 요건이 겹치면(예: 과학 진로 3과목 중 2과목은 지정) 겹친 과목은 교과군 몫에서 한 번만 센다
  const named = new Set(rule.requirements.flatMap((q) => q.subjectIds));
  const reqs = rule.requirements.map((q) => {
    if (q.subjectIds.length || !q.group) return evalReq(q, bySchool.get(schoolId));
    const overlap = q.group.subjectIds.filter((id) => named.has(id)).length;
    const adj = { ...q, minCount: Math.max(0, (q.minCount ?? 1) - overlap), group: { ...q.group, subjectIds: q.group.subjectIds.filter((id) => !named.has(id)) } };
    const r = evalReq(adj, bySchool.get(schoolId));
    return overlap ? { ...r, label: q.orGroupLabel, minCount: adj.minCount, note: `지정 과목 ${overlap}과목은 위 항목에서 센 것을 빼고 ${adj.minCount}과목이 더 필요해요` } : r;
  });
  const sum = (f) => reqs.reduce((a, r) => a + f(r), 0);
  const need = sum((r) => r.minCount);
  const offered = sum((r) => r.counts.offered), reachable = sum((r) => r.counts.reachable);
  matches.push({ ...base, requirements: reqs, summary: { need, guaranteed: sum((r) => r.counts.guaranteed), offered, reachable, blocked: offered - reachable, absent: need - offered }, nullReason: null });
}
const out = { _meta: { note: "학교×모집단위 권장 과목 충족 계산(생성물, 손으로 고치지 않는다). tools/build-matches.mjs. 편제표는 개설 '후보'이고 요강은 2028학년도 기준 참고 구조예요.", admissionYear: rules._meta.admissionYear, count: matches.length }, matches };
const json = JSON.stringify(out, null, 1) + "\n";
const target = D + "matches.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("matches.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
const ok = matches.filter((m) => m.summary);
console.log(`${matches.length} matches (계산 ${ok.length}, null ${matches.length - ok.length})`);
for (const m of ok.slice(0, 8)) console.log(m.schoolId, m.ruleId, JSON.stringify(m.summary));
