// research/data/exam-trends-draft.json(조사 세션) → portal/data/exam-trends.json (내신 출제·평가 경향, 학교 비교에서 사용).
//   검사: 값 범위(평균 0~100, 표준편차 0~50), 성취도 분포 합 100(±0.6), 지필+수행 100(±0.6), 서술형 0~100, 교과 중복, placeId·files.json 참조.
//   계산: 교과별 A 비율, 학교별 경향(변별 강함/보통/무난). 규칙(추정): 평균 70 미만 또는 표준편차 17 이상 → 변별 강함, 평균 80 이상이고 표준편차 12 미만 → 무난, 그 밖 → 보통. 교과 평균들의 평균·표준편차로 판정한다.
//   초안이 없으면 빈 목록을 만든다(화면은 빈 상태 문구).
// 사용: node tools/build-exam-trends.mjs [--check] [--src 경로(시험용)]
import { withSourceIds } from "./lib/source-ids.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const argv = process.argv.slice(2);
const SRC = argv.includes("--src") ? argv[argv.indexOf("--src") + 1] : "research/data/exam-trends-draft.json";
const MAN = JSON.parse(readFileSync("tools/exam-trends-manual.json", "utf8"));
const CODES = existsSync("portal/data/school-codes.json") ? JSON.parse(readFileSync("portal/data/school-codes.json", "utf8")).items : [];
const schoolCode = (pid) => CODES.find((c) => c.placeId === pid)?.ids?.find((x) => x.system === "schoolinfo")?.code ?? null;
const ns = (s) => String(s).replace(/\s+/g, "");
// 선택과목 현황(electives.json)의 과목 → 영역(사회·과학). 평가계획의 교과 표기가 이와 어긋나면 오류
const elArea = new Map();
if (existsSync("portal/data/electives.json")) for (const it of JSON.parse(readFileSync("portal/data/electives.json", "utf8")).items ?? []) for (const tm of it.terms ?? []) for (const s of tm.subjects) elArea.set(ns(s.name), s.area);
const raw = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")) : { _meta: {}, items: [] };
const noUrl = (s) => (s == null ? s : String(s).replace(/\s*\(https?:\/\/[^)]*\)/g, "")); // 문장 속 주소 괄호는 뺀다(링크는 화면이 따로 붙인다)
const cleanUrl = (u, pid) => (!u ? null : /GS_CD=None/.test(u) ? (schoolCode(pid) ? u.replace("GS_CD=None", `GS_CD=${schoolCode(pid)}`) : "https://www.schoolinfo.go.kr/") : u); // 학교 코드가 빠진 공시 주소는 학교 단위 주소로(코드는 school-codes) // 학교 코드가 없는 공시 주소는 학교알리미 첫 화면으로
// 조사 초안(schools[{assessmentPlan[{term,grade,rows[{subject,area,writtenPct,performancePct}]}],achievement{rows},qualitative[]}], official, commonRules, readingAids) → 이 파일의 입력 모양(items·guide)으로 바꾼다
function convert(r) {
  if (!r.schools) return r;
  const items = r.schools.map((s) => {
    const ap = s.assessmentPlan ?? [], rows = s.achievement?.rows ?? [];
    const srcs = []; for (const a of ap) { const x = a.source; if (x?.name && !srcs.some((y) => y.name === x.name)) srcs.push({ name: x.name, url: cleanUrl(x.url, s.placeId) }); }
    const first = ap.find((a) => a.grade === 1) ?? ap[0];
    const q = (s.qualitative ?? []).map((x) => ({ text: x.text, source: x.source?.name ?? null, status: x.status ?? "reported" }));
    const hasData = ap.length || rows.length;
    return { placeId: s.placeId, name: s.name, term: first?.term ?? null, asOf: first?.checkedAt ?? null, sourceKind: first ? "학교알리미 공시 평가계획" : null, status: first?.status === "confirmed" ? "reported" : first?.status ?? "reported",
      sources: srcs, plans: ap.map((a) => ({ term: a.term, grade: a.grade, note: a.note ?? null, gaps: MAN.gaps.filter((g) => g.placeId === s.placeId && g.grade === a.grade).map((g) => ({ subject: g.subject, area: g.area })), rows: a.rows.map((x) => ({ subject: x.subject, area: MAN.areaOverrides[ns(x.subject)] ?? x.area, paperPct: x.writtenPct, performancePct: x.performancePct, essayPct: x.essayPct ?? null })) })),
      subjects: rows, qualitative: q, nullReason: hasData ? null : noUrl(s.assessmentPlanNullReason ?? s.achievement?.nullReason ?? null), nextAction: hasData ? null : noUrl(s.assessmentPlanNextAction ?? s.achievement?.nextAction ?? null), achievementNull: rows.length ? null : noUrl(s.achievement?.nullReason ?? null) };
  });
  const a = r.readingAids ?? {};
  return { _meta: r._meta, items, guide: { intro: a.verdict ?? null, questions: a.questions ?? [], basis: (r.official ?? []).map((o) => ({ text: o.text, source: o.source ? { name: o.source.name, url: o.source.url ?? null } : undefined })), commonRules: r.commonRules ? { text: r.commonRules.text, source: r.commonRules.source ? { name: r.commonRules.source.name, url: cleanUrl(r.commonRules.source.url) } : null } : null } };
}
const draft = convert(raw);
const schema = JSON.parse(readFileSync("schema/exam-trends.schema.json", "utf8"));
const I = schema.properties.items.items, SUBJ = I.properties.subjects.items.properties.subject.enum;
const { plain } = await import("../portal/plain.js");
const places = new Map(JSON.parse(readFileSync("portal/data/places.json", "utf8")).places.map((p) => [p.id, p]));
const fileIds = new Set((existsSync("portal/data/files.json") ? JSON.parse(readFileSync("portal/data/files.json", "utf8")) : []).map((f) => f.id));
const errs = [], seen = new Set();
const num = (v) => typeof v === "number" && Number.isFinite(v);
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const round1 = (v) => Math.round(v * 10) / 10;
export const tendency = (mean, sd) => (mean < 70 || sd >= 17 ? "변별 강함" : mean >= 80 && sd < 12 ? "무난" : "보통");

const items = draft.items.map((it) => {
  const w = it.placeId ?? it.name ?? "?";
  for (const k of I.required) if (it[k] == null || it[k] === "") errs.push(`${w}: ${k} 없음`);
  if (!new RegExp(I.properties.placeId.pattern).test(it.placeId || "")) errs.push(`${w}: placeId 형식`);
  if (seen.has(it.placeId)) errs.push(`${w}: placeId 중복`); seen.add(it.placeId);
  if (!places.has(it.placeId)) errs.push(`${w}: places.json에 없음`); else if (places.get(it.placeId).level !== "high") errs.push(`${w}: 고등학교가 아님`);
  if (!I.properties.status.enum.includes(it.status)) errs.push(`${w}: status ${it.status}`);
  if (it.asOf && !/^\d{4}-\d{2}-\d{2}$/.test(it.asOf)) errs.push(`${w}: asOf 형식`);
  for (const f of it.fileIds ?? []) if (!fileIds.has(f)) errs.push(`${w}: fileIds "${f}"가 files.json에 없음`);
  const base = { placeId: it.placeId, name: it.name, term: it.term ?? null, asOf: it.asOf ?? null, sourceKind: it.sourceKind ?? null, status: it.status, sources: (it.sources ?? []).map((s) => ({ ...s, name: plain(s.name) })), fileIds: it.fileIds ?? [], briefingNote: it.briefingNote ? plain(it.briefingNote) : null };
  const plans = (it.plans ?? []).map((pl) => {
    const rows = pl.rows.map((x) => {
      const y = `${w} ${pl.grade}학년 ${x.subject}`;
      if (![...SUBJ, "제2외국어"].includes(x.area)) errs.push(`${y}: 교과 "${x.area}"`);
      if (elArea.has(ns(x.subject)) && elArea.get(ns(x.subject)) !== x.area) errs.push(`${y}: 교과 ${x.area} ≠ 선택과목 현황의 분류 ${elArea.get(ns(x.subject))}`);
      if (MAN.areaOverrides[ns(x.subject)] == null && ["인문학과윤리", "중국어회화"].includes(ns(x.subject))) errs.push(`${y}: 교과 보정 표 필요`);
      for (const k of ["paperPct", "performancePct", "essayPct"]) if (x[k] != null && !(num(x[k]) && x[k] >= 0 && x[k] <= 100)) errs.push(`${y}: ${k} ${x[k]} 범위`);
      if (x.paperPct == null || x.performancePct == null) errs.push(`${y}: 지필·수행 비율 필요`); else if (Math.abs(x.paperPct + x.performancePct - 100) > 0.6) errs.push(`${y}: 지필 ${x.paperPct} + 수행 ${x.performancePct} ≠ 100`);
      return { subject: plain(x.subject), area: x.area, paperPct: x.paperPct, performancePct: x.performancePct, essayPct: x.essayPct ?? null };
    });
    const subs = new Set(); for (const x of rows) { if (subs.has(x.subject)) errs.push(`${w} ${pl.grade}학년: 과목 "${x.subject}" 중복`); subs.add(x.subject); }
    const gaps = (pl.gaps ?? []).filter((g) => { if (rows.some((x) => ns(x.subject) === ns(g.subject))) { errs.push(`${w} ${pl.grade}학년 ${g.subject}: 값이 생겼으니 tools/exam-trends-manual.json gaps에서 지우세요`); return false; } return true; });
    // 표를 자동으로 읽어 옮긴 값은 과목이 빠졌을 수 있다: 화면에는 '일부 과목만' 한 줄(많이 빠진 경우는 그렇게)
    const partial = pl.note ? (/많은 과목이 빠/.test(pl.note) ? "많은 과목이 빠졌어요. 학교알리미 파일에서 직접 확인해 주세요" : "일부 과목이 빠졌을 수 있어요") : null;
    // 1학년 공통과목(국어·수학·영어·통합사회·통합과학)이 빠졌으면 '평가계획 정리 중'으로 알린다
    if (pl.grade === 1) for (const [key, area] of [["공통국어", "국어"], ["공통수학", "수학"], ["공통영어", "영어"], ["통합사회", "사회"], ["통합과학", "과학"]]) if (!rows.some((x) => ns(x.subject).includes(key)) && !gaps.some((g) => ns(g.subject).includes(key))) gaps.push({ subject: key, area });
    return { term: pl.term, grade: pl.grade ?? null, rows, gaps, partial };
  });
  base.plans = plans; base.qualitative = (it.qualitative ?? []).map((x) => ({ text: plain(x.text), source: x.source ? plain(x.source) : null, status: x.status ?? "reported" }));
  if (!(it.subjects ?? []).length && !plans.length) {
    if (!it.nullReason) errs.push(`${w}: subjects가 없으면 nullReason 필수`);
    return { ...base, nullReason: it.nullReason ? plain(it.nullReason) : null, nextAction: it.nextAction ? plain(it.nextAction) : null, achievementNull: null, subjects: [], summary: null };
  }
  if (!(it.sources ?? []).length) errs.push(`${w}: sources 비어 있음`);
  const names = new Set();
  const subjects = it.subjects.map((s) => {
    const x = `${w} ${s.subject}`;
    if (!SUBJ.includes(s.subject)) errs.push(`${x}: 교과 "${s.subject}"`);
    if (names.has(s.subject)) errs.push(`${x}: 교과 중복`); names.add(s.subject);
    if (s.mean != null && !(num(s.mean) && s.mean >= 0 && s.mean <= 100)) errs.push(`${x}: 평균 ${s.mean} 범위(0~100)`);
    if (s.sd != null && !(num(s.sd) && s.sd >= 0 && s.sd <= 50)) errs.push(`${x}: 표준편차 ${s.sd} 범위(0~50)`);
    if ((s.mean == null) !== (s.sd == null)) errs.push(`${x}: 평균·표준편차는 함께 있거나 함께 null`);
    if (s.takers != null && !(Number.isInteger(s.takers) && s.takers > 0)) errs.push(`${x}: 수강자 수 ${s.takers}`);
    if (s.dist) { const v = Object.values(s.dist); if (v.some((n) => !num(n) || n < 0 || n > 100)) errs.push(`${x}: 성취도 분포 범위`); const sum = v.reduce((a, b) => a + b, 0); if (Math.abs(sum - 100) > 0.6) errs.push(`${x}: 성취도 분포 합 ${round1(sum)} ≠ 100`); }
    for (const k of ["paperPct", "performancePct", "essayPct"]) if (s[k] != null && !(num(s[k]) && s[k] >= 0 && s[k] <= 100)) errs.push(`${x}: ${k} ${s[k]} 범위`);
    if ((s.paperPct != null) !== (s.performancePct != null)) errs.push(`${x}: 지필·수행 비율은 함께 있어야 함`);
    else if (s.paperPct != null && Math.abs(s.paperPct + s.performancePct - 100) > 0.6) errs.push(`${x}: 지필 ${s.paperPct} + 수행 ${s.performancePct} ≠ 100`);
    return { subject: s.subject, mean: s.mean ?? null, sd: s.sd ?? null, takers: s.takers ?? null, dist: s.dist ?? null, aPct: s.dist?.A ?? null, paperPct: s.paperPct ?? null, performancePct: s.performancePct ?? null, essayPct: s.essayPct ?? null, plan: s.plan ? plain(s.plan) : null };
  }).sort((a, b) => SUBJ.indexOf(a.subject) - SUBJ.indexOf(b.subject));
  const m = subjects.filter((s) => s.mean != null);
  const summary = m.length ? { meanAvg: round1(avg(m.map((s) => s.mean))), sdAvg: round1(avg(m.map((s) => s.sd))), tendency: tendency(avg(m.map((s) => s.mean)), avg(m.map((s) => s.sd))), basis: "평균·표준편차 기준 추정", subjectCount: m.length } : null;
  return { ...base, nullReason: null, nextAction: null, achievementNull: subjects.length ? null : it.achievementNull ? plain(it.achievementNull) : null, subjects, summary };
});
if (errs.length) { console.error(errs.slice(0, 30).join("\n")); process.exit(1); }

const g = draft.guide;
const guide = { intro: g?.intro ? plain(g.intro) : null, questions: (g?.questions ?? []).map((q) => plain(q)), basis: (g?.basis ?? []).map((b) => ({ ...b, text: plain(b.text) })), commonRules: g?.commonRules ? { ...g.commonRules, text: plain(g.commonRules.text) } : null };
const out = { _meta: { note: "내신 출제·평가 경향(생성물, 손으로 고치지 않는다). research/data/exam-trends-draft.json에서 tools/build-exam-trends.mjs가 만든다. 경향 한 줄은 평균·표준편차 기준 추정이다.", rule: "평균 70 미만 또는 표준편차 17 이상 = 변별 강함, 평균 80 이상이고 표준편차 12 미만 = 무난, 그 밖 = 보통", checkedAt: draft._meta?.checkedAt ?? null, count: items.length, withData: items.filter((i) => i.subjects.length || i.plans.length).length }, guide, items };
const json = JSON.stringify(withSourceIds(out), null, 1) + "\n";
const target = "portal/data/exam-trends.json";
if (argv.includes("--check")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== json) { console.error("exam-trends.json이 초안과 다르다 — node tools/build-exam-trends.mjs"); process.exit(1); }
  console.log(`OK: exam-trends ${items.length}곳(자료 있음 ${out._meta.withData})`);
} else if (argv.includes("--src")) { console.log(json.slice(0, 1800)); } else { writeFileSync(target, json); console.log(`exam-trends ${items.length}곳(자료 있음 ${out._meta.withData})`); }
