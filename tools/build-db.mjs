#!/usr/bin/env node
// 편제표 전사본(content/curriculum/*.json) → 정규화된 통합 DB(content/db/*)
//
//   node tools/build-db.mjs          DB 생성 (검증 오류가 있어도 파일은 쓰고 종료코드 1)
//   node tools/build-db.mjs --check  파일을 쓰지 않고 검증만 (CI/수동 점검용)
// content/db/ 는 전부 생성물이다. 직접 고치지 말 것.
// 쓰기: 임시 폴더(content/.db-build-*)에 먼저 만들고, 오류가 하나도 없을 때만 content/db 를 통째로 교체한다.
//       오류가 있으면 content/db 는 건드리지 않는다(이전 DB 유지, 종료코드 1).
//
// 입력: content/curriculum/*.json (읽기 전용 원본), content/data/schools.json, content/data/display-images.json, tools/db-rules.json
// 출력: content/db/ (스키마 설명은 docs/db-schema.md)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CUR_DIR = join(ROOT, 'content', 'curriculum');
const SCHOOLS_FILE = join(ROOT, 'content', 'data', 'schools.json');
const RULES_FILE = join(ROOT, 'tools', 'db-rules.json');
const OUT_DIR = join(ROOT, 'content', 'db');
const CHECK_ONLY = process.argv.includes('--check');
const SCHEMA_VERSION = '2.1.0';

const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
const ko = (a, b) => String(a).localeCompare(String(b), 'ko');
const uniq = a => [...new Set(a)];
const sum = (a, f = x => x) => a.reduce((s, x) => s + (f(x) || 0), 0);
const keyOf = s => String(s).normalize('NFC').replace(/\s+/g, '');
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

// ---------- 규칙 ----------
const rules = readJson(RULES_FILE);
const AREAS = rules.areas;
const KIND_ORDER = rules.kindOrder;
const aliasOf = name => rules.aliases[keyOf(name)] ?? rules.aliases[name] ?? name;
const areaMap = new Map(), subAreaMap = new Map(), ambiguous = new Map();
for (const [area, names] of Object.entries(rules.areaBySubject)) for (const n of names) areaMap.set(keyOf(n), area);
for (const [sub, names] of Object.entries(rules.subAreaBySubject)) for (const n of names) subAreaMap.set(keyOf(n), sub);
for (const [n, why] of Object.entries(rules.ambiguousSubjects)) ambiguous.set(keyOf(n), why);
const compositeSet = new Set(rules.composites.map(keyOf));
// 수능 영역 매핑 규칙(§ csat)
const CSAT = rules.csat;
const csatIn = new Map(), csatBase = new Map(), csatOverride = new Map(), csatNotes = new Map();
for (const [a, names] of Object.entries(CSAT.in)) for (const n of names) csatIn.set(keyOf(n), a);
for (const [a, names] of Object.entries(CSAT.base)) for (const n of names) csatBase.set(keyOf(n), a);
for (const [a, names] of Object.entries(CSAT.areaOverride)) for (const n of names) csatOverride.set(keyOf(n), a);
for (const [n, t] of Object.entries(CSAT.notes)) csatNotes.set(keyOf(n), t);
const csatConfirmed = new Set(CSAT.confirmed.map(keyOf));
// csatConfidence: confirmed(교육부 확정안) / reported(보도·2차 자료) / unconfirmed(근거 없음·추정 — "해당 없음"이 아니라 "미확인")
function csatOf(key, area, subArea) {
  const note = csatNotes.get(key) ?? null;
  let r;
  if (csatIn.has(key)) r = { csatArea: csatIn.get(key), csatScope: 'in', csatNote: note };
  else if (csatBase.has(key)) r = { csatArea: csatBase.get(key), csatScope: 'base', csatNote: note };
  else {
    const a = csatOverride.get(key) ?? CSAT.defaultBySubArea[subArea] ?? CSAT.defaultByArea[area] ?? null;
    r = a ? { csatArea: a, csatScope: 'out', csatNote: note } : { csatArea: null, csatScope: 'none', csatNote: null };
  }
  if (r.csatScope === 'none') return r; // 수능 영역이 없는 교과: 판정 대상 아님
  r.csatConfidence = csatConfirmed.has(key) ? 'confirmed'
    : r.csatScope === 'base' || (CSAT.unconfirmedAreas[r.csatScope] ?? []).includes(r.csatArea) ? 'unconfirmed' : 'reported';
  return r;
}

// ---------- 입력 ----------
const files = readdirSync(CUR_DIR).filter(f => f.endsWith('.json')).sort();
const curricula = [];
for (const f of files) {
  const d = readJson(join(CUR_DIR, f));
  if (!Array.isArray(d.courses) || !Array.isArray(d.electiveGroups)) continue;
  curricula.push({ file: f, d });
}
if (!curricula.length) { console.error('content/curriculum 에 편제표 JSON이 없습니다.'); process.exit(2); }
const SCHOOL_ID_RE = /^(school-[a-z0-9]+(-[a-z0-9]+)*|s-\d{3,})$/;
const schoolsIn = existsSync(SCHOOLS_FILE) ? readJson(SCHOOLS_FILE).items || [] : [];

const issues = []; // 검증 결과 (level: error | warn | info)
const note = (level, curriculumId, check, message, extra = {}) => issues.push({ level, curriculumId, schoolId: extra.schoolId ?? null, check, message, ...extra });

// ---------- 과목 정규화 ----------
const spellings = new Map(); // subjectKey -> Map(printed -> count)
const subjectDefs = new Map(); // subjectKey -> def
const unmapped = new Map(); // subjectKey -> printed names

function resolveSubject(printed) {
  const k0 = keyOf(printed);
  let parts = null;
  if (compositeSet.has(k0)) parts = printed.split(/[\/↔]/).map(s => aliasOf(s.trim()));
  const comps = parts ?? [aliasOf(printed)];
  const compKeys = comps.map(keyOf);
  const subjectKey = parts ? [...compKeys].sort(ko).join('|') : compKeys[0];
  const areas = uniq(compKeys.map(k => areaMap.get(k)).filter(Boolean));
  const missing = compKeys.filter(k => !areaMap.has(k));
  if (missing.length) { const u = unmapped.get(subjectKey) ?? new Set(); u.add(printed); unmapped.set(subjectKey, u); }
  const area = (parts && rules.compositeArea[[...comps.map(aliasOf).map(keyOf)].sort(ko).join('|')]) || areas[0] || null;
  const subArea = parts ? null : subAreaMap.get(compKeys[0]) ?? null;
  const sp = spellings.get(subjectKey) ?? new Map();
  sp.set(printed, (sp.get(printed) || 0) + 1);
  spellings.set(subjectKey, sp);
  if (!subjectDefs.has(subjectKey)) {
    subjectDefs.set(subjectKey, {
      subjectKey, isComposite: !!parts, components: parts ? uniq(comps) : [],
      area, areasAll: uniq([area, ...areas].filter(Boolean)), subArea,
      ambiguous: compKeys.map(k => ambiguous.get(k)).filter(Boolean).join(' / ') || null,
      ...(parts ? { csatArea: null, csatScope: 'none', csatNote: null } : csatOf(compKeys[0], area, subArea)),
    });
  }
  return subjectDefs.get(subjectKey);
}

// ---------- 구분(kind) ----------
const normKinds = k => (Array.isArray(k) ? k : k ? [k] : []).filter(x => KIND_ORDER.includes(x));
const primaryKind = ks => KIND_ORDER.find(x => ks.includes(x)) ?? null;
const normCreativeName = s => s.replace(/[·・\s]/g, '').replace('자율자치활동', '자율·자치활동');

// ---------- 1단계: 행(offerings), 그룹, 학교별 요약 ----------
const rows = [], groups = [], flagsOut = [], curOut = [];
const schoolOut = new Map();
const TERMS = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2'];

for (const { d } of curricula) {
  const curId = d.id;
  const schoolId = d.schoolId;
  const entryYear = d.entryYear ?? d.cohort;
  if (entryYear == null) note('error', curId, 'entry-year', 'entryYear(입학학년도)가 없습니다.', { schoolId });
  const sIn = schoolsIn.find(s => s.id === schoolId);
  if (!schoolId || !SCHOOL_ID_RE.test(schoolId)) note('warn', curId, 'school-id-format', `schoolId 형식이 규칙(school-<slug> 또는 s-NNN)과 다릅니다: ${schoolId}`, { schoolId });
  if (!sIn) note('error', curId, 'school-missing', `schools.json 에 ${schoolId} 가 없습니다. 학교는 id 로만 연결되므로 schools.json 에 먼저 등록하세요.`, { schoolId });
  if (sIn && d.school && sIn.name !== d.school) note('error', curId, 'school-name-mismatch', `학교 이름 불일치: schools.json "${sIn.name}" / 편제표 "${d.school}" — 같은 id 의 이름이 파일마다 다릅니다`, { schoolId });
  if (!schoolOut.has(schoolId)) schoolOut.set(schoolId, { ...(sIn ?? { id: schoolId, name: d.school, _meta: { confidence: 'unverified', note: 'schools.json 에 없어 편제표에서 생성' } }), curriculumIds: [] });
  schoolOut.get(schoolId).curriculumIds.push(curId);

  const legend = d.legend ?? {};
  const legendText = Object.values(legend).join(' ');
  const kindScheme = !Object.keys(legend).length ? 'printed' : (/융합/.test(legendText) && !/일반|진로/.test(legendText) ? 'fusion-only' : 'printed');
  const conf = d._meta?.confidence ?? 'unverified';
  const mk = (r, extra) => ({ curriculumId: curId, schoolId, entryYear, ...r, ...extra });
  const crows = [];
  const termInfo = t => ({ term: t, grade: Number(t[0]), semester: Number(t[2]) });

  d.courses.forEach((c, i) => {
    const sub = resolveSubject(c.subject); const ks = normKinds(c.kind);
    crows.push(mk(termInfo(c.term), { mode: 'required', slot: i, subjectName: c.subject, subjectKey: sub.subjectKey, area: sub.area, areasAll: sub.areasAll, subArea: sub.subArea, csatArea: sub.csatArea, csatScope: sub.csatScope, csatConfidence: sub.csatConfidence ?? null, sourceArea: c.area ?? null, kindSource: c.kindSource ?? null, kinds: ks, kind: primaryKind(ks), credits: c.credits, basicCredits: c.basicCredits ?? null, groupKey: null, extra: c.extra ?? null, graded: c.graded ?? null }));
  });
  d.electiveGroups.forEach(g => {
    const gKey = `${curId}#${g.id}`;
    const opts = g.options.map((o, j) => {
      const sub = resolveSubject(o.subject); const ks = normKinds(o.kind ?? g.kind);
      return mk(termInfo(g.term), { mode: 'elective', slot: j, subjectName: o.subject, subjectKey: sub.subjectKey, area: sub.area, areasAll: sub.areasAll, subArea: sub.subArea, csatArea: sub.csatArea, csatScope: sub.csatScope, csatConfidence: sub.csatConfidence ?? null, sourceArea: null, kindSource: o.kindSource ?? g.kindSource ?? null, kinds: ks, kind: primaryKind(ks), credits: g.creditsEach, basicCredits: null, groupKey: gKey, extra: o.extra ?? null, graded: o.graded ?? null });
    });
    crows.push(...opts);
    const areasInPool = uniq(opts.map(o => o.area).filter(Boolean));
    const raw = g.area ?? null;
    const lifeSet = new Set(rules.lifeAreas);
    let poolType;
    if (raw && /교과\(군\)\s*간/.test(raw)) poolType = 'cross';
    else if (raw && /기초교과/.test(raw)) poolType = 'basic';
    else if (raw && /제2외국어|기술·가정/.test(raw)) poolType = 'life';
    else if (raw) poolType = 'in-area';
    else if (areasInPool.length === 1) poolType = 'in-area';
    else if (areasInPool.length && areasInPool.every(a => lifeSet.has(a))) poolType = 'life';
    else poolType = 'cross';
    if (g.pick > g.options.length) note('error', curId, 'pick-exceeds-options', `${g.id}: 택${g.pick} 인데 후보가 ${g.options.length}개`, { schoolId });
    groups.push({ groupKey: gKey, curriculumId: curId, schoolId, entryYear, groupId: g.id, ...termInfo(g.term), pick: g.pick, creditsEach: g.creditsEach, creditsTotal: g.pick * g.creditsEach, optionCount: g.options.length, poolLabelRaw: raw, poolType, areasInPool, sameArea: areasInPool.length === 1, kindsPrinted: uniq(opts.flatMap(o => o.kinds)).sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b)), subjectKeys: opts.map(o => o.subjectKey) });
  });
  (d.outsideSchool ?? []).forEach((o, i) => {
    const sub = resolveSubject(o.subject); const ks = normKinds(o.kind);
    crows.push(mk(termInfo(o.term), { mode: 'outside', slot: i, subjectName: o.subject, subjectKey: sub.subjectKey, area: sub.area, areasAll: sub.areasAll, subArea: sub.subArea, csatArea: sub.csatArea, csatScope: sub.csatScope, csatConfidence: sub.csatConfidence ?? null, sourceArea: o.area ?? null, kindSource: o.kindSource ?? null, kinds: ks, kind: primaryKind(ks), credits: o.credits, basicCredits: o.basicCredits ?? null, groupKey: null, extra: o.extra ?? null, graded: null, note: o.note ?? null }));
  });

  // 행 ID, 구분 상태
  const seq = {};
  for (const r of crows) {
    const n = (seq[`${r.term}:${r.mode}`] = (seq[`${r.term}:${r.mode}`] ?? 0) + 1);
    r.id = `${curId}#${r.term}#${r.mode[0]}${String(n).padStart(2, '0')}`;
    r.kindStatus = r.kind ? (r.kindSource === '글자색' ? 'color' : 'printed') : (kindScheme === 'fusion-only' ? 'unmarked' : 'missing');
    r.kindGuess = null; r.flagIds = []; r.openFlagIds = []; r.checkedFlagIds = []; r.readConfidence = 'ok'; r.confidence = conf;
    r.creditsDiffer = r.basicCredits != null && r.basicCredits !== r.credits;
  }
  curOut.push({ d, curId, schoolId, entryYear, conf, kindScheme, rows: crows });
  rows.push(...crows);
}

// ---------- 2단계: 다른 학교 기준 구분 추정 (만장일치일 때만) ----------
const printedKinds = new Map();
for (const r of rows) if (r.kind) { const s = printedKinds.get(r.subjectKey) ?? new Map(); s.set(r.kind, (s.get(r.kind) || 0) + 1); printedKinds.set(r.subjectKey, s); }
for (const r of rows) {
  if (r.kind) continue;
  const s = printedKinds.get(r.subjectKey);
  if (s && s.size === 1) { r.kindGuess = [...s.keys()][0]; r.kindStatus = 'inferred'; }
}

// ---------- 3단계: flags 를 행/그룹에 연결 ----------
for (const c of curOut) {
  (c.d.flags ?? []).forEach((f, i) => {
    const id = `flag-${c.curId}-${String(i + 1).padStart(2, '0')}`;
    const ref = f.ref ?? '';
    const term = (ref.match(/(?:^|\s)([123]-[12])(?![-\d])/) ?? [])[1] ?? null;
    const gid = (ref.match(/([123]-[12]-[A-Z])/) ?? [])[1] ?? null;
    const refKey = keyOf(ref);
    let linked = c.rows.filter(r => r.subjectName.length >= 2 && refKey.includes(keyOf(r.subjectName)) && (!term || r.term === term));
    // 짧은 과목명이 다른 과목명 안에 우연히 들어가는 경우를 줄이기 위해, 가장 긴 일치만 유지
    if (linked.length) {
      const longest = Math.max(...linked.map(r => keyOf(r.subjectName).length));
      linked = linked.filter(r => keyOf(r.subjectName).length === longest || refKey.includes(keyOf(r.subjectName)) && keyOf(r.subjectName).length >= longest - 2);
    }
    let how = linked.length ? 'subject' : null;
    if (!linked.length && /학교\s*밖/.test(ref)) { linked = c.rows.filter(r => r.mode === 'outside'); how = linked.length ? 'outside' : null; }
    if (!linked.length && gid) { linked = c.rows.filter(r => r.groupKey === `${c.curId}#${gid}`); how = linked.length ? 'group' : null; }
    const level = f.confidence === 'low' ? 'low' : 'medium';
    const checked = f.checked === true;
    if (checked && !f.resolution) note('info', c.curId, 'flag-resolution', `확인 처리된 flag에 resolution 이 없습니다: ${ref}`, { schoolId: c.schoolId });
    // readConfidence 는 아직 열려 있는(미확인) flag 만 반영한다. 확인 처리된 flag 는 이력으로만 남는다.
    for (const r of linked) { r.flagIds.push(id); (checked ? r.checkedFlagIds : r.openFlagIds).push(id); if (!checked && r.readConfidence !== 'low') r.readConfidence = level; }
    const out = { id, curriculumId: c.curId, schoolId: c.schoolId, ref, note: f.note ?? '', confidence: f.confidence ?? 'medium', term, groupId: gid, linkedRowIds: linked.map(r => r.id), linkedSubjectKeys: uniq(linked.map(r => r.subjectKey)), linkMethod: how, scope: how ? 'row' : 'general', status: checked ? 'checked' : 'open', checked, checkedDate: f.checkedDate ?? null, checkedBy: f.checkedBy ?? null, resolution: f.resolution ?? null };
    flagsOut.push(out);
    if (!how && !checked) note('warn', c.curId, 'flag-unlinked', `과목/묶음에 연결되지 않은 flag: ${ref}`, { schoolId: c.schoolId, flagId: id });
  });
}

// 행 신뢰도 사다리: unverified(AI 전사) < checked(사진과 대조 확인) < verified(공식 원본 확인). reported 는 checked 와 같은 높이.
// 확인 처리(checked)된 flag 에 연결됐고 열린 flag 가 없는 행은 checked 이상으로 올린다. (편제표 단위 신뢰도가 이미 더 높으면 그대로)
const RANK = { unverified: 0, checked: 1, reported: 1, verified: 2 };
for (const r of rows) if (r.checkedFlagIds.length && !r.openFlagIds.length && (RANK[r.confidence] ?? 0) < RANK.checked) r.confidence = 'checked';

// ---------- 4단계: 합계 계산과 검증 ----------
const summaries = [], curRecords = [];
for (const c of curOut) {
  const { d, curId, schoolId, entryYear, rows: cr } = c;
  const req = cr.filter(r => r.mode === 'required'), ele = cr.filter(r => r.mode === 'elective'), out = cr.filter(r => r.mode === 'outside');
  const grp = groups.filter(g => g.curriculumId === curId);
  const byTerm = {};
  for (const t of TERMS) {
    const required = sum(req.filter(r => r.term === t), r => r.credits);
    const elective = sum(grp.filter(g => g.term === t), g => g.creditsTotal);
    byTerm[t] = { required, elective, total: required + elective, outside: sum(out.filter(r => r.term === t), r => r.credits), groupCount: grp.filter(g => g.term === t).length };
  }
  const total = sum(TERMS, t => byTerm[t].total), required = sum(TERMS, t => byTerm[t].required), elective = sum(TERMS, t => byTerm[t].elective);
  const byArea = {}; for (const a of AREAS) byArea[a] = { required: 0, candidates: 0 };
  for (const r of req) if (r.area) byArea[r.area].required += r.credits; else inc(byArea, '미분류', 0);
  const candBy = {}; for (const r of ele) if (r.area) (candBy[r.area] ??= new Set()).add(r.subjectKey);
  for (const [a, s] of Object.entries(candBy)) byArea[a].candidates = s.size;
  const byKind = {}; for (const r of req) inc(byKind, r.kind ?? (r.kindGuess ? `추정:${r.kindGuess}` : '미표기'), r.credits);
  const candidateKeys = uniq(ele.map(r => r.subjectKey));
  const pickTotal = sum(grp, g => g.pick);
  const cp = d.creative?.perTerm ?? {};
  const creative = { perTerm: {}, totalHours: 0, standardHours: d.creative?.standardHours ?? null, operatedHours: d.creative?.operatedHours ?? null };
  for (const t of TERMS) { const o = {}; for (const [k, v] of Object.entries(cp[t] ?? {})) o[normCreativeName(k)] = v; creative.perTerm[t] = o; creative.totalHours += sum(Object.values(o)); }

  const dd = d.declared ?? {};
  const declared = {
    subjectCredits: dd.subjectCredits ?? null, creativeCredits: dd.creativeCredits ?? null, totalCredits: dd.totalCredits ?? null, requiredCredits: dd.requiredCredits ?? null,
    termCredits: dd.termCredits ?? null,
    fixed: { total: dd.fixedCredits ?? null, core: dd.fixedCoreCredits ?? null, other: dd.fixedOtherCredits ?? null, byTerm: dd.termFixed ?? null, byArea: dd.areaTotals ?? null },
    elective: { total: dd.electiveCredits ?? null, byTerm: dd.termElective ?? null },
    requiredByArea: dd.requiredByArea ?? null, // 영역별 필수이수학점(최소 이수 기준). 병합 셀이면 areas[] 에 여러 교과군. 학교 지정 학점(fixed.byArea)과 다른 개념
  };
  if (declared.requiredByArea && !Array.isArray(declared.requiredByArea)) declared.requiredByArea = Object.entries(declared.requiredByArea).map(([a, credits]) => ({ areas: [a], credits }));
  if (declared.requiredByArea?.length && declared.requiredCredits != null) {
    const rsum = sum(declared.requiredByArea, e => e.credits);
    if (rsum !== declared.requiredCredits) note('error', curId, 'required-by-area-sum', `영역별 필수이수학점 합: 선언(총 필수) ${declared.requiredCredits} ≠ 영역 합 ${rsum}`, { schoolId, expected: declared.requiredCredits, actual: rsum });
  }
  for (const e of declared.requiredByArea ?? []) for (const a of e.areas ?? []) if (!AREAS.includes(a)) note('warn', curId, 'required-area-name', `requiredByArea 의 교과군 이름이 규칙과 다릅니다: ${a}`, { schoolId });
  const ck = (check, expected, actual, msg, level = 'error') => { if (expected != null && expected !== actual) note(level, curId, check, `${msg}: 선언 ${expected} ≠ 계산 ${actual}`, { schoolId, expected, actual }); };
  for (const t of TERMS) {
    ck('term-total', declared.termCredits?.[t], byTerm[t].total, `${t}학기 합계`);
    ck('term-fixed', declared.fixed.byTerm?.[t], byTerm[t].required, `${t}학기 지정`);
    ck('term-elective', declared.elective.byTerm?.[t], byTerm[t].elective, `${t}학기 선택`);
  }
  ck('subject-total', declared.subjectCredits, total, '교과 합계');
  ck('fixed-total', declared.fixed.total, required, '지정 학점');
  ck('elective-total', declared.elective.total, elective, '선택 학점');
  if (declared.fixed.core != null && declared.fixed.other != null) ck('fixed-split', declared.fixed.total, declared.fixed.core + declared.fixed.other, '지정(핵심+기타) 합');
  if (declared.subjectCredits != null && declared.creativeCredits != null) ck('grand-total', declared.totalCredits, declared.subjectCredits + declared.creativeCredits, '총 이수학점(교과+창체)');
  if (declared.fixed.byTerm) ck('term-fixed-sum', declared.fixed.total, sum(Object.values(declared.fixed.byTerm)), '학기별 지정 합');
  if (declared.fixed.byArea) {
    const cmp = uniq([...Object.keys(declared.fixed.byArea), ...AREAS.filter(a => byArea[a].required)]);
    for (const a of cmp) ck('area-fixed', declared.fixed.byArea[a] ?? 0, byArea[a]?.required ?? 0, `영역(${a}) 지정 학점`);
  }
  if (creative.standardHours != null && creative.operatedHours == null) ck('creative-hours', creative.standardHours, creative.totalHours, '창체 시간', 'warn');
  if (creative.operatedHours != null) ck('creative-hours', creative.operatedHours, creative.totalHours, '창체 운영 시간', 'warn');
  if (out.length) note('info', curId, 'outside-school', `학교 밖 과목 ${out.length}개(${sum(out, r => r.credits)}학점)는 교내 합계에 포함하지 않음`, { schoolId });
  // 규칙 영역 vs 원본에 인쇄된 영역
  for (const r of req) if (r.sourceArea && r.area && r.sourceArea !== r.area) note('warn', curId, 'area-rule-conflict', `${r.term} ${r.subjectName}: 규칙 영역 "${r.area}" ≠ 원본 영역 "${r.sourceArea}"`, { schoolId, rowId: r.id });
  const noKind = cr.filter(r => r.mode !== 'outside' && !r.kind);
  if (noKind.length) note('warn', curId, 'kind-missing', `구분(kind) 미표기 ${noKind.length}행 (${c.kindScheme === 'fusion-only' ? '표에 융합(♥)만 표시되고 일반/진로 구분 없음' : '원본 확인 필요'}); 다른 학교 기준 추정 ${noKind.filter(r => r.kindGuess).length}행`, { schoolId, count: noKind.length });
  const badCredit = cr.filter(r => r.creditsDiffer);
  if (badCredit.length) note('info', curId, 'credits-differ', `운영학점≠기본학점 ${badCredit.length}과목: ${uniq(badCredit.map(r => r.subjectName)).join(', ')}`, { schoolId });

  const flagsHere = flagsOut.filter(f => f.curriculumId === curId);
  const issuesHere = issues.filter(i => i.curriculumId === curId);
  const validation = { errors: issuesHere.filter(i => i.level === 'error').length, warnings: issuesHere.filter(i => i.level === 'warn').length };
  curRecords.push({ id: curId, schoolId, entryYear, document: d.document ?? null, sourceImage: d.sourceImage ?? null, schoolNameRaw: d.school ?? null, schoolType: d.schoolType ?? null, kindScheme: c.kindScheme, legend: d.legend ?? null, declared, creative, notes: d.notes ?? [], _meta: { ...(d._meta ?? {}), confidence: c.conf }, validation });
  summaries.push({
    curriculumId: curId, schoolId, entryYear,
    credits: { subject: total, required, elective, outsideSchool: sum(out, r => r.credits), declaredSubject: declared.subjectCredits, creativeCredits: declared.creativeCredits, totalDeclared: declared.totalCredits },
    byTerm, byArea, byKind,
    electives: { groupCount: grp.length, pickTotal, creditsTotal: elective, candidateRows: ele.length, candidateSubjects: candidateKeys.length, breadth: pickTotal ? Math.round((candidateKeys.length / pickTotal) * 100) / 100 : null, firstElectiveTerm: TERMS.find(t => byTerm[t].elective > 0) ?? null, byPoolType: Object.fromEntries(Object.entries(grp.reduce((o, g) => { inc(o, g.poolType, 1); return o; }, {}))) },
    outsideSchoolCount: out.length,
    creativeHours: creative.totalHours,
    quality: { confidence: c.conf, flagsLow: flagsHere.filter(f => !f.checked && f.confidence === 'low').length, flagsMedium: flagsHere.filter(f => !f.checked && f.confidence !== 'low').length, flagsChecked: flagsHere.filter(f => f.checked).length, flagsUnlinked: flagsHere.filter(f => !f.checked && f.scope === 'general').length, kindMissingRows: noKind.length, kindInferredRows: noKind.filter(r => r.kindGuess).length, hasSourceArea: cr.some(r => r.sourceArea), ...validation },
  });
}

// ---------- 5단계: 과목 테이블 ----------
const subjects = [];
for (const [key, def] of subjectDefs) {
  const sp = [...spellings.get(key).entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || ko(a[0], b[0]));
  const name = def.isComposite ? def.components.map(c => aliasOf(c)).sort(ko).join('↔') : sp[0][0];
  const rs = rows.filter(r => r.subjectKey === key);
  const schools = uniq(rs.map(r => r.schoolId)).sort(ko);
  subjects.push({
    ...def, name, aliases: uniq(sp.map(x => x[0]).concat(def.isComposite ? [] : [])).filter(x => x !== name).sort(ko),
    kindsPrinted: uniq(rs.flatMap(r => r.kinds)).sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b)),
    offeredBy: schools, schoolCount: schools.length,
    byMode: { required: uniq(rs.filter(r => r.mode === 'required').map(r => r.schoolId)).sort(ko), elective: uniq(rs.filter(r => r.mode === 'elective').map(r => r.schoolId)).sort(ko), outside: uniq(rs.filter(r => r.mode === 'outside').map(r => r.schoolId)).sort(ko) },
  });
}
subjects.sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area) || ko(a.name, b.name));
for (const [key, names] of unmapped) note('warn', null, 'subject-unmapped', `교과군 규칙이 없는 과목: ${[...names].join(', ')} (tools/db-rules.json 에 추가 필요)`, { subjectKey: key });

// ---------- 6단계: 파생 데이터 ----------
const schoolList = [...schoolOut.values()].sort((a, b) => ko(a.id, b.id));
const nameOf = Object.fromEntries(schoolList.map(s => [s.id, s.name]));
const areaByTerm = [];
for (const s of summaries) for (const t of TERMS) {
  const termRows = rows.filter(r => r.curriculumId === s.curriculumId && r.term === t);
  for (const a of AREAS) {
    const required = sum(termRows.filter(r => r.mode === 'required' && r.area === a), r => r.credits);
    const cands = uniq(termRows.filter(r => r.mode === 'elective' && r.area === a).map(r => r.subjectKey)).length;
    if (required || cands) areaByTerm.push({ curriculumId: s.curriculumId, schoolId: s.schoolId, term: t, area: a, required, candidates: cands });
  }
}
const subjectName = Object.fromEntries(subjects.map(s => [s.subjectKey, s.name]));
const compare = subjects.map(s => {
  const cells = {};
  for (const sid of s.offeredBy) {
    const rs = rows.filter(r => r.subjectKey === s.subjectKey && r.schoolId === sid);
    cells[sid] = { modes: uniq(rs.map(r => r.mode)), terms: uniq(rs.map(r => r.term)).sort(), kinds: uniq(rs.map(r => r.kind ?? r.kindGuess).filter(Boolean)), credits: uniq(rs.map(r => r.credits)).sort((a, b) => a - b), groupKeys: uniq(rs.map(r => r.groupKey).filter(Boolean)) };
  }
  return { subjectKey: s.subjectKey, name: s.name, area: s.area, subArea: s.subArea, schoolCount: s.schoolCount, cells };
});
const toInitials = str => [...str].map(ch => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c <= 11171 ? 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor(c / 588)] : ch; }).join('');
const searchIndex = subjects.map(s => ({ subjectKey: s.subjectKey, name: s.name, aliases: s.aliases, area: s.area, subArea: s.subArea, schools: s.offeredBy, text: [s.name, ...s.aliases, s.area, s.subArea ?? ''].join(' ').toLowerCase(), initials: toInitials(s.name.replace(/[^가-힣]/g, '')) }));
const count = (arr, f) => { const o = {}; for (const x of arr) for (const k of [].concat(f(x))) if (k != null) inc(o, k); return o; };
const facets = {
  schools: schoolList.map(s => ({ id: s.id, name: s.name })),
  entryYears: uniq(curRecords.map(c => c.entryYear)).sort(),
  terms: TERMS, areas: AREAS, subAreas: count(subjects, s => s.subArea), kinds: KIND_ORDER,
  modes: count(rows, r => r.mode), poolTypes: count(groups, g => g.poolType), kindStatus: count(rows, r => r.kindStatus), kindSource: count(rows, r => r.kindSource),
  rowsByArea: count(rows.filter(r => r.mode !== 'outside'), r => r.area),
  selection: { school: '학교지정', student: '학생선택', outside: '학교 밖' },
  csat: { areas: CSAT.areas, basisExamYear: CSAT.basisExamYear, appliesToExamYear: CSAT.appliesToExamYear, applicability: CSAT.applicability, notice: CSAT.notice, retrieved: CSAT.retrieved, sources: CSAT.sources, confidenceLevels: CSAT.confidenceNote, rowsByConfidence: count(rows.filter(r => r.mode !== 'outside'), r => r.csatConfidence), scopes: { in: '출제 범위', base: '공통·기초(직접 출제 미확정)', out: '수능 영역 교과이나 출제 제외', none: '수능 영역 없음' }, basis: CSAT.basis, confidence: CSAT.confidence, asOf: CSAT.asOf, rowsByScope: count(rows.filter(r => r.mode !== 'outside'), r => r.csatScope) },
};

// ---------- 7단계: 검토 대기열 ----------
const reviewQueue = {
  unlinkedFlags: flagsOut.filter(f => !f.checked && f.scope === 'general').map(f => ({ flagId: f.id, curriculumId: f.curriculumId, ref: f.ref, confidence: f.confidence, note: f.note })),
  resolvedFlags: flagsOut.filter(f => f.checked).map(f => ({ flagId: f.id, curriculumId: f.curriculumId, ref: f.ref, originalConfidence: f.confidence, checkedDate: f.checkedDate, checkedBy: f.checkedBy, resolution: f.resolution })),
  lowConfidenceFlags: flagsOut.filter(f => !f.checked && f.confidence === 'low').map(f => ({ flagId: f.id, curriculumId: f.curriculumId, ref: f.ref, note: f.note, linkedRowIds: f.linkedRowIds })),
  kindMissing: curOut.map(c => ({ curriculumId: c.curId, kindScheme: c.kindScheme, rows: c.rows.filter(r => r.mode !== 'outside' && !r.kind).map(r => ({ rowId: r.id, term: r.term, subject: r.subjectName, status: r.kindStatus, guess: r.kindGuess })) })).filter(x => x.rows.length),
  unmappedSubjects: [...unmapped].map(([k, n]) => ({ subjectKey: k, printed: [...n] })),
  ambiguousSubjects: subjects.filter(s => s.ambiguous).map(s => ({ subjectKey: s.subjectKey, name: s.name, area: s.area, reason: s.ambiguous, schools: s.offeredBy })),
  areaRuleConflicts: issues.filter(i => i.check === 'area-rule-conflict').map(i => ({ curriculumId: i.curriculumId, message: i.message })),
  declaredMismatches: issues.filter(i => i.level === 'error').map(i => ({ curriculumId: i.curriculumId, check: i.check, message: i.message })),
};

// ---------- 학교 id 일관성: 갤러리(site.json 의 gallery 섹션 데이터) ↔ schools.json ----------
// 갤러리 항목은 id(schoolId)로 학교와 연결해야 한다. 이름만 있는 항목은 이름이 schools.json 과 정확히 일치할 때만 임시 허용(경고).
{
  const SITE_FILE = join(ROOT, 'content', 'site.json');
  const idByName = new Map(schoolsIn.map(sc => [sc.name, sc.id]));
  const idSet = new Set(schoolsIn.map(sc => sc.id));
  if (existsSync(SITE_FILE)) {
    for (const sec of readJson(SITE_FILE).sections ?? []) {
      if (sec.type !== 'gallery' || typeof sec.data !== 'string') continue;
      const gp = join(ROOT, 'content', sec.data);
      if (!existsSync(gp)) { note('error', null, 'gallery-missing', `site.json 의 gallery 데이터 파일이 없습니다: ${sec.data}`); continue; }
      (readJson(gp).items ?? []).forEach((it, i) => {
        const where = `${sec.data} 항목 ${i + 1}(${it.school ?? '이름 없음'})`;
        if (it.schoolId) {
          if (!idSet.has(it.schoolId)) note('error', null, 'gallery-school-id', `${where}: schoolId ${it.schoolId} 가 schools.json 에 없습니다`);
          else if (it.school && schoolsIn.find(sc => sc.id === it.schoolId)?.name !== it.school) note('error', null, 'gallery-school-name', `${where}: schoolId ${it.schoolId} 의 이름과 다릅니다`);
        } else if (idByName.has(it.school)) note('warn', null, 'gallery-no-school-id', `${where}: schoolId 가 없어 이름으로만 연결됨 → 갤러리 항목에 schoolId: "${idByName.get(it.school)}" 추가 필요`);
        else note('error', null, 'gallery-school-unresolved', `${where}: schoolId 도 없고 이름이 schools.json 과 일치하지 않습니다`);
      });
    }
  }
}

// ---------- 출력 ----------
const TERMS_ = TERMS;
const omitNull = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
// 원본 경로를 담기 쉬운 키는 DB 어디에도 남기지 않는다(소스 이미지 경로는 displayImage 로만 노출)
const DROP_KEYS = new Set(['file', 'sourceImage']);
const clean = v => Array.isArray(v) ? v.map(clean) : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).filter(([k]) => !DROP_KEYS.has(k)).map(([k, x]) => [k, clean(x)])) : v;

// 화면용 이미지
const sourceImageOf = new Map(curOut.map(c => [c.curId, c.d.sourceImage ?? null]));
const IMAGES_FILE = join(ROOT, 'content', 'data', 'display-images.json'); // 비공개(content/ 는 gitignore)
const IMAGES_ON = rules.images?.enabled === true; // 꺼져 있으면 DB 어디에도 이미지 경로를 넣지 않는다
const imageRules = IMAGES_ON && existsSync(IMAGES_FILE) ? readJson(IMAGES_FILE) : {};
const maskedSources = new Set();
const displayImageOf = c => {
  if (!IMAGES_ON) { if (c.d.sourceImage) maskedSources.add(c.d.sourceImage); return null; }
  const r = imageRules[c.schoolId];
  if (r == null) { note('warn', c.curId, 'display-image', `${c.schoolId} 는 content/data/display-images.json 에 없어 displayImage 를 넣지 않습니다.`, { schoolId: c.schoolId }); return null; }
  if (r === '$sourceImage') return c.d.sourceImage ?? null;
  if (c.d.sourceImage) maskedSources.add(c.d.sourceImage); // 마스킹본이 있는 학교의 원본 경로는 어디에도 나오면 안 됨
  return r;
};

const curRecordsOut = curOut.map(c => {
  const rec = curRecords.find(x => x.id === c.curId);
  return omitNull(clean({ id: rec.id, schoolId: rec.schoolId, entryYear: rec.entryYear, document: rec.document, displayImage: displayImageOf(c), kindScheme: rec.kindScheme, legend: rec.legend, declared: rec.declared, creative: rec.creative, validation: rec.validation, confidence: rec._meta.confidence, _meta: rec._meta }));
});
const imageOf = Object.fromEntries(curRecordsOut.map(c => [c.id, c.displayImage ?? null]));

// offerings: 대시보드 계약에 맞춘 이름으로 평탄화(항상 위 정규화 결과에서 파생). null 값은 생략.
const SELECTION = { required: 'school', elective: 'student', outside: 'outside' }; // 학교지정 / 학생선택(택n) / 학교 밖
const offeringsOut = [...rows].sort(sortRowsBy).map(r => omitNull({
  id: r.id, curriculumId: r.curriculumId, schoolId: r.schoolId, entryYear: r.entryYear,
  term: r.term, grade: r.grade, semester: r.semester,
  slot: r.mode, selection: SELECTION[r.mode], seq: r.slot, subject: r.subjectName, subjectKey: r.subjectKey,
  area: r.area, subArea: r.subArea, csatArea: r.csatArea, csatScope: r.csatScope, csatConfidence: r.csatConfidence, kind: r.kinds, primaryKind: r.kind, kindStatus: r.kindStatus, kindSource: r.kindSource, kindGuess: r.kindGuess,
  credits: r.credits, basicCredits: r.basicCredits,
  groupId: r.groupKey, pick: r.mode === 'elective' ? groups.find(g => g.groupKey === r.groupKey)?.pick : null, groupSize: r.mode === 'elective' ? groups.find(g => g.groupKey === r.groupKey)?.optionCount : null,
  extra: r.extra, graded: r.graded, flagIds: r.flagIds, openFlagIds: r.openFlagIds, readConfidence: r.readConfidence, confidence: r.confidence,
}));
function sortRowsBy(a, b) { return ko(a.id, b.id); }

const groupsOut = groups.map(g => omitNull({ id: g.groupKey, label: g.groupId, curriculumId: g.curriculumId, schoolId: g.schoolId, entryYear: g.entryYear, term: g.term, grade: g.grade, semester: g.semester, pick: g.pick, creditsEach: g.creditsEach, creditsTotal: g.creditsTotal, size: g.optionCount, poolLabelRaw: g.poolLabelRaw, poolType: g.poolType, areasInPool: g.areasInPool, sameArea: g.sameArea, kind: g.kindsPrinted, subjectKeys: g.subjectKeys }));

const flagsOutRows = flagsOut.map(f => {
  const refs = f.linkMethod === 'group' ? [{ type: 'group', id: `${f.curriculumId}#${f.groupId}` }] : f.linkedRowIds.map(id => ({ type: 'offering', id }));
  if (!refs.length) refs.push({ type: 'curriculum', id: f.curriculumId });
  return omitNull({ id: f.id, curriculumId: f.curriculumId, schoolId: f.schoolId, ref: f.ref, note: f.note, confidence: f.confidence, term: f.term, scope: f.scope, linkMethod: f.linkMethod, status: f.status, checked: f.checked || null, checkedDate: f.checkedDate, checkedBy: f.checkedBy, resolution: f.resolution, refs });
});

const subjectsOut = subjects.map(s => omitNull({ subjectKey: s.subjectKey, name: s.name, area: s.area, subArea: s.subArea, csatArea: s.csatArea, csatScope: s.csatScope, csatConfidence: s.csatConfidence, csatNote: s.csatNote, aliases: s.aliases, isComposite: s.isComposite, components: s.isComposite ? s.components : null, areasAll: s.areasAll.length > 1 ? s.areasAll : null, kindsPrinted: s.kindsPrinted, offeredBy: s.offeredBy, schoolCount: s.schoolCount, ambiguous: s.ambiguous }));

const schoolsOut = schoolList.map(s => clean(s));
const schoolById = Object.fromEntries(schoolsOut.map(s => [s.id, s]));

// 수능 영역별: 학교지정 학점(범위 in/base 구분), 학생선택 후보 과목 수(범위 in)
function byCsatOf(curId) {
  const o = {};
  for (const a of CSAT.areas) o[a.key] = { requiredIn: 0, requiredBase: 0, requiredOut: 0, candidatesIn: 0, candidatesAll: 0, unconfirmed: false };
  const cand = {};
  for (const r of rows) {
    if (r.curriculumId !== curId || !r.csatArea || r.mode === 'outside') continue;
    const e = o[r.csatArea];
    if (r.csatConfidence === 'unconfirmed') e.unconfirmed = true;
    if (r.mode === 'required') { if (r.csatScope === 'in') e.requiredIn += r.credits; else if (r.csatScope === 'base') e.requiredBase += r.credits; else e.requiredOut += r.credits; }
    else { (cand[r.csatArea] ??= { all: new Set(), inn: new Set() }).all.add(r.subjectKey); if (r.csatScope === 'in') cand[r.csatArea].inn.add(r.subjectKey); }
  }
  for (const [a, c] of Object.entries(cand)) { o[a].candidatesAll = c.all.size; o[a].candidatesIn = c.inn.size; }
  return o;
}
const summaryOut = summaries.map(s => {
  const sc = schoolById[s.schoolId] ?? {};
  const cr = curRecords.find(x => x.id === s.curriculumId);
  const own = issues.filter(i => i.curriculumId === s.curriculumId);
  const flagsOpen = s.quality.flagsLow + s.quality.flagsMedium;
  const flagsTotal = flagsOpen + s.quality.flagsChecked;
  const warnsNoFlag = own.filter(i => i.level === 'warn' && i.check !== 'flag-unlinked').length;
  const errs = own.filter(i => i.level === 'error').length;
  const o = {
    id: s.curriculumId, curriculumId: s.curriculumId, schoolId: s.schoolId, schoolName: nameOf[s.schoolId], entryYear: s.entryYear,
    schoolType: sc.schoolType, founding: sc.founding, region: sc.region, assignment: sc.assignment, gender: sc.gender,
    displayImage: imageOf[s.curriculumId],
    creditsSubject: s.credits.subject, creditsCreative: s.credits.creativeCredits, creditsTotal: s.credits.totalDeclared ?? (s.credits.subject + (s.credits.creativeCredits ?? 0)),
    creditsRequired: s.credits.required, creditsElective: s.credits.elective, creditsOutside: s.credits.outsideSchool,
    requiredCount: rows.filter(r => r.curriculumId === s.curriculumId && r.mode === 'required').length,
    groupCount: s.electives.groupCount, pickTotal: s.electives.pickTotal, candidateSubjects: s.electives.candidateSubjects, breadth: s.electives.breadth, firstElectiveTerm: s.electives.firstElectiveTerm,
    creativeHours: s.creativeHours,
    confidence: s.quality.confidence, flagsTotal, flagsOpen, flagsChecked: s.quality.flagsChecked, flagsUnlinked: s.quality.flagsUnlinked, kindMissingRows: s.quality.kindMissingRows, validationErrors: errs, reviewCount: flagsOpen + errs + warnsNoFlag,
    byTerm: s.byTerm, byArea: s.byArea, byCsat: byCsatOf(s.curriculumId), byKind: s.byKind, electivePools: s.electives.byPoolType,
  };
  return omitNull(o);
});

const matrixOut = compare.map(m => ({ subjectKey: m.subjectKey, name: m.name, area: m.area, ...(m.subArea ? { subArea: m.subArea } : {}), schoolCount: m.schoolCount, cells: Object.fromEntries(Object.entries(m.cells).map(([sid, c]) => [sid, { slots: c.modes, terms: c.terms, kind: c.kinds, credits: c.credits, groupIds: c.groupKeys }])) }));

// ---------- 편제표 밖 엔티티(일정·제도·고교 유형·제도 요약·출처): content/data/<이름>.json 의 items[] ----------
// 공통 레코드 필드(docs/db-schema.md §10): id, source[], confidence, status, updated, appliesTo. 손으로 관리하는 입력이며 content/db 로 검증·정렬해 내보낸다.
const CONF_LEVELS = ['unverified', 'checked', 'reported', 'verified'];
const STATUS_LEVELS = ['candidate', 'active', 'superseded', 'rejected'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = v => typeof v === 'string' && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v));
const PORTAL = {
  'events': { use: 'core', purpose: '일정(고입·대입·수능) — 홈 "지금 할 일", 타임라인', req: ['title', 'category', 'dateStart', 'scope', 'dateStatus'], enums: { category: ['고입', '대입', '수능', '모평', '기타'], dateStatus: ['fixed', 'expected', 'tentative'] }, dates: ['dateStart', 'dateEnd'], sort: (a, b) => ko(a.dateStart, b.dateStart) || ko(a.id, b.id) },
  'policy': { use: 'lazy', purpose: '제도 변경 로그(날짜 내림차순)', req: ['date', 'title', 'summary', 'phase'], enums: { phase: ['confirmed', 'proposed', 'under-review', 'reported'] }, dates: ['date'], sort: (a, b) => ko(b.date, a.date) || ko(a.id, b.id) },
  'high-school-types': { use: 'lazy', purpose: '고교 유형별 전형 시기·방식(고교 선택)', req: ['type', 'timing', 'method'], enums: {}, dates: [], sort: (a, b) => ko(a.id, b.id) },
  'admission-system': { use: 'lazy', purpose: '대입 제도 요약 표(수능·내신·일정·검토 중 항목)', req: ['topic', 'content', 'phase'], enums: { phase: ['confirmed', 'proposed', 'under-review', 'reported'] }, dates: [], sort: (a, b) => ko(a.id, b.id) },
  'sources': { use: 'core', purpose: '출처 목록(자료실, 오래된 데이터 경고)', req: ['name', 'kind', 'termsStatus'], enums: { kind: ['official', 'media', 'self'], termsStatus: ['ok', 'partial', 'unknown', 'n/a'] }, dates: ['lastChecked'], sort: (a, b) => ko(a.id, b.id), nullableDates: ['lastChecked'] },
};
const portalData = {};
for (const [name, spec] of Object.entries(PORTAL)) {
  const file = join(ROOT, 'content', 'data', `${name}.json`);
  if (!existsSync(file)) continue;
  const items = readJson(file).items ?? [];
  const seen = new Set(), out = [];
  const bad = (id, msg) => note('error', null, `portal-${name}`, `${name}.json ${id}: ${msg}`);
  for (const it of items) {
    const id = it.id ?? '(id 없음)';
    if (!it.id) bad(id, 'id 가 없습니다');
    else if (seen.has(it.id)) bad(id, 'id 가 중복됩니다'); else seen.add(it.id);
    for (const k of spec.req) if (it[k] === undefined || it[k] === null || it[k] === '') bad(id, `필수 필드 ${k} 가 없습니다`);
    for (const [k, vals] of Object.entries(spec.enums)) if (it[k] !== undefined && !vals.includes(it[k])) bad(id, `${k} 값이 올바르지 않습니다: ${it[k]}`);
    for (const k of spec.dates) if (it[k] != null && !isDate(it[k])) bad(id, `${k} 는 YYYY-MM-DD 날짜여야 합니다: ${it[k]}`);
    for (const k of spec.nullableDates ?? []) if (it[k] === undefined) bad(id, `${k} 는 값 또는 null 이어야 합니다(키 필요)`);
    if (it.dateEnd && it.dateStart && it.dateEnd < it.dateStart) bad(id, 'dateEnd 가 dateStart 보다 앞섭니다');
    if (!Array.isArray(it.source) || !it.source.length) bad(id, 'source[] 가 비어 있습니다');
    else for (const sr of it.source) {
      if (!sr.name || !['official', 'media', 'self'].includes(sr.kind) || !isDate(sr.retrieved)) bad(id, `source 항목에 name, kind(official|media|self), retrieved(YYYY-MM-DD)가 필요합니다: ${JSON.stringify(sr).slice(0, 80)}`);
      else if (sr.kind !== 'self' && !sr.url) note('warn', null, `portal-${name}`, `${name}.json ${id}: 출처 "${sr.name}" 에 url 이 없습니다`);
    }
    if (!CONF_LEVELS.includes(it.confidence)) bad(id, `confidence 가 올바르지 않습니다: ${it.confidence}`);
    if (!STATUS_LEVELS.includes(it.status)) bad(id, `status 가 올바르지 않습니다: ${it.status}`);
    if (!isDate(it.updated)) bad(id, 'updated 는 YYYY-MM-DD 날짜여야 합니다');
    const ap = it.appliesTo;
    if (!ap || typeof ap !== 'object') bad(id, 'appliesTo 가 필요합니다(비어 있는 객체 {} 는 허용)');
    else {
      const ey = [].concat(ap.entryYear ?? []), xy = [].concat(ap.examYear ?? []);
      if ([...ey, ...xy].some(y => !Number.isInteger(y))) bad(id, 'appliesTo 의 학년도는 정수여야 합니다');
      if (ap.entryYear != null && ap.examYear != null && !ey.every(y => xy.includes(y + 3))) bad(id, 'entryYear 와 examYear 관계가 맞지 않습니다(examYear = entryYear + 3)');
    }
    if (it.confidence === 'unverified' && it.dateStatus && it.dateStatus !== 'tentative') note('warn', null, `portal-${name}`, `${name}.json ${id}: 미확인 값인데 dateStatus 가 ${it.dateStatus} 입니다(tentative 권장)`);
    if (it.status === 'active' || it.status === 'superseded') out.push(it); // candidate / rejected 는 화면용 DB 에 싣지 않음
  }
  portalData[name] = { use: spec.use, purpose: spec.purpose, rows: out.sort(spec.sort) };
}

const data = {
  'summary': { use: 'core', purpose: '학교(편제표)당 1행 비교표 + 학기·영역·구분 요약. 가장 작고 먼저 읽는 파일', rows: summaryOut },
  'schools': { use: 'core', purpose: '학교 엔티티(이름·유형·설립·지역·배정방식·출처 신뢰도)', rows: schoolsOut },
  'curricula': { use: 'core', purpose: '편제표 헤더: 선언 학점(declared), 창체, 검증 건수', rows: curRecordsOut },
  'facets': { use: 'core', purpose: '필터 UI용 값 목록과 개수', rows: facets },
  'subjects': { use: 'lazy', purpose: '정규화된 과목 마스터(key, name, area, aliases, 개설 학교)', rows: subjectsOut },
  'groups': { use: 'lazy', purpose: '택n 묶음(pick, size, poolType, 후보 subjectKeys)', rows: groupsOut },
  'flags': { use: 'lazy', purpose: '판독 확인 필요 항목. refs[{type,id}] 로 offering/group/curriculum 에 연결', rows: flagsOutRows },
  'offerings': { use: 'lazy', purpose: '핵심 사실 표: 학교×학기×과목 1행(평탄화, 항상 생성물)', rows: offeringsOut },
  'subject-matrix': { use: 'lazy', purpose: '과목×학교 비교 매트릭스(cells[schoolId])', rows: matrixOut },
  'search-index': { use: 'lazy', purpose: '과목 검색 인덱스(소문자 text, 초성 initials)', rows: searchIndex },
  'area-by-term': { use: 'optional', purpose: '학교×학기×교과군 지정 학점·선택 후보 수', rows: areaByTerm },
  'review-queue': { use: 'optional', purpose: '사람이 확인할 항목 모음(검수 화면용)', rows: reviewQueue },
};
Object.assign(data, portalData);
data.facets.rows.portal = {
  staleAfterDays: 90, // 마지막 확인(updated / sources.lastChecked)이 이보다 오래되었거나 lastChecked 가 null 이면 "오래된 데이터" 경고
  eventCategories: count(portalData.events?.rows ?? [], e => e.category), eventScopes: count(portalData.events?.rows ?? [], e => e.scope),
  dateStatus: { fixed: '확정 일정', expected: '예정(기본계획·보도 기준)', tentative: '임시값(미확인)' },
  phase: { confirmed: '확정', reported: '보도 기준', proposed: '제안', 'under-review': '검토 중' },
  targetCohort: { entryYear: 2027, examYear: 2030 },
};

// ---- 출력 직렬화 + 검사 ----
const serialized = Object.entries(data).map(([name, d]) => [`${name}.json`, JSON.stringify(d.rows)]);
const internal = {
  'validation.json': issues,
  'build-report.json': { schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), inputs: [...curricula.map(c => ({ path: `content/curriculum/${c.file}`, sha256_16: sha(join(CUR_DIR, c.file)) })), ...(existsSync(SCHOOLS_FILE) ? [{ path: 'content/data/schools.json', sha256_16: sha(SCHOOLS_FILE) }] : []), { path: 'tools/db-rules.json', sha256_16: sha(RULES_FILE) }, ...(existsSync(IMAGES_FILE) ? [{ path: 'content/data/display-images.json', sha256_16: sha(IMAGES_FILE) }] : [])], counts: { schools: schoolList.length, curricula: curRecords.length, subjects: subjects.length, offerings: rows.length, groups: groups.length, flags: flagsOut.length, ...Object.fromEntries(Object.entries(portalData).map(([k, v]) => [k, v.rows.length])) } },
};

// 원본 경로 노출 검사: ① 마스킹 학교의 원본 경로는 어디에도 금지 ② files/inbox 문자열은 displayImage 값으로만 허용 ③ sourceImage 키 금지
const leaks = [];
const walk = (v, key, file) => {
  if (Array.isArray(v)) v.forEach(x => walk(x, key, file));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k === 'sourceImage' || (!IMAGES_ON && k === 'displayImage')) leaks.push(`${file}: ${k} 키`); walk(x, k, file); }
  else if (typeof v === 'string') { if (/files\/inbox/.test(v) && key !== 'displayImage') leaks.push(`${file}: ${key ?? ''}="${v.slice(0, 60)}"`); if (!IMAGES_ON && /files\/(inbox|display|masked)\//.test(v)) leaks.push(`${file}: 이미지 경로(${key ?? ''})`); for (const m of maskedSources) if (v.includes(m) || v.includes(m.split('/').pop())) leaks.push(`${file}: 마스킹 학교 원본 경로 노출 (${key ?? ''})`); }
};
for (const [f, text] of serialized) walk(JSON.parse(text), null, f);
for (const m of maskedSources) for (const [f, text] of serialized) if (text.includes(m)) leaks.push(`${f}: 마스킹 학교 원본 경로 문자열`);
for (const l of uniq(leaks)) note('error', null, 'privacy-leak', `원본 이미지 경로 노출: ${l}`);
// displayImage 파일 존재 확인(파일 내용은 읽지 않음)
for (const c of curRecordsOut) if (c.displayImage && !existsSync(join(ROOT, 'content', c.displayImage))) note('warn', c.id, 'display-image-missing', `displayImage 파일이 아직 없습니다: ${c.displayImage}`, { schoolId: c.schoolId });

const errors = issues.filter(i => i.level === 'error'), warns = issues.filter(i => i.level === 'warn');
const index = { version: SCHEMA_VERSION, generatedAt: internal['build-report.json'].generatedAt, entryYears: facets.entryYears, counts: internal['build-report.json'].counts, files: serialized.map(([f, text]) => { const name = f.replace(/\.json$/, ''); const d = data[name]; return { name: f, use: d.use, purpose: d.purpose, rows: Array.isArray(d.rows) ? d.rows.length : undefined, bytes: Buffer.byteLength(text) }; }) };
index.totalBytes = sum(index.files, f => f.bytes);
index.coreBytes = sum(index.files.filter(f => f.use === 'core'), f => f.bytes);

let written = false;
if (!CHECK_ONLY && !errors.length) {
  // 임시 폴더에 전부 만든 뒤 한 번에 교체(중간에 실패해도 이전 DB 유지)
  const TMP = join(ROOT, 'content', `.db-build-${process.pid}`);
  const PREV = join(ROOT, 'content', `.db-prev-${process.pid}`);
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(TMP, '_internal'), { recursive: true });
  for (const [f, text] of serialized) writeFileSync(join(TMP, f), text + '\n');
  writeFileSync(join(TMP, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  for (const [f, v] of Object.entries(internal)) writeFileSync(join(TMP, '_internal', f), JSON.stringify(v, null, 2) + '\n');
  if (existsSync(OUT_DIR)) renameSync(OUT_DIR, PREV);
  renameSync(TMP, OUT_DIR);
  rmSync(PREV, { recursive: true, force: true });
  written = true;
}
console.log(`${CHECK_ONLY ? '[check] ' : ''}학교 ${schoolList.length} · 편제표 ${curRecords.length} · 과목 ${subjects.length} · 행 ${rows.length} · 택n 묶음 ${groups.length} · flags ${flagsOut.length}`);
console.log(`오류 ${errors.length} · 경고 ${warns.length} · 정보 ${issues.length - errors.length - warns.length}`);
for (const i of [...errors, ...warns]) console.log(`  [${i.level}] ${i.curriculumId ?? '-'} ${i.check}: ${i.message}`);
console.log(`파일 ${index.files.length}개 · 합계 ${(index.totalBytes / 1024).toFixed(0)}KB (core ${(index.coreBytes / 1024).toFixed(0)}KB)` + (written ? ` → ${OUT_DIR}` : ''));
if (!CHECK_ONLY && errors.length) console.log('※ 오류가 있어 content/db 를 갱신하지 않았습니다(이전 DB 유지).');
process.exit(errors.length ? 1 : 0);
