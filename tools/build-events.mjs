// 일정(events) 생성 규칙. tools/build-policy.mjs가 불러 portal/data/events.json을 만든다.
// 날짜 정본: research/data/policy-draft.json의 행별 `date`("YYYY-MM-DD", "YYYY-MM-DD~YYYY-MM-DD", 월만 있으면 "YYYY-MM"),
// 한 행에 날짜가 여럿이면 tools/events-manual.json(손으로 관리)의 {label,start,end}[] 를 쓴다. 코드에 날짜를 두지 않는다.
import { readFileSync } from "node:fs";

export const loadManual = () => JSON.parse(readFileSync(new URL("./events-manual.json", import.meta.url), "utf8")).events || {};

const DATE = "\\d{4}-\\d{2}(?:-\\d{2})?";
// draft의 date 문자열 → [{label:"", start, end?}]. 형식이 아니면 null.
export const parseDate = (t) => {
  const m = typeof t === "string" && t.match(new RegExp(`^(${DATE})(?:~(${DATE}))?$`));
  return m ? [m[2] && m[2] !== m[1] ? { label: "", start: m[1], end: m[2] } : { label: "", start: m[1] }] : null;
};

// 행(id·title)에 대한 일정 목록: 손 관리 파일(id→title 순) 우선, 없으면 draft의 date.
export const specFor = (row, rawDate, manual) => manual[row.id] || manual[row.title] || parseDate(rawDate);

// 정책 행 → events.json 항목. id는 `ev-<행id>-<n>`(행 안에서 시작일 순서가 아니라 정의 순서).
export function makeEvents(rows, specOf) {
  const out = [];
  for (const r of rows) {
    const spec = specOf(r);
    if (!spec) continue;
    spec.forEach((e, i) => {
      const ev = { id: `ev-${r.id}-${i + 1}`, policyId: r.id, title: r.title, label: e.label || "", start: e.start };
      if (e.end) ev.end = e.end;
      Object.assign(ev, { status: r.status, unverified: r.unverified });
      for (const k of ["reason", "note", "sourceKind", "sourceName", "sourceUrl", "sources", "region", "audience", "learners", "stage", "entryYear", "examYear"]) if (r[k] != null) ev[k] = r[k];
      ev.body = r.body;
      ev.checkedAt = r.checkedAt;
      out.push(ev);
    });
  }
  return out;
}
