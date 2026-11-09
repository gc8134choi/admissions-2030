// 학교 이름 약칭 전수 점검: 모든 학교(places.json)를 '접두어('용인')를 뗀 약칭 + 학교급 한 글자'(신봉초·한빛초·죽전고…)와
// 표시 이름 그대로 불렀을 때 ① '이 포털에 없는 학교예요'라고 하지 않고 ② 그 학교가 '학교' 구역에 나오는지 본다.
// 쓰는 법: node tools/check-school-aliases.mjs   (어긋나면 종료 코드 1)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const { makeSearcher, buildSearchData, schoolAliases } = await import(`${root}/portal/search.js`);
const { jointOf } = await import(`${root}/portal/joint-zone.js`);
const { loadSearchExtra } = await import(`${root}/portal/search-extra.js`);
const load = async (n) => JSON.parse(readFileSync(`${root}/portal/data/${n}.json`, "utf8"));
const store = { get: (k, d) => d, set() {} };
const parts = await Promise.all([load("policy"), load("summary"), load("links").catch(() => ({ items: [] })), load("subject-info").catch(() => ({ subjects: [] })), load("places").catch(() => ({ places: [] })), loadSearchExtra(load).catch(() => [])]);
const S = makeSearcher(store); S.setData(buildSearchData(parts, store));
const places = parts[4].places || [], bad = [];
const official = new Map(); for (const f of ["hs-compare", "middle-compare"]) for (const sc of (await load(f)).schools || []) { const m = /^(.*?)(초등학교|중학교|고등학교)$/.exec(sc.name || ""); if (m) official.set(sc.placeId, [sc.name, m[1] + m[2][0]]); }
const SUF = /(초등학교|중학교|고등학교)$/, SH = { 초등학교: "초", 중학교: "중", 고등학교: "고" };
let n = 0;
for (const p of places) {
  const m = SUF.exec(p.name); if (!m) continue;
  const core = p.name.replace(SUF, ""), forms = new Set([p.name, core + SH[m[0]], core.replace(/^용인/, "") + SH[m[0]], ...(official.get(p.id) || [])]); // 공식 정식 이름(용인홍천고등학교)과 그 약칭(용인홍천고)도
  for (const f of [...forms].filter((x) => x.length >= 3)) for (const topic of ["학교군", "방과후학교", "모집 인원"]) {
    const q = `${f} ${topic}`, res = S.search(q), flat = res.flatMap(([, l]) => l); n++;
    if (flat.some((x) => /포털의 학교 목록에서 찾지 못했어요/.test(x.t || ""))) bad.push(`'${q}' → '목록에서 찾지 못했어요' 선언 (${p.name}은 목록에 있음)`);
    else if (!flat.some((x) => (x.t || "").startsWith(p.name))) bad.push(`'${q}' → ${p.name} 행이 안 나와요`);
  }
}
// 별칭 함수 자체: 학교마다 약칭(접두어 뗀 형태)이 포함되는지
for (const p of places) { const m = SUF.exec(p.name); if (!m) continue; const core = p.name.replace(SUF, ""); if (core.startsWith("용인") && core.length >= 4 && !schoolAliases(p.name).includes((core.slice(2) + SH[m[0]]).toLowerCase())) bad.push(`${p.name}: 약칭 ${core.slice(2) + SH[m[0]]}이 별칭에 없어요`); }
// 별칭 충돌 전수: 한 이름·별칭이 둘 이상의 학교에 정확히 일치하면 안 되고, 학교마다 자기 짧은 이름(접두어 뗀 이름+학교급)이 자기에게만 정확히 일치해야 한다. 접두 충돌(용인고 ↔ 용인고림고)은 정확 일치가 우선하는지 본다
{
  const nm = (x) => String(x).replace(/\s+/g, "").toLowerCase(), byForm = new Map();
  for (const p of places) for (const f of schoolAliases(p.name)) { const k = nm(f); (byForm.get(k) || byForm.set(k, new Set()).get(k)).add(p.name); }
  for (const [k, set] of byForm) if (set.size > 1) bad.push(`별칭 '${k}'가 학교 ${set.size}곳에 정확히 일치: ${[...set].join(" / ")}`);
  let pre = 0;
  for (const p of places) { const m = SUF.exec(p.name); if (!m) continue; for (const own2 of [nm(p.name.replace(SUF, "") + SH[m[0]])]) { if (own2.length >= 3 && !(byForm.get(own2) || new Set()).has(p.name)) bad.push(`${p.name}: 약칭 '${own2}'이 자기에게 일치하지 않아요`); for (const [k] of byForm) if (k !== own2 && k.startsWith(own2) && !(byForm.get(k) || new Set()).has(p.name)) pre++; }
    const own = nm(p.name.replace(SUF, "").replace(/^용인/, "") + SH[m[0]]); if (own.length < 3) continue; if (!(byForm.get(own) || new Set()).has(p.name)) bad.push(`${p.name}: 자기 약칭 '${own}'이 자기에게 일치하지 않아요`); for (const [k] of byForm) if (k !== own && k.startsWith(own) && !(byForm.get(k) || new Set()).has(p.name)) pre++; }
  console.log(`  · 약칭이 다른 학교 별칭의 접두인 경우 ${pre}건(정확 일치가 우선하므로 확정은 정확 일치 쪽, 접두만 맞으면 후보로 안내)`);
}
// 띄어 쓴 학교급(성복 고등학교·수지 초등학교)도 그 학교로 인식
let nsp = 0;
for (const p of places) { const m = SUF.exec(p.name); if (!m) continue; const core = p.name.replace(SUF, "").replace(/^용인/, ""); if (core.length < 2) continue; const q = `${core} ${m[0]} 학교군`, flat = S.search(q).flatMap(([, l]) => l); nsp++; if (!flat.some((x) => (x.t || "").startsWith(p.name))) bad.push(`'${q}' → ${p.name} 행이 안 나와요(띄어 쓴 학교급)`); }
// 초등학교 학교군 문구 25곳 × 데이터 대조: middle.json의 학교군 전체 값(두 학군이면 '공동학군' 포함)이 안내에 그대로 있어야 한다
const mid = await load("middle"); let nz = 0;
for (const a of mid.areas || []) {
  const sc = places.find((x) => x.id === a.from.placeId); if (!sc) continue;
  const j = jointOf(a), names = j.type === "all" ? j.groups : [j.home].filter(Boolean);
  const flat = S.search(`${sc.name} 학교군`).flatMap(([, l]) => l), note = flat.find((x) => (x.t || "") === `${sc.name} · 학교군`); nz++;
  if (!note) { bad.push(`${sc.name} 학교군: 안내 행이 없어요`); continue; }
  if (j.type === "unknown") bad.push(`${sc.name} 학교군: 공동학군 범위 미분류`);
  for (const nm of names) if (!note.s.includes(nm)) bad.push(`${sc.name} 학교군: '${nm}'이 안내에 없어요 → ${note.s.slice(0, 80)}`);
  // 학구 일부만 공동(고기초)이면 범위·상대 학군이 안내에 있고 '두 학군 공동'으로 읽히면 안 되며, 학교 전체가 공동이면 두 학군 이름과 '공동학군'
  if (j.type === "part") { if (!note.s.includes("학구 일부") || !note.s.includes(j.scope) || !note.s.includes(j.other) || /수지1중학군 공동학군|수지1중학군·판교중학군/.test(note.s)) bad.push(`${sc.name} 학교군: 학구 일부 공동학군(범위 '${j.scope}'·상대 '${j.other}')이 안내에 없거나 전체 공동으로 읽혀요 → ${note.s.slice(0, 160)}`); }
  else if ((j.type === "all") !== /공동학군/.test(note.s.replace(/^[^—]*—/, ""))) bad.push(`${sc.name} 학교군: 공동학군 표시가 데이터(${j.type})와 달라요 → ${note.s.slice(0, 120)}`);
}
// 학교급 한 글자 띄어쓰기(서원 중·홍천 고)·'고교/중교' 변형: 같은 이름의 다른 학교급 값을 1위로 내면 안 된다. 학교급 없는 모호한 이름(서원·홍천)은 후보 안내
const SHORT = { 초등학교: ["초", "초교"], 중학교: ["중", "중교"], 고등학교: ["고", "고교"] }; let nv = 0;
for (const p of places) { const m = SUF.exec(p.name); if (!m) continue; const core = p.name.replace(SUF, "").replace(/^용인/, ""); if (core.length < 2 || core.length > 6) continue;
  for (const f of [`${core} ${SHORT[m[0]][0]}`, `${core}${SHORT[m[0]][1]}`, `${core} ${m[0]}`]) { const q = `${f} 학급수`, flat = S.search(q).flatMap(([, l]) => l); nv++; const top = flat.find((x) => places.some((pp) => (x.t || "").startsWith(pp.name))); /* 학교 이름으로 시작하는 첫 행 */ if (!top || !(top.t || "").startsWith(p.name)) bad.push(`'${q}' → 1위가 ${p.name}이(가) 아니에요: ${(top?.t || "-").slice(0, 30)}`); } }
const byCore = new Map(); for (const p of places) { const m = SUF.exec(p.name); if (!m) continue; const c = p.name.replace(SUF, "").replace(/^용인/, ""); if (c.length >= 2) (byCore.get(c) || byCore.set(c, []).get(c)).push(p.name); }
let namb = 0; for (const [c, names] of byCore) if (names.length >= 2) { namb++; const flat = S.search(`${c} 학급수`).flatMap(([, l]) => l), note = flat.find((x) => (x.t || "") === `${c} 후보`); if (!note) bad.push(`'${c} 학급수': 같은 이름 학교가 ${names.length}곳인데 후보 안내가 없어요`); else for (const nm of names) if (!note.s.includes(nm)) bad.push(`'${c}' 후보에 ${nm}이(가) 빠졌어요`); }
console.log(`  · 학교급 변형 ${nv}질의, 모호한 이름 ${namb}개 후보 안내`);
console.log(`  · 띄어 쓴 학교급 ${nsp}질의, 초등 학교군 문구 ${nz}곳 데이터 대조`);
// 날짜 질의 45일 × 8형태: 정책 행 본문에 있는 날짜(연도 있는 것)를 점(1.31·2028.1.31)·한글(1월 31일)·슬래시(1/31)·하이픈(2028-01-31)·요일 포함(1월 31일 월요일)·띄어쓴 점(2026. 12. 4.)으로 물으면 상위 3위 안에 그 날짜가 든 행이 나와야 하고 '찾지 못했어요'를 내면 안 된다. 기간(9.24~12.20)은 별도로 본문 그대로 전수
{
  const WD = "일월화수목금토", seen = new Map();
  for (const r of parts[0]) for (const m of String(r.body || "").matchAll(/(?<![\d.])(20\d{2})\.(\d{1,2})\.(\d{1,2})(?![\d.])/g)) { const k = `${m[1]}.${+m[2]}.${+m[3]}`; if (!seen.has(k)) seen.set(k, [+m[1], +m[2], +m[3]]); }
  const days = [...seen.values()].slice(0, 45), P2 = (n) => String(n).padStart(2, "0"); let nd = 0; const fails = new Map();
  for (const [y, mo, d] of days) {
    const wd = WD[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()], forms = { 점: `${mo}.${d}`, 연점: `${y}.${mo}.${d}`, 한글: `${mo}월 ${d}일`, 슬래시: `${mo}/${d}`, 하이픈: `${y}-${P2(mo)}-${P2(d)}`, 요일: `${mo}월 ${d}일 ${wd}요일`, 띄어쓴점: `${y}. ${mo}. ${d}.`, 연한글: `${y}년 ${mo}월 ${d}일` };
    for (const [nm, q] of Object.entries(forms)) { nd++;
      const res = S.search(q), flat = res.flatMap(([, l]) => l).slice(0, 3), has = flat.some((x) => { const row = parts[0].find((p) => p.title === x.t); return row && new RegExp(`(?<![\\d.])(?:${y}\\.0?)?0?${mo}\\.0?${d}(?![\\d])`).test(row.title + " " + row.body); });
      if (!has) { fails.set(nm, (fails.get(nm) || 0) + 1); if (process.env.DBG) console.log('   미적중', q, flat.map((x) => x.t.slice(0, 20)).join(' / ')); }
      if (res.flatMap(([, l]) => l).some((x) => /목록에서 찾지 못했어요/.test(x.s || ""))) bad.push(`날짜 질의 '${q}' → 본문에 있는데 '찾지 못했어요'`); } }
  for (const [nm, n] of fails) bad.push(`날짜 표기 '${nm}': ${days.length}일 중 ${n}일은 상위 3위 안에 그 날짜가 든 행이 없어요`);
  const seen2 = new Set(); let np = 0;
  for (const r of parts[0]) for (const m of String(r.body || "").matchAll(/(?<![\d.])(\d{1,2}\.\d{1,2}~\d{1,2}\.\d{1,2})(?![\d.])/g)) { const d = m[1]; if (seen2.has(d)) continue; seen2.add(d); np++;
    const flat = S.search(d).flatMap(([, l]) => l); if (!flat.some((x) => { const row = parts[0].find((p) => p.title === x.t); return row && String(row.title + " " + row.body).includes(d); })) bad.push(`기간 질의 '${d}' → 그 기간이 든 행이 안 나와요 (${r.id})`); }
  console.log(`  · 날짜 ${days.length}일 × 8형태 ${nd}질의, 기간 ${np}건`);
}
// 숫자 질의 × 이름 형태: 학교 표시 이름(places)·공식 정식 이름·용인 접두어 유무·약칭 어느 쪽으로 불러도 같은 값 행(학생수·학급수·교원수)이 나와야 한다
{
  let nn = 0;
  for (const f of ["hs-compare", "middle-compare"]) for (const cmp of [await load(f)]) for (const sc of cmp.schools || []) {
    const pl = places.find((x) => x.id === sc.placeId); if (!pl) continue; const m = SUF.exec(pl.name); if (!m) continue; const core = pl.name.replace(SUF, "");
    const hasVal = (lbl) => Object.entries(sc.values || {}).some(([k, v]) => v && v.value != null);
    if (!hasVal()) continue;
    for (const form of new Set(pl.name.startsWith("용인") ? [pl.name, sc.name] : [pl.name, sc.name, `용인${core}${SH[m[0]]}`, `${core}${SH[m[0]]}`, `용인${core}${m[0]}`])) for (const lbl of ["학생수", "학급수", "교원수"].filter((l) => (cmp.fields || []).some((fd) => fd.label.startsWith(l) && sc.values?.[fd.id]?.value != null))) {
      const flat = S.search(`${form} ${lbl}`).flatMap(([, l]) => l); nn++;
      if (!flat.some((x) => (x.t || "").startsWith(pl.name) && (x.t || "").includes(lbl))) bad.push(`'${form} ${lbl}' → ${pl.name} · ${lbl} 값 행이 안 나와요`); } }
  console.log(`  · 이름 형태 × 숫자 질의 ${nn}건`);
}
// 배너 진실성: 용어 이름 + 풀이/뜻풀이/정의, 한글 날짜 표기, 공동학군 데이터 낱말 질의는 '찾지 못했어요'·'맞는 내용이 없을 수 있어요' 배너를 1위로 내지 않고 값이 있는 행을 낸다
{
  const gl = await load("glossary").catch(() => ({ terms: [] })), BANNER = /목록에서 찾지 못했어요|정확히 맞는 내용이 없을 수 있어요/; let nb = 0;
  const first = (q) => S.search(q)[0] || ["", []];
  for (const t of (gl.terms || []).slice(0, 80)) { if (String(t.term).length < 2) continue; for (const suf of ["풀이", "뜻풀이", "정의"]) { const q = `${t.term} ${suf}`, [h, l] = first(q); nb++; if (BANNER.test(`${l[0]?.t} ${l[0]?.s}`) && h === "안내") bad.push(`'${q}' → 배너가 1위 (용어 행이 있음)`); } }
  const ko = [["2028년 1월 10일 17일", /1\.10~17/], ["2028년 1월 31일 2월 7일", /1\.31~2\.7/], ["2032년 11월 18일 목요일 시험", /2032\.11\.18/], ["공동학군", /공동학군/], ["공동학군 뜻", /공동학군/], ["운중동", /운중동/], ["대장통 석운통", /대장통/], ["판교중학군", /판교중학군/]];
  for (const [q, must] of ko) { const flat = S.search(q).flatMap(([, l]) => l); nb++; if (!flat.some((x) => must.test(`${x.t} ${x.s} ${x.x || ""}`))) bad.push(`'${q}' → 값이 있는 행이 안 나와요`); if (S.search(q)[0]?.[0] === "안내") bad.push(`'${q}' → 배너가 1위`); }
  console.log(`  · 배너 진실성 ${nb}질의`);
}
if (bad.length) { for (const b of bad.slice(0, 40)) console.log("  ✗", b); console.log(`실패 ${bad.length}건 / ${n}질의`); process.exit(1); }
console.log(`OK: 학교 ${places.length}곳 × 이름 형태·주제 ${n}질의에서 '찾지 못했어요' 오선언 없음`);
