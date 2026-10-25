#!/usr/bin/env node
// 편제표 전사본(content/curriculum/*.json) → 정규화된 통합 DB(content/db/*)
//
//   node tools/build-db.mjs          DB 생성 (검증 오류가 있어도 파일은 쓰고 종료코드 1)
//   node tools/build-db.mjs --check  파일을 쓰지 않고 검증만 (CI/수동 점검용)
// content/db/ 는 전부 생성물이다(실행할 때마다 *.json 을 지우고 다시 만든다). 직접 고치지 말 것.
//
// 입력: content/curriculum/*.json (읽기 전용 원본), content/data/schools.json, content/data/display-images.json, tools/db-rules.json
// 출력: content/db/ (스키마 설명은 docs/db-schema.md)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CUR_DIR = join(ROOT, 'content', 'curriculum');
const SCHOOLS_FILE = join(ROOT, 'content', 'data', 'schools.json');
const RULES_FILE = join(ROOT, 'tools', 'db-rules.json');
const OUT_DIR = join(ROOT, 'content', 'db');
const CHECK_ONLY = process.argv.includes('--check');
const SCHEMA_VERSION = '2.0.0';

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

// ---------- 입력 ----------
const files = readdirSync(CUR_DIR).filter(f => f.endsWith('.json')).sort();
const curricula = [];
for (const f of files) {
  const d = readJson(join(CUR_DIR, f));
  if (!Array.isArray(d.courses) || !Array.isArray(d.electiveGroups)) continue;
  curricula.push({ file: f, d });
}
if (!curricula.length) { console.error('content/curriculum 에 편제표 JSON이 없습니다.'); process.exit(2); }
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
  if (!sIn) note('warn', curId, 'school-missing', `schools.json 에 ${schoolId} 가 없어 임시 학교 레코드를 만듭니다.`, { schoolId });
  if (sIn && d.school && sIn.name !== d.school) note('info', curId, 'school-name', `표시 이름 불일치: schools.json "${sIn.name}" / 편제표 "${d.school}" (schools.json 값을 사용)`, { schoolId });
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
    crows.push(mk(termInfo(c.term), { mode: 'required', slot: i, subjectName: c.subject, subjectKey: sub.subjectKey, area: sub.area, areasAll: sub.areasAll, subArea: sub.subArea, sourceArea: c.area ?? null, kinds: ks, kind: primaryKind(ks), credits: c.credits, basicCredits: c.basicCredits ?? null, groupKey: null, extra: c.extra ?? null, graded: c.graded ?? null }));
  });
  d.electiveGroups.forEach(g => {
    const gKey = `${curId}#${g.id}`;
    const opts = g.options.map((o, j) => {
      const sub = resolveSubject(o.subject); const ks = normKinds(o.kind ?? g.kind);
      return mk(termInfo(g.term), { mode: 'elective', slot: j, subjectName: o.subject, subjectKey: sub.subjectKey, area: sub.area, areasAll: sub.areasAll, subArea: sub.subArea, sourceArea: null, kinds: ks, kind: primaryKind(ks), credits: g.creditsEach, basicCredits: null, groupKey: gKey, extra: o.extra ?? null, graded: o.graded ?? null });
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
    crows.push(mk(termInfo(o.term), { mode: 'outside', slot: i, subjectName: o.subject, subjectKey: sub.subjectKey, area: sub.area, areasAll: sub.areasAll, subArea: sub.subArea, sourceArea: o.area ?? null, kinds: ks, kind: primaryKind(ks), credits: o.credits, basicCredits: o.basicCredits ?? null, groupKey: null, extra: o.extra ?? null, graded: null, note: o.note ?? null }));
  });

  // 행 ID, 구분 상태
  const seq = {};
  for (const r of crows) {
    const n = (seq[`${r.term}:${r.mode}`] = (seq[`${r.term}:${r.mode}`] ?? 0) + 1);
    r.id = `${curId}#${r.term}#${r.mode[0]}${String(n).padStart(2, '0')}`;
    r.kindStatus = r.kind ? 'printed' : (kindScheme === 'fusion-only' ? 'unmarked' : 'missing');
    r.kindGuess = null; r.flagIds = []; r.readConfidence = 'ok'; r.confidence = conf;
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
    for (const r of linked) { r.flagIds.push(id); if (r.readConfidence !== 'low') r.readConfidence = level; }
    const out = { id, curriculumId: c.curId, schoolId: c.schoolId, ref, note: f.note ?? '', confidence: f.confidence ?? 'medium', term, groupId: gid, linkedRowIds: linked.map(r => r.id), linkedSubjectKeys: uniq(linked.map(r => r.subjectKey)), linkMethod: how, scope: how ? 'row' : 'general' };
    flagsOut.push(out);
    if (!how) note('warn', c.curId, 'flag-unlinked', `과목/묶음에 연결되지 않은 flag: ${ref}`, { schoolId: c.schoolId, flagId: id });
  });
}

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
  };
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
    quality: { confidence: c.conf, flagsLow: flagsHere.filter(f => f.confidence === 'low').length, flagsMedium: flagsHere.filter(f => f.confidence !== 'low').length, flagsUnlinked: flagsHere.filter(f => f.scope === 'general').length, kindMissingRows: noKind.length, kindInferredRows: noKind.filter(r => r.kindGuess).length, hasSourceArea: cr.some(r => r.sourceArea), ...validation },
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
  modes: count(rows, r => r.mode), poolTypes: count(groups, g => g.poolType), kindStatus: count(rows, r => r.kindStatus),
  rowsByArea: count(rows.filter(r => r.mode !== 'outside'), r => r.area),
};

// ---------- 7단계: 검토 대기열 ----------
const reviewQueue = {
  unlinkedFlags: flagsOut.filter(f => f.scope === 'general').map(f => ({ flagId: f.id, curriculumId: f.curriculumId, ref: f.ref, confidence: f.confidence, note: f.note })),
  lowConfidenceFlags: flagsOut.filter(f => f.confidence === 'low').map(f => ({ flagId: f.id, curriculumId: f.curriculumId, ref: f.ref, note: f.note, linkedRowIds: f.linkedRowIds })),
  kindMissing: curOut.map(c => ({ curriculumId: c.curId, kindScheme: c.kindScheme, rows: c.rows.filter(r => r.mode !== 'outside' && !r.kind).map(r => ({ rowId: r.id, term: r.term, subject: r.subjectName, status: r.kindStatus, guess: r.kindGuess })) })).filter(x => x.rows.length),
  unmappedSubjects: [...unmapped].map(([k, n]) => ({ subjectKey: k, printed: [...n] })),
  ambiguousSubjects: subjects.filter(s => s.ambiguous).map(s => ({ subjectKey: s.subjectKey, name: s.name, area: s.area, reason: s.ambiguous, schools: s.offeredBy })),
  areaRuleConflicts: issues.filter(i => i.check === 'area-rule-conflict').map(i => ({ curriculumId: i.curriculumId, message: i.message })),
  declaredMismatches: issues.filter(i => i.level === 'error').map(i => ({ curriculumId: i.curriculumId, check: i.check, message: i.message })),
};

// ---------- 출력 ----------
const TERMS_ = TERMS;
const omitNull = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
// 원본 경로를 담기 쉬운 키는 DB 어디에도 남기지 않는다(소스 이미지 경로는 displayImage 로만 노출)
const DROP_KEYS = new Set(['file', 'sourceImage']);
const clean = v => Array.isArray(v) ? v.map(clean) : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).filter(([k]) => !DROP_KEYS.has(k)).map(([k, x]) => [k, clean(x)])) : v;

// 화면용 이미지
const sourceImageOf = new Map(curOut.map(c => [c.curId, c.d.sourceImage ?? null]));
const IMAGES_FILE = join(ROOT, 'content', 'data', 'display-images.json'); // 비공개(content/ 는 gitignore)
const imageRules = existsSync(IMAGES_FILE) ? readJson(IMAGES_FILE) : {};
const maskedSources = new Set();
const displayImageOf = c => {
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
const offeringsOut = [...rows].sort(sortRowsBy).map(r => omitNull({
  id: r.id, curriculumId: r.curriculumId, schoolId: r.schoolId, entryYear: r.entryYear,
  term: r.term, grade: r.grade, semester: r.semester,
  slot: r.mode, seq: r.slot, subject: r.subjectName, subjectKey: r.subjectKey,
  area: r.area, subArea: r.subArea, kind: r.kinds, primaryKind: r.kind, kindStatus: r.kindStatus, kindGuess: r.kindGuess,
  credits: r.credits, basicCredits: r.basicCredits,
  groupId: r.groupKey, pick: r.mode === 'elective' ? groups.find(g => g.groupKey === r.groupKey)?.pick : null, groupSize: r.mode === 'elective' ? groups.find(g => g.groupKey === r.groupKey)?.optionCount : null,
  extra: r.extra, graded: r.graded, flagIds: r.flagIds, readConfidence: r.readConfidence, confidence: r.confidence,
}));
function sortRowsBy(a, b) { return ko(a.id, b.id); }

const groupsOut = groups.map(g => omitNull({ id: g.groupKey, label: g.groupId, curriculumId: g.curriculumId, schoolId: g.schoolId, entryYear: g.entryYear, term: g.term, grade: g.grade, semester: g.semester, pick: g.pick, creditsEach: g.creditsEach, creditsTotal: g.creditsTotal, size: g.optionCount, poolLabelRaw: g.poolLabelRaw, poolType: g.poolType, areasInPool: g.areasInPool, sameArea: g.sameArea, kind: g.kindsPrinted, subjectKeys: g.subjectKeys }));

const flagsOutRows = flagsOut.map(f => {
  const refs = f.linkMethod === 'group' ? [{ type: 'group', id: `${f.curriculumId}#${f.groupId}` }] : f.linkedRowIds.map(id => ({ type: 'offering', id }));
  if (!refs.length) refs.push({ type: 'curriculum', id: f.curriculumId });
  return omitNull({ id: f.id, curriculumId: f.curriculumId, schoolId: f.schoolId, ref: f.ref, note: f.note, confidence: f.confidence, term: f.term, scope: f.scope, linkMethod: f.linkMethod, refs });
});

const subjectsOut = subjects.map(s => omitNull({ subjectKey: s.subjectKey, name: s.name, area: s.area, subArea: s.subArea, aliases: s.aliases, isComposite: s.isComposite, components: s.isComposite ? s.components : null, areasAll: s.areasAll.length > 1 ? s.areasAll : null, kindsPrinted: s.kindsPrinted, offeredBy: s.offeredBy, schoolCount: s.schoolCount, ambiguous: s.ambiguous }));

const schoolsOut = schoolList.map(s => clean(s));
const schoolById = Object.fromEntries(schoolsOut.map(s => [s.id, s]));

const summaryOut = summaries.map(s => {
  const sc = schoolById[s.schoolId] ?? {};
  const cr = curRecords.find(x => x.id === s.curriculumId);
  const own = issues.filter(i => i.curriculumId === s.curriculumId);
  const flagsTotal = s.quality.flagsLow + s.quality.flagsMedium;
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
    confidence: s.quality.confidence, flagsTotal, flagsUnlinked: s.quality.flagsUnlinked, kindMissingRows: s.quality.kindMissingRows, validationErrors: errs, reviewCount: flagsTotal + errs + warnsNoFlag,
    byTerm: s.byTerm, byArea: s.byArea, byKind: s.byKind, electivePools: s.electives.byPoolType,
  };
  return omitNull(o);
});

const matrixOut = compare.map(m => ({ subjectKey: m.subjectKey, name: m.name, area: m.area, ...(m.subArea ? { subArea: m.subArea } : {}), schoolCount: m.schoolCount, cells: Object.fromEntries(Object.entries(m.cells).map(([sid, c]) => [sid, { slots: c.modes, terms: c.terms, kind: c.kinds, credits: c.credits, groupIds: c.groupKeys }])) }));

const data = {
  'summary': { use: 'core', purpose: '학교(편제표)당 1행 비교표 + 학기·영역·구분 요약. 가장 작고 먼저 읽는 파일', rows: summaryOut },
  'schools': { use: 'core', purpose: '학교 엔티티(이름·유형·설립·지역·배정방식·출처 신뢰도)', rows: schoolsOut },
  'curricula': { use: 'core', purpose: '편제표 헤더: displayImage, 선언 학점(declared), 창체, 검증 건수', rows: curRecordsOut },
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

// ---- 출력 직렬화 + 검사 ----
const serialized = Object.entries(data).map(([name, d]) => [`${name}.json`, JSON.stringify(d.rows)]);
const internal = {
  'validation.json': issues,
  'build-report.json': { schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), inputs: [...curricula.map(c => ({ path: `content/curriculum/${c.file}`, sha256_16: sha(join(CUR_DIR, c.file)) })), ...(existsSync(SCHOOLS_FILE) ? [{ path: 'content/data/schools.json', sha256_16: sha(SCHOOLS_FILE) }] : []), { path: 'tools/db-rules.json', sha256_16: sha(RULES_FILE) }, ...(existsSync(IMAGES_FILE) ? [{ path: 'content/data/display-images.json', sha256_16: sha(IMAGES_FILE) }] : [])], counts: { schools: schoolList.length, curricula: curRecords.length, subjects: subjects.length, offerings: rows.length, groups: groups.length, flags: flagsOut.length } },
};

// 원본 경로 노출 검사: ① 마스킹 학교의 원본 경로는 어디에도 금지 ② files/inbox 문자열은 displayImage 값으로만 허용 ③ sourceImage 키 금지
const leaks = [];
const walk = (v, key, file) => {
  if (Array.isArray(v)) v.forEach(x => walk(x, key, file));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k === 'sourceImage') leaks.push(`${file}: sourceImage 키`); walk(x, k, file); }
  else if (typeof v === 'string') { if (/files\/inbox/.test(v) && key !== 'displayImage') leaks.push(`${file}: ${key ?? ''}="${v.slice(0, 60)}"`); for (const m of maskedSources) if (v.includes(m) || v.includes(m.split('/').pop())) leaks.push(`${file}: 마스킹 학교 원본 경로 노출 (${key ?? ''})`); }
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

if (!CHECK_ONLY) {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const f of readdirSync(OUT_DIR)) if (f.endsWith('.json')) rmSync(join(OUT_DIR, f));
  rmSync(join(OUT_DIR, 'derived'), { recursive: true, force: true });
  rmSync(join(OUT_DIR, '_internal'), { recursive: true, force: true });
  mkdirSync(join(OUT_DIR, '_internal'), { recursive: true });
  for (const [f, text] of serialized) writeFileSync(join(OUT_DIR, f), text + '\n');
  writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  for (const [f, v] of Object.entries(internal)) writeFileSync(join(OUT_DIR, '_internal', f), JSON.stringify(v, null, 2) + '\n');
}
console.log(`${CHECK_ONLY ? '[check] ' : ''}학교 ${schoolList.length} · 편제표 ${curRecords.length} · 과목 ${subjects.length} · 행 ${rows.length} · 택n 묶음 ${groups.length} · flags ${flagsOut.length}`);
console.log(`오류 ${errors.length} · 경고 ${warns.length} · 정보 ${issues.length - errors.length - warns.length}`);
for (const i of [...errors, ...warns]) console.log(`  [${i.level}] ${i.curriculumId ?? '-'} ${i.check}: ${i.message}`);
console.log(`파일 ${index.files.length}개 · 합계 ${(index.totalBytes / 1024).toFixed(0)}KB (core ${(index.coreBytes / 1024).toFixed(0)}KB)` + (CHECK_ONLY ? '' : ` → ${OUT_DIR}`));
process.exit(errors.length ? 1 : 0);
