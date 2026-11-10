// 문구 속 화면 이름 점검: portal/*.js 문자열의 '○○ 화면' 패턴을 모아, ○○이 현재 메뉴 이름(menu-tree.js의 title·page·그룹)이나 화면 탭 이름이 아니면 실패한다.
// (옛 이름 '대입 제도 화면'·'자료·소식'이 문구에 남는 것을 막는다.) 일반 표현(이 화면·그 화면 …)은 허용. 새 이름을 쓰려면 먼저 메뉴/탭에 있어야 한다.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const { GROUPS, HOME } = await import(`${root}/portal/menu-tree.js`);
const names = new Set(), add = (x) => { if (x) names.add(String(x).trim()); };
for (const g of GROUPS) { add(g.title); for (const it of g.items || []) { add(it.title); add(it.page); } }
add(HOME?.title); add("홈");
// 화면 안의 탭·구역 이름(메뉴 항목 안의 탭: 고교 일정의 '대학 입시'·'학년별 큰 그림', 학교 보기의 '지도' 등)
["대학 입시", "학년별 큰 그림", "학년별 할 일", "지도", "비교", "고교 보기", "중학교 보기", "고교 종류", "수시·정시", "대학별 과목", "학교 비교", "학교 요약", "상세", "자료실", "출처·확인일", "원본 파일", "바뀐 소식", "관련 사이트", "화면 설정", "검색", "일정", "오늘", "메뉴", "내 계획표", "고교학점제", "수능과 내신"].forEach(add);
const GENERIC = /^(다크 모드|어두운|모드 어두운|메인|휴대폰|비슷한|맞는 비슷한|이|그|저|해당|각|다른|같은|아래|위|전체|상세|빈|학교별|표시|인쇄|지도|비교|검색 결과|처음|첫|현재|이전|다음|기본|목록|모바일|전체 화면|큰|작은|넓은|좁은|한|두|세|어느|이런|저런|화면)$/;
const bad = []; let n = 0;
for (const f of readdirSync(`${root}/portal`).filter((x) => x.endsWith(".js") && !/^(menu-tree|menu|sw)\.js$/.test(x))) {
  const lines = readFileSync(`${root}/portal/${f}`, "utf8").split("\n");
  lines.forEach((l0, i) => { const l = l0.replace(/\/\*.*?\*\//g, " ").replace(/(^|\s)\/\/.*$/, "$1"); /* 주석은 화면에 보이지 않는다 */ for (const m of l.matchAll(/(?:^|[\s'"`(,>])([가-힣·]+(?: [가-힣·]+)?) 화면/g)) {
    let nm = m[1].trim(); n++;
    const words = nm.split(" "); const cands = [nm, words[words.length - 1], words.length > 1 ? words.slice(-2).join(" ") : null].filter(Boolean);
    if (cands.some((c) => names.has(c) || GENERIC.test(c))) continue;
    if (/^(?:.*(?:에서|으로|에는|에도|에|의|은|는|을|를|이|가|도|만|과|와|고|며|면|니|서)$)/.test(words[words.length - 1])) continue; // 앞 낱말에 붙은 조사로 끝나는 덩어리는 이름이 아니다
    bad.push(`${f}:${i + 1} '${nm} 화면' — 현재 메뉴·탭 이름이 아니에요`);
  } });
}

// 탭 이름 전수: 문구 속 "'○○' 탭"의 ○○은 화면이 실제로 그리는 탭 이름(policy.js의 일정 탭 배열 등)이어야 한다
{
  const tabs = new Set(["중학교", "고등학교", "고교 입학", "대학 입시", "학년별 큰 그림", "학교 비교", "지도", "비교"]);
  for (const f of readdirSync(`${root}/portal`).filter((x) => x.endsWith(".js"))) { const src = readFileSync(`${root}/portal/${f}`, "utf8"); for (const m of src.matchAll(/\["[a-z]+", "#[^"]+", "([^"]+)"\]/g)) tabs.add(m[1]); }
  for (const f of readdirSync(`${root}/portal`).filter((x) => x.endsWith(".js") && !/^(menu-tree|menu|sw)\.js$/.test(x))) { readFileSync(`${root}/portal/${f}`, "utf8").split("\n").forEach((l0, i) => { const l = l0.replace(/\/\*.*?\*\//g, " ").replace(/(^|\s)\/\/.*$/, "$1"); for (const m of l.matchAll(/'([^']{2,14})' 탭/g)) { n++; if (!m[1].split(/\s*\|\s*/).every((x) => tabs.has(x) || names.has(x))) bad.push(`${f}:${i + 1} '${m[1]}' 탭 — 화면에 그런 탭 이름이 없어요`); } }); }
}

// 옛 메뉴 이름 전수: 메뉴 개편 뒤 바뀐 이름(대입 제도·고교학점제 이해·변경 로그·학년별 로드맵·학년별 할 일)이 화면에 보이는 문구(주석 제외)에 남지 않았는지
{
  const STALE = ["대입 제도", "고교학점제 이해", "변경 로그", "학년별 로드맵", "학년별 할 일", "대학 요건 보기", "대학 요건 맞춰보기"];
  const OK_LINE = /image-credits|\.screen\b|FILE\s*=|screen\)|\bscreen:/; // 데이터 분류 값·내부 식별용은 제외
  for (const f of readdirSync(`${root}/portal`).filter((x) => x.endsWith(".js") && !/^(menu-tree|menu|sw)\.js$/.test(x))) { readFileSync(`${root}/portal/${f}`, "utf8").split("\n").forEach((l0, i) => {
    const l = l0.replace(/\/\*.*?\*\//g, " ").replace(/(^|\s)\/\/.*$/, " "); if (OK_LINE.test(l)) return;
    for (const w of STALE) if (l.includes(w) && /["'`]/.test(l)) bad.push(`${f}:${i + 1} 옛 메뉴 이름 '${w}'이(가) 화면 문구에 남아 있어요`); }); }
}
if (bad.length) { for (const b of bad.slice(0, 60)) console.log("  ✗", b); console.log(`화면 이름 불일치 ${bad.length}건 / 패턴 ${n}곳`); process.exit(1); }
console.log(`OK: 문구 속 '○○ 화면' ${n}곳이 모두 현재 메뉴·탭 이름(${names.size}개)이거나 일반 표현`);
