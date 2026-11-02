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

// 본문(body·label·title)에 적힌 날짜 토큰(월·일). "이전 값·교체·달라" 같은 정정 설명 괄호는 제외한다.
export function dateTokens(text) {
  const t = String(text || "").replace(/\([^()]*(?:이전|교체|달라|아님|정정)[^()]*\)/g, " ");
  const out = new Set();
  let m;
  const r1 = /(\d{4})\s*[.년]\s*(\d{1,2})\s*[.월]\s*(\d{1,2})/g;
  while ((m = r1.exec(t))) out.add(`${+m[2]}-${+m[3]}`);
  const r2 = /(?<![\d.])(\d{1,2})\s*[.월]\s*(\d{1,2})\s*일?(?![\d])/g;
  while ((m = r2.exec(t))) { const mo = +m[1], d = +m[2]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) out.add(`${mo}-${d}`); }
  const r3 = /(\d{1,2})\.(\d{1,2})\s*[~∼-]\s*(?:(\d{1,2})\.)?(\d{1,2})(?![\d.])/g;
  while ((m = r3.exec(t))) { const mo = +m[1], mo2 = m[3] ? +m[3] : mo; out.add(`${mo}-${+m[2]}`); out.add(`${mo2}-${+m[4]}`); }
  return out;
}
// 일정 start/end(일 단위)가 본문 날짜에 있어야 한다. 없으면 오류 목록을 돌려준다(월만 있는 일정은 건너뜀).
export function checkEventDates(events) {
  const bad = [];
  for (const e of events) {
    const tk = dateTokens(`${e.body || ""} ${e.label || ""} ${e.title || ""}`);
    for (const k of ["start", "end"]) {
      const v = e[k];
      if (typeof v === "string" && v.length === 10 && !tk.has(`${+v.slice(5, 7)}-${+v.slice(8, 10)}`)) bad.push(`${e.id} ${k}=${v}: 본문·라벨에 같은 날짜가 없음 (${(e.label || e.title || "").slice(0, 30)})`);
    }
  }
  return bad;
}

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
  { const seen = new Set(); for (const e of out) { if (seen.has(e.id)) throw new Error(`일정 id 중복: ${e.id}`); seen.add(e.id); } }
  { const bad = checkEventDates(out); if (bad.length) throw new Error(`일정 날짜가 본문과 다름 ${bad.length}건:\n  ` + bad.join("\n  ")); }
  // 라벨이 있는 일정(하루 단위)은 본문에 그 날짜(M.D, M월 D일, YYYY.M.D)가 적혀 있어야 한다 — 제목·본문이 라벨·날짜와 어긋난 행(id가 겹치면서 생긴 사고)을 막는다.
  const bad = [];
  for (const e of out) {
    if (!e.title || (e.end && e.end < e.start)) bad.push(`${e.id}: 제목 없음 또는 끝날짜가 시작보다 앞`);
    const m = e.label && /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.start);
    if (!m) continue;
    const [y, mo, d] = [m[1], +m[2], +m[3]], b = String(e.body || "");
    if (![`${mo}.${d}`, `${mo}월 ${d}일`, `${mo}/${d}`, `${y}.${mo}.${d}`].some((p) => b.includes(p))) bad.push(`${e.id}: 라벨 "${e.label}"의 날짜 ${e.start}가 본문에 없음 — 제목·본문이 라벨·날짜와 어긋났는지 확인`);
  }
  if (bad.length) throw new Error("일정 점검 실패:\n" + bad.join("\n"));
  return out;
}
