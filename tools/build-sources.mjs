// portal/data/*.json의 출처 항목 → portal/data/sources.json (출처 등록부, 생성물).
//   id(src-xxxxxxxx, URL 기준 안정)·url·kind(official|media|user|self|other)·org·checked(확인일)·names·usedIn.
//   데이터 행의 `sources` 옆 `sourceIds`(병행 필드)가 이 id를 가리킨다. 화면은 아직 기존 필드를 쓴다.
// 사용: node tools/build-sources.mjs [--check]
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { sourceId, collectSources } from "./lib/source-ids.mjs";

const SELF = /^(sources|data-dictionary|changes)\.json$/;
const ORG = [
  [/(^|\.)goe\.go\.kr$|satp\.goe/, "경기도교육청"], [/goeyi\.kr$/, "경기도용인교육지원청"], [/schoolinfo\.go\.kr$/, "학교알리미(교육부·한국교육개발원)"],
  [/open\.neis\.go\.kr$/, "교육행정정보시스템(NEIS)"], [/kcue\.or\.kr$/, "한국대학교육협의회"], [/suneung\.re\.kr$/, "한국교육과정평가원"], [/hscredit\.kr$/, "교육부 고교학점제 종합지원포털"],
  [/moe\.go\.kr$/, "교육부"], [/korea\.kr$/, "대한민국 정책브리핑"], [/sen\.go\.kr$/, "서울특별시교육청"], [/bokjiro\.go\.kr$/, "복지로"], [/giheunggu\.go\.kr$/, "용인시 기흥구"],
  [/snu\.ac\.kr$/, "서울대학교"], [/yonsei\.ac\.kr$/, "연세대학교"], [/korea\.ac\.kr$/, "고려대학교"], [/postech\.ac\.kr$/, "포스텍"], [/kaist\.ac\.kr$/, "KAIST"],
  [/openstreetmap\.org$/, "OpenStreetMap"], [/namu\.wiki$/, "나무위키"],
];
const OFFICIAL = /\.go\.kr$|\.re\.kr$|\.ac\.kr$|kcue\.or\.kr$|goeyi\.kr$|hscredit\.kr$/;
const MEDIA = /news|daum|nate|economy|sedaily|dailian|asiae|newspim|joongang|imbc|localnaeil|incheontoday|namu|megastudy|veritas|kyobit|edpl|dhnews|prompie|nicebizinfo|riroschool|naeil/;
function classify(s, host) {
  if (s.kind === "official" || s.kind === "media" || s.kind === "user" || s.kind === "self") return s.kind;
  if (!host) return /사용자|AI|편제표|이 포털|조사 자료|학교 주소|학교공지|설명회/.test(s.name) ? "user" : "other"; // 주소 없는 출처: 사용자 제공·자체 정리
  if (/openstreetmap/.test(host)) return "other";
  if (OFFICIAL.test(host)) return "official";
  if (MEDIA.test(host)) return "media";
  return "other";
}

const reg = new Map();
let withIds = 0, refs = 0;
for (const f of readdirSync("portal/data").filter((x) => x.endsWith(".json") && !SELF.test(x)).sort()) {
  let d; try { d = JSON.parse(readFileSync(`portal/data/${f}`, "utf8")); } catch { continue; }
  const dsChecked = (d && !Array.isArray(d) && d._meta?.checkedAt) || null;
  for (const s of collectSources(d)) {
    const id = sourceId(s); refs++;
    let host = null; try { host = s.url ? new URL(s.url).hostname : null; } catch {}
    const e = reg.get(id) ?? { id, url: s.url ?? null, kind: classify(s, host), org: (host && ORG.find(([re]) => re.test(host))?.[1]) ?? host ?? null, checked: null, names: [], usedIn: {} };
    if (!e.names.includes(s.name)) e.names.push(s.name);
    const c = s.retrieved ?? dsChecked; if (c && (!e.checked || c > e.checked)) e.checked = c;
    if (s.kind && e.kind === "other") e.kind = classify(s, host);
    e.usedIn[f] = (e.usedIn[f] ?? 0) + 1;
    reg.set(id, e);
  }
}
const sources = [...reg.values()].sort((a, b) => a.id.localeCompare(b.id));

// 점검: ① id 충돌(같은 id에 다른 URL) ② 데이터의 sourceIds·sourceId가 모두 등록부에 있음 ③ 형식
const errs = [];
const idRe = /^src-[0-9a-f]{8}$/;
for (const s of sources) {
  if (!idRe.test(s.id)) errs.push(`${s.id}: id 형식`);
  if (s.url && !/^https?:\/\/\S+$/.test(s.url)) errs.push(`${s.id}: url 형식 "${s.url}"`);
  if (s.checked && !/^\d{4}-\d{2}-\d{2}/.test(s.checked)) errs.push(`${s.id}: checked 형식 "${s.checked}"`);
}
const known = new Set(sources.map((s) => s.id));
for (const f of readdirSync("portal/data").filter((x) => x.endsWith(".json") && !SELF.test(x)).sort()) {
  const txt = readFileSync(`portal/data/${f}`, "utf8");
  for (const m of txt.matchAll(/"src-[0-9a-f]{8}"/g)) if (!known.has(m[0].slice(1, -1))) errs.push(`${f}: 등록부에 없는 출처 id ${m[0]}`);
  if (/"sourceIds?"/.test(txt)) withIds++;
}
if (errs.length) { console.error(errs.slice(0, 30).join("\n")); process.exit(1); }

const out = { _meta: { note: "출처 등록부(생성물, 손으로 고치지 않는다). tools/build-sources.mjs가 portal/data의 출처 항목에서 만든다. 데이터 행의 sourceIds가 이 id를 가리킨다.", count: sources.length, kinds: Object.fromEntries(["official", "media", "user", "self", "other"].map((k) => [k, sources.filter((s) => s.kind === k).length])) }, sources };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/sources.json";
if (process.argv.includes("--check")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== json) { console.error("sources.json이 데이터와 다르다 — 생성기(build-*.mjs)를 다시 돌린 뒤 node tools/build-sources.mjs"); process.exit(1); }
  console.log(`OK: sources ${sources.length}건(출처 항목 ${refs}건 참조, sourceIds 있는 파일 ${withIds}개)`);
} else { writeFileSync(target, json); console.log(`sources ${sources.length}건 (참조 ${refs}건), ${JSON.stringify(out._meta.kinds)}`); }
