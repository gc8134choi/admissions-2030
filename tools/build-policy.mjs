// research/*.md 표 → portal/data/policy.json. 값은 md에서 그대로 옮기고, 지어내지 않는다.
// 사용: node tools/build-policy.mjs  (--check: 파일과 결과가 다르면 종료코드 1)
import { readFileSync, writeFileSync } from "node:fs";

const CHECKED_AT = "2026-10-25"; // 두 md의 조사일
const STATUS = { 확정: "confirmed", 보도: "reported", 추정: "estimated", "확인 못 함": "unknown" };
const KIND = { 공식: "official", 매체: "media" };

// md 표 위치 → topic / id 접두. (md는 research/ 소관이라 읽기만 한다.)
const TABLES = {
  "01": [
    { topic: "admission-reform", prefix: "adm" },
    { topic: "admission-trend", prefix: "adm-t" },
  ],
  "02": [
    { topic: "hs-schedule", prefix: "hs-sch" },
    { topic: "hs-types", prefix: "hs-type" },
    { topic: "credit-system", prefix: "credit" },
  ],
};
// 학년도: 2028 개편 확정안 행은 2028학년도 대상(md: 2025 입학생), 그 외는 현 중3(2027→2030).
const YEAR_2028 = ["2028학년도 대입 개편 확정", "통합형 수능", "심화수학", "내신 5등급 상대평가", "수능·수시/정시 시기 조정"];
// 일정 행의 날짜(md 본문의 월.일을 ISO로 옮김. 연도는 2027학년도 고입이 2026 하반기라서 2026으로 둠).
const EVENTS = {
  기본계획: [{ label: "기본계획 확정", start: "2026-08" }],
  과학고: [{ label: "접수(전국 기준)", start: "2026-08-18", end: "2026-09-03" }],
  마이스터고: [{ label: "접수", start: "2026-10-19", end: "2026-10-22" }, { label: "합격 발표", start: "2026-11-04" }],
  특성화고: [
    { label: "특별전형 접수", start: "2026-11-23", end: "2026-11-24" }, { label: "특별전형 발표", start: "2026-11-27" },
    { label: "일반전형 접수", start: "2026-11-30", end: "2026-12-01" }, { label: "일반전형 발표", start: "2026-12-02" },
    { label: "추가모집 접수", start: "2026-12-02", end: "2026-12-03" }, { label: "추가모집 발표", start: "2026-12-03" },
  ],
  "후기 일반고·자사고·외고·국제고": [{ label: "후기 전형 개막(보도)", start: "2026-12-02" }],
};

const cells = (line) => line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const links = (cell) => {
  if (!cell || cell === "-") return [];
  return cell.split(/,\s*(?=\[)/).map((p) => {
    const m = p.match(/^\[([^\]]+)\]\((.*)\)(.*)$/);
    return m ? { name: (m[1] + m[3]).trim(), url: m[2] } : { name: p, url: null };
  });
};

function parse(file, defs) {
  const lines = readFileSync(file, "utf8").split("\n");
  const rows = [];
  let t = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!/^\| 항목 /.test(lines[i])) continue;
    const def = defs[++t];
    let n = 0;
    for (i += 2; i < lines.length && lines[i].startsWith("|"); i++) {
      const [title, body, st, kind, src] = cells(lines[i]);
      const m = st.match(/^([^()]+)(?:\((.*)\))?$/);
      const key = m[1].trim();
      const status = STATUS[key] || "unknown"; // '-' = 판단 근거 없음 → unknown
      const sources = links(src);
      const row = { id: `${def.prefix}-${String(++n).padStart(3, "0")}`, topic: def.topic };
      Object.assign(row, years(title), { title, body: status === "unknown" && body === "확인 못 함" ? "확인 못 함" : body, status });
      const note = [m[2], kind !== "-" && !KIND[kind] ? kind : null].filter(Boolean).join("; ");
      if (note) row.note = note;
      row.sourceKind = KIND[kind] ?? (kind.startsWith("공식") ? "media" : null);
      row.sourceName = sources[0]?.name ?? (src === "-" ? null : src);
      row.sourceUrl = sources[0]?.url ?? null;
      if (sources.length > 1) row.sources = sources;
      if (EVENTS[title]) row.events = EVENTS[title];
      row.checkedAt = CHECKED_AT;
      rows.push(row);
    }
  }
  return rows;
}
const years = (title) => (YEAR_2028.includes(title) ? { entryYear: 2025, examYear: 2028 } : { entryYear: 2027, examYear: 2030 });

// 01의 '확인 못 함' 목록 → unknown 행
function unknownRows(file) {
  const text = readFileSync(file, "utf8").split("## 확인 못 함")[1] || "";
  return text.split("\n").filter((l) => l.startsWith("- ")).map((l, i) => ({
    id: `adm-u-${String(i + 1).padStart(3, "0")}`, topic: "admission-unknown", entryYear: 2027, examYear: 2030,
    title: l.slice(2).split(". ")[0].replace(/\.$/, ""), body: l.slice(2), status: "unknown",
    sourceKind: null, sourceName: null, sourceUrl: null, checkedAt: CHECKED_AT,
  }));
}

const out = [...parse("research/01-admission-system.md", TABLES["01"]), ...unknownRows("research/01-admission-system.md"), ...parse("research/02-high-school-entry.md", TABLES["02"])];
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/policy.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("policy.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(out.length, "rows");
