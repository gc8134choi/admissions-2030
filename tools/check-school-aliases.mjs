// 학교 이름 약칭 전수 점검: 모든 학교(places.json)를 '접두어('용인')를 뗀 약칭 + 학교급 한 글자'(신봉초·한빛초·죽전고…)와
// 표시 이름 그대로 불렀을 때 ① '이 포털에 없는 학교예요'라고 하지 않고 ② 그 학교가 '학교' 구역에 나오는지 본다.
// 쓰는 법: node tools/check-school-aliases.mjs   (어긋나면 종료 코드 1)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const { makeSearcher, buildSearchData, schoolAliases } = await import(`${root}/portal/search.js`);
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
    if (flat.some((x) => /이 포털에 없는 학교예요/.test(x.t || ""))) bad.push(`'${q}' → '없는 학교' 선언 (${p.name}은 있음)`);
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
if (bad.length) { for (const b of bad.slice(0, 40)) console.log("  ✗", b); console.log(`실패 ${bad.length}건 / ${n}질의`); process.exit(1); }
console.log(`OK: 학교 ${places.length}곳 × 이름 형태·주제 ${n}질의에서 '없는 학교' 오선언 없음`);
