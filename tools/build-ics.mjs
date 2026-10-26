// portal/data/events.json → portal/data/schedule.ics (캘린더 구독용 정적 파일, 서버 없음).
// 확정은 표시하지 않고, 추정은 제목에 "(추정)", 보도는 "(보도)"를 붙인다. 현 고3(audience grade3)과 2033학년도 등 기본 기준(2030 대입) 밖 일정은 넣지 않는다(졸업·입학은 포함).
// 월 단위 날짜(YYYY-MM)는 그 달 전체 종일 일정으로 넣고 제목에 "(월 단위)"를 붙인다.
// 사용: node tools/build-ics.mjs   (--check: 파일과 결과가 다르면 종료코드 1)
import { readFileSync, writeFileSync } from "node:fs";

const events = JSON.parse(readFileSync("portal/data/events.json", "utf8"));
const esc = (t) => String(t).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// RFC 5545: 한 줄은 75옥텟 이하. 넘으면 CRLF + 공백으로 접는다(UTF-8 문자 경계를 지킨다).
const fold = (line) => {
  const bytes = (c) => Buffer.byteLength(c, "utf8");
  let out = "", cur = 0, first = true;
  for (const ch of line) {
    const limit = first ? 75 : 74;
    if (cur + bytes(ch) > limit) { out += "\r\n "; cur = 0; first = false; }
    out += ch; cur += bytes(ch);
  }
  return out;
};
const ymd = (d) => d.replace(/-/g, "");
const addDay = (d) => { const [y, m, dd] = d.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, dd + 1)); return `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, "0")}${String(t.getUTCDate()).padStart(2, "0")}`; };
const monthStart = (d) => `${d}-01`;
const monthEnd = (d) => { const [y, m] = d.split("-").map(Number); const t = new Date(Date.UTC(y, m, 0)); return `${y}-${String(m).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`; };
const isMonth = (d) => /^\d{4}-\d{2}$/.test(d);

const tag = (e) => (e.status === "estimated" ? " (추정)" : e.status === "reported" ? " (보도)" : "");

const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//admissions-2030//schedule//KO", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:대입 일정", "X-WR-TIMEZONE:Asia/Seoul"];
let n = 0;
for (const e of events) {
  if ((e.audience || []).includes("grade3")) continue;
  if ((e.learners || []).length && !e.learners.some((x) => x === "A" || x === "all" || x === "common") && !/^life-/.test(e.policyId)) continue; // 2033학년도 등 기본 기준 밖 일정(졸업·입학은 항상 포함)
  const s0 = isMonth(e.start) ? monthStart(e.start) : e.start;
  const e0 = e.end ? (isMonth(e.end) ? monthEnd(e.end) : e.end) : isMonth(e.start) ? monthEnd(e.start) : e.start;
  const monthly = isMonth(e.start) || (e.end && isMonth(e.end));
  const summary = `${e.title}${e.label ? ` · ${e.label}` : ""}${tag(e)}${monthly ? " (월 단위)" : ""}`;
  const src = (e.sources || (e.sourceName ? [{ name: e.sourceName, url: e.sourceUrl }] : [])).map((x) => (x.url ? `${x.name} ${x.url}` : x.name)).join(" / ");
  const desc = [e.body, e.unverified ? "아직 원문 확인 전이에요." : "", e.reason ? `사유: ${e.reason}` : "", src ? `출처: ${src}` : "", `확인일 ${e.checkedAt}`].filter(Boolean).join("\n");
  lines.push("BEGIN:VEVENT", `UID:${e.id}@admissions-2030`, `DTSTAMP:${ymd(e.checkedAt)}T000000Z`, `DTSTART;VALUE=DATE:${ymd(s0)}`, `DTEND;VALUE=DATE:${addDay(e0)}`, `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(desc)}`, "TRANSP:TRANSPARENT", "END:VEVENT");
  n++;
}
lines.push("END:VCALENDAR");
const ics = lines.map(fold).join("\r\n") + "\r\n";
const target = "portal/data/schedule.ics";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== ics) { console.error("schedule.ics is out of date"); process.exit(1); }
} else writeFileSync(target, ics);
console.log(n, "events in schedule.ics");
