// research/data/policy-draft.json(조사 세션 산출) → portal/data/policy.json. 편제표 DB(build-db)와 별개다.
// 값은 draft에서 그대로 옮기고, 화면용 필드(entryYear, events, note)만 더한다.
// 사용: node tools/build-policy.mjs  (--check: 파일과 결과가 다르면 종료코드 1)
import { readFileSync, writeFileSync } from "node:fs";

const STATUS = { 확정: "confirmed", 보도: "reported", 추정: "estimated", "학교 배부 자료": "material", "서울교육청 자료": "seoul", unknown: "unknown" };
const KIND = { 공식: "official", 매체: "media", "학교 배부 자료": "material", "서울교육청 자료": "seoul" };

// 고입·대입 일정 행의 날짜(고입은 id, 대입은 id가 밀릴 수 있어 title 키). draft 본문의 날짜를 ISO로 옮겼다(연도는 해당 학년도 시행 연도). 월만 알면 YYYY-MM.
const EVENTS = {
  "hs-01": [{ label: "기본계획 확정", start: "2026-08" }],
  "hs-02": [{ label: "접수(전국 기준)", start: "2026-08-18", end: "2026-09-03" }],
  "hs-03": [{ label: "접수", start: "2026-10-19", end: "2026-10-22" }, { label: "합격 발표", start: "2026-11-04" }],
  "hs-04": [
    { label: "특별전형 접수", start: "2026-11-23", end: "2026-11-24" }, { label: "특별전형 발표", start: "2026-11-27" },
    { label: "일반전형 접수", start: "2026-11-30", end: "2026-12-01" }, { label: "일반전형 발표", start: "2026-12-02" },
    { label: "추가모집 접수", start: "2026-12-02", end: "2026-12-03" }, { label: "추가모집 발표", start: "2026-12-03" },
  ],
  "hs-05": [{ label: "후기 전형 개막(보도)", start: "2026-12-02" }],
  "2027학년도 수능(참고, 현 고3)": [{ label: "원서접수", start: "2026-08-24", end: "2026-09-04" }, { label: "시험", start: "2026-11-19" }, { label: "성적통지", start: "2026-12-11" }],
  "2027학년도 수능 시행 기본계획 공고": [{ label: "공고(매체 보도)", start: "2026-03-31" }],
  "2028학년도 수능": [{ label: "시험", start: "2027-11-18" }, { label: "성적통지", start: "2027-12-10" }],
  "2028학년도 수시 원서접수": [{ label: "수시 원서접수 시작", start: "2027-09-20" }],
  "2028학년도 대입전형 기본사항": [{ label: "대교협 발표", start: "2025-08-28" }],
  "2030학년도 대입전형 기본사항 발표": [{ label: "발표 가능성(추정)", start: "2027-08" }],
  "2030학년도 수능 시행일": [{ label: "시행일 미확인(2029.11 중하순 추정)", start: "2029-11" }],
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
const NOTES = { "adm-05": "미결정 상태", "adm-10": "개인 제안, 정부안 아님", "hs-04": "공식 페이지 요약", "hs-08": "공식 FAQ 인용" };
// 사용자 결정 Q6(2026-10-25): 기본계획 공고 시기 정정. 화면 상단 안내문도 이 행의 body를 읽는다(문구 관리 한 곳).
const BODY = { "adm-07": "수능 세부 범위는 추정이며, 2030학년도 수능 시행 기본계획 공고(2029.3 전후 추정, 2027학년도분은 2026.3.31 공고) 전까지 미확정" };

// 사용자 지시(PM 경유, 2026-10-25): 2030학년도 수능을 2029.11.15로 잠정 예상. 상태는 추정 그대로, 본문에 출처를 덧붙인다.
const APPEND = { "sch-12": "사용자 잠정 예상 2029.11.15, 공식 공고 전." };

// statusNote("확정(원문 미확인, 시기 조정은 미결정)") 괄호 안에서 배지로 따로 보이는 "원문 미확인"을 뺀 나머지.
const extra = (t) => ((t || "").match(/\((.*)\)\s*$/)?.[1] ?? "").split(/,\s*/).filter((x) => x && x !== "원문 미확인").join(", ");

const draft = JSON.parse(readFileSync("research/data/policy-draft.json", "utf8")).items;
const out = draft.map((d) => {
  const sources = [d.sourceName && { name: d.sourceName, url: d.sourceUrl }, ...(d.extraSources || [])].filter(Boolean);
  const row = { id: d.id, topic: d.topic };
  row.entryYear = d.entryYear ?? (d.examYear ? d.examYear - 3 : 2027);
  row.examYear = d.examYear ?? row.entryYear + 3;
  Object.assign(row, { title: d.title, body: APPEND[d.id] ? `${(BODY[d.id] ?? d.body).replace(/\.?$/, ".")} ${APPEND[d.id]}` : BODY[d.id] ?? d.body, status: STATUS[d.status] ?? "unknown" });
  const note = NOTES[d.id] ?? extra(d.statusNote);
  if (note) row.note = note;
  row.unverified = !!d.unverified;
  row.sourceKind = KIND[d.sourceKind] ?? null;
  row.sourceName = d.sourceName ?? null;
  row.sourceUrl = d.sourceUrl ?? null;
  if (sources.length > 1) row.sources = sources;
  if (EVENTS[d.id] || EVENTS[d.title]) row.events = EVENTS[d.id] || EVENTS[d.title];
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
