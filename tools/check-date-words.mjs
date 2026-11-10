// 참고 일정 행(2028학년도 수시·정시 sch-04·sch-10)의 기간 날짜 전수 점검: 본문 기간(전형기간 가·나·다군, 등록 …) 안의 날짜(시작·중간·끝) × 그 행에서 쓸 수 있는 낱말(정시·수시·등록·가군·나군·다군 중 제목이나 그 기간 줄에 든 것) × 8가지 표기
// (1.20 / 1월 20일 / 1/20 / 01-20 / 2028.1.20 / 2028년 1월 20일 / 1월 20일(목) / 1. 20)로 물었을 때 그 행이 '일정·제도' 위쪽 5건 안에 나오는지 본다. 쓰는 법: node tools/check-date-words.mjs
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const { makeSearcher, buildSearchData } = await import(`${root}/portal/search.js`);
const { loadSearchExtra } = await import(`${root}/portal/search-extra.js`);
const load = async (n) => JSON.parse(readFileSync(`${root}/portal/data/${n}.json`, "utf8"));
const store = { get: (k, d) => d, set() {} };
const parts = await Promise.all([load("policy"), load("summary"), load("links").catch(() => ({ items: [] })), load("subject-info").catch(() => ({ subjects: [] })), load("places").catch(() => ({ places: [] })), loadSearchExtra(load).catch(() => [])]);
const S = makeSearcher(store); S.setData(buildSearchData(parts, store));
const pol = (await load("policy")), arr = pol.items || pol.policy || pol, rows = (arr.find ? arr : Object.values(arr));
const WORDS = ["정시", "수시", "등록", "가군", "나군", "다군"], WD = "일월화수목금토", bad = []; let n = 0;
for (const id of ["sch-04", "sch-10"]) {
  const row = rows.find((x) => x.id === id); if (!row) { bad.push(`${id}: 정책 행이 없어요`); continue; }
  const year = +/(20\d{2})\./.exec(row.body)[1], body = String(row.body).replace(/\(\s*[월화수목금토일]\s*\)/g, "");
  for (const seg of body.split(/[,;]/)) {
    const m = /(?<![\d.])(?:\d{4}\.)?(\d{1,2})\.(\d{1,2})\s*~\s*(?:(\d{1,2})\.)?(\d{1,2})(?![\d])/.exec(seg); if (!m) continue;
    const [m1, d1] = [+m[1], +m[2]], [m2, d2] = [m[3] ? +m[3] : m1, +m[4]], a = new Date(Date.UTC(year, m1 - 1, d1)), b = new Date(Date.UTC(year, m2 - 1, d2)), days = Math.round((b - a) / 864e5);
    const words = WORDS.filter((w) => row.title.includes(w) || seg.includes(w)); if (!words.length) continue;
    for (const off of new Set([0, Math.floor(days / 2), days])) { const dt = new Date(a.getTime() + off * 864e5), M = dt.getUTCMonth() + 1, D = dt.getUTCDate(), Y = dt.getUTCFullYear(), wd = WD[dt.getUTCDay()];
      const forms = [`${M}.${D}`, `${M}월 ${D}일`, `${M}/${D}`, `${String(M).padStart(2, "0")}-${String(D).padStart(2, "0")}`, `${Y}.${M}.${D}`, `${Y}년 ${M}월 ${D}일`, `${M}월 ${D}일(${wd})`, `${M}. ${D}`];
      for (const w of words) for (const f of forms) { n++; const r = S.search(`${f} ${w}`), g = r.find(([h]) => h === "일정·제도"); if (!(g && g[1].slice(0, 5).some((y) => y.t === row.title))) bad.push(`${id} '${f} ${w}' → '${row.title}'이 일정·제도 위쪽 5건에 없어요`); } }
  }
}

// 서울 구 이름 25곳 × 고입 낱말: 데이터는 서울 전체 단위라, 구 이름 + 고입 낱말을 물으면 제목이 '서울'로 시작하는 서울 행이 맨 위 3건 안에 나와야 한다(경기 행이 먼저 나오지 않게)
const GU = ["종로", "용산", "성동", "광진", "동대문", "중랑", "성북", "강북", "도봉", "노원", "은평", "서대문", "마포", "양천", "강서", "구로", "금천", "영등포", "동작", "관악", "서초", "강남", "송파", "강동"];
for (const g of GU) for (const w of ["외고", "고입 일정", "일반고 배정", "자사고"]) for (const q of [`${g} ${w}`, `서울 ${g}구 ${w}`]) { n++; const r = S.search(q), top = r.filter(([h]) => h !== "안내" && h !== "공식 확인처").flatMap(([, l]) => l).slice(0, 3); if (!top.some((y) => /^서울|서울/.test(y.t))) bad.push(`'${q}' → 위 3건에 서울 행이 없어요(${top.map((y) => y.t).join(" / ").slice(0, 60)})`); }

// 코드 속 문구(SOON_WHY·검색 0건 틀 등)의 학년도·연도·시기 표현 전수: '○○학년도 …요강/시행계획 … ○○○○년' 꼴 문장은 아래 등록부에 있어야 하고, 연결한 정책 행(policy.json)이 그 값을 담아야 한다
{
  const { readdirSync } = await import("node:fs");
  const REG = [{ phrase: "2030학년도 시행계획은 2028년 4월 말, 모집요강은 2029년에 나오고", rows: ["str-14"], need: [/시행계획\(2028년 4월 말 공표\)/, /모집요강\(2029년\)/] }];
  const files = readdirSync(`${root}/portal`).filter((f) => f.endsWith(".js")); const srcAll = files.map((f) => [f, readFileSync(`${root}/portal/${f}`, "utf8")]);
  for (const r of REG) { n++; if (!srcAll.some(([, t]) => t.includes(r.phrase))) bad.push(`등록 문구가 코드에 없어요: ${r.phrase}`); const body = r.rows.map((id) => rows.find((x) => x.id === id)).map((x) => `${x?.title} ${x?.body}`).join(" "); for (const re of r.need) if (!re.test(body)) bad.push(`'${r.phrase}' ← 정책 행 ${r.rows.join(",")}에 ${re} 이(가) 없어요`); }
  const PAT = /(20\d\d)학년도[^."'`\n]{0,24}(?:요강|시행계획)[^."'`\n]{0,16}(20\d\d)년/;
  for (const [f, t] of srcAll) t.split("\n").forEach((l0, i) => { const l = l0.replace(/\/\*.*?\*\//g, " ").replace(/(^|\s)\/\/.*$/, " "); const m = PAT.exec(l); if (m && !REG.some((r) => l.includes(r.phrase))) bad.push(`${f}:${i + 1} 연도가 든 요강·시행계획 문구가 등록부에 없어요 → '${m[0]}' (정책 행 값과 대조해 등록하세요)`); });
}
if (bad.length) { bad.slice(0, 80).forEach((x) => console.log("  ✗", x)); console.log(`실패 ${bad.length}/${n}건`); process.exit(1); }
console.log(`OK: 2028 수시·정시 참고 일정 날짜×낱말×8표기 ${n}개 질의가 모두 맞게 나와요(수시·정시 참고 일정 행과 서울 구 이름 질의)`);
