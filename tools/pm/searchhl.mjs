// 검색 결과 중 ?hl= 이동 주소 모으기(정책 행 제목·GAP 질의로 검색해 나온 것). 출력: JSON 배열(중복 제거)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(new URL("../..", import.meta.url).pathname);
const { makeSearcher, buildSearchData } = await import(`${root}/portal/search.js`);
const { loadSearchExtra } = await import(`${root}/portal/search-extra.js`);
const load = async (n) => JSON.parse(readFileSync(`${root}/portal/data/${n}.json`, "utf8"));
const store = { get: (k, d) => d, set() {} };
const parts = await Promise.all([load("policy"), load("summary"), load("links").catch(() => ({ items: [] })), load("subject-info").catch(() => ({ subjects: [] })), load("places").catch(() => ({ places: [] })), loadSearchExtra(load).catch(() => [])]);
const S = makeSearcher(store); S.setData(buildSearchData(parts, store));
const places = parts[4].places || [], univs = (await load("universities")).universities || [];
const extra = [...places.flatMap((p) => [`${p.name} 교복`, `${p.name} 편제표`, `${p.name} 학급당 학생수`, `${p.name} 설명회`, `${p.name} 급식`]), ...univs.map((u) => `${u.name} 요건`)];
const qs = [...extra, ...parts[0].map((r) => r.title.replace(/^\d{4}-\d{2}(-\d{2})?\s*/, "")), ...JSON.parse(readFileSync(`${root}/tools/pm/searchgold.json`, "utf8")).queries.map((g) => g.q)];
const seen = new Map();
for (const q of qs) for (const [, l] of S.search(q)) for (const x of l.slice(0, 3)) if (/[?&](hl|u)=/.test(x.href) && !seen.has(x.href)) seen.set(x.href, { q, t: x.t });
console.log(JSON.stringify([...seen].map(([href, v]) => ({ href, q: v.q, t: v.t }))));
