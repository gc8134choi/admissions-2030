// 전체 검색: 헤더 돋보기 → 일정·제도, 학교, 과목, 바로가기, 화면을 한 번에 찾는다. 한글 부분 일치.
// 데이터는 처음 열 때 한 번에 병렬로 읽는다. 최근 검색은 이 브라우저(localStorage)에만 저장한다.
import { allItems } from "./nav-tree.js";
import { stageOf } from "./stage.js";
import { loadSearchExtra, univInfo, elemZone } from "./search-extra.js";
import { sayOf, noneText, REGION_WORDS, GG_WORDS, REGION_ALIAS, regionKnown, regionFindPattern, gyeonggiNote } from "./search-claims.js";
import { loadProfile, filterByProfile } from "./profile.js";
const RECENT_KEY = "portal.search.recent";
// 안내 데이터(중학교 배정 가이드·고교 유형·전형)를 제목+본문 단위로 펼쳐 색인한다. 출처·주소·코드 필드는 뺀다.
const SKIP = new Set(["id", "url", "source", "sources", "status", "_meta", "nullReason", "checkedAt"]);
const units = (o, href, from, out = []) => {
  if (Array.isArray(o)) o.forEach((x) => units(x, href, from, out));
  else if (o && typeof o === "object") {
    const t = o.title || o.name || o.item || o.what || o.term || o.label;
    const txt = [];
    const take = (v, d = 0) => { if (typeof v === "string") txt.push(v); else if (d < 3 && v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!SKIP.has(k)) take(x, d + 1); };
    for (const [k, v] of Object.entries(o)) if (!SKIP.has(k) && k !== "items") take(v, 1);
    if (typeof t === "string" && txt.length) out.push({ t, text: txt.join(" "), href, from });
    for (const [k, v] of Object.entries(o)) if (v && typeof v === "object" && !SKIP.has(k)) units(v, href, from, out);
  }
  return out;
};
const NORM_CACHE = new Map(); // 같은 문자열을 질의마다 되풀이해 정규화하지 않는다(검색이 150ms→수 ms)
const DOCN = new WeakMap(), nr = (r) => { let v = DOCN.get(r); if (v === undefined) { v = String(r.title ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, "") + String(" ").trim() + String(r.body ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, ""); DOCN.set(r, v); } return v; }, ng = (g) => { let v = DOCN.get(g); if (v === undefined) { v = String(g.t ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, "") + String(g.text ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, ""); DOCN.set(g, v); } return v; };
const norm = (s) => { const k = String(s ?? ""); let v = NORM_CACHE.get(k); if (v === undefined) { v = k.normalize("NFC").toLowerCase().replace(/\s+/g, ""); if (NORM_CACHE.size > 20000) NORM_CACHE.clear(); NORM_CACHE.set(k, v); } return v; };

// 학교 이름 약칭: 포털 표시 이름·'용인' 접두어를 뗀 이름·학교급 접미를 초/중/고로 줄인 이름(용인신봉초등학교 → 신봉초)을 모두 학교 이름 판정에 쓴다
export const schoolAliases = (name) => {
  const n = norm(name), m = /^(.*?)(초등학교|중학교|고등학교)$/.exec(n); if (!m) return [n];
  const core = m[1], sh = m[2][0], out = new Set([n, core + sh]);
  if (core.startsWith("용인") && core.length >= 4) { out.add(n.slice(2)); out.add(core.slice(2) + sh); }
  else if (!core.startsWith("용인") && core.length >= 2) { out.add("용인" + n); out.add("용인" + core + sh); } // 공식 정식 이름(용인홍천고등학교)으로 불러도
  return [...out];
};const ROUTE = {
  "exam-schedule": "#schedule?t=univ", "hs-schedule": "#schedule?t=hs", "gg-hs-entry": "#schedule?t=hs", "life-schedule": "#schedule?t=life",
  "change-log": "#changelog", "hs-types": "#select/types", "hs-choice-opinion": "#select/types", "high-school-assignment": "#select/types", "academy-material": "#admission/system",
  "curriculum-guide": "#life/credit", "hs-credit-system": "#life/credit",
};
// 날짜가 없는 경기 고입 행은 일정 화면에 없고 고교 종류 화면(접이식 안)에 있다
// 안내 문서 링크의 자동 강조 대상: 화면 전체로 가는 링크(지도·요약·대학 선택·계획표·출처·로드맵·용어)는 빼고, 그 밖의 문서는 제목(마지막 마디)으로 찾는다
const autoHl = (g) => { if (g.term || g.gap || !/^#/.test(g.href) || /v=map|v=summary|v=univ|^#home|^#planner|^#library\/(sources|links)|t=road|[?&]bf=|^#schedule$|#changelog/.test(g.href)) return null; const seg = String(g.t).split(" · ").pop(); return (seg.length >= 3 ? seg : g.t).replace(/\(.*$/, "").trim() || null; };
export const NO_HL = new Set(["hs-11", "sch-04", "log-13", "b33-06"]); // 기본 화면에 행이 표시되지 않는 행(2033 대입 전망·학년 필터 등): 강조 없이 화면으로만 간다
// 안내 문장 자르기: 글자 수 한도 안에서 문장 끝(. 다 요)이나 띄어쓰기에서 끊고 "…"를 붙인다(중간에서 뚝 끊기지 않게)
export const clip = (t, n) => { t = String(t || ""); if (t.length <= n) return t; const head = t.slice(0, n + 40); const m = [...head.matchAll(/[.。]\s|(?:다|요)(?:\.|\s)/g)].map((x) => x.index + x[0].trimEnd().length).filter((i) => i >= n * 0.5 && i <= n + 40).pop(); if (m) return t.slice(0, m).trim(); const cut = t.slice(0, n), sp = cut.lastIndexOf(" "); return (sp > n * 0.6 ? cut.slice(0, sp) : cut).trim() + "…"; };
const withHl = (href, t) => (!t || !/^#/.test(href) || /[?&]hl=/.test(href) || /[?&]v=univ&u=/.test(href) ? href : href + (href.includes("?") ? "&" : "?") + "hl=" + encodeURIComponent(String(t).replace(/ⓘ/g, "").slice(0, 24))); // 검색에서 가면 그 행을 펴서 강조(hl.js)
const routeOf = (r) => (r.topic === "gg-hs-entry" && !(r.events && r.events.length) ? "#select/curriculum?v=types"
  : r.topic === "hs-schedule" && r.region === "seoul" ? "#schedule?t=hs&seoul=1" // 서울 행은 일정 화면에서 '서울 보기'를 켜야 보인다
  : r.topic === "admission-structure" || ["cur-29", "cur-30"].includes(r.id) ? "#admission/system?t=types" // 대입 전형 구조 행은 수시·정시(전형) 화면에 있다
  : ["cur-08", "sch-03"].includes(r.id) ? "#admission/system" // 수능 참고 행은 대입 제도 화면에 있다
  : /^(opn-0[124]|asg-07)$/.test(r.id) ? "#select/types" : r.id === "acd-04" ? "#select/types" // 진학 비율은 고교 유형의 학원 의견 구역에 있다
  : r.topic === "exam-schedule" && r.examYear && r.examYear !== 2030 ? "#admission/system" // 다른 학년도 참고 행은 대입 제도 화면에 있다
  : ROUTE[r.topic] || (r.topic.startsWith("admission") ? "#admission/system" : "#home"));

// 같은 뜻의 말(학부모가 쓰는 말 → 화면에 있는 말). 앞 말을 찾으면 뒤 말도 같이 찾는다.
const SYN = [["학교알리미", "학알리"], ["한성과학고", "한성과고"], ["예상", "추정"], ["기본계획 발표", "기본계획 공고"], ["학교장추천", "고교장추천", "교장추천", "학교장 추천", "고교장 추천"], ["교과서", "검정교과서", "검정 교과서"], ["서성한", "서강대", "성균관대", "한양대"], ["중경외시", "중앙대", "경희대", "한국외대", "서울시립대"], ["서울대", "snu"], ["성균관대", "skku"], ["서울시립대", "uos"], ["포스텍", "postech", "포항공대", "포항공과대학교"], ["카이스트", "kaist", "한국과학기술원"], ["한양대", "한대"], ["중앙대", "중앙"], ["고입전형포털", "satp"], ["자유학기", "시험 안 보는 학기", "시험안보는학기"], ["kice", "평가원", "한국교육과정평가원"], ["설대", "서울대", "서울대학교"], ["연고대", "연세대 고려대"], ["지균", "지역균형", "지역균형전형"], ["논서술형", "서논술형", "서·논술형"], ["봉사활동", "봉사"], ["영재고", "영재학교"], ["자유학년제", "자유학기", "자유학기제", "자유학년"], ["sky", "스카이", "서울대", "연세대", "고려대"], ["과탐", "과학탐구"], ["사탐", "사회탐구"], ["전형유형", "전형 유형", "전형 구분", "전형유형 구분"], ["서연고", "서울대", "연세대", "고려대"], ["포스텍", "포항공과대학교", "포항공대"], ["외대", "한국외국어대학교", "한국외대"], ["창체", "창의적 체험활동", "창의적체험활동"], ["화작", "화법과 작문", "화법과작문"], ["언매", "언어와 매체", "언어와매체"], ["성대", "성균관대", "성균관대학교"], ["연대", "연세대", "연세대학교"], ["중대", "중앙대", "중앙대학교"], ["고대", "고려대", "고려대학교"], ["서울시립대", "시립대", "서울시립대학교"], ["시뮬레이션", "시뮬레이터"], ["심리학", "인간과 심리"], ["전후기", "전기 후기", "전기·후기"], ["급식", "점심", "점심 방식", "중식", "점심시간 식사"], ["다자녀", "세 자녀", "세자녀", "다둥이", "삼남매"], ["국영수", "국·수·영", "국수영"], ["예비소집", "예비소집일", "예비소집 날짜"], ["생활기록부", "학교생활기록부", "생기부", "학생부"], ["준비물", "서류", "원서"], ["원서", "원서접수", "접수", "지원"], ["상현", "상현중", "상현초", "상현고"], ["성복", "성복중", "성복초", "성복고"], ["설명회", "배정 설명회", "입학설명회"], ["배정", "평준화", "추첨", "배정원서"], ["수시", "학종", "학생부종합"], ["정시", "수능"], ["내신", "5등급", "성적"], ["학점", "학점제", "고교학점제"], ["통학", "거리", "지도"], ["특목", "과학고", "외고", "국제고", "자사고", "영재"], ["비교", "견줘", "견주", "견줄", "나란히", "한꺼번에"], ["날짜", "일정", "시행", "언제"], ["합격", "배정", "추첨"], ["권장과목", "이수 권장", "전공 연계"], ["학생수", "학생 수", "인원"], ["선택과목", "탐구 선택", "문과 이과", "성향"], ["진학", "진학 현황", "합격 실적"], ["시험", "지필", "수행평가", "평가계획"], ["졸업식", "중학교 졸업", "초등학교 졸업"], ["외대부고", "외대부설", "한국외국어대학교부설", "한국외대부고"], ["수능일", "수능 날짜", "수능 시행일", "수능 시행"], ["졸업일", "졸업식", "중학교 졸업", "초등학교 졸업"], ["수능 시간", "시험시간", "시험 시간", "영역별 시간"], ["자유학기", "시험 없는 학기", "자유학년"], ["출결", "출결 감점", "출결 점수", "결석 감점"], ["학비", "수업료", "등록금", "비용", "가격", "낙찰가"], ["입학 서류", "준비물", "제출 서류", "서류"], ["카이스트", "한국과학기술원", "KAIST"], ["포스텍", "포항공과대학교", "포항공대"], ["서울대", "서울대학교"], ["연세대", "연세대학교"], ["고려대", "고려대학교", "고대"], ["서강대", "서강대학교"], ["성균관대", "성균관대학교", "성대"], ["한양대", "한양대학교"], ["중앙대", "중앙대학교"], ["경희대", "경희대학교"], ["외대", "한국외국어대학교", "한국외대"], ["시립대", "서울시립대학교", "서울시립대"]];
// 문장형 질의 정리: 조사·어미·의도 동사(바꾸고·싶어요·가려면 …)를 떼고 핵심어만 남긴다. 학교 이름 판정과 검색이 모두 이 결과를 쓴다.
const VERB_ONLY = /^(바꾸고|날이|날은|날첫째|둘째|셋째|넷째|다섯째|반드시|채워야|채워|채우|몇월|몇일|몇시|몇년|몇번|몇학점|줄어드|줄어드는|줄어들|줄어요|늘어나|늘어나는|늘어요|넘나|넘는|넘어요|달라|달라지|달라져|달라요|궁금|열어주면|안열어주면|빠지|빠져|빠지나|빠지는|빨리|마칠|마치|쓸|써요|어디서|언제쯤|쯤|바꿔|바꾸|바꾸는|보고|보기|보는|찾고|찾아|찾는|알려줘|알려|알려주세요|알려줘요|싶어요|싶은데|하려면|가려면|가고|해요|해줘|줘|주세요|어떻게|어디|언제|뭐|무엇|뭐예요|어느|어떤|있어요|없어요|있나요|돼요|되나요|할까요|가요|와요|있는|없는|갈|수|걸|것|거|있을까요|되는|하는|하고|싶어|싶다|싶습니다|좀|저|제가|내가|뭐야|뭔가요|뭔데|무엇인가요|해야|해야해요|해야하나요|하나요|하면|돼|되나|가면|이야|인가|맞아요|맞나요|무슨|말이에요|얼마나|얼마|며칠|어디서|어디에|어디에서|쓰고|내고|우리|아이|지금|시기|될까요|돼요|하나|뭘|어떻게요|알수|모르겠어요|모르겠|모르겠는데|모르는|뭐하는|하는곳|무슨|기관|누구|요구|어딘가요|어딘가|어딘지|어디인가요|것들|알려주|알고|올해|안에|꼭|게|링크|바로가기|싶은|등을|등이|등|어디어디|바뀔|바뀌나|바뀌는|가능성|모자라면|모자란|부족하면|일을|할|들어야|들어|나오|나오는|나와요|넣어|써야|내야|나와|받나요|받아요|받는|받으면|있을까|있나|없나|뭐가|뭐예요|누가)$/;
const ENDINGS = /((?<=[가-힣]{2})(?<!학교)별|(?<=[가-힣]{2})란|이나|인데|(?<=[가-힣]{2})(?:한|된|할|가고|오고)|끼리|이란|이라는|라는|이라면|다면|만들고싶어요|만들고|만들어줘|만들어|만들기|만드는|들어가려면|하려면|가려면|바꾸고싶어요|보고싶어요|알고싶어요|싶어요|싶은데|해주세요|해줘요|해줘|알려줘요|알려줘|알려주세요|주세요|해요|이에요|예요|인가요|있나요|없나요|할까요|되나요|돼요|나요|까요|는데|은데|려면|으로|에서|에게|한테|에는|에도|까지|부터|이랑|이고|이며|바꾸고|바꿔|하고|은요|는요|인가요|뭔가요|하나요|했나요|인데요|입니까|습니까|ㅂ니까|어떤가요|어때요|좋을까요|궁금해요|궁금합니다|가능한가요|가능해요|가능할까요|합니까|하는지|되는지|있는지|있을까요|싶습니다|있어요|없어요|될까요|할까요|하죠|되죠|인지|되고|하면|으면|이면|이라서|이라는데|라는데|다는데|다던데|던데|는지|은지|ㄴ지|나요|가요|어요|아요|세요|죠)$/;
const JOSA = /(은|는|이|가|을|를|에|로|의|도|만|과|와|랑)$/;
// 숫자·날짜·단위 표기 통일: 12월 7일·12월7일·12/7 → 12.7, 10퍼센트 → 10%, 90점은 그대로(일정 행의 날짜 표기와 맞춘다)
const normNums = (q) => String(q).replace(/(?<![\d.])['’]?(2[4-9]|3\d)\s*년(?=\s*\d{1,2}\s*월)/g, "20$1년").replace(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/g, (m, y, mo, d) => `${y}.${+mo}.${+d}`).replace(/(\d{4})[-/](\d{1,2})(?![\d-/])/g, (m, y, mo) => `${y}.${+mo}`).replace(/(?:디데이|d\s*-\s*day|d\s*-\s*\d{2,4}|d\s*\d{3,4}(?!\d)|(?:천|1000|1,000|[0-9]{3,4})\s*일\s*(?:남|전|뒤|후))/gi, " D-day 남은 날 ").replace(/(\d{4})\s*년\s*(\d{1,2})\s*월(?!\s*\d)/g, "$1.$2").replace(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?/g, "$1.$2.$3").replace(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?/g, "$1.$2").replace(/(\d{1,2})\s*\/\s*(\d{1,2})(?!\d)/g, "$1.$2").replace(/(\d+(?:\.\d+)?)\s*(?:퍼센트|프로)/g, "$1%");
export const cleanQuery = (q) => { q = normNums(q).replace(/(\d{1,2}\.\d{1,2})\s*부터\s*\d{1,2}\s*일(?:까지)?/g, "$1").replace(/(\d)\.(?=\d)/g, "$1\u0001"); const out = []; for (const raw of String(q).replace(/[?？!！.,;:~…"'“”‘’()（）\[\]「」『』]+/g, " ").replace(/[·ㆍ/]+/g, " ").trim().split(/\s+/)) { let t = raw; if (!t) continue; if (/^(서성한|중경외시|서연고|연고대|설대|한대)$/.test(t)) { out.push(t); continue; } /* 대학 별칭은 어미 떼기 대상이 아니다(서성한→서성) */ if (VERB_ONLY.test(t)) continue; const e = t.replace(ENDINGS, ""); if (e !== t) { if (!e) continue; t = e; } if (t.length >= 3 && JOSA.test(t)) t = t.replace(JOSA, ""); if (t && !VERB_ONLY.test(t) && !(t.length === 1 && !/[\d밖]/.test(t))) out.push(t); } if (out.length === 1 && /^(확인|문의|질문|궁금|알아|정보)$/.test(out[0])) return String(q).trim().replace(/\u0001/g, "."); return (out.join(" ") || String(q).trim()).replace(/\u0001/g, "."); };
const EXPC = new Map(), expand = (k) => { let c = EXPC.get(k); if (c) return c; c = expand0(k); if (EXPC.size > 5000) EXPC.clear(); EXPC.set(k, c); return c; }, expand0 = (k) => { const out = new Set([k]); { const m = /^(\d{4})[.\-](\d{1,2})$/.exec(k); { const m3 = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(k); if (m3) { const mm = String(Number(m3[2])), dd = String(Number(m3[3])); out.add(`${m3[1]}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`); out.add(`${m3[1]}.${mm}.${dd}`); out.add(`${m3[1]}년${mm}월${dd}일`);} } if (m) { const mm = String(Number(m[2])); out.add(`${m[1]}.${mm}`); out.add(`${m[1]}-${mm.padStart(2, "0")}`); out.add(`${m[1]}년${mm}월`); } } /* 2027.3 = 2027-03 = 2027년 3월 */ SYN.forEach((g) => { if (g.some((w) => norm(w) === k || k.includes(norm(g[0])))) g.forEach((w) => out.add(norm(w))); }); return [...out]; };
/* 토큰이 글에 있는지: 변형(expand)에 더해 ① 연도 없이 쓴 날짜(2027.12.10 ← "2027 … 12.10(금)") ② 퍼센트 근사(80% ← 80.3%) */
const tokIn = (tk, n) => { if (/^\d{1,2}\.\d{1,2}$/.test(tk)) return new RegExp(`(?<!\\d)${tk.replace(".", "\\.")}${/\.\d{2}$/.test(tk) ? "" : "(?!\\d)"}(?!%)`).test(n) || expand(tk).slice(1).some((w) => n.includes(w)); /* 월.일은 연도 끝자리(2027.9의 7.9)에 걸리지 않게 */ if (expand(tk).some((w) => n.includes(w))) return true; { const my = /^(20\d\d)년?$/.exec(tk); if (my) return n.includes(`${+my[1] + 1}학년도`) || n.includes(`${my[1]}학년도`); /* 달력 연도 ↔ 학년도: 2029년 11월 수능 = 2030학년도 */ const md = /^(20\d\d)\.(\d{1,2})(\.\d{1,2})?$/.exec(tk); if (md && n.includes(`${+md[1] + (+md[2] >= 3 ? 1 : 0)}학년도`) && n.includes(md[2] + (md[3] || ""))) return true; } let m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(tk); if (m) return n.includes(m[1]) && n.includes(`${+m[2]}.${+m[3]}`); m = /^(\d+)%$/.exec(tk); if (m) return new RegExp(`(?<!\\d)${m[1]}(\\.\\d+)?%`).test(n); return false; };
const UNIV_ALIAS = [["서울대학교", ["서울대", "설대"]], ["연세대학교", ["연세대"]], ["고려대학교", ["고려대"]], ["포항공과대학교", ["포스텍", "포항공대"]], ["한국과학기술원", ["카이스트", "kaist"]], ["서강대학교", ["서강대"]], ["성균관대학교", ["성균관대"]], ["한양대학교", ["한양대"]], ["중앙대학교", ["중앙대"]], ["경희대학교", ["경희대"]], ["한국외국어대학교", ["한국외대", "외대"]], ["서울시립대학교", ["서울시립대", "시립대"]]];
const UNIV_Q = /서성한|중경외시|서연고|연고대|설대|한대|서울대|연세대|고려대|서강대|성균관대|한양대|중앙대|경희대|외대|시립대|포스텍|카이스트|snu|skku|uos|kaist|postech/i;
const HELP = [["경기도교육청", "https://www.goe.go.kr", "도 단위 공지·고입 안내"], ["학교알리미", "https://www.schoolinfo.go.kr", "학교별 공시 정보"], ["대입정보포털 어디가", "https://www.adiga.kr", "대학 입시 정보"], ["고입 전형 포털(경기)", "https://www.satp.goe.go.kr", "경기 고입 원서·전형요강"]];

// 검색 데이터 구성(브라우저 밖에서도 같은 구조를 쓰도록 분리): [policy, summary, links, subject-info, places, extra] → data
export function buildSearchData([policy0, summary, links, si, pl, extra], store) {
  const policy = filterByProfile(policy0, loadProfile(store), { grade3: true }); /* 화면이 보여 주는 행만 검색 결과로(화면에 없는 행으로 링크되지 않게) */
  return { places: pl.places || [], guide: extra.map((d) => ({ t: d.t, text: d.text, href: d.href, from: "", sch: d.sch, s: d.s, q: d.q, only: d.only, gap: d.gap, found: d.found, raw: d.raw, strict: d.strict, hl: d.hl, term: d.term, quiet: d.quiet })), policy, policyAll: policy0, summary, links: links.items || [], subjects: si.subjects || (Array.isArray(si) ? si : []) };
}
// 점수·순위 계산 전부. 브라우저(DOM) 없이 setData(data) 뒤 search(q)만 부르면 된다.
// 한글 날짜·퍼센트 표기를 데이터 표기로: '2028년 1월 10일 17일' → '2028.1.10~17', '1월 31일 2월 7일' → '1.31~2.7', '10퍼' → '10%'
const slashDates = (q) => { const dateWords = /일정|날짜|언제|접수|발표|등록|원서|면접|수능|시험|기간|마감|개학|졸업|입학|요일/, noFrac = /출석|분의|비율|이상|이하|이수/; return noFrac.test(q) ? q : q.replace(/(?<![\d.\/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d\/])/g, (m, a, b) => ((+a >= 1 && +a <= 12 && +b >= 1 && +b <= 31 && (+b > 12 || dateWords.test(q) || /^\s*\d{1,2}\s*\/\s*\d{1,2}\s*$/.test(q))) ? `${+a}.${+b}` : m)); }; /* 1/31 → 1.31 (분수 2/3은 날짜 낱말이 있을 때만) */
// 날짜 매칭용(본문 대조에만 쓰는) 더 넓은 정규화: 연도 없는 '1월 31일'·요일까지 같은 표현(월.일)으로. 검색어 자체에는 쓰지 않는다(기존 한글 날짜 처리 보존)
export const normDates = (q0) => slashDates(normKoQuery(q0)).replace(/(?<![\d.])0?(\d{1,2})\s*월\s*0?(\d{1,2})\s*일/g, "$1.$2").replace(/(\d{1,2}\.\d{1,2})\s*[월화수목금토일]요일/g, "$1").replace(/(\d{1,2}\.\d{1,2})\s*\(\s*[월화수목금토일]\s*\)/g, "$1");
export const normKoQuery = (q0) => {
  let q = String(q0);
  const dateWords = /일정|날짜|언제|접수|발표|등록|원서|면접|수능|시험|기간|마감|개학|졸업|입학|요일|[월화수목금토일]\)?\s*$/, noFrac = /출석|분의|비율|이상|이하|이수|\d\s*\/\s*\d\s*(이상|못|미만)/;
  q = q.replace(/(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?/g, "$1.$2.$3 ") /* '2026. 12. 4.' → 2026.12.4 */
    .replace(/(\d{4})\s*[-/]\s*0?(\d{1,2})\s*[-/]\s*0?(\d{1,2})(?!\d)/g, "$1.$2.$3") /* 2028-01-31 · 2028/1/31 */
    .replace(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(?:~|부터|-)?\s*(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일/g, (m, y, m1, d1, m2, d2) => `${y ? y + "." : ""}${m1}.${d1}~${m2 ? m2 + "." : ""}${d2}`)
    .replace(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, (m, y, m1, d1) => `${y}.${m1}.${d1}`); /* 연도 없는 '3월 2일'은 기존 처리를 그대로 둔다 */
  return q.replace(/(\d{1,2}\.\d{1,2})\s*[월화수목금토일]요일/g, "$1").replace(/(\d{1,2}\.\d{1,2})\s*\(\s*[월화수목금토일]\s*\)/g, "$1").replace(/(\d+)\s*(?:퍼센트|퍼)(?![가-힣])/g, "$1%");
};
// 질의 속 날짜·기간 표기를 정책 행 본문에서 글자 그대로 찾는다(2028.1.3 ↔ 1.3, '1.10~17'은 그대로·시작·끝 모두). 날짜가 둘 이상이면 모두 든 행이 먼저, 하나뿐이면 다른 낱말도 하나 이상 겹쳐야 한다.
const dateRows = (q0, policy) => {
  const raw = String(q0 || "").replace(/[～〜∼]/g, "~"), refs = [], DT = "\\d{4}\\.\\d{1,2}\\.\\d{1,2}|\\d{1,2}\\.\\d{1,2}";
  for (const m of raw.matchAll(new RegExp(`(?<![\\d.])(${DT})(?:\\s*~\\s*(${DT}|\\d{1,2}))?(?![\\d])`, "g"))) {
    const a = m[1], b = m[2], md = (x) => x.replace(/^\d{4}\./, ""), year = /^\d{4}/.test(a) ? a.slice(0, 4) : "";
    const parts = [md(a)]; if (b) parts.push(/\./.test(b) ? md(b) : `${md(a).split(".")[0]}.${b}`);
    refs.push({ lit: m[0].replace(/\s+/g, ""), alts: b ? [`${md(a)}~${b.split(".").pop()}`, `${a}~${b.split(".").pop()}`] : [], parts, year });
  }
  if (!refs.length) return [];
  /* 날짜 낱말 경계: 앞뒤가 숫자·점·%가 아니어야(81.3%·1.65 같은 수와 구별) */
  const has = (t, x) => new RegExp("(?:(?<![\\d.])|(?<=(?<!\\d)\\d{4}\\.))" + x.replace(/\./g, "\\.") + "(?![\\d%]|\\.\\d)").test(t);
  const words = raw.replace(new RegExp(DT, "g"), " ").split(/[\s~?？!,]+/).map((w) => norm(w.replace(/(은|는|이|가|을|를|에|에서|까지|부터)$/, ""))).filter((w) => w.length >= 2 && !/^(일정|언제|며칠|날짜|기간|알려줘|뭐예요|인가요|일까요|잠정|시험)$/.test(w));
  const out = [];
  for (const row of policy) {
    const t = `${row.title} ${row.body || ""}`, k = refs.filter((r) => has(t, r.lit) || r.alts.some((x) => has(t, x)) || (r.parts.every((x) => has(t, x)) && (!r.year || t.includes(r.year)))).length; if (k < refs.length) continue;
    const nt = norm(t), ev = refs.some((r) => r.parts.length === 1 && (row.events || []).some((e) => [e.start, e.end].some((dd) => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(dd || ""), q2 = r.parts[0].split("."); return m && +m[1] === +q2[0] && +m[2] === +q2[1]; }))); /* 구조화된 일정(events) 날짜와 같으면 우선 */
    const ob = words.filter((w) => nt.includes(w)).length; out.push({ row, ob, ov: ob + (ev ? 5 : 0) });
  }
  const res = out.filter((x) => refs.length >= 2 || refs[0].parts.length >= 2 || x.ob >= 1 || !words.length).sort((a, b) => b.ov - a.ov).slice(0, 4); res.pure = !words.length; return res;
};
// 일정이 여러 건인 행은 도착 화면에서 질의와 맞는 일정 줄(라벨·날짜)을 강조한다: 행 제목 첫 줄이 아니라 질의가 말한 단계(과학고 소집면접 11.20 등)
export const evHlFor = (r, q0) => { const evs = r.events || []; if (evs.length < 2) return r.title; const nq = norm(q0), toks = String(q0).split(/\s+/).map(norm).filter(Boolean), best = evs.map((e) => { const lb = norm(e.label || ""), md = /^\d{4}-(\d{2})-(\d{2})/.exec(e.start || ""), mdd = md ? `${+md[1]}.${+md[2]}` : ""; let sc = 0; for (const w of toks) { if (w.length >= 2 && lb.includes(w)) sc += 2; } if (mdd && nq.includes(mdd)) sc += 3; return { e, sc }; }).sort((a, b) => b.sc - a.sc)[0]; return best && best.sc >= 2 && best.e.label ? best.e.label : r.title; };
export function makeSearcher(store) {
  let data = null;
  let any = false;
  const STOP = new Set(["있는", "없는", "어떤", "어디", "언제", "얼마", "어떻게", "하는", "되는", "알려줘", "알려", "관련", "풀이", "뜻풀이", "정의", "개념", "의미", "뜻"]), STOP2 = new Set(["학교", "정보"]);
  const searchOnce = (q0, orMode) => {
    const PH = [["선생님 명당", "교원1인당"], ["교사 명당", "교원1인당"], ["선생님 한 명당", "교원1인당"], ["선생님 1명당", "교원1인당"], ["교사 한 명당", "교원1인당"], ["선생님 수", "교원수"], ["시험 없는 학기", "자유학기"], ["시험없는학기", "자유학기"], ["출결 감점", "출결"], ["지도에서 학교 찾기", "학교 지도"], ["학교 찾기", "학교 지도"], ["다크 모드", "화면 모드"], ["다크모드", "화면 모드"], ["야간 모드", "화면 모드"], ["논술 전형", "논술전형"], ["수능 절대평가", "절대평가"], ["학교 밖 교육과정", "공동교육과정"], ["수능 응시 영역", "수능 영역"], ["교복 지원비", "교복 지원금"], ["자공고", "자율형공립고"], ["성적 반영 점수", "성적 반영"], ["고등학교 무상교육", "무상교육"], ["학교생활기록부", "생활기록부"], ["용인외대부고", "용인한국외국어대학교부설고등학교"], ["외대부고", "용인한국외국어대학교부설고등학교"], ["외대부", "용인한국외국어대학교부설고등학교"]]; // 여러 낱말로 된 말은 화면에 있는 말 하나로 바꿔 찾는다
    let q = String(q0); for (const [a, b] of PH) q = q.replace(a, b);
    const UNIV_TOK = /서성한|중경외시|서연고|연고대|설대|한대|서울대|연세대|고려대|서강대|성균관대|한양대|중앙대|경희대|외대|시립대|포스텍|카이스트|snu|skku|uos|kaist|postech/i;
    if (UNIV_TOK.test(q) && !orMode) { const rest = q.split(/\s+/).filter((w) => !/^(입시|입학|요건|수시|정시|전형|지원|조건)$/.test(w)); if (rest.length) q = rest.join(" "); } /* 대학 별칭 질의의 흔한 낱말(입시·수시…)은 맞춤 조건에서 뺀다 */
    const GEN = /^(일정|방법|안내|기간|날짜|정보|신청|기준|절차|기재|차이|비교|뜻|의미|입시|해석|종류|구분|기관|곳)$/; q = q.split(/\s+/).filter((w) => !STOP.has(w) && !(orMode && STOP2.has(w))); { const rest = q.filter((w) => !GEN.test(norm(w))); if (rest.length) q = rest; } q = q.join(" ") || q0; // 일정·방법 같은 흔한 낱말은 다른 낱말이 있으면 맞춤 조건에서 뺀다 // 말버릇(있는·어떤 …)은 빼고 찾는다
    any = orMode;
    const k = norm(q); if (!k) return [];
    const ks = expand(k);
    // 띄어 쓴 검색어는 낱말마다(동의어 포함) 모두 들어 있어야 맞는다. 하나도 못 찾으면 낱말 중 하나만 맞아도 보여 준다.
    const toks = String(q).split(/\s+/).map(norm).filter(Boolean);
    const has = (...xs) => hasN(xs.map(norm).join(" ")), hasN = (n) => { if (toks.length < 2) return ks.some((w) => n.includes(w)); const hit = toks.map((tk) => tokIn(tk, n)); if (any) return hit.some(Boolean); const need = toks.filter((tk, i) => !hit[i]); /* 학교급 낱말(고등학교)만 빠진 행은 맞는 것으로: 행이 "후기 원서접수"라고만 써도 "후기 고등학교 원서 접수"에 맞게(접수·원서·전형을 묻는 말에 한함) */ return !need.length || (toks.length >= 3 && need.length === 1 && need[0] === "고등학교" && toks.some((t) => /^(원서|접수|전형)/.test(t)) && toks.some((t) => /^(후기|전기)/.test(t))); };
    const fo = store.get("portal.focus", []), foc = Array.isArray(fo) ? fo : [];
    const rank = (title, body, row) => (norm(title).includes(k) ? 6 : ks.some((w) => norm(title).includes(w)) ? 4 : 1) - (row && (row.region === "seoul" || /^서울/.test(title || "")) ? 3 : 0) + (row && foc.includes(stageOf(row)) ? 1 : 0) + (norm(body || "").includes(k) ? 0.5 : 0) + (!row && toks.some((tk) => tk.length >= 2 && (norm(title) === tk || norm(title).startsWith(tk))) ? 2.5 : 0); // 제목이 검색어로 시작하는 문서(교복·자유학기 …)를 먼저
    const dfOf = (tk) => data.policy.filter((r) => nr(r).includes(tk)).length, rare = toks.length > 1 ? toks.filter((tk) => dfOf(tk) > 0 && dfOf(tk) <= 20) : [];
    const rareHit = (r) => (rare.some((tk) => norm(r.title).includes(tk)) ? 4 : 0); // 드문 낱말(국제고·과학고 등)이 제목에 있는 행을 먼저
    const tokHit = (r) => (toks.length > 1 ? toks.filter((tk) => expand(tk).some((w) => nr(r).includes(w))).length * 1.5 : 0), hsQ = HS_Q.test(norm(q0)) && !MID_Q.test(norm(q0)), hsRow = (r) => /^(hs-|gg-|high-school)/.test(r.topic); const datoks = toks.filter((tk) => /^\d{4}\.\d{1,2}(\.\d{1,2})?$|^\d{1,2}\.\d{1,2}$/.test(tk)), yrtoks = toks.filter((tk) => /^20\d\d년$/.test(tk)), yearHit = (r) => yrtoks.filter((tk) => nr(r).includes(tk.slice(0, 4) + ".")).length * 3, dateHit = (r) => datoks.length && datoks.filter((tk) => expand(tk).some((w) => nr(r).includes(w))).length * 4; /* 날짜를 담은 질의는 그 날짜가 본문에 있는 행을 앞에 */ const OTHER_REG = /^(서울|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)/, askReg = /용인|수지|성복|풍덕천|서울|인천|부산|대구|광주|대전|울산|세종|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주|타지역|다른 ?지역/.test(q0), regBoost = (r) => (askReg ? 0 : /^경기/.test(r.title) ? 1 : OTHER_REG.test(r.title) ? -1 : 0); /* 지역을 안 밝히면 우리 집 지역(경기) 행을 앞에 */
    const rowOk = (r) => hasN(nr(r)) || (datoks.length >= 1 && !any && datoks.every((tk) => tokIn(tk, nr(r)))); /* 날짜가 본문에 있는 행은 시험·접수 같은 흔한 낱말이 빠져도 맞는 것으로 */
    const evHl = (r) => evHlFor(r, q0);
    const rows0 = data.policy.filter((r) => rowOk(r)), rowsStrict = rows0.filter((r) => hasN(nr(r))), rows = (rowsStrict.length ? rowsStrict : rows0).map((r) => ({ href: withHl(routeOf(r), NO_HL.has(r.id) || r.topic === "profile-2033" ? null : evHl(r)), t: r.title, x: r.body, s: clip(r.body || "", 90), inline: NO_HL.has(r.id) || r.topic === "profile-2033", sc: rank(r.title, r.body, r) + tokHit(r) + rareHit(r) + (hsQ && hsRow(r) ? 2 : 0) + regBoost(r) + dateHit(r) + yearHit(r) + (hasN(nr(r)) ? 0 : -8) })).sort((a, b) => b.sc - a.sc).slice(0, 12);
    const gd = data.guide.filter((g) => !g.quiet && !(g.strict && !g.rawMatch) && hasN(ng(g))).map((g) => ({ sch: g.sch, href: g.hl === null ? g.href : withHl(g.href, g.hl || autoHl(g)), term: g.term, t: g.t, x: g.text, s: clip(g.s || (g.text.split(/(?<=[.。다요])\s/).find((x) => ks.some((w) => norm(x).includes(w))) || g.text), 80), sc: rank(g.t, g.text) })).sort((a, b) => b.sc - a.sc).slice(0, 8);
    const sch = data.summary.filter((m) => has(m.schoolName, m.region)).map((m) => ({ href: `#select/curriculum?v=summary&s=${m.schoolId}`, t: m.schoolName, s: `${m.creditsRequired}+${m.creditsElective}학점 · ${m.region}` }));
    const sub = (typeof UNIV_Q !== "undefined" && UNIV_Q.test(q0) ? [] : data.subjects).filter((x) => has(x.name, x.summary)).slice(0, 10).map((x) => ({ href: `#select/curriculum?v=compare`, t: x.name, s: `${x.area || ""} · ${(x.summary || "").slice(0, 70)}` }));
    const lk = data.links.filter((x) => has(x.name, x.purpose, x.org)).map((x) => ({ href: x.url, ext: true, t: x.name, s: `${x.org} · ${x.purpose}` }));
    const pages = allItems().filter((i) => has(i.title, i.tab, i.desc)).map((i) => ({ href: `#${i.id}`, t: i.title, s: i.tab }));
    const plc = data.places.filter((x) => has(x.name, x.address)).slice(0, 10).map((x) => ({ href: `#select/curriculum?v=map&lv=${x.level === "middle" || x.level === "elementary" ? x.level : "high"}&p=${encodeURIComponent(x.id)}`, t: x.name, s: `${x.level === "middle" ? "중학교" : x.level === "elementary" ? "초등학교" : "고등학교"} · ${x.address || ""}` }));
    const maps = [["학교 지도", "#select/curriculum?v=map"], ["중학교 배정", "#select/curriculum?v=middle"]].filter(([n]) => has(n, "지도", "중학교", "배정")).map(([n, h]) => ({ href: h, t: n, s: "학교" }));
    if ((datoks.length && rows.some((r) => dateHit({ title: r.t, body: r.x })) && !gd.some((g) => dateHit({ title: g.t, body: g.x }))) || rows.some((r) => norm(r.t) === norm(q))) /* 제목이 질의와 똑같은 일정 행(초등학교 졸업)은 안내 글보다 먼저 */ return [["일정·제도", rows], ["가이드·용어", gd], ["학교", [...sch, ...plc]], ["과목", sub], ["바로가기", lk], ["화면", [...pages, ...maps]]].filter(([, l]) => l.length);
    return [["가이드·용어", gd], ["일정·제도", rows], ["학교", [...sch, ...plc]], ["과목", sub], ["바로가기", lk], ["화면", [...pages, ...maps]]].filter(([, l]) => l.length);
  };
  // 안내가 정해진 주제(이사·배정 서류·자사고 배점·재수 …)는 느슨하게 맞는 다른 행보다 먼저 보여 준다. 없는 주제는 엉뚱한 행 대신 안내만 보인다.
  let regionHay = null;
  const priority = (q, q0 = "") => { const nq = norm(q), nr = norm(String(q0).replace(/[?？!！.,~]/g, " ")); const rawQ = String(q0 || q).toLowerCase(); const hit = data.guide.filter((g) => g.q && (g.raw ? new RegExp(g.q).test(rawQ) : (new RegExp(g.q).test(nq) || new RegExp(g.q).test(nr)))).filter((g) => !(g.gap === "none-topics" && /수능|가채점/.test(nr) && /날짜|며칠|언제|시행|몇월|몇일|일정/.test(nr))); /* 질의에 날짜 낱말이 있는 수능 질의는 약한 안내로 막지 않는다(정리된 질의에서 날짜 낱말이 빠져 선언이 걸리던 오류) */ if (hit.some((g) => g.gap === "none-topics")) { const o = hit.filter((g) => g.gap === "none-topics"); return { list: o.map((g) => ({ href: g.href, t: g.t, s: g.s })), only: true }; } // 정확한 자료가 없을 수 있는 주제는 약한 안내만(링크·소음 행이 앞서지 않게)
    if (hit.some((g) => g.gap === "other-region")) { // 질의의 지역 낱말이 포털 데이터(정책·안내)에 있으면 지역 안내를 내지 않는다(서울·수원외고 등) — 데이터에 없는 지역만 약한 안내
      const w = REGION_WORDS.find((x) => new RegExp("(?<![가-힣(])" + regionFindPattern(x)).test(String(q0).toLowerCase().replace(/\s+/g, " "))); regionHay ||= JSON.stringify([data.policy, data.guide.map((g) => [g.t, g.s, g.text])]);
      if (w && GG_WORDS.includes(w) && /공동학군|학구|판교중학군|운중동/.test(String(q0))) { const rest = hit.filter((g) => g.gap !== "other-region"); return rest.length ? { list: rest.map((g) => ({ href: withHl(g.href, g.hl), t: g.t, s: g.s })), only: false } : null; /* 학군·학교군 낱말이면 지역 일반 안내를 빼고 학교군 데이터로 */ }
      if (w && GG_WORDS.includes(w) && !regionKnown(w, regionHay, nr)) { /* 학군·학교군 낱말이 있으면 지역 일반 안내 대신 학교군 데이터(고기초 공동학군 등) */ const rest = hit.filter((g) => g.gap !== "other-region"); { const midQ = /중학|초등/.test(String(q0)) && !/고등|고교|고입|일반고/.test(String(q0)), gn = midQ && w === "광교" ? { href: "#select/curriculum?v=middle", t: "광교 · 중학교 배정", s: "광교는 수원(광교신도시)과 용인 수지구(광교마을로 등 도로명)에 걸친 이름이에요. 용인 수지구 기준은 아래 배정 행에 있고, 수원 광교의 중학교 배정은 정확히 맞는 내용이 없을 수 있어요 → 수원 지역 교육지원청 안내에서 확인해요" } : midQ ? { href: "#select/curriculum?v=middle", t: "다른 지역 중학교 배정", s: `${w}의 중학교 배정은 정확히 맞는 내용이 없을 수 있어요(중학교 배정·학교군은 용인 기준만 있어요) → ${w} 지역 교육지원청 안내에서 확인해요` } : { href: "#schedule?t=hs", t: "경기 고입 일정", s: gyeonggiNote(w, data.policy) }, others = rest.map((g) => ({ href: withHl(g.href, g.hl), t: g.t, s: g.s })), other = !midQ && /수능|대입|대학|마이스터|특성화|과학고|영재/.test(String(q0)); /* 학교급·시험 낱말이 있으면 고입 평준화 안내를 앞세우지 않는다 */ return { list: other ? others : [gn, ...others], after: other ? gn : null, only: false }; } } // 경기 지역 낱말(수원·성남 등)은 '없는 지역'이 아니라 경기 전체 일정 안내로
      if (w && REGION_ALIAS[w] === "서울" && /고입|고등|고교|일반고|전형|배정|일정|원서|입학|후기/.test(String(q0)) && !/중학|초등|대학|수능|입시/.test(String(q0))) { /* 서울 구 이름은 서울 고입 데이터 행을 앞에: 서울 기본계획(hs-01)·후기 일정(hs-05)·특별학생 배정(hs-15) */
        const sr = ["hs-01", "hs-05", "hs-15"].map((id) => data.policy.find((x) => x.id === id)).filter(Boolean);
        if (sr.length) return { list: [{ href: "#schedule?t=hs", t: `${w} · 서울 고입`, s: `${w}${/[가-힣]$/.test(w) && (w.charCodeAt(w.length - 1) - 0xac00) % 28 ? "은" : "는"} 서울의 구 이름이라 서울 고입 기본계획·후기 일정 행으로 안내해요(구별 학교 목록은 포털에서 찾지 못했어요)` }, ...sr.map((x) => ({ href: withHl(routeOf(x), x.title), t: x.title, s: clip(x.body || "", 90) }))], only: false };
      }
      if (w && regionKnown(w, regionHay, nr)) { const rest = hit.filter((g) => g.gap !== "other-region"); return rest.length ? { list: rest.map((g) => ({ href: withHl(g.href, g.hl), t: g.t, s: g.s })), only: rest.some((g) => g.only) } : null; }
    }
    if (hit.some((g) => g.gap === "other-region")) { const o = hit.filter((g) => g.gap === "other-region"); return { list: o.map((g) => ({ href: withHl(g.href, g.hl), t: g.t, s: g.s })), only: false }; } // 지역 안내와 함께 있는 데이터 행도 보여 준다(정답 행을 가리지 않는다) // 다른 지역 질의는 지역 경고만 먼저(이어서 우리 지역 결과로 오해하지 않게)
    return hit.length ? { list: hit.map((g) => ({ href: withHl(g.href, g.hl), t: g.t, s: g.s })), only: hit.some((g) => g.only) } : null; };
  // 학교급 가중: 고교 말(고교·후기·일반고·외고 …)이 있으면 고교 정책 행을 중학교 배정 안내보다 먼저, 중학교·초등 말이면 반대로
  const HS_Q = /고교|고등|일반고|후기|외고|국제고|자사고|특성화|마이스터|평준화|고입|전기고|과학고/, MID_Q = /중학교|중입|초등|초6|중학군|근거리|중1/;
  const isMid = (x) => /v=middle/.test(x.href) || /^(초[56]|중[123]) · |배정부터 등록까지|^중학교 /.test(x.t);
  const reweight = (r, q) => {
    const nq = norm(q), hs = HS_Q.test(nq), mid = MID_Q.test(nq); if (hs === mid) return r;
    const part = (l) => [...l.filter((x) => isMid(x) === mid), ...l.filter((x) => isMid(x) !== mid)];
    r = r.map(([h, l]) => (h.startsWith("가이드") || h.startsWith("일정") ? [h, part(l)] : [h, l]));
    if (hs) { const i = r.findIndex(([h]) => h.startsWith("일정")), j = r.findIndex(([h]) => h.startsWith("가이드")); if (i > j && j >= 0) { const [g] = r.splice(i, 1); r.splice(j, 0, g); } }
    return r;
  };
  // 낱말 일부만 맞은 느슨한 결과(OR)와 학교 이름 판정, 학교+주제 질의를 구조적으로 처리한다
  const TOPICS = [[/방과후/, "방과후학교", null], [/특색|교육 ?목표|교육 ?중점/, "교육 특색", (pl) => (pl.level === "middle" ? "#select/curriculum?v=middle&g=%EA%B5%90%EC%9C%A1" : "#select/curriculum?v=hs&g=%EA%B5%90%EC%9C%A1%EA%B3%BC%EC%A0%95")], [/편제표|개설(하는|되는)? ?과목|과목표|과목 ?구성/, "편제표(학교별 과목표)", (pl) => (pl.schoolId ? `#select/curriculum?s=${encodeURIComponent(pl.schoolId)}&hl=${encodeURIComponent("과목표")}` : null)], [/학비|등록금|수업료/, "학비·비용", () => "#select/curriculum?v=types"], [/모집 ?인원|정원|몇 ?명/, "모집 인원", () => "#select/curriculum?v=types"], [/진학 ?실적|대입 ?결과|입시 ?결과|합격 ?실적|합격자|진학/, "대학 진학 현황", (pl) => (pl.level === "high" ? "#select/curriculum?v=hs&g=%EC%A7%84%ED%95%99" : null)], [/설명회/, "설명회 노트", (pl) => data.guide.find((g) => pl.schoolId && g.href.includes("bf=" + pl.schoolId))?.href || null], [/합격선|커트라인|입결/, "합격선", () => null], [/입학|전형|지원|가려면|가고 ?싶|들어가/, "입학·전형", () => "#schedule?t=hs"], [/학군|학교군|중학구/, "학교군", () => "#select/curriculum?v=middle"], [/어느 ?중학교|갈 ?수 ?있는 ?중학교|가는 ?중학교|중학교 ?배정|배정 ?(되|받)/, "학교군", () => "#select/curriculum?v=middle", "elementary"]];
  // 과목 이름의 로마숫자(미적분Ⅱ·화학Ⅰ)를 질의의 아라비아 숫자(미적분2·화학 1)와 맞춘다
  const romanize = (str) => {
    if (!data.roman) { const bases = new Set(); for (const x of data.subjects || []) { const m = /^(.+?)\s*(Ⅰ|Ⅱ)$/.exec(x.name || ""); if (m) bases.add(m[1].trim()); } data.roman = [...bases].map((b) => [new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*([12])(?![0-9가-힣])", "g"), b]); }
    if (!data.plainRoman) { const names = (data.subjects || []).map((x) => x.name || ""), withR = new Set(names.filter((n) => /(Ⅰ|Ⅱ)$/.test(n)).map((n) => n.replace(/\s*(Ⅰ|Ⅱ)$/, ""))); const m = new Map(); for (const n of names) if (n.length >= 2 && !/(Ⅰ|Ⅱ)$/.test(n) && !withR.has(n) && !/[ ·]/.test(n)) { m.set(n, n); if (n.length >= 3 && /학$/.test(n)) m.set(n.slice(0, -1), n); } data.plainRoman = [...m].map(([k, v]) => [new RegExp(k + "\\s*(?:[12]|Ⅰ|Ⅱ|I{1,2})(?![0-9가-힣A-Za-z])", "g"), v]); } // 화학1·화학Ⅰ·물리2 → 화학·물리학(로마숫자 없는 과목)
    let t = String(str).replace(/(미적분|영어|수학|확률과 ?통계|화학|물리학?|생명과학|지구과학)\s*(투|이)(?![가-힣])/g, (_, b, n) => b + (n === "투" ? "2" : "2")).replace(/(미적분|영어|수학|화학|물리학?|생명과학|지구과학)\s*원(?![가-힣])/g, "$11"); for (const [re, b] of data.roman) t = t.replace(re, (_, n) => b + (n === "1" ? "Ⅰ" : "Ⅱ")); for (const [re, v] of data.plainRoman) t = t.replace(re, v); return t;
  };
  const search0 = (q) => {
    const SKIP_GEN = /^(용인|경기|서울|우리|일반|공립|사립|전국|특성화|자율)$/, hasSch = (j) => data.places.some((x) => schoolAliases(x.name).some((al) => al === j || al.startsWith(j)));
    const joinSp = (t) => t
      .replace(/([가-힣]{2,6}) *(초등학교|중학교|고등학교|초|중|고)(?![가-힣])/g, (m, a2, b2) => (/ /.test(m) && !SKIP_GEN.test(a2) && hasSch(norm(a2 + b2)) ? a2 + b2 : m)) // 학교급을 띄어 쓴 이름(성복 고등학교·서원 중)은 실제 학교 이름일 때만 붙인다
      .replace(/([가-힣]{2,5})(고교|중교|초교)(?![가-힣])/g, (m, a2, b2) => (hasSch(norm(a2 + b2[0])) ? a2 + b2[0] : m)); // 풍덕고교·수지중교 같은 변형
    q = joinSp(String(q)); let qForce = q; const forceCands = [];
    { // 붙여 쓴 낱말(고교무상교육)이 데이터에 그대로는 없고 두 부분이 각각 데이터에 있으면 띄워서 찾는다
      const inData = (w) => (data.dn ||= data.policy.map((x) => nr(x)).concat(data.guide.map((g) => ng(g)))).some((d) => d.includes(norm(w)));
      const splitTok = (tk, force) => { if (!/^[가-힣]{5,}$/.test(tk) || (!force && inData(tk))) return tk; for (let k = tk.length - 2; k >= 2; k--) { const l = tk.slice(0, k), r2 = tk.slice(k); if (r2.length >= 2 && inData(l) && inData(r2)) return `${l} ${r2}`; } return tk; };
      const toks = String(q).split(/(\s+)/); // 데이터에 그 낱말이 어딘가 있어도 결과가 비면, 가능한 모든 띄우는 자리(고교|무상교육, 고교무상|교육)로 다시 찾는다
      toks.forEach((tk, i) => { if (!/^[가-힣]{5,}$/.test(tk) || /(은|는|이|가|을|를|의|에|와|과|도|로|에서|인데|까지|부터|이나|요|다|까|지|네|서|고|면|며|해|한|된|할|는지|세요)$/.test(tk)) return; /* 조사·어미로 끝나는 말은 붙여 쓴 명사가 아니다 */ for (let k = tk.length - 2; k >= 2; k--) { const l = tk.slice(0, k), r2 = tk.slice(k); if (r2.length >= 2 && inData(l) && inData(r2)) forceCands.push(toks.map((x, j) => (j === i ? `${l} ${r2}` : x)).join("")); } });
      qForce = forceCands[0] || q;
    }
    const q0 = romanize(String(q)).replace(/시험을? ?(안|못) ?(보는|치는)( ?학기)?/g, "자유학기"); // 원문(의도 낱말 확인용)
    q = cleanQuery(q0).replace(/(?:용인)?(?:한국)?외(?:국어)?대(?:학교)?부(?:설|속)?(?:고등학교|고)?/g, "용인한국외국어대학교부설고등학교"); // 약칭 → 학교 이름
    const schoolSa = /용인한국외국어대학교부설고등학교/.test(q) && !/학생|학급|교원|급식|매점|주소|전화|홈페이지|교복|편제표|방과후|특색|진학|기숙사|남녀|설립|교사/.test(q); /* 학교 값(학생수·교원 등)을 묻는 말에는 자사고 전형 행을 끼워 넣지 않는다 */ /* 외대부고는 자사고: 학교 이름+전형·배점 같은 속성어도 자사고 안내 행을 찾게 */
    const p = priority(schoolSa ? "자사고 외고 " + q : q, schoolSa ? "자사고 외고 " + q0 : q0); if (p && p.only) return [["바로 안내", p.list]];
    { // 문장 속 동사·어미(떨어지면·열어·같은…)는 찾는 내용어가 아니다: 색인에 한 번도 없는 낱말은 무시하고 남은 내용어로 찾는다(내용어 전부가 없을 때만 "없음"으로 간다)
      const dn = (data.dn ||= data.policy.map((x) => nr(x)).concat(data.guide.map((g) => ng(g))));
      const dfN = (w) => dn.filter((d) => tokIn(norm(w), d)).length;
      const ws = q.split(/\s+/).filter(Boolean), SCH = /^[가-힣]{2,5}(중학교|고등학교|초등학교|중|고|초)$/;
      if (ws.length >= 2) { const VL = /(면|니|죠|며|지|어|아|해|한|된|는|은|던|려|러|야|라|래|서|고|다|요|네|까|게|ㄴ|을|를|같|많|좋|없|있)$/; const keep = ws.filter((w) => SCH.test(w) || /\\d/.test(w) || !VL.test(w) || dfN(w) > 5); if (keep.length && keep.length < ws.length) q = keep.join(" "); }
    }
    let r = searchOnce(q, false), weak = false;
    if (!r.length && /학비|등록금|수업료|입학금|무상교육/.test(String(q))) { const q2 = String(q).split(/\s+/).filter((w) => !/^(고등학교|중학교|고교)$/.test(w)).join(" "); if (q2) r = searchOnce(q2, false); } /* 학교급 낱말 때문에 비는 학비 질문은 유형별 학비·비용으로 */
    if (!r.length && String(q).trim().includes(" ")) { r = searchOnce(q, true); weak = r.length > 0; }
    if (weak && forceCands.length) { const GEN = /^(고등학교|중학교|고교|학교|제도|관련|정보|내용)$/, alt = forceCands.flatMap((c0) => { const qf = cleanQuery(romanize(c0)); return [qf, qf.split(/\s+/).filter((w) => !GEN.test(w)).join(" ")]; }).map((x) => searchOnce(x, false)).find((x) => x.length); if (alt) { r = alt; weak = false; } } // 느슨한 결과뿐이면, 붙여 쓴 낱말을 띄운 질의가 정확히 맞는 행을 찾는지 본다
    r = reweight(r, q);
    // 학교 이름과 앞부분이 맞는 말이 있으면(예: 상현중) 그 학교를 맨 위에 두고, 이름이 다른 학교(상현고 등) 행은 걷어 낸다
    const words = String(q).split(/\s+/).map(norm).filter((t) => t.length >= 2 && !STOP.has(t));
    const toks0 = words.filter((t) => t.length >= 3);
    // 학교 이름 판정 우선순위: 정식 이름 정확 일치 > 별칭 정확 일치 > 접두 일치. 접두 일치가 둘 이상이면 어느 쪽도 확정하지 않고 후보로 보여 준다(용인고 ↔ 용인고림고 같은 충돌)
    const tierOf = (x, t) => (norm(x.name) === t ? 1 : schoolAliases(x.name).includes(t) ? 2 : schoolAliases(x.name).some((a) => a.startsWith(t)) ? 3 : 9);
    const exMap = new Map(), ambig = [];
    for (const t of toks0) { const c = data.places.map((x) => [x, tierOf(x, t)]).filter(([, k]) => k < 9); if (!c.length) continue; const b = Math.min(...c.map(([, k]) => k)), hs = c.filter(([, k]) => k === b).map(([x]) => x); if (b === 3 && hs.length > 1) ambig.push([t, hs]); for (const x of hs) exMap.set(x.id, x); }
    const ex = [...exMap.values()];
    const notes = [];
    if (words.includes("서울") && !ex.length) { // 서울 + 학교 이름(○○고): 서울 고입 데이터에 그 학교가 있으면 그 행을 먼저(예: 서울 하나고 → 서울 후기 일정 행)
      const stoks = words.filter((t) => /고$/.test(t) && t.length >= 3 && !t.startsWith("서울")), body = (x) => norm(`${x.t} ${x.s} ${x.x || ""}`);
      const cands = stoks.length ? r.flatMap(([, l]) => l).filter((x) => /서울/.test(body(x)) && stoks.some((t) => body(x).includes(t))).slice(0, 3) : [];
      if (cands.length) { weak = false; r = [["서울 고입", cands], ...r.map(([h, l]) => [h, l.filter((x) => !cands.includes(x))]).filter(([, l]) => l.length)]; }
    }
    if (!ex.length && /학생수|학급수|학급|교원|급식|매점|주소|전화|홈페이지|교복|편제표|방과후|특색|학비|진학|설명회|모집/.test(String(q0)) && !String(q0).split(/\s+/).some((w) => /([초중고]|학교|초등|중학|고등|고교)$/.test(w))) { // 학교급 없이 이름만(서원·홍천): 같은 이름 학교가 둘 이상이면 한 학교로 단정하지 않고 후보를 보여 준다
      const coreOf = (x) => norm(x.name).replace(/(초등학교|중학교|고등학교)$/, "").replace(/^용인/, "");
      for (const t of words) { if (t.length < 2 || SKIP_GEN.test(t)) continue; const same = data.places.filter((x) => coreOf(x) === t); if (same.length >= 2) notes.push({ href: "#select/curriculum?v=map", t: `${t} 후보`, s: `'${t}'은(는) 학교가 여러 곳이에요: ${same.map((x) => x.name).join(" / ")} → 학교급을 붙여 다시 물어 주세요(예: ${t}${same[0].level === "middle" ? "중" : same[0].level === "high" ? "고" : "초"})` }); }
    }
    if (ex.length) {
      const keys = toks0.filter((t) => ex.some((x) => norm(x.name).startsWith(t)));
      const otherToks = words.map(norm).filter((w) => w.length >= 2 && !keys.some((k) => k.includes(w) || w.includes(k))); // 학교 이름 말고 남은 낱말(매점·교복…)이 제목에 든 문서를 앞에
      r = r.map(([h, l]) => [h, h === "학교" ? l : l.filter((x) => keys.some((k) => norm(x.t + " " + x.s + " " + (x.sch || "")).includes(k))).map((x, i) => ({ x, i, c: otherToks.filter((w) => norm(x.t).includes(w)).length })).sort((a, b) => b.c - a.c || a.i - b.i).map((o) => o.x)]).filter(([, l]) => l.length);
      r = [["학교", ex.map((x) => ({ href: `#select/curriculum?v=map&lv=${x.level === "middle" || x.level === "elementary" ? x.level : "high"}&p=${encodeURIComponent(x.id)}`, t: x.name, s: `${x.level === "middle" ? "중학교" : x.level === "elementary" ? "초등학교" : "고등학교"} · ${x.address || ""}` }))], ...r.filter(([h]) => h !== "학교")];
      weak = false; // 학교 이름이 맞았으면 느슨한 매치가 아니다
      const rest = norm(q); // 학교 + 주제: 주제어에 맞는 화면을 같이 이어 준다
      const first = ex[0];
      for (const [t, hs] of ambig) notes.push({ href: "#select/curriculum?v=map", t: `${t} 후보`, s: `'${t}'(으)로 시작하는 학교가 여러 곳이에요: ${hs.map((x) => x.name).join(" / ")} → 학교 이름을 정확히 입력해 주세요` });
      for (const [re, label, fn, onlyLv] of ambig.length ? [] : TOPICS) if (re.test(q0) && (!onlyLv || first.level === onlyLv) && !notes.some((n) => n.t === `${first.name} · ${label}`) && !(p && /설명회/.test(label))) {
        const say = sayOf(label, first), href = label === "설명회 노트" ? (fn ? fn(first) : null) : say?.href || null; // 문구는 search-claims.js의 대응표(도착 화면에 실제로 있는 값)
        if (/몇 ?명/.test(q0) && label === "모집 인원" && !/모집 ?인원|정원/.test(q0)) continue; // '서울대 몇 명'은 진학 현황 질의 — 모집 인원 안내가 가리지 않는다
        const ui = label === "대학 진학 현황" ? univInfo.get(first.id) : null; // 값이 비어 있는 학교는 화면의 빈 칸 사유 그대로
        if (ui && !ui.has) { notes.push({ href, t: `${first.name} · ${label}`, s: `${ui.why || "비교 화면의 이 칸은 비어 있어요"} (고교 보기 비교표의 빈 칸 사유)` }); continue; }
        if (label === "설명회 노트") { notes.push(href ? { href, t: `${first.name} · ${label}`, s: "학교 보기 화면에서 설명회 노트를 볼 수 있어요" } : { href: "#library/links", t: `${first.name} · ${label}`, s: noneText(label, first.level) }); continue; }
        notes.push(href && say ? { href, t: `${first.name} · ${label}`, s: say.text + (label === "학교군" && first.level === "elementary" && elemZone.get(first.id) ? ` — ${first.name.replace(/등학교$/, "")}는 ${elemZone.get(first.id)}${/공동학군$/.test(elemZone.get(first.id)) ? "이에요" : "이에요"}` : "") } : { href: "#library/links", t: `${first.name} · ${label}`, s: say?.none || noneText(label, first.level) });
      }
      if (/용인한국외국어/.test(rest)) notes.push({ href: "#select/curriculum?v=types", t: "용인외대부고(자율형 사립고)", s: "외·국·자 전형 일정과 유형 설명은 고교 종류 화면에 있어요" });
    } else {
      // 목록에서 찾지 못한 학교 이름(예: 죽전중·풍덕중): 학교 이름 모양의 낱말이 어떤 학교 이름과도 안 맞으면 알려 준다
      const LV = { 중: ["middle", "중학교"], 고: ["high", "고등학교"], 초: ["elementary", "초등학교"] };
      for (const t of words) { const m = /^([가-힣]{2,5})(중학교|고등학교|초등학교|중|고|초)$/.exec(t); if (!m || /(신고|공고|광고|보고|통고|예고|사고|경고|출고|원고|항고|상고|신초|최초|개중|도중|기중|동중|전입신고)$/.test(t) || /^(언제|어디|어느|무엇|뭐|누구|얼마|어떻|어떤|이러|그러|저러|이래|그래|저래|아니|또는|그리|하지|되지|있지|없지|이고|그리고)$/.test(m[1]) || /(하|되|싶|있|없|보|알|해|서|가|오|나|내|주|받|쓰|열|떨|들|살|찾|맞|넣|놓|같|끝|돌|걸|골|르|리|아|어|지|자|다|라|네|죠|누|뀌|꾸|추|우|치|키|끄|뜨|크|트|프|요|면|며|니|까|게|듯|던|든|는|은|을|를)$/.test(m[1]) || /^(자공|자율|자사|일반|특성화|마이스터|자사|외|국제|과학|영재|예술|체육|특목|자율|자율형|자율형공립|자율형사립|공립|사립|전기|후기|평준화|비평준화|외국어|명문|상위|진학|입시|특수|대안|각종|모든|우리|근처|인근|다른|광역|지역|학군|중학|고등|초등|특성화|연합|통합)$/.test(m[1])) continue; const lv = LV[m[2][0]]; if (!lv || SYN.some((g) => g.includes(t)) || data.guide.some((g) => !g.q && ng(g).includes(norm(t))) || data.policy.some((r) => nr(r).includes(norm(t))) || data.places.some((x) => x.level === lv[0] && schoolAliases(x.name).some((a) => a.startsWith(t) || a.startsWith(m[1])))) continue;
        const all = data.places.filter((x) => x.level === lv[0]).map((x) => x.name.replace(/(중학교|고등학교|초등학교)$/, m[2][0])), names = all.slice(0, 40); // 31교 전체를 보여 준다
        notes.push({ href: `#select/curriculum?v=map`, t: `${t}${(t.charCodeAt(t.length - 1) - 0xac00) % 28 ? "은" : "는"} 포털의 학교 목록에서 찾지 못했어요`, s: `있는 ${lv[1]} ${all.length}곳: ${names.join("·")} → 학교 지도나 학교알리미에서도 찾아 보세요` }); weak = true; break; }
    }
    { // 과목 이름을 묻는 말(화학·확률과 통계·정보 과목…)은 과목 카드를 맨 위에(내신 평가계획 등 소음보다 먼저)
      const SUBGEN = /^(과목|설명|소개|내용|수업|뭐|무엇|어떤|뜻|의미|특징|유형|종류|구분|어느|들어|배우|배워|공부|과목이|과목은)$/;
      const rawN = norm(String(q0).replace(/[?？!！.,~]/g, " ").split(/\s+/).filter((w) => w && !SUBGEN.test(norm(w)) && !VERB_ONLY.test(w)).join(" ")), nn = norm(String(q).split(/\s+/).filter((w) => !SUBGEN.test(norm(w))).join(" "));
      if (nn.length >= 2) { const exact = data.subjects.filter((x) => [rawN, nn].some((k) => norm(x.name) === k || norm(x.name).replace(/과$/, "") === k.replace(/과$/, ""))).slice(0, 3); if (exact.length) { const cards = exact.map((x) => ({ href: `#select/curriculum?v=compare`, t: x.name, s: `${x.area || ""} · ${(x.summary || "").slice(0, 70)}` })); r = [["과목", cards], ...r.filter(([h]) => h !== "과목")]; } }
    }
    if (/지도/.test(String(q))) { const i = r.findIndex(([h]) => h === "화면"); if (i > 0) r.unshift(...r.splice(i, 1)); } // 화면 이름을 찾는 말이면 화면을 먼저
    const nrq = norm(String(q0).replace(/[?？!！.,~]/g, " ")), nameHits = data.links.filter((x) => { const nn = norm(x.name); return (nn.length >= 3 && nrq.includes(nn) && !/학교 홈페이지/.test(x.name)) || (x.url && /satp|adiga|schoolinfo/.test(x.url) && new RegExp(x.url.match(/(satp|adiga|schoolinfo)/)[1]).test(nrq)); }); // 외부 링크 이름이 질의에 있으면 그 링크를 바로 보여 준다
    if (nameHits.length) weak = false;
    if (p) weak = false; // 바로 안내(GAP)가 있으면 느슨한 매치 배너를 내지 않는다
    let strongTop = false;
    if (weak && !notes.length) { // 약한 매치 판정: 데이터 어디에도 없는 핵심어가 있는지(missing)와 가장 잘 맞는 행의 낱말 일치로 정한다
      const dfc0 = (w) => { data.dn ||= data.policy.map((x) => nr(x)).concat(data.guide.map((g) => ng(g))); return data.dn.filter((d) => tokIn(w, d)).length; };
      const core = String(q).split(/\s+/).map(norm).filter((w) => w && !STOP.has(w) && !STOP2.has(w) && !/^(일정|방법|안내|기간|날짜|기준|절차|언제|신청|정보|기재|차이|비교|뜻|의미)$/.test(w) && !/(라면|으면|이면|하면|려면|하고|해서|가능|장)$/.test(w) && !(/(면|니|죠|며|지|어|아|해|한|된|는|은|던|려|러|야|라|래|네|까|게|같|많|좋)$/.test(w) && dfc0(w) <= 5));
      const cover = (x) => core.filter((w) => expand(w).some((v) => norm(x.t + " " + x.s).includes(v))).length;
      const cands = r.filter(([h]) => h === "일정·제도" || h === "가이드·용어").flatMap(([, l]) => l.slice(0, 8));
      const best = Math.max(0, ...cands.map(cover));
      data.dn ||= data.policy.map((x) => nr(x)).concat(data.guide.map((g) => ng(g)));
      const dfc = (w) => data.dn.filter((d) => tokIn(w, d)).length;
      const missing = core.filter((w) => dfc(w) === 0);
      const covers1 = (x, w) => expand(w).some((v) => norm(x.t + " " + x.s).includes(v));
      const uncov = core.filter((w) => { const d = dfc(w); return d > 0 && d <= 40 && !cands.some((x) => covers1(x, w)); }); // 드문(구체적인) 낱말인데 어떤 후보 행에도 없음
      strongTop = (core.length >= 3 && !missing.length && !uncov.length && best >= core.length - 1) || (core.length >= 2 && !missing.length && best >= core.length); /* 빠진 낱말 없이 1위 후보가 거의 다 맞으면(핵심어가 둘이면 모두 맞을 때) 배너를 정답 행 뒤로 */
      if (globalThis.__SDBG) console.log("DBG", { core, missing, uncov, best, cands: cands.length });
      if (core.length >= 2 && !missing.length && uncov.length <= (core.length >= 4 ? 1 : 0) && best >= Math.ceil(core.length * 0.5) || core.length === 1 && best >= 1) { weak = false; r = r.map(([h, l]) => [h, l.slice(0, 5)]); }
      else if (core.length >= 2 && (missing.length || uncov.length) && best <= 1) { // 핵심어가 데이터에 없고 맞은 건 흔한 낱말뿐이면(동아리 활동·학교 평균 등급) 무관 행 대신 안내 한 줄
        const DOMAIN = /^(배정|전형|입학|지원|접수|원서|등록|고입|중입|대입|수능|내신|졸업|학점|과목|서류|준비물|설명회|교복|급식|학교군|지망|추첨|전학|이사|예비소집|교과서)$/;
        const hitDomain = core.some((w) => DOMAIN.test(w) && cands.some((x) => expand(w).some((v) => norm(x.t + " " + x.s).includes(v))));
        if (!hitDomain && !cands.length) { /* 데이터 어디에도 없는 핵심어가 있고 맞은 건 흔한 낱말뿐이면 다른 주제 행을 정답처럼 내지 않는다 */ r = [["안내", [{ href: "#library/links", t: "정확히 맞는 내용이 없을 수 있어요", s: "같은 낱말이 든 자료를 목록에서 찾지 못했어요 → 학교알리미(학교별 공시)나 해당 학교 누리집에서 확인해요" }]], ["공식 확인처", HELP.slice(1, 2).map(([n, u, d]) => ({ href: u, ext: true, t: n, s: d })).concat([{ href: "#select/curriculum?v=map", t: "학교 지도(학교 홈페이지·전화)", s: "학교 카드에서 학교 누리집으로 이어져요" }])]]; return r; }
      }
    }
    if (weak && r.some(([, l]) => l.some((x) => x.term && (() => { const raw = String(q0).split(/\s+/).map(norm).filter(Boolean), tn = norm(String(x.t).replace(/\s*\(용어\)\s*$/, "")); return raw.includes(tn) && tn.length >= 2 && raw.length <= 2 && raw.filter((w) => w !== tn).every((w) => r.some(([, l2]) => l2.some((y) => norm(`${y.t} ${y.s || ""}`).includes(w)))); })()))) weak = false; // 질의의 낱말 하나가 정확한 용어 행이면 "정확히 맞는 내용이 없을 수 있어요" 배너를 내지 않는다
    if (weak) { // 신뢰도 낮음: 안내를 먼저 내고 느슨한 결과는 최대 3행
      const flat = r.filter(([h]) => h !== "과목").flatMap(([h, l]) => l.map((x) => ({ ...x, _g: h }))).slice(0, 3);
      { const bn = ["안내", [{ href: "#library/links", t: "이 포털에 정확히 맞는 내용이 없을 수 있어요", s: "아래는 낱말 일부만 맞는 비슷한 화면이에요 → 정확한 내용은 공식 안내(교육청·학교알리미·대입정보포털)에서 확인해요" }, ...notes]], sm = flat.length ? [["비슷한 화면", flat]] : []; r = [...(strongTop ? [...sm, bn] : [bn, ...sm]), ["공식 확인처", HELP.slice(0, 3).map(([n, u, d]) => ({ href: u, ext: true, t: n, s: d }))]]; }
    } else if (notes.length) r = [["안내", notes], ...r];
    if (p || any) r = r.map(([h, l]) => (["과목", "학교", "바로가기"].includes(h) ? [h, l.slice(0, 3)] : [h, l]));
    if (!p && /(뜻|의미|란|이란|뭐예요|뭔가요|무엇|설명|줄임말|약자|약어|역할)/.test(q0)) { // 낱말 뜻을 묻는 말은 용어 풀이를 맨 위에
      const need = norm(String(q).split(/\s+/).filter((w) => !/^(뜻|의미|란|이란|뭐|무엇|설명|줄임말|약자|약어|역할|의|은|는)$/.test(w)).join(""));
      const tm = need.length >= 2 ? data.guide.filter((g) => g.term && norm(g.t.replace(/ \(용어\)$/, "")) === need).slice(0, 1) : [];
      if (tm.length) { weak = false; r = [["바로 안내", tm.map((g) => ({ href: "#home", term: g.term, t: g.t, s: g.s || "" }))], ...r.filter(([h]) => h !== "바로 안내")]; }
    }
    r = r.map(([h, l]) => { const seen = new Set(); return [h, l.filter((x) => { const k = x.t.replace(/ⓘ/g, "").trim() + (h === "일정·제도" || h === "가이드·용어" ? "" : "|" + x.href); if (seen.has(k)) return false; seen.add(k); return true; })]; }); // 같은 제목·주소 결과는 한 번만(배정부터 등록까지 4중복 등)
    if (nameHits.length) { r = [["바로가기", nameHits.slice(0, 3).map((x) => ({ href: x.url, ext: true, t: x.name, s: `${x.org} · ${x.purpose}` }))], ...r.filter(([h]) => h !== "바로가기" && h !== "안내" && h !== "공식 확인처" && h !== "비슷한 화면")]; }
    if (!p && !nameHits.length && !weak) { /* 관련성 문턱: 질의의 날짜·숫자 낱말이 1위 행 어디에도 없으면 다른 날짜/주제 행을 정답처럼 내지 않고 "자료 없음"으로 */
      const ct = String(q).split(/\s+/).map(norm).filter((w) => w.length >= 2 && !/^(일정|방법|안내|기간|날짜|정보|신청|기준|절차|차이|비교|뜻|의미|종류|구분)$/.test(w));
      const top = r.find(([h]) => h === "일정·제도" || h === "가이드·용어")?.[1]?.[0];
      if (top && ct.length >= 2 && !top.term) { const tx = norm(top.t + " " + top.s + " " + (top.x || "")); const nums = ct.filter((w) => /^\d{4}\.\d{1,2}\.\d{1,2}$|^\d{1,2}\.\d{1,2}$/.test(w)); if (nums.some((w) => !tokIn(w, tx)) || (ct.includes("대학") && ct.some((w) => /기숙사|급식|교복|체육복|통학|방과후/.test(w)) && /v=(hs|middle)|&g=/.test(top.href))) r = []; }
    }
    if (!r.length && !p) r = [["안내", [{ href: "#library/links", t: "정확히 맞는 내용이 없을 수 있어요", s: "같은 낱말이 든 자료를 목록에서 찾지 못했어요 → 학교알리미(학교별 공시)나 교육청·학교 누리집에서 확인해요" }]], ["공식 확인처", HELP.slice(1, 2).map(([n, u, d]) => ({ href: u, ext: true, t: n, s: d }))]];
    if (p && p.after) { const rest2 = r.map(([h, l]) => [h, l.filter((x) => !p.list.some((y) => y.t === x.t))]).filter(([, l]) => l.length); r = [...(p.list.length ? [["바로 안내", p.list]] : []), ...rest2.slice(0, 1), ["안내", [p.after]], ...rest2.slice(1)]; /* 학교급·시험 낱말이 있으면 그 주제 첫 묶음 바로 아래에 고입 안내 */ } else if (p) r = [["바로 안내", p.list], ...r.map(([h, l]) => [h, l.filter((x) => !p.list.some((y) => y.t === x.t))]).filter(([, l]) => l.length)];
    return r;
  };
  const search = (q) => { /* 날짜·기간 질의는 본문에 그 날짜가 든 정책 행을 위로(어느 경로로 결과가 만들어졌든) */
    q = normKoQuery(q);
    { /* 이름 형태 통일: 학교 표시 이름이 '홍천고등학교'인 학교를 '용인홍천고(등학교)'로 불러도 같은 이름으로 바꿔 같은 값 행이 나오게 */
      if (!data.aliasMap) { const m = []; for (const pl of data.places) { if (pl.name.startsWith("용인")) continue; for (const a of schoolAliases(pl.name)) if (a.startsWith("용인") && a !== norm(pl.name) || a === "용인" + norm(pl.name)) m.push([a, pl.name]); } data.aliasMap = m.sort((x, y) => y[0].length - x[0].length); }
      for (const [a, nm] of data.aliasMap) { const re = new RegExp(a.split("").join("\\s*"), "g"); if (re.test(q)) q = q.replace(re, nm); }
    }
    let r = search0(q);
    { /* 질의의 날짜·기간(2028.1.3~1.6, 9.24~12.20, 1.10~17)이 본문에 글자 그대로 든 정책 행은 순위와 상관없이 위로 올린다. '찾지 못했어요'는 그런 행이 정말 없을 때만 낸다 */
      const shown = new Set(data.policy.map((x) => x.id)), dr = dateRows(normDates(q), data.policyAll || data.policy); /* 현재 학년 화면에 안 나오는 행 */  /* 현재 학년 화면에 안 나오는 행(2028학년도 참고 등)도 본문 내용은 알려 주되 그 행으로는 연결하지 않는다 */  if (dr.length && dr.pure && r.some(([h]) => h !== "안내" && h !== "공식 확인처" && h !== "비슷한 화면") && !(r[0] && r[0][0] === "안내")) { /* 날짜만 묻는 말인데 이미 일반 결과가 있으면 날짜가 든 행을 그 일정·제도 묶음 맨 앞에 끼워 넣는다(기존 결과는 유지) */ const have = new Set(dr.slice(0, 3).map((x) => x.row.title)), add = dr.slice(0, 3).map((x) => ({ href: withHl(routeOf(x.row), !shown.has(x.row.id) || NO_HL.has(x.row.id) ? null : evHlFor(x.row, q)), t: x.row.title, x: x.row.body, s: clip(x.row.body || "", 90), inline: !shown.has(x.row.id) || NO_HL.has(x.row.id) })); const k = r.findIndex(([h]) => h === "일정·제도"); r = [["일정·제도", add], ...r.map(([h, l]) => [h, l.filter((y) => !have.has(y.t))]).filter(([, l]) => l.length)]; } else if (dr.length && !dr.pure && r.some(([h]) => h !== "안내" && h !== "공식 확인처" && h !== "비슷한 화면") && !(r[0] && r[0][0] === "안내")) { /* 날짜 말고 다른 낱말도 있고 이미 답이 나왔으면 날짜 행은 뒤에 덧붙이기만 */ const have = new Set(r.flatMap(([, l]) => l.map((y) => y.t))), add = dr.filter((x) => !have.has(x.row.title)).map((x) => ({ href: withHl(routeOf(x.row), !shown.has(x.row.id) || NO_HL.has(x.row.id) ? null : evHlFor(x.row, q)), t: x.row.title, x: x.row.body, s: clip(x.row.body || "", 90), inline: !shown.has(x.row.id) || NO_HL.has(x.row.id) })); if (add.length) { const k = r.findIndex(([h]) => h === "일정·제도"); if (k >= 0) r[k] = [r[k][0], [...r[k][1], ...add.slice(0, 2)]]; } } else if (dr.length) { const banner = (h, l) => h === "안내" && l.some((x) => /정확히 맞는 내용이 없을 수 있어요/.test(x.t || "")); r = [["일정·제도", dr.map((x) => ({ href: withHl(routeOf(x.row), !shown.has(x.row.id) || NO_HL.has(x.row.id) || x.row.topic === "profile-2033" ? null : x.row.title), t: x.row.title, x: x.row.body, s: clip(x.row.body || "", 120), inline: !shown.has(x.row.id) || NO_HL.has(x.row.id) })).concat((r.find(([h]) => h === "일정·제도")?.[1] || []).filter((y) => !dr.some((x) => x.row.title === y.t)).slice(0, 4))], ...r.filter(([h, l]) => h !== "일정·제도" && h !== "비슷한 화면" && !banner(h, l))]; } }
    if (r.length && r.every(([h]) => h === "안내" || h === "공식 확인처" || h === "비슷한 화면") && r.some(([h, l]) => h === "안내" && l.some((y) => /목록에서 찾지 못했어요|정확히 맞는 내용이 없을 수 있어요/.test(`${y.t} ${y.s}`)))) { /* 질의의 내용어(안내어 제외)를 '모두' 담은 용어·정책 행이 있으면 그것이 정답이다: 배너를 걷고 그 행을 앞세운다(정식 명칭·역할·쉽게 설명·시청·총원·마감 시간 같은 말투 낱말은 내용어가 아니다) */
      const FILL = /^(정식|명칭|이름|역할|뭐|무엇|뜻|풀이|설명|쉽게|시청|총원|전체|몇|몇시|시간|내는데|내는|어떻게|알려|해줘|해주세요|어디|언제|며칠|얼마|방법|하는|있나|인가|이에요|예요|해요|관련|대한|에서|으로|하면|되나|되는|건가|건지|뭔가)/;
      const stems = [...new Set(cleanQuery(String(q)).split(/\s+/).map((w) => norm(w).replace(/(인가요|인가|일까요|일까|이에요|예요|인지|인데|은|는|이|가|을|를|의|에|도)$/, "")).filter((w) => w.length >= 2 && !FILL.test(w) && !STOP.has(w) && !STOP2.has(w)))];
      if (stems.length >= 1 && stems.length <= 3 && stems.some((w) => w.length >= 4) && !stems.some((w) => /^[가-힣]{2,5}(초등학교|중학교|고등학교|초|중|고)$/.test(w)) && !/^[가-힣]{2,3}(구|동|시|군)$/.test(stems[0])) { /* 4자 이상 특이 낱말(대학수학능력시험·한국대학교육협의회·선복수지원)이 있을 때만 */
        const has = (txt) => stems.every((w) => txt.includes(w) || (w.length >= 3 && txt.includes(w.slice(0, -1)))), shown3 = new Set(data.policy.map((x) => x.id));
        const G2 = data.guide.filter((g) => !g.quiet && !g.gap && has(norm(`${g.t} ${g.text || ""}`))).slice(0, 3), P2 = (data.policyAll || data.policy).filter((x) => has(norm(`${x.title} ${x.body || ""}`))).slice(0, 3);
        if (G2.length || P2.length) r = [...(G2.length ? [["가이드·용어", G2.map((g) => (g.term ? { href: "#home", term: g.term, t: g.t, s: g.s || "" } : { href: g.hl === null ? g.href : withHl(g.href, g.hl || autoHl(g)), t: g.t, s: clip(g.s || g.text || "", 90) }))]] : []), ...(P2.length ? [["일정·제도", P2.map((x) => ({ href: withHl(routeOf(x), !shown3.has(x.id) || NO_HL.has(x.id) ? null : evHlFor(x, q)), t: x.title, x: x.body, s: clip(x.body || "", 90), inline: !shown3.has(x.id) || NO_HL.has(x.id) }))]] : []), ...r.filter(([h]) => h === "공식 확인처")];
      }
    }
    if (r.length && r.every(([h]) => h === "안내" || h === "공식 확인처" || h === "비슷한 화면") && r.some(([h, l]) => h === "안내" && l.some((y) => /목록에서 찾지 못했어요|정확히 맞는 내용이 없을 수 있어요/.test(`${y.t} ${y.s}`)))) { /* 배너(맞는 내용이 없을 수 있어요)가 1위인데 질의의 특이한 낱말(자료 8곳 이하에만 나오는 3자 이상 낱말)이 정책 본문·안내 색인에 실제로 있으면 그 행을 먼저 보여 준다. '찾지 못했어요'는 그런 행이 정말 없을 때만 남는다 */
      const pol = (data.policyAll || data.policy).map((x) => ({ x, n: norm(`${x.title} ${x.body || ""}`) })), gd = data.guide.filter((g) => !g.quiet && !g.gap).map((g) => ({ g, n: norm(`${g.t} ${g.text || ""}`) }));
      const all = [...new Set(cleanQuery(String(q)).split(/\s+/).map(norm).filter((w) => w.length >= 3 && !STOP.has(w) && !STOP2.has(w) && !/^\d+$/.test(w)))], df = (t) => pol.filter((p2) => p2.n.includes(t)).length + gd.filter((g2) => g2.n.includes(t)).length, toks = all.filter((t) => { const d = df(t); return d >= 1 && d <= 8; }), tight = new Set(all.filter((t) => { const d = df(t); return d >= 1 && d <= 3; }));
      const hitsP = pol.map(({ x, n }) => ({ x, k: toks.filter((t) => n.includes(t)).length, k2: all.filter((t) => n.includes(t)).length })).filter((h) => h.k > 0).sort((a2, b2) => b2.k - a2.k || b2.k2 - a2.k2), hitsG = gd.map(({ g, n }) => ({ g, k: toks.filter((t) => n.includes(t)).length, k2: all.filter((t) => n.includes(t)).length })).filter((h) => h.k > 0).sort((a2, b2) => b2.k - a2.k || b2.k2 - a2.k2);
      const bestK = Math.max(0, ...hitsP.map((h) => h.k), ...hitsG.map((h) => h.k)), shown2 = new Set(data.policy.map((x) => x.id));
      if (all.length <= 3 && tight.size >= 1 && [...hitsP, ...hitsG].some((h) => h.k2 >= 2 && [...tight].some((t) => norm(h.x ? `${h.x.title} ${h.x.body || ""}` : `${h.g.t} ${h.g.text || ""}`).includes(t)))) { const has2 = (h) => h.k2 >= 2 && [...tight].some((t) => norm(h.x ? `${h.x.title} ${h.x.body || ""}` : `${h.g.t} ${h.g.text || ""}`).includes(t)), P = hitsP.filter(has2).slice(0, 3), G = hitsG.filter(has2).slice(0, 3);
        r = [...(P.length ? [["일정·제도", P.map(({ x }) => ({ href: withHl(routeOf(x), !shown2.has(x.id) || NO_HL.has(x.id) ? null : x.title), t: x.title, x: x.body, s: clip(x.body || "", 90), inline: !shown2.has(x.id) || NO_HL.has(x.id) }))]] : []), ...(G.length ? [["가이드·용어", G.map(({ g }) => (g.term ? { href: "#home", term: g.term, t: g.t, s: g.s || "" } : { href: g.hl === null ? g.href : withHl(g.href, g.hl || autoHl(g)), t: g.t, s: clip(g.s || g.text || "", 90) }))]] : []), ...r.filter(([h]) => h === "공식 확인처")]; }
    }
    { /* 약한 배너('낱말 일부만 맞는 비슷한 화면') 바로 아래 행이 질의의 내용어를 모두 담고 있으면 그것은 일부 일치가 아니라 정답이다: 배너를 걷고 그 행을 앞세운다 */
      const wk = r.findIndex(([h, l]) => h === "안내" && l.some((y) => /낱말 일부만 맞는 비슷한 화면/.test(y.s || ""))), sg = r.findIndex(([h]) => h === "비슷한 화면");
      if (wk >= 0 && sg >= 0) { const toks = cleanQuery(String(q)).split(/\s+/).map((w) => norm(w).replace(/(인가요|인가|일까요|일까|이에요|예요|인지|인데)$/, "")).filter((w) => w.length >= 2 && !STOP.has(w) && !STOP2.has(w)); const full = toks.length >= 2 ? r[sg][1].find((y) => toks.every((w) => { const tx = norm(`${y.t} ${y.s || ""}`); return tx.includes(w) || (w.length >= 3 && tx.includes(w.slice(0, -1))); /* 어미가 붙은 꼴(필수인)은 앞 글자로 */ })) : null;
        if (full) r = [["바로 안내", [full]], ...r.filter(([h, l], i) => i !== wk && h !== "비슷한 화면"), ["가이드·용어", r[sg][1].filter((y) => y !== full)]].filter(([, l]) => l.length); }
    }
    if (/서울/.test(String(q)) && !/서울대|서울시립|서울과학|서울예|서울여|서울교|서울시/.test(String(q)) && /고입|일반고|외고|국제고|자사고|후기|전기|합격|등록|추가모집|배정|원서/.test(String(q)) && !/대학|입시|수능|수시|정시|중학|초등/.test(String(q))) { /* 서울 낱말이 있는 고입 질의: 제목이 '서울'로 시작하는 서울 행을 경기 행보다 앞에 */
      const sl = []; r = r.map(([h, l]) => [h, l.filter((y) => { if (/^서울/.test(y.t || "") && !y.term) { sl.push(y); return false; } return true; })]).filter(([, l]) => l.length);
      if (sl.length) { const k = r.findIndex(([h]) => h !== "바로 안내" && h !== "안내"); const g = ["일정·제도", sl]; r = k < 0 ? [...r, g] : [...r.slice(0, k), g, ...r.slice(k)]; if (r[0][0] === "바로 안내" && /경기/.test(r[0][1][0]?.t || "")) { const first = r.shift(); r.splice(1, 0, first); } }
    }
    { /* 이미 만들어진 결과(안내 행 포함)의 hl이 일정 여러 건인 정책 행의 제목이면 질의에 맞는 일정 줄로 바꾼다 */
      const byTitle = new Map(data.policy.filter((x) => (x.events || []).length >= 2).map((x) => [x.title, x]));
      r = r.map(([h, l]) => [h, l.map((y) => { const m = /([?&])hl=([^&]*)$/.exec(y.href || ""); if (!m) return y; let t0; try { t0 = decodeURIComponent(m[2]); } catch { return y; } const row = byTitle.get(t0) || (t0.length >= 8 ? [...byTitle.values()].find((x) => x.title.startsWith(t0)) : null); if (!row) return y; t0 = row.title === t0 ? t0 : t0; const nh = evHlFor(row, q); return nh === row.title ? y : { ...y, href: y.href.replace(/([?&]hl=)[^&]*$/, "$1" + encodeURIComponent(nh)) }; })]);
    }
    { /* 용인 학교 표 안내('고교 31곳'·'중학교 13곳')에 용인 표기가 없으니, 질의에 다른 지역 낱말이 있으면 용인 기준 표임을 밝힌다 */
      const rw = REGION_WORDS.find((x) => new RegExp("(?<![가-힣(])" + regionFindPattern(x)).test(String(q).toLowerCase().replace(/\s+/g, " ")));
      if (rw) { const jo = (rw.charCodeAt(rw.length - 1) - 0xac00) % 28 ? "은" : "는"; r = r.map(([h, l]) => [h, l.map((x) => (/(고교|중학교|학교) ?\d+곳/.test(x.s || "") && !x.inline && !/용인 기준 표/.test(x.s) ? { ...x, s: `${x.s} — 용인 기준 표예요(${rw}${jo} 이 표에 없어요)` } : x))]); }
    }
    if (/풀이|뜻풀이|정의|개념|뜻|의미|란|이란/.test(String(q))) { /* 용어 풀이 질의: 질의에 용어 이름이 그대로 든 용어 행이 있으면 그 행을 맨 위에 두고 '맞는 내용이 없을 수 있어요' 배너·비슷한 화면은 걷는다 */
      const nq = norm(String(q)), terms = data.guide.filter((g) => g.term).map((g) => ({ g, nm: norm(String(g.t).replace(/ \(용어\)$/, "")) })).filter((x) => x.nm.length >= 2 && nq.includes(x.nm)).sort((a, b) => b.nm.length - a.nm.length);
      if (terms.length) { const g = terms[0].g; r = [["가이드·용어", [{ href: "#home", term: g.term, t: g.t, s: g.s || "" }]], ...r.map(([h, l]) => [h, l.filter((y) => y.t !== g.t)]).filter(([h, l]) => l.length && h !== "비슷한 화면" && !(h === "안내" && l.some((y) => /정확히 맞는 내용이 없을 수 있어요/.test(y.t || ""))))]; }
    }
    { /* 외대부고(자율형 사립고)의 합격자 발표·일정·원서 질의: 평준화 일반고 배정이 아니라 외·국·자 전형 일정 행을 먼저, 대학 진학 현황 행은 뒤로 */
      if (/외대부고|외국어대학교부설|외대부설/.test(String(q)) && /합격|발표|일정|원서|접수|면접|전형|언제/.test(String(q)) && !/진학|대학|입결/.test(String(q))) {
        const ph = data.policy.find((x) => x.title === "경기 외고·국제고·자사고 전형 일정");
        if (ph) { const mine = { href: withHl(routeOf(ph), ph.title), t: ph.title, x: ph.body, s: clip(ph.body || "", 90) }; r = [["일정·제도", [mine, ...(r.find(([h]) => h === "일정·제도")?.[1] || []).filter((y) => y.t !== ph.title && !/^경기 후기 평준화 일반고 배정 발표/.test(y.t))]], ...r.filter(([h]) => h !== "일정·제도" && h !== "바로 안내").map(([h, l]) => [h, l.filter((y) => !/ · 대학 진학 현황$/.test(y.t))]).filter(([, l]) => l.length)]; }
      }
    }
    { /* 대학 이름 질의(한양대 논술 전형·카이스트 학종 일정): 대학 요건 행을 맨 위로. 한국외대·외대는 용인외대부고가 아니라 한국외국어대학교 */
      const um = UNIV_ALIAS.find(([, al]) => al.some((a) => new RegExp("(?<![가-힣])" + a + (a === "외대" ? "(?!부|고)" : "")).test(String(q))));
      if (um) {
        const ur = data.guide.find((g) => String(g.t).startsWith(um[0] + " · 과목 요건"));
        const noSchool = /^(한국외대|외대)/.test(um[1][0]) && !/부고|부설|부속|고등학교|외대고/.test(String(q));
        if (ur) { r = r.map(([h, l]) => [h, l.filter((y) => y.t !== ur.t && !(noSchool && /^용인한국외국어대학교부설고등학교|^용인외대부고/.test(y.t || "")))]).filter(([, l]) => l.length); const grp = ["대학 요건", [{ href: ur.href, t: ur.t, s: ur.s || "" }]], k = r.findIndex(([h]) => h !== "바로 안내" && h !== "안내" && h !== "바로가기"); r = k < 0 ? [...r, grp] : [...r.slice(0, k), grp, ...r.slice(k)]; /* 바로 안내·안내(없음 안내 포함)는 그대로 두고 그 아래 첫 자리에 */ }
      }
    }
    return r;
  };
  return { setData: (d) => { data = d; }, search };
}

export function mountSearch(btn, { load, store, esc }) {
  let box = null, data = null, loading = null, last = null;
  const S = makeSearcher(store), search = S.search; // 점수·순위 계산은 makeSearcher(브라우저 없이도 돌아감: tools/pm/searchgold.py)
  const prep = () => (loading ??= Promise.all([load("policy"), load("summary"), load("links").catch(() => ({ items: [] })), load("subject-info").catch(() => ({ subjects: [] })), load("places").catch(() => ({ places: [] })), loadSearchExtra(load).catch(() => [])]).then((parts) => { data = buildSearchData(parts, store); S.setData(data); }));
  const recent = () => store.get(RECENT_KEY, []);
  const remember = (q) => { if (q.trim().length < 2) return; store.set(RECENT_KEY, [q.trim(), ...recent().filter((x) => x !== q.trim())].slice(0, 6)); };

  const item = (x) => x.term ? `<li><a href="#" data-term="${esc(x.term)}" data-go><b>${esc(x.t)}</b><span>${esc(x.s)}</span></a></li>` : `<li><a href="${esc(x.href)}"${x.ext ? ' target="_blank" rel="noopener"' : ""} data-go><b>${esc(x.t)}${x.ext ? " ↗" : ""}</b><span>${esc(x.inline && x.x ? String(x.x).slice(0, 260) : x.s)}</span></a></li>`; /* 도착 화면에 그 행이 따로 그려지지 않는 행(2028 참고·2033 전망 등)은 값이 결과에서 바로 보이게 본문을 더 보여 준다 */
  const paint = () => {
    const q = box.querySelector("input").value, out = box.querySelector(".sr-out");
    if (!q.trim()) { const r = recent(); out.innerHTML = r.length ? `<p class="sr-h">최근 검색</p><p class="sr-rec">${r.map((x) => `<button type="button" class="lnk" data-q="${esc(x)}">${esc(x)}</button>`).join("")}</p>` : '<p class="muted">일정, 학교, 과목, 용어를 찾아 보세요.</p>'; return; }
    const res = search(q);
    out.innerHTML = res.length ? res.map(([h, l]) => `<p class="sr-h">${h} <span class="muted">${l.length}</span></p><ul class="rows">${l.map(item).join("")}</ul>`).join("") : `<div class="empty"><p>정확히 맞는 내용을 찾지 못했어요.</p><small>다른 말로 다시 찾거나, 아래 공식 사이트·학교 공지에서 확인해 보세요.</small></div><p class="sr-h">문의처·공식 링크</p><ul class="rows">${HELP.map(([n, u, d]) => item({ href: u, ext: true, t: n, s: d })).join("")}<li><a href="#select/curriculum?v=map" data-go><b>학교 지도에서 학교 찾기</b><span>학교 홈페이지·전화는 학교 지도 카드에서 볼 수 있어요</span></a></li></ul>`;
  };
  const close = () => { if (!box) return; box.remove(); box = null; document.removeEventListener("keydown", onKey); btn.focus(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const open = async () => {
    if (box) return close();
    box = document.createElement("div"); box.className = "srch"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "검색");
    box.innerHTML = `<div class="sr-in"><div class="sr-bar"><input type="search" placeholder="예: 교복, 원서, 상현중, 평준화" aria-label="검색어" autocomplete="off"><button type="button" class="lnk" data-x>닫기</button></div><div class="sr-out" aria-live="polite"><p class="muted">불러오는 중…</p></div></div>`;
    document.body.appendChild(box); document.addEventListener("keydown", onKey);
    const inp = box.querySelector("input"); inp.focus();
    if (!data) box.querySelector(".sr-out").innerHTML = '<p class="muted" role="status">검색을 준비하고 있어요…</p>'; // 아직 불러오는 중이면 알린다
    await prep().catch(() => { box.querySelector(".sr-out").innerHTML = '<p class="note">정보를 못 가져왔어요. 잠시 뒤 다시 열어 주세요.</p>'; });
    if (!data) return;
    paint();
    inp.addEventListener("input", () => { clearTimeout(last); last = setTimeout(paint, 80); });
    box.addEventListener("click", (e) => {
      if (e.target.closest("[data-x]") || e.target === box) return close();
      const r = e.target.closest("[data-q]"); if (r) { inp.value = r.dataset.q; paint(); inp.focus(); return; }
      const tm = e.target.closest("[data-term]"); if (tm) { e.preventDefault(); remember(inp.value); const id = tm.dataset.term; close(); import("./glossary.js").then((m) => setTimeout(() => m.showTerm(id), 60)); return; }
      if (e.target.closest("[data-go]")) { remember(inp.value); setTimeout(close, 0); }
    });
  };
  btn.addEventListener("click", open);
  document.addEventListener("keydown", (e) => { if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !box) { e.preventDefault(); open(); } });
  return { warm: () => prep().catch(() => {}) }; // 한가할 때 데이터를 미리 불러 첫 검색을 빠르게
}
