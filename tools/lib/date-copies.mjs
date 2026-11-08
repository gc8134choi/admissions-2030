// 같은 날짜가 여러 데이터에 손 사본으로 있는 것을 정본(policy 행 본문·events)과 맞춰 보는 읽기 전용 검사.
//   정본: research/data/policy-draft.json 의 행(본문·제목)과 portal/data/events.json 의 start/end·label·body
//   사본: research/data/date-copies.json 이 가리키는 hs-types 달력·timeline·roadmap·middle-guide 항목
//   규칙: ① 사본 글에 적힌 날짜(월.일)는 연결된 정본 날짜에 있어야 한다 ② 사본의 when(YYYY-MM-DD)은 정본 날짜에 있어야 한다
//         ③ date-copies.json 에 없는 사본(날짜가 든 항목)은 '매핑 없음'으로 알린다(새 항목이 조용히 빠지지 않게)
import { readFileSync, existsSync } from "node:fs";

const FULL = /(?<![\d.])(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?!\d)/g;
const SHORT = /(?<![\d.])(\d{1,2})\.(\d{1,2})(?![\d])(?!\.\d)/g;
const pad = (n) => String(n).padStart(2, "0");
const md = (m, d) => `${pad(m)}-${pad(d)}`;

// 글에서 날짜를 순서대로 뽑는다: [{y|null, m, d}] ('1.4~1.7', '12.11~12', '2026.12.4~12.10' 모두 처리)
export function datesIn(text) {
  const t = String(text ?? "").replace(/％/g, "%");
  const hits = [];
  const used = [];
  for (const m of t.matchAll(FULL)) { hits.push({ i: m.index, y: +m[1], m: +m[2], d: +m[3] }); used.push([m.index, m.index + m[0].length]); }
  for (const m of t.matchAll(SHORT)) {
    const i = m.index; if (used.some(([a, b]) => i >= a && i < b)) continue;
    const mo = +m[1], d = +m[2]; if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    hits.push({ i, y: null, m: mo, d });
  }
  hits.sort((a, b) => a.i - b.i);
  const out = [];
  for (const h of hits) { // 범위 끝 '~27' 같은 일 단독 표기: 바로 앞 날짜의 월을 따른다
    out.push(h);
  }
  // '~'뒤 일 단독('1.25~27', '11.2~6')
  for (const m of t.matchAll(/(?<!\d)(\d{1,2})\s*[.](\d{1,2})(?:\([^)]*\))?\s*~\s*(\d{1,2})(?![\d.])/g)) {
    const mo = +m[1], d2 = +m[3]; if (mo >= 1 && mo <= 12 && d2 >= 1 && d2 <= 31) out.push({ i: m.index, y: null, m: mo, d: d2 });
  }
  // 연도 이어받기: 짧은 날짜는 앞의 긴 날짜 연도를 따르고, 월이 줄면 다음 해
  let cy = null, pm = null;
  out.sort((a, b) => a.i - b.i);
  for (const h of out) {
    if (h.y) { cy = h.y; pm = h.m; continue; }
    // 12월→1월처럼 월이 크게 줄 때만 다음 해로 본다(같은 문장 안 순서가 뒤섞여도 해를 넘기지 않게)
    if (cy != null) { if (pm != null && pm - h.m >= 6) cy += 1; h.y = cy; pm = h.m; }
  }
  return out;
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const fullSet = (ds) => new Set(ds.filter((d) => d.y).map((d) => `${d.y}-${pad(d.m)}-${pad(d.d)}`));
const mdSet = (ds) => new Set(ds.map((d) => md(d.m, d.d)));

// 사본 종류별로 (id, when, text) 행을 꺼낸다.
const ROWS = {
  "hs-calendar": (d) => d.calendar.map((r) => ({ id: r.id, when: r.when, text: r.what })),
  timeline: (d) => d.events.map((r) => ({ id: r.id, when: r.when, text: r.what })),
  roadmap: (d) => d.items.map((r) => ({ id: r.id, when: r.when, text: r.what, refs: r.refs })),
  "middle-guide": (d) => d.sections.flatMap((s) => s.items.map((it, i) => ({ id: `${s.id}#${i}`, when: it.when, text: it.text }))),
};

export function checkDateCopies(root = ".") {
  const cfgPath = `${root}/research/data/date-copies.json`;
  if (!existsSync(cfgPath)) return { errs: [], checked: 0, unmapped: [] };
  const cfg = readJson(cfgPath);
  const policy = new Map(readJson(`${root}/research/data/policy-draft.json`).items.map((r) => [r.id, r]));
  const events = readJson(`${root}/portal/data/events.json`);
  const canon = (ids) => {
    let ds = [];
    for (const id of ids) {
      const r = policy.get(id);
      if (!r) throw new Error(`date-copies.json: 정책 행 ${id} 없음`);
      ds = ds.concat(datesIn(`${r.title ?? ""} ${r.body ?? ""}`));
      for (const e of events.filter((x) => x.policyId === id)) ds = ds.concat(datesIn(`${e.start ?? ""} ${e.end ?? ""} ${e.label ?? ""} ${e.body ?? ""}`));
    }
    return { md: mdSet(ds), full: fullSet(ds) };
  };
  const errs = [], unmapped = [];
  let checked = 0;
  for (const src of cfg.sources) {
    const data = readJson(`${root}/${src.file}`);
    const rows = [];
    for (const r of ROWS[src.kind](data)) rows.push(r);
    const map = { ...(src.map ?? {}) };
    if (src.kind === "roadmap") for (const r of rows) if (!map[r.id] && r.refs?.length) map[r.id] = { policy: r.refs }; // 로드맵은 refs가 곧 정본 연결
    for (const r of rows) {
      const own = datesIn(`${r.text}`);
      const hasDate = own.length > 0 || /^\d{4}-\d{2}-\d{2}/.test(r.when ?? "");
      const m = map[r.id];
      if (!m) { if (hasDate && !(src.skip ?? []).includes(r.id)) unmapped.push(`${src.file}#${r.id}`); continue; }
      if (m.skip) continue;
      const c = canon(m.policy ?? []);
      const allow = new Set((m.allow ?? []).map(String));
      checked++;
      for (const d of own) {
        const key = md(d.m, d.d);
        if (!c.md.has(key) && !allow.has(`${d.m}.${d.d}`)) errs.push(`${src.file}#${r.id}: 글의 날짜 ${d.m}.${d.d} 가 연결된 정본(${(m.policy ?? []).join(",")})에 없음 — "${String(r.text).slice(0, 50)}"`);
      }
      for (const w of String(r.when ?? "").split("~")) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(w)) continue;
        if (!c.full.has(w) && !allow.has(w)) errs.push(`${src.file}#${r.id}: when ${w} 가 연결된 정본(${(m.policy ?? []).join(",")})에 없음`);
      }
    }
  }
  return { errs, checked, unmapped };
}
