// 값 토큰 정규화: 요약 속 날짜·큰 수를 같은 형태('2030.8', '2030.8.15', '8.15', '12345')로 바꿔 도착 화면 본문과 견준다.
// '2030년 8월'='2030.8', '8월 15일'='8.15', '425,000'='425000'. search.js(안내 자동 부착)와 tools/build-dest-values.mjs·check-search-rows가 같이 쓴다.
const comma = (t) => String(t || "").replace(/(\d),(?=\d{3})/g, "$1");
const YMD = /(\d{4})\s*(?:\.|년\s*)(\d{1,2})\s*(?:\.|월\s*)(\d{1,2})\s*일?(?![\d])/g, YM = /(\d{4})\s*(?:\.|년\s*)(\d{1,2})(?:\s*월)?(?![\d.]|\s*[.월]\s*\d|\s*%)/g, MD = /(?<![\d.])(\d{1,2})\s*(?:\.|월\s*)(\d{1,2})\s*일?(?![\d.]|\s*%)/g, BIG = /(?<![\d.])(\d{5,})(?![\d])/g;
export const valTokens = (text) => {
  const t = comma(text), out = new Set();
  for (const m of t.matchAll(YMD)) { out.add(`${m[1]}.${+m[2]}.${+m[3]}`); out.add(`${+m[2]}.${+m[3]}`); }
  for (const m of t.matchAll(YM)) out.add(`${m[1]}.${+m[2]}`);
  for (const m of t.matchAll(MD)) if (+m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31) out.add(`${+m[1]}.${+m[2]}`); /* 65.8% 같은 퍼센트는 월.일이 아니다 */
  for (const m of t.matchAll(BIG)) out.add(m[1]);
  return out;
};
const FIRST = /\d{4}\s*(?:\.|년\s*)\d{1,2}\s*(?:\.|월\s*)\d{1,2}\s*일?(?![\d])|\d{4}\s*(?:\.|년\s*)\d{1,2}(?:\s*월)?(?![\d.]|\s*[.월]\s*\d)|(?<![\d.])\d{1,2}\s*(?:\.|월\s*)\d{1,2}\s*일?(?![\d.])|(?<![\d.])\d{5,}(?![\d])/;
/** 요약의 첫 값 토큰(정규화된 형태). 괄호 속 출처 날짜·요일은 값이 아니다. 없으면 "". */
export const firstVal = (summary) => { const s = comma(summary).replace(/\(\s*[월화수목금토일]\s*\)/g, "").replace(/\([^)]*\)/g, " "), m = FIRST.exec(s); return m ? [...valTokens(m[0])][0] || "" : ""; };
/** 값 토큰이 없는 요약용: 행 본문 앞 90자의 낱말(한글 3자 이상)·날짜가 도착 화면 본문에 40% 미만이면 true(= 이 화면에서는 그 내용을 못 찾으니 '결과에만' 안내가 필요). */
const ym = (x) => String(x || "").replace(/(\d{4})\s*년\s*(\d{1,2})\s*월/g, "$1.$2");
export const phraseMissing = (rowBody, pageText) => { const wd = ym(String(rowBody || "").slice(0, 90)).replace(/\([^)]*\)/g, " ").match(/[가-힣]{3,}|\d+(?:\.\d+)+/g) || [], t = ym(String(pageText || "").replace(/ⓘ/g, "")); if (wd.length < 3) return false; const hit = wd.filter((w) => t.includes(w)).length; return hit < Math.ceil(wd.length * 0.4); };
/** 요약의 모든 값 토큰(괄호 속 포함, 요일 괄호만 제외). 안내 부착 판정: 이 중 하나라도 도착 화면 토큰에 있으면 안내 없음. */
export const allVals = (summary) => valTokens(String(summary || "").replace(/\(\s*[월화수목금토일]\s*\)/g, ""));
