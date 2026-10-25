// 과목 마스터(아키텍처 1단계): 편제표 DB(subjects·offerings)와 교육청 안내(subject-info) → 안정 코드 sj-NNNN.
//   입력(읽기만): portal/data/subjects.json, offerings.json, subject-info.json
//   고정:  portal/data/subjects.lock.json   legacyKey → sj 코드(한 번 부여하면 바뀌지 않고, 코드는 재사용하지 않는다)
//   산출:  portal/data/subject-master.json, portal/data/offerings-index.json, temp/quality/subject-mapping.md
// 이름 매핑은 정규화 후 완전 일치만 자동으로 잇는다. 모호·불일치는 리포트에만 남기고 임의로 잇지 않는다.
// 사용: node tools/build-subjects.mjs [--check]   (--check: 산출물이 다르거나 검증에 걸리면 종료코드 1)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const rd = (p) => JSON.parse(readFileSync(p, "utf8"));
const D = "portal/data/";
const subjects = rd(D + "subjects.json");
const offerings = rd(D + "offerings.json");
const infoDoc = rd(D + "subject-info.json");
const info = infoDoc.subjects;
const LOCK = D + "subjects.lock.json";
const CHECK = process.argv.includes("--check");
const errs = [];

// ---- 코드 고정 -------------------------------------------------------
const lock = existsSync(LOCK) ? rd(LOCK) : { _meta: {}, next: 1, codes: {}, retired: [] };
const codes = { ...lock.codes };
let next = lock.next;
const live = new Set(subjects.map((s) => s.subjectKey));
for (const s of subjects) if (!codes[s.subjectKey]) codes[s.subjectKey] = "sj-" + String(next++).padStart(4, "0");
const retired = [...new Set([...(lock.retired || []), ...Object.keys(codes).filter((k) => !live.has(k))])].sort();
const lockOut = {
  _meta: { note: "legacyKey(=subjectKey) → 과목 코드. 한 번 부여한 코드는 바꾸거나 재사용하지 않는다. tools/build-subjects.mjs가 새 과목만 이어서 부여한다(손으로 고치지 않는다)." },
  next, codes, retired,
};
{
  const vals = Object.values(codes);
  if (new Set(vals).size !== vals.length) errs.push("lock: 코드 중복");
  for (const [k, v] of Object.entries(lock.codes || {})) if (codes[k] !== v) errs.push(`lock: ${k} 코드가 바뀜`);
}

// ---- 이름 정규화·매핑 --------------------------------------------------
const norm = (t) => t.replace(/[\s]+/g, "").replace(/[·ㆍ・]/g, "·").replace(/[↔／/]/g, "|");
const infoBy = new Map();
for (const x of info) { const k = norm(x.name); if (infoBy.has(k)) errs.push(`subject-info 이름 중복: ${x.name}`); infoBy.set(k, x); }
const bigrams = (t) => { const s = new Set(); for (let i = 0; i < t.length - 1; i++) s.add(t.slice(i, i + 2)); return s; };
const jac = (a, b) => { const A = bigrams(a), B = bigrams(b); let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n || 1); };
// 후보 제시용(자동 연결하지 않음): 한쪽 이름이 다른 쪽에 포함(3자 이상)되거나 글자쌍 유사도 0.5 이상
const candidates = (name) => {
  const n = norm(name);
  return info.filter((x) => { const m = norm(x.name); return m !== n && ((m.length >= 3 && n.includes(m)) || (n.length >= 3 && m.includes(n)) || jac(n, m) >= 0.5); }).map((x) => x.name);
};
function classify(name) {
  const hit = infoBy.get(norm(name));
  if (hit) return { cls: "auto", info: hit };
  const c = candidates(name);
  return c.length ? { cls: "ambiguous", cands: c } : { cls: "none" };
}

// ---- 개설(offerings)에서 읽는 값 ----------------------------------------
const kindCount = new Map();
for (const o of offerings) { const m = kindCount.get(o.subjectKey) ?? new Map(); m.set(o.primaryKind, (m.get(o.primaryKind) || 0) + 1); kindCount.set(o.subjectKey, m); }
const topKind = (key) => { const m = kindCount.get(key); return m ? [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))[0][0] : null; };
const TYPE2KIND = { 공통과목: "공통", 일반선택: "일반", 진로선택: "진로", 융합선택: "융합" };
const area7 = (a) => (["국어", "수학", "영어", "한국사", "사회", "과학"].includes(a) ? a : "기타");
const byKey = new Map(subjects.map((s) => [s.subjectKey, s]));
const byName = new Map(subjects.map((s) => [norm(s.name), s]));

// ---- 마스터 ------------------------------------------------------------
const master = [];
const rep = { auto: [], ambiguous: [], none: [], composite: [] };
for (const s of subjects) {
  const id = codes[s.subjectKey];
  const own = s.isComposite ? null : classify(s.name);
  let r = own, infoHit = own?.info;
  if (s.isComposite) {
    // 선택 가능한 묶음 과목: 구성 과목 각각이 자동 일치하면 자동, 아니면 가장 나쁜 쪽
    const parts = (s.components || []).map((c) => ({ c, ...classify(c) }));
    const worst = parts.some((p) => p.cls === "none") ? "none" : parts.some((p) => p.cls === "ambiguous") ? "ambiguous" : "auto";
    r = { cls: worst, parts };
  }
  rep[r.cls].push({ s, r });
  if (s.isComposite) rep.composite.push({ s, r });
  const kind = (infoHit && TYPE2KIND[infoHit.type]) || topKind(s.subjectKey) || "학교지정";
  const comps = s.isComposite ? (s.components || []).map((c) => { const t = byName.get(norm(c)); return t ? codes[t.subjectKey] : null; }) : null;
  const m = {
    subjectId: id, legacyKey: s.subjectKey, name: s.name, aliases: s.aliases || [],
    area: s.area, areaGroup: area7(s.area),
    ...(byKey.get(s.subjectKey)?.subArea ? { subArea: byKey.get(s.subjectKey).subArea } : {}),
    kind, kindSource: infoHit && TYPE2KIND[infoHit.type] ? "subject-info" : "offerings",
    ...(infoHit ? { defaultCredits: /기본 4학점/.test(infoHit.credit || "") || !infoHit.credit ? 4 : undefined } : {}),
    rev: { r2022: true, predecessors2015: infoHit?.old2015 ? [].concat(infoHit.old2015) : [] },
    isComposite: !!s.isComposite,
    ...(s.isComposite ? { components: s.components || [], componentIds: comps } : {}),
    ...(s.csatArea ? { csat: [{ regimeId: "csat-2028", area: s.csatArea, scope: s.csatScope, confidence: s.csatConfidence }] } : {}),
    infoMatch: r.cls, // auto | ambiguous | none (모호·불일치는 info를 흡수하지 않음)
    ...(infoHit ? { infoName: infoHit.name, summary: infoHit.summary, ...(infoHit.majors ? { majorsHint: infoHit.majors } : {}) } : {}),
    schoolCount: s.schoolCount, offeredBy: s.offeredBy,
  };
  if (m.defaultCredits === undefined) delete m.defaultCredits;
  master.push(m);
}
// subject-info에 있지만 어느 과목에도 이어지지 않은 항목(참고용)
const usedInfo = new Set(master.filter((m) => m.infoName).map((m) => norm(m.infoName)));
for (const s of subjects) if (s.isComposite) for (const c of s.components || []) { const h = infoBy.get(norm(c)); if (h) usedInfo.add(norm(h.name)); }
const unusedInfo = info.filter((x) => !usedInfo.has(norm(x.name)));

const masterOut = {
  _meta: { note: "과목 마스터(생성물, 손으로 고치지 않는다). tools/build-subjects.mjs가 subjects.json·subject-info.json·subjects.lock.json으로 만든다. 기존 subjects.json은 그대로 두고 화면은 아직 이것을 쓰지 않는다.", schemaVersion: "3.0.0-draft", count: master.length, infoCount: info.length, infoMatched: usedInfo.size },
  subjects: master,
};
const idxOut = {
  _meta: { note: "offerings.id → subjectId (생성물). offerings.json은 수정하지 않는다.", count: offerings.length },
  bySubjectKey: Object.fromEntries(subjects.map((s) => [s.subjectKey, codes[s.subjectKey]])),
  byOffering: Object.fromEntries(offerings.map((o) => [o.id, codes[o.subjectKey] ?? null])),
};
for (const o of offerings) if (!codes[o.subjectKey] || !live.has(o.subjectKey)) errs.push(`offering ${o.id}: subjectKey "${o.subjectKey}" 코드 없음`);

// ---- 스키마 검증(schema/subjects.schema.json의 required·enum·pattern·type만 확인) ----
const schema = rd("schema/subjects.schema.json");
const ids = new Set();
for (const m of master) {
  for (const k of schema.required) if (m[k] == null) errs.push(`${m.legacyKey}: ${k} 없음`);
  if (!new RegExp(schema.properties.subjectId.pattern).test(m.subjectId)) errs.push(`${m.legacyKey}: subjectId 형식`);
  if (ids.has(m.subjectId)) errs.push(`subjectId 중복 ${m.subjectId}`); ids.add(m.subjectId);
  for (const f of ["area", "areaGroup", "kind"]) if (!schema.properties[f].enum.includes(m[f])) errs.push(`${m.legacyKey}: ${f} "${m[f]}"가 enum 밖`);
  for (const c of m.csat || []) { const p = schema.properties.csat.items.properties; if (!p.area.enum.includes(c.area) || !p.scope.enum.includes(c.scope) || !p.confidence.enum.includes(c.confidence)) errs.push(`${m.legacyKey}: csat 값`); }
  for (const c of m.componentIds || []) if (c && !ids.has(c) && !master.some((x) => x.subjectId === c)) errs.push(`${m.legacyKey}: componentIds ${c}`);
}
if (master.length !== subjects.length) errs.push("마스터 개수가 subjects.json과 다름");

// ---- 리포트 ------------------------------------------------------------
const li = (a) => a.map(({ s, r }) => `- \`${s.subjectKey}\` ${s.name} (${s.area}, ${s.schoolCount}개교)${r.cands ? ` → 후보: ${r.cands.join(", ")}` : ""}${r.parts ? ` ← 구성 ${r.parts.map((p) => `${p.c}(${p.cls === "auto" ? "일치" : p.cls === "ambiguous" ? "모호" : "불일치"})`).join(", ")}` : ""}`).join("\n") || "- 없음";
const md = `# 과목 이름 매핑 리포트 (subject-mapping)

생성: \`node tools/build-subjects.mjs\` (손으로 고치지 않는다). 편제표 DB 과목 ${subjects.length}개 ↔ 교육청 안내(subject-info) ${info.length}개.
규칙: 공백·가운뎃점 표기를 정규화한 뒤 **완전 일치**만 자동으로 잇는다. 모호·불일치는 안내 내용을 흡수하지 않고(\`infoMatch\`로 표시) 여기에 남긴다. 임의 매핑은 하지 않는다.

## 요약
자동 일치 ${rep.auto.length} / 모호 ${rep.ambiguous.length} / 불일치 ${rep.none.length} (합계 ${subjects.length}, 묶음 과목 ${rep.composite.length}개는 구성 과목 기준으로 분류)

## 자동 일치 (${rep.auto.length})
${rep.auto.length} 과목은 목록을 생략한다(\`subject-master.json\`의 \`infoMatch: "auto"\`).
묶음 과목 중 자동: ${rep.auto.filter((x) => x.s.isComposite).map((x) => x.s.name).join(", ") || "없음"}

## 모호 (${rep.ambiguous.length}) — 후보만 제시, 판단은 사람이
${li(rep.ambiguous)}

## 불일치 (${rep.none.length}) — 안내자료에 같은 과목 없음
${li(rep.none)}

## 안내자료에는 있으나 편제표 과목과 이어지지 않은 항목 (${unusedInfo.length})
편제표에 없는 과목(4개교 밖)이 대부분이다. 목록: ${unusedInfo.map((x) => x.name).join(", ")}

## 문서 충돌 목록 (수정하지 않음, 편제표 세션 소관)
\`data-src/curriculum-analysis/docs/db-schema.md\`에서 CLAUDE.md와 맞지 않는 곳:
${(() => { const p = "data-src/curriculum-analysis/docs/db-schema.md"; if (!existsSync(p)) return "- 파일이 이 브랜치에 없음"; const L = readFileSync(p, "utf8").split("\n"); const hit = L.map((t, i) => [i + 1, t]).filter(([, t]) => /비공개|익명|비식별|이름.{0,6}(넣지|숨)|출생/.test(t)); return hit.map(([n, t]) => `- ${p}:${n} ${t.trim().slice(0, 100)}`).join("\n") || "- 해당 문장 없음"; })()}
`;

const files = [
  [LOCK, JSON.stringify(lockOut, null, 1) + "\n"],
  [D + "subject-master.json", JSON.stringify(masterOut, null, 1) + "\n"],
  [D + "offerings-index.json", JSON.stringify(idxOut, null, 1) + "\n"],
  ["temp/quality/subject-mapping.md", md],
];
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
if (CHECK) {
  const bad = files.filter(([p, t]) => !existsSync(p) || readFileSync(p, "utf8") !== t).map(([p]) => p);
  if (bad.length) { console.error("out of date:", bad.join(", ")); process.exit(1); }
} else for (const [p, t] of files) writeFileSync(p, t);
console.log(`자동 일치 ${rep.auto.length} / 모호 ${rep.ambiguous.length} / 불일치 ${rep.none.length}`);
