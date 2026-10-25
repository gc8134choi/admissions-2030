// research/data/policy-draft.json(조사 세션 산출) → portal/data/policy.json. 편제표 DB(build-db)와 별개다.
// 값은 draft에서 그대로 옮기고, 화면용 필드(entryYear, events, note)만 더한다.
// 사용: node tools/build-policy.mjs  (--check: 파일과 결과가 다르면 종료코드 1)
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";

const STATUS = { 확정: "confirmed", 보도: "reported", 추정: "estimated", "학교 배부 자료": "material", "서울교육청 자료": "seoul", "학원 자료": "academy", "서울교육청 자료(원문 확인)": "seoul-verified", "서울·경기 자료 일치": "match", "경기도교육청 자료": "gyeonggi", 의견: "opinion", unknown: "unknown" };
const KIND = { 공식: "official", 매체: "media", "학교 배부 자료": "material", "서울교육청 자료": "seoul", "서울교육청·경기도교육청 자료": "seoul-gyeonggi", "경기도교육청 자료": "gyeonggi", "학원 의견": "opinion", "학원 자료": "academy" };

// 고입·대입 일정 행의 날짜(고입은 id, 대입은 id가 밀릴 수 있어 title 키). draft 본문의 날짜를 ISO로 옮겼다(연도는 해당 학년도 시행 연도). 월만 알면 YYYY-MM.
const EVENTS = {
  "hs-01": [{ label: "기본계획 확정", start: "2026-08" }],
  "hs-02": [{ label: "접수(전국 기준)", start: "2026-08-18", end: "2026-09-03" }],
  "hs-05": [{ label: "후기 전형 개막(보도)", start: "2026-12-02" }],
  "2027학년도 수능(참고, 현 고3)": [{ label: "원서접수", start: "2026-08-24", end: "2026-09-04" }, { label: "시험", start: "2026-11-19" }, { label: "성적통지", start: "2026-12-11" }],
  "2027학년도 수능 시행 기본계획 공고": [{ label: "공고(매체 보도)", start: "2026-03-31" }],
  "2028학년도 수능": [{ label: "시험", start: "2027-11-18" }, { label: "성적통지", start: "2027-12-10" }],
  "2028학년도 수시 원서접수": [{ label: "수시 원서접수 시작", start: "2027-09-20" }],
  "2028학년도 대입전형 기본사항": [{ label: "대교협 발표", start: "2025-08-28" }],
  "2030학년도 대입전형 기본사항 발표": [{ label: "발표 가능성(추정)", start: "2027-08" }],
  "2030학년도 수능 시행일": [{ label: "시행일(잠정 예상)", start: "2029-11-15" }],
  "2030학년도 수능 시행 기본계획 공고": [{ label: "공고(2029.3 전후 추정)", start: "2029-03" }],
  "2027학년도 고교 입학(개학)": [{ label: "입학·개학(추정)", start: "2027-03" }],
  "2028학년도 정시 일정(참고)": [
    { label: "원서접수(3일 이상)", start: "2028-01-03", end: "2028-01-06" }, { label: "가군 전형", start: "2028-01-10", end: "2028-01-17" },
    { label: "나군 전형", start: "2028-01-18", end: "2028-01-25" }, { label: "다군 전형", start: "2028-01-31", end: "2028-02-07" },
    { label: "합격자 발표(~2.10)", start: "2028-02-10" }, { label: "등록", start: "2028-02-11", end: "2028-02-14" },
  ],
  "2030학년도 수시 원서접수": [{ label: "시작(2029.9 중하순 추정)", start: "2029-09" }],
  "2030학년도 수능": [{ label: "시행일(잠정 예상)", start: "2029-11-15" }],
  "2030학년도 정시": [{ label: "원서접수·전형(추정)", start: "2029-12", end: "2030-02" }],
};
// draft에서 빠진, 조사 md 상태 칸의 괄호 설명.
const NOTES = { "adm-05": "미결정 상태", "adm-10": "개인 제안, 정부안 아님", "hs-08": "공식 FAQ 인용" };
// 사용자 결정 Q6(2026-10-25): 기본계획 공고 시기 정정. 화면 상단 안내문도 이 행의 body를 읽는다(문구 관리 한 곳).
const BODY = { "adm-07": "수능 세부 범위는 추정이며, 2030학년도 수능 시행 기본계획 공고(2029.3 전후 추정, 2027학년도분은 2026.3.31 공고) 전까지 미확정" };

// statusNote에서 배지로 따로 보이는 상태 문구·"원문 미확인"·"학원" 라벨을 뺀 나머지.
// 형식: "확정(원문 미확인, 시기 조정은 미결정)" 또는 "학원 자료, 2028학년도 기준, 원문 미확인; 추가 설명". ";" 뒤는 그대로 붙인다.
const DROP = new Set(["원문 미확인", "학원", "학원 자료", "학원 의견", ...Object.keys(STATUS)]);
const extra = (t) => {
  const [head, ...rest] = (t || "").split(/;\s*/);
  const inner = head.match(/\((.*)\)\s*$/)?.[1] ?? head;
  return [inner.split(/,\s*/).filter((x) => x && !DROP.has(x)).join(", "), ...rest].filter(Boolean).join("; ");
};

// draft의 date("YYYY-MM-DD" 또는 "YYYY-MM-DD~YYYY-MM-DD") → 날짜 하나짜리 events. 라벨은 항목 제목이 대신한다.
const dateEvents = (t) => {
  const m = typeof t === "string" && t.match(/^(\d{4}-\d{2}-\d{2})(?:~(\d{4}-\d{2}-\d{2}))?$/);
  return m ? [m[2] && m[2] !== m[1] ? { label: "", start: m[1], end: m[2] } : { label: "", start: m[1] }] : null;
};

// 모르는 status 문구는 조용히 unknown으로 두지 않고 멈춘다(새 값은 STATUS에 추가).
const status = (d) => { const v = STATUS[d.status]; if (!v) throw new Error(`unmapped status "${d.status}" (${d.id})`); return v; };

const draft = JSON.parse(readFileSync("research/data/policy-draft.json", "utf8")).items;
const out = draft.map((d) => {
  const sources = [d.sourceName && { name: d.sourceName, url: d.sourceUrl }, ...(d.extraSources || [])].filter(Boolean);
  const row = { id: d.id, topic: d.topic };
  row.entryYear = d.entryYear ?? (d.examYear ? d.examYear - 3 : 2027);
  row.examYear = d.examYear ?? row.entryYear + 3;
  Object.assign(row, { title: d.title, body: BODY[d.id] ?? d.body, status: status(d) });
  const note = NOTES[d.id] ?? extra(d.statusNote);
  if (note) row.note = note;
  row.unverified = !!d.unverified;
  if (d.unverifiedReason) row.reason = d.unverifiedReason;
  row.sourceKind = KIND[d.sourceKind] ?? null;
  row.sourceName = d.sourceName ?? null;
  row.sourceUrl = d.sourceUrl ?? null;
  if (sources.length > 1) row.sources = sources;
  if (d.region) row.region = d.region; // seoul | gyeonggi | national (정의: draft 상단 fields.region)
  if (Array.isArray(d.audience)) row.audience = d.audience; // 일정 대상별 필터용(없으면 공통 취급)
  const events = EVENTS[d.id] || EVENTS[d.title] || dateEvents(d.date);
  if (events) row.events = events;
  row.checkedAt = d.checkedAt;
  return row;
});
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/policy.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("policy.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(out.length, "rows");

// ---- 공식 이미지 출처(research/data/image-credits.json → portal/data/image-credits.json) ----
// 공공누리 제1유형(출처표시)만 portal/img/credit/로 복사해 화면에 쓰고, 그 밖의 유형·조건 불명은 링크만 남긴다(usable=false).
{
  const credits = JSON.parse(readFileSync("research/data/image-credits.json", "utf8")).images || [];
  const out2 = credits.map((c) => {
    const usable = /제1유형/.test(c.license || "") && c.file && existsSync(c.file);
    const base = (c.file || "").split("/").pop();
    if (usable && !process.argv.includes("--check")) { mkdirSync("portal/img/credit", { recursive: true }); copyFileSync(c.file, `portal/img/credit/${base}`); }
    const { file, imageUrl, ...rest } = c;
    return { ...rest, file: usable ? base : null, usable: !!usable };
  });
  const j2 = JSON.stringify(out2, null, 1) + "\n";
  const t2 = "portal/data/image-credits.json";
  if (process.argv.includes("--check")) {
    let cur = ""; try { cur = readFileSync(t2, "utf8"); } catch {}
    if (cur !== j2) { console.error("image-credits.json is out of date"); process.exit(1); }
  } else writeFileSync(t2, j2);
  console.log(out2.filter((x) => x.usable).length, "usable images");
}
