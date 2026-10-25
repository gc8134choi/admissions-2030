// research/data/policy-draft.json(조사 세션 산출) → portal/data/policy.json. 편제표 DB(build-db)와 별개다.
// 값은 draft에서 그대로 옮기고, 화면용 필드(entryYear, events, note)만 더한다.
// 사용: node tools/build-policy.mjs  (--check: 파일과 결과가 다르면 종료코드 1)
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { loadManual, specFor, makeEvents } from "./build-events.mjs";

const STATUS = { 확정: "confirmed", 보도: "reported", 추정: "estimated", "학교 배부 자료": "material", "서울교육청 자료": "seoul", "학원 자료": "academy", "서울교육청 자료(원문 확인)": "seoul-verified", "서울·경기 자료 일치": "match", "경기도교육청 자료": "gyeonggi", 의견: "opinion", unknown: "unknown" };
const KIND = { 공식: "official", 매체: "media", "학교 배부 자료": "material", "서울교육청 자료": "seoul", "서울교육청·경기도교육청 자료": "seoul-gyeonggi", "경기도교육청 자료": "gyeonggi", "학원 의견": "opinion", "학원 자료": "academy" };

// draft에서 빠진, 조사 md 상태 칸의 괄호 설명.
const NOTES = { "asg-05": "2026학년도 기준, 2027 규칙은 gg-10~12 참고. \"학군 내 11지망\"은 2027 공식(학군내 5지망)과 달라 확인 필요", "adm-05": "미결정 상태", "adm-10": "개인 제안, 정부안 아님", "hs-08": "공식 FAQ 인용" };
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

// 모르는 status 문구는 조용히 unknown으로 두지 않고 멈춘다(새 값은 STATUS에 추가).
const status = (d) => { const v = STATUS[d.status]; if (!v) throw new Error(`unmapped status "${d.status}" (${d.id})`); return v; };

const rawDate = new Map();
const draft = JSON.parse(readFileSync("research/data/policy-draft.json", "utf8")).items;
const out = draft.map((d) => {
  const sources = [d.sourceName && { name: d.sourceName, url: d.sourceUrl }, ...(d.extraSources || [])].filter(Boolean);
  const row = { id: d.id, topic: d.topic };
  // 연도는 draft에 있는 것만 그대로 내보낸다(없는 행은 프로필 공통 행). 프로필 필터는 portal/profile.js.
  if (d.entryYear != null) row.entryYear = d.entryYear;
  if (d.examYear != null) row.examYear = d.examYear;
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
  if (Array.isArray(d.learners)) row.learners = d.learners; // 학습자 관련성(A/B). 없으면 연도 규칙(portal/profile.js)
  if (d.stage) row.stage = d.stage;
  rawDate.set(row.id, d.date);
  row.checkedAt = d.checkedAt;
  return row;
});
// 일정은 events.json이 정본이고, policy 행에는 하위 호환용 events[]와 eventIds를 함께 둔다(한 릴리스 동안).
const manual = loadManual();
// 바뀐 소식(change-log)의 date는 보도일이라 일정으로 쓰지 않는다.
const events = makeEvents(out, (r) => (r.topic === "change-log" ? null : specFor(r, rawDate.get(r.id), manual)));
for (const r of out) {
  const mine = events.filter((e) => e.policyId === r.id);
  if (mine.length) { r.events = mine.map((e) => ({ label: e.label, start: e.start, ...(e.end ? { end: e.end } : {}) })); r.eventIds = mine.map((e) => e.id); }
}
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/policy.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("policy.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(out.length, "rows");
{
  const j = JSON.stringify(events, null, 1) + "\n", t = "portal/data/events.json";
  if (process.argv.includes("--check")) { let cur = ""; try { cur = readFileSync(t, "utf8"); } catch {} if (cur !== j) { console.error("events.json is out of date"); process.exit(1); } }
  else writeFileSync(t, j);
  console.log(events.length, "events");
}

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
