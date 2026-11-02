// 검색 골드셋 실행기(브라우저 없이 portal/search.js의 점수 함수를 그대로 돌린다).
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(new URL("../..", import.meta.url).pathname);
const { makeSearcher, buildSearchData } = await import(`${root}/portal/search.js`);
const { loadSearchExtra } = await import(`${root}/portal/search-extra.js`);
const load = async (n) => JSON.parse(readFileSync(`${root}/portal/data/${n}.json`, "utf8"));
const store = { get: (k, d) => d, set() {} };
const parts = await Promise.all([load("policy"), load("summary"), load("links").catch(() => ({ items: [] })), load("subject-info").catch(() => ({ subjects: [] })), load("places").catch(() => ({ places: [] })), loadSearchExtra(load).catch(() => [])]);
const S = makeSearcher(store); S.setData(buildSearchData(parts, store));
const gold = JSON.parse(readFileSync(`${root}/tools/pm/searchgold.json`, "utf8")).queries;
const NOTICE = /없어요|없을 수 있어요|다뤄요|찾기 어려운|아직 없|찾는 정보가 없|못했어요|확인하지 못/;
const res = [];
for (const g of gold) {
  const groups = S.search(g.q); const flat = groups.flatMap(([h, l]) => l.map((x) => ({ ...x, _g: h })));
  let ok = false, strict = false, top = flat.slice(0, 3).map((x) => x.t).join(" | ");
  if (g.kind === "has") {
    const rows = flat.filter((x) => x._g !== "공식 확인처" && !(x._g === "안내" && /정확히 맞는 내용이 없을 수 있어요/.test(x.t)));
    const t3 = rows.slice(0, 3); const hit = (x) => g.expect.some((e) => (x.t + " " + x.s + " " + x.href).includes(e));
    ok = t3.some(hit); const banner = flat[0] && flat[0]._g === "안내" && /정확히 맞는 내용이 없을 수 있어요/.test(flat[0].t); strict = ok && !banner;
  } else {
    const f = flat[0]; ok = !!f && (f._g === "안내" || f._g === "바로 안내") && NOTICE.test(f.t + " " + f.s); strict = ok;
    if (!ok && !flat.length) { ok = true; strict = true; } // 빈 응답은 화면에서 '찾는 정보가 없어요'+확인처가 나온다
  }
  res.push({ q: g.q, kind: g.kind, ok, strict, top, holdout: !!g.holdout });
}
console.log(JSON.stringify(res));
