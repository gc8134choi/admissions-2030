// 전체 검색: 헤더 돋보기 → 일정·제도, 학교, 과목, 바로가기, 화면을 한 번에 찾는다. 한글 부분 일치.
// 데이터는 처음 열 때 한 번에 병렬로 읽는다. 최근 검색은 이 브라우저(localStorage)에만 저장한다.
import { allItems } from "./nav-tree.js";
import { stageOf } from "./stage.js";
import { loadSearchExtra } from "./search-extra.js";
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
const ROUTE = {
  "exam-schedule": "#schedule?t=univ", "hs-schedule": "#schedule?t=hs", "gg-hs-entry": "#schedule?t=hs", "life-schedule": "#schedule?t=life",
  "change-log": "#changelog", "hs-types": "#select/types", "hs-choice-opinion": "#select/types", "high-school-assignment": "#select/types", "academy-material": "#admission/system",
  "curriculum-guide": "#life/credit", "hs-credit-system": "#life/credit",
};
// 날짜가 없는 경기 고입 행은 일정 화면에 없고 고교 유형 화면(접이식 안)에 있다
// 안내 문서 링크의 자동 강조 대상: 화면 전체로 가는 링크(지도·요약·대학 선택·계획표·출처·로드맵·용어)는 빼고, 그 밖의 문서는 제목(마지막 마디)으로 찾는다
const autoHl = (g) => { if (g.term || g.gap || !/^#/.test(g.href) || /v=map|v=summary|v=univ|^#home|^#planner|^#library\/(sources|links)|t=road|[?&]bf=|^#schedule$|#changelog/.test(g.href)) return null; const seg = String(g.t).split(" · ").pop(); return (seg.length >= 3 ? seg : g.t).replace(/\(.*$/, "").trim() || null; };
const NO_HL = new Set(["hs-11", "sch-04", "log-13", "b33-06"]); // 기본 화면에 행이 표시되지 않는 행(2033 대입 전망·학년 필터 등): 강조 없이 화면으로만 간다
const withHl = (href, t) => (!t || !/^#/.test(href) || /[?&]hl=/.test(href) ? href : href + (href.includes("?") ? "&" : "?") + "hl=" + encodeURIComponent(String(t).replace(/ⓘ/g, "").slice(0, 24))); // 검색에서 가면 그 행을 펴서 강조(hl.js)
const routeOf = (r) => (r.topic === "gg-hs-entry" && !(r.events && r.events.length) ? "#select/curriculum?v=hs&ty=1"
  : r.topic === "hs-schedule" && r.region === "seoul" ? "#schedule?t=hs&seoul=1" // 서울 행은 일정 화면에서 '서울 보기'를 켜야 보인다
  : ["cur-08", "cur-29", "cur-30", "sch-03"].includes(r.id) ? "#admission/system" // 수능·전형 구조 참고 행은 대입 제도 화면에 있다
  : /^(opn-0[124]|asg-07)$/.test(r.id) ? "#select/types" : r.id === "acd-04" ? "#select/types" // 진학 비율은 고교 유형의 학원 의견 구역에 있다
  : r.topic === "exam-schedule" && r.examYear && r.examYear !== 2030 ? "#admission/system" // 다른 학년도 참고 행은 대입 제도 화면에 있다
  : ROUTE[r.topic] || (r.topic.startsWith("admission") ? "#admission/system" : "#home"));

// 같은 뜻의 말(학부모가 쓰는 말 → 화면에 있는 말). 앞 말을 찾으면 뒤 말도 같이 찾는다.
const SYN = [["교과서", "검정교과서", "검정 교과서"], ["서성한", "서강대", "성균관대", "한양대"], ["중경외시", "중앙대", "경희대", "한국외대", "서울시립대"], ["서울대", "snu"], ["성균관대", "skku"], ["서울시립대", "uos"], ["포스텍", "postech", "포항공대", "포항공과대학교"], ["카이스트", "kaist", "한국과학기술원"], ["한양대", "한대"], ["중앙대", "중앙"], ["고입전형포털", "satp"], ["자유학기", "시험 안 보는 학기", "시험안보는학기"], ["kice", "평가원", "한국교육과정평가원"], ["설대", "서울대", "서울대학교"], ["연고대", "연세대 고려대"], ["지균", "지역균형", "지역균형전형"], ["논서술형", "서논술형", "서·논술형"], ["봉사활동", "봉사"], ["영재고", "영재학교"], ["자유학년제", "자유학기", "자유학기제", "자유학년"], ["sky", "스카이", "서울대", "연세대", "고려대"], ["과탐", "과학탐구"], ["사탐", "사회탐구"], ["전형유형", "전형 유형", "전형 구분", "전형유형 구분"], ["서연고", "서울대", "연세대", "고려대"], ["포스텍", "포항공과대학교", "포항공대"], ["외대", "한국외국어대학교", "한국외대"], ["창체", "창의적 체험활동", "창의적체험활동"], ["화작", "화법과 작문", "화법과작문"], ["언매", "언어와 매체", "언어와매체"], ["성대", "성균관대", "성균관대학교"], ["연대", "연세대", "연세대학교"], ["중대", "중앙대", "중앙대학교"], ["고대", "고려대", "고려대학교"], ["서울시립대", "시립대", "서울시립대학교"], ["시뮬레이션", "시뮬레이터"], ["심리학", "인간과 심리"], ["전후기", "전기 후기", "전기·후기"], ["급식", "점심", "점심 방식", "중식", "점심시간 식사"], ["다자녀", "세 자녀", "세자녀", "다둥이", "삼남매"], ["국영수", "국·수·영", "국수영"], ["예비소집", "예비소집일", "예비소집 날짜"], ["생활기록부", "학교생활기록부", "생기부", "학생부"], ["준비물", "서류", "원서"], ["원서", "원서접수", "접수", "지원"], ["상현", "상현중", "상현초", "상현고"], ["성복", "성복중", "성복초", "성복고"], ["설명회", "배정 설명회", "입학설명회"], ["배정", "평준화", "추첨", "배정원서"], ["수시", "학종", "학생부종합"], ["정시", "수능"], ["내신", "5등급", "성적"], ["학점", "학점제", "고교학점제"], ["통학", "거리", "지도"], ["특목", "과학고", "외고", "국제고", "자사고", "영재"], ["날짜", "일정", "시행", "언제"], ["합격", "배정", "추첨"], ["권장과목", "이수 권장", "전공 연계"], ["학생수", "학생 수", "인원"], ["선택과목", "탐구 선택", "문과 이과", "성향"], ["진학", "진학 현황", "합격 실적"], ["시험", "지필", "수행평가", "평가계획"], ["졸업식", "중학교 졸업", "초등학교 졸업"], ["외대부고", "외대부설", "한국외국어대학교부설", "한국외대부고"], ["수능일", "수능 날짜", "수능 시행일", "수능 시행"], ["졸업일", "졸업식", "중학교 졸업", "초등학교 졸업"], ["수능 시간", "시험시간", "시험 시간", "영역별 시간"], ["자유학기", "시험 없는 학기", "자유학년"], ["출결", "출결 감점", "출결 점수", "결석 감점"], ["학비", "수업료", "등록금", "비용", "가격", "낙찰가"], ["입학 서류", "준비물", "제출 서류", "서류"], ["카이스트", "한국과학기술원", "KAIST"], ["포스텍", "포항공과대학교", "포항공대"], ["서울대", "서울대학교"], ["연세대", "연세대학교"], ["고려대", "고려대학교", "고대"], ["서강대", "서강대학교"], ["성균관대", "성균관대학교", "성대"], ["한양대", "한양대학교"], ["중앙대", "중앙대학교"], ["경희대", "경희대학교"], ["외대", "한국외국어대학교", "한국외대"], ["시립대", "서울시립대학교", "서울시립대"]];
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
const UNIV_Q = /서성한|중경외시|서연고|연고대|설대|한대|서울대|연세대|고려대|서강대|성균관대|한양대|중앙대|경희대|외대|시립대|포스텍|카이스트|snu|skku|uos|kaist|postech/i;
const HELP = [["경기도교육청", "https://www.goe.go.kr", "도 단위 공지·고입 안내"], ["학교알리미", "https://www.schoolinfo.go.kr", "학교별 공시 정보"], ["대입정보포털 어디가", "https://www.adiga.kr", "대학 입시 정보"], ["고입 전형 포털(경기)", "https://www.satp.goe.go.kr", "경기 고입 원서·전형요강"]];

// 검색 데이터 구성(브라우저 밖에서도 같은 구조를 쓰도록 분리): [policy, summary, links, subject-info, places, extra] → data
export function buildSearchData([policy0, summary, links, si, pl, extra], store) {
  const policy = filterByProfile(policy0, loadProfile(store), { grade3: true }); /* 화면이 보여 주는 행만 검색 결과로(화면에 없는 행으로 링크되지 않게) */
  return { places: pl.places || [], guide: extra.map((d) => ({ t: d.t, text: d.text, href: d.href, from: "", sch: d.sch, s: d.s, q: d.q, only: d.only, gap: d.gap, hl: d.hl, term: d.term, quiet: d.quiet })), policy, summary, links: links.items || [], subjects: si.subjects || (Array.isArray(si) ? si : []) };
}
// 점수·순위 계산 전부. 브라우저(DOM) 없이 setData(data) 뒤 search(q)만 부르면 된다.
export function makeSearcher(store) {
  let data = null;
  let any = false;
  const STOP = new Set(["있는", "없는", "어떤", "어디", "언제", "얼마", "어떻게", "하는", "되는", "알려줘", "알려", "관련"]), STOP2 = new Set(["학교", "정보"]);
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
    const rows0 = data.policy.filter((r) => rowOk(r)), rowsStrict = rows0.filter((r) => hasN(nr(r))), rows = (rowsStrict.length ? rowsStrict : rows0).map((r) => ({ href: withHl(routeOf(r), NO_HL.has(r.id) || r.topic === "profile-2033" ? null : r.title), t: r.title, x: r.body, s: (r.body || "").slice(0, 90), sc: rank(r.title, r.body, r) + tokHit(r) + rareHit(r) + (hsQ && hsRow(r) ? 2 : 0) + regBoost(r) + dateHit(r) + yearHit(r) + (hasN(nr(r)) ? 0 : -8) })).sort((a, b) => b.sc - a.sc).slice(0, 12);
    const gd = data.guide.filter((g) => !g.quiet && hasN(ng(g))).map((g) => ({ sch: g.sch, href: g.hl === null ? g.href : withHl(g.href, g.hl || autoHl(g)), term: g.term, t: g.t, x: g.text, s: (g.s || (g.text.split(/(?<=[.。다요])\s/).find((x) => ks.some((w) => norm(x).includes(w))) || g.text)).slice(0, 80), sc: rank(g.t, g.text) })).sort((a, b) => b.sc - a.sc).slice(0, 8);
    const sch = data.summary.filter((m) => has(m.schoolName, m.region)).map((m) => ({ href: `#select/curriculum?v=summary&s=${m.schoolId}`, t: m.schoolName, s: `${m.creditsRequired}+${m.creditsElective}학점 · ${m.region}` }));
    const sub = (typeof UNIV_Q !== "undefined" && UNIV_Q.test(q0) ? [] : data.subjects).filter((x) => has(x.name, x.summary)).slice(0, 10).map((x) => ({ href: `#select/curriculum?v=compare`, t: x.name, s: `${x.area || ""} · ${(x.summary || "").slice(0, 70)}` }));
    const lk = data.links.filter((x) => has(x.name, x.purpose, x.org)).map((x) => ({ href: x.url, ext: true, t: x.name, s: `${x.org} · ${x.purpose}` }));
    const pages = allItems().filter((i) => has(i.title, i.tab, i.desc)).map((i) => ({ href: `#${i.id}`, t: i.title, s: i.tab }));
    const plc = data.places.filter((x) => has(x.name, x.address)).slice(0, 10).map((x) => ({ href: `#select/curriculum?v=map&p=${encodeURIComponent(x.id)}`, t: x.name, s: `${x.level === "middle" ? "중학교" : x.level === "elementary" ? "초등학교" : "고등학교"} · ${x.address || ""}` }));
    const maps = [["학교 지도", "#select/curriculum?v=map"], ["중학교 배정", "#select/curriculum?v=middle"]].filter(([n]) => has(n, "지도", "중학교", "배정")).map(([n, h]) => ({ href: h, t: n, s: "학교" }));
    if ((datoks.length && rows.some((r) => dateHit({ title: r.t, body: r.x })) && !gd.some((g) => dateHit({ title: g.t, body: g.x }))) || rows.some((r) => norm(r.t) === norm(q))) /* 제목이 질의와 똑같은 일정 행(초등학교 졸업)은 안내 글보다 먼저 */ return [["일정·제도", rows], ["가이드·용어", gd], ["학교", [...sch, ...plc]], ["과목", sub], ["바로가기", lk], ["화면", [...pages, ...maps]]].filter(([, l]) => l.length);
    return [["가이드·용어", gd], ["일정·제도", rows], ["학교", [...sch, ...plc]], ["과목", sub], ["바로가기", lk], ["화면", [...pages, ...maps]]].filter(([, l]) => l.length);
  };
  // 안내가 정해진 주제(이사·배정 서류·자사고 배점·재수 …)는 느슨하게 맞는 다른 행보다 먼저 보여 준다. 없는 주제는 엉뚱한 행 대신 안내만 보인다.
  const priority = (q, q0 = "") => { const nq = norm(q), nr = norm(String(q0).replace(/[?？!！.,~]/g, " ")); const hit = data.guide.filter((g) => g.q && (new RegExp(g.q).test(nq) || new RegExp(g.q).test(nr))); if (hit.some((g) => g.gap === "none-topics")) { const o = hit.filter((g) => g.gap === "none-topics"); return { list: o.map((g) => ({ href: g.href, t: g.t, s: g.s })), only: true }; } // 이 포털이 다루지 않는 주제는 안내만(링크·소음 행이 앞서지 않게)
    if (hit.some((g) => g.gap === "other-region")) { const o = hit.filter((g) => g.gap === "other-region"); return { list: o.map((g) => ({ href: withHl(g.href, g.hl), t: g.t, s: g.s })), only: true }; } // 다른 지역 질의는 지역 경고만 먼저(이어서 우리 지역 결과로 오해하지 않게)
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
  // 낱말 일부만 맞은 느슨한 결과(OR)와 없는 학교, 학교+주제 질의를 구조적으로 처리한다
  const TOPICS = [[/방과후/, "방과후학교", null], [/특색|교육 ?목표|교육 ?중점/, "교육 특색", (pl) => (pl.level === "middle" ? "#select/curriculum?v=middle&g=%EA%B5%90%EC%9C%A1" : "#select/curriculum?v=hs&g=%EA%B5%90%EC%9C%A1%EA%B3%BC%EC%A0%95")], [/편제표|개설(하는|되는)? ?과목|과목표|과목 ?구성/, "편제표(학교별 과목표)", (pl) => (pl.schoolId ? `#select/curriculum?s=${encodeURIComponent(pl.schoolId)}&hl=${encodeURIComponent("과목표")}` : null)], [/학비|등록금|수업료/, "학비·비용", () => "#select/curriculum?v=hs&ty=1"], [/모집 ?인원|정원|몇 ?명/, "모집 인원", () => "#select/curriculum?v=hs&ty=1"], [/진학 ?실적|대입 ?결과|입시 ?결과|합격 ?실적|합격자|진학/, "대학 진학 현황", (pl) => (pl.level === "high" ? "#select/curriculum?v=hs&g=%EC%A7%84%ED%95%99" : null)], [/설명회/, "설명회 노트", (pl) => data.guide.find((g) => pl.schoolId && g.href.includes("bf=" + pl.schoolId))?.href || null], [/합격선|커트라인|입결/, "합격선", () => null], [/입학|전형|지원|가려면|가고 ?싶|들어가/, "입학·전형", () => "#schedule?t=hs"], [/학군|학교군|중학구/, "학교군", () => "#select/curriculum?v=middle"]];
  // 과목 이름의 로마숫자(미적분Ⅱ·화학Ⅰ)를 질의의 아라비아 숫자(미적분2·화학 1)와 맞춘다
  const romanize = (str) => {
    if (!data.roman) { const bases = new Set(); for (const x of data.subjects || []) { const m = /^(.+?)\s*(Ⅰ|Ⅱ)$/.exec(x.name || ""); if (m) bases.add(m[1].trim()); } data.roman = [...bases].map((b) => [new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*([12])(?![0-9가-힣])", "g"), b]); }
    if (!data.plainRoman) { const names = (data.subjects || []).map((x) => x.name || ""), withR = new Set(names.filter((n) => /(Ⅰ|Ⅱ)$/.test(n)).map((n) => n.replace(/\s*(Ⅰ|Ⅱ)$/, ""))); const m = new Map(); for (const n of names) if (n.length >= 2 && !/(Ⅰ|Ⅱ)$/.test(n) && !withR.has(n) && !/[ ·]/.test(n)) { m.set(n, n); if (n.length >= 3 && /학$/.test(n)) m.set(n.slice(0, -1), n); } data.plainRoman = [...m].map(([k, v]) => [new RegExp(k + "\\s*(?:[12]|Ⅰ|Ⅱ|I{1,2})(?![0-9가-힣A-Za-z])", "g"), v]); } // 화학1·화학Ⅰ·물리2 → 화학·물리학(로마숫자 없는 과목)
    let t = String(str).replace(/(미적분|영어|수학|확률과 ?통계|화학|물리학?|생명과학|지구과학)\s*(투|이)(?![가-힣])/g, (_, b, n) => b + (n === "투" ? "2" : "2")).replace(/(미적분|영어|수학|화학|물리학?|생명과학|지구과학)\s*원(?![가-힣])/g, "$11"); for (const [re, b] of data.roman) t = t.replace(re, (_, n) => b + (n === "1" ? "Ⅰ" : "Ⅱ")); for (const [re, v] of data.plainRoman) t = t.replace(re, v); return t;
  };
  const search = (q) => {
    const q0 = romanize(String(q)).replace(/시험을? ?(안|못) ?(보는|치는)( ?학기)?/g, "자유학기"); // 원문(의도 낱말 확인용)
    q = cleanQuery(q0).replace(/(?:용인)?(?:한국)?외(?:국어)?대(?:학교)?부(?:설|속)?(?:고등학교|고)?/g, "용인한국외국어대학교부설고등학교"); // 약칭 → 학교 이름
    const schoolSa = /용인한국외국어대학교부설고등학교/.test(q); /* 외대부고는 자사고: 학교 이름+전형·배점 같은 속성어도 자사고 안내 행을 찾게 */
    const p = priority(schoolSa ? "자사고 외고 " + q : q, schoolSa ? "자사고 외고 " + q0 : q0); if (p && p.only) return [["바로 안내", p.list]];
    { // 문장 속 동사·어미(떨어지면·열어·같은…)는 찾는 내용어가 아니다: 색인에 한 번도 없는 낱말은 무시하고 남은 내용어로 찾는다(내용어 전부가 없을 때만 "없음"으로 간다)
      const dn = (data.dn ||= data.policy.map((x) => nr(x)).concat(data.guide.map((g) => ng(g))));
      const dfN = (w) => dn.filter((d) => tokIn(norm(w), d)).length;
      const ws = q.split(/\s+/).filter(Boolean), SCH = /^[가-힣]{2,5}(중학교|고등학교|초등학교|중|고|초)$/;
      if (ws.length >= 2) { const VL = /(면|니|죠|며|지|어|아|해|한|된|는|은|던|려|러|야|라|래|서|고|다|요|네|까|게|ㄴ|을|를|같|많|좋|없|있)$/; const keep = ws.filter((w) => SCH.test(w) || /\\d/.test(w) || !VL.test(w) || dfN(w) > 5); if (keep.length && keep.length < ws.length) q = keep.join(" "); }
    }
    let r = searchOnce(q, false), weak = false;
    if (!r.length && /학비|등록금|수업료|입학금/.test(String(q))) { const q2 = String(q).split(/\s+/).filter((w) => !/^(고등학교|중학교|고교)$/.test(w)).join(" "); if (q2) r = searchOnce(q2, false); } /* 학교급 낱말 때문에 비는 학비 질문은 유형별 학비·비용으로 */
    if (!r.length && String(q).trim().includes(" ")) { r = searchOnce(q, true); weak = r.length > 0; }
    r = reweight(r, q);
    // 학교 이름과 앞부분이 맞는 말이 있으면(예: 상현중) 그 학교를 맨 위에 두고, 이름이 다른 학교(상현고 등) 행은 걷어 낸다
    const words = String(q).split(/\s+/).map(norm).filter((t) => t.length >= 2 && !STOP.has(t));
    const toks0 = words.filter((t) => t.length >= 3);
    const ex = data.places.filter((x) => toks0.some((t) => norm(x.name).startsWith(t)));
    const notes = [];
    if (ex.length) {
      const keys = toks0.filter((t) => ex.some((x) => norm(x.name).startsWith(t)));
      const otherToks = words.map(norm).filter((w) => w.length >= 2 && !keys.some((k) => k.includes(w) || w.includes(k))); // 학교 이름 말고 남은 낱말(매점·교복…)이 제목에 든 문서를 앞에
      r = r.map(([h, l]) => [h, h === "학교" ? l : l.filter((x) => keys.some((k) => norm(x.t + " " + x.s + " " + (x.sch || "")).includes(k))).map((x, i) => ({ x, i, c: otherToks.filter((w) => norm(x.t).includes(w)).length })).sort((a, b) => b.c - a.c || a.i - b.i).map((o) => o.x)]).filter(([, l]) => l.length);
      r = [["학교", ex.map((x) => ({ href: `#select/curriculum?v=map&p=${encodeURIComponent(x.id)}`, t: x.name, s: `${x.level === "middle" ? "중학교" : x.level === "elementary" ? "초등학교" : "고등학교"} · ${x.address || ""}` }))], ...r.filter(([h]) => h !== "학교")];
      weak = false; // 학교 이름이 맞았으면 느슨한 매치가 아니다
      const rest = norm(q); // 학교 + 주제: 주제어에 맞는 화면을 같이 이어 준다
      const first = ex[0];
      for (const [re, label, fn] of TOPICS) if (re.test(q0) && !(p && /설명회/.test(label))) {
        const href = fn ? fn(first) : null;
        notes.push(href ? { href, t: `${first.name} · ${label}`, s: `${label}${(label.charCodeAt(label.length - 1) - 0xac00) % 28 ? "은" : "는"} 학교별 비교 화면에서 볼 수 있어요` } : { href: "#library/links", t: `${first.name} · ${label}`, s: `${label}${(label.charCodeAt(label.length - 1) - 0xac00) % 28 ? "은" : "는"} 이 포털에 아직 없어요 → 학교 홈페이지·학교알리미 공시에서 확인해요` });
      }
      if (/용인한국외국어/.test(rest)) notes.push({ href: "#select/curriculum?v=hs&ty=1", t: "용인외대부고(자율형 사립고)", s: "외·국·자 전형 일정과 유형 설명은 고교 유형 화면에 있어요" });
    } else {
      // 이 포털에 없는 학교(예: 죽전중·풍덕중): 학교 이름 모양의 낱말이 어떤 학교 이름과도 안 맞으면 알려 준다
      const LV = { 중: ["middle", "중학교"], 고: ["high", "고등학교"], 초: ["elementary", "초등학교"] };
      for (const t of words) { const m = /^([가-힣]{2,5})(중학교|고등학교|초등학교|중|고|초)$/.exec(t); if (!m || /(신고|공고|광고|보고|통고|예고|사고|경고|출고|원고|항고|상고|신초|최초|개중|도중|기중|동중|전입신고)$/.test(t) || /(하|되|싶|있|없|보|알|해|서|가|오|나|내|주|받|쓰|열|떨|들|살|찾|맞|넣|놓|같|끝|돌|걸|골|르|리|아|어|지|다|라|네|죠|요|면|며|니|까|게|듯|던|든|는|은|을|를)$/.test(m[1]) || /^(자공|자율|자사|일반|특성화|마이스터|자사|외|국제|과학|영재|예술|체육|특목|자율|자율형|자율형공립|자율형사립|공립|사립|전기|후기|평준화|비평준화|외국어|명문|상위|진학|입시|특수|대안|각종|모든|우리|근처|인근|다른|광역|지역|학군|중학|고등|초등|특성화|연합|통합)$/.test(m[1])) continue; const lv = LV[m[2][0]]; if (!lv || SYN.some((g) => g.includes(t)) || data.guide.some((g) => !g.q && ng(g).includes(norm(t))) || data.policy.some((r) => nr(r).includes(norm(t))) || data.places.some((x) => x.level === lv[0] && (norm(x.name).startsWith(t) || norm(x.name).startsWith(m[1])))) continue;
        const all = data.places.filter((x) => x.level === lv[0]).map((x) => x.name.replace(/(중학교|고등학교|초등학교)$/, m[2][0])), names = all.slice(0, 40); // 31교 전체를 보여 준다
        notes.push({ href: `#select/curriculum?v=map`, t: `${t}${(t.charCodeAt(t.length - 1) - 0xac00) % 28 ? "은" : "는"} 이 포털에 없는 학교예요`, s: `있는 ${lv[1]} ${all.length}곳: ${names.join("·")} → 없는 학교는 학교 지도나 학교알리미에서 찾아요` }); weak = true; break; }
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
      strongTop = core.length >= 3 && !missing.length && !uncov.length && best >= core.length - 1; /* 빠진 낱말 없이 1위 후보가 거의 다 맞으면 배너를 뒤로 */
      if (globalThis.__SDBG) console.log("DBG", { core, missing, uncov, best, cands: cands.length });
      if (core.length >= 2 && !missing.length && uncov.length <= (core.length >= 4 ? 1 : 0) && best >= Math.ceil(core.length * 0.5) || core.length === 1 && best >= 1) { weak = false; r = r.map(([h, l]) => [h, l.slice(0, 5)]); }
      else if (core.length >= 2 && (missing.length || uncov.length) && best <= 1) { // 핵심어가 데이터에 없고 맞은 건 흔한 낱말뿐이면(동아리 활동·학교 평균 등급) 무관 행 대신 안내 한 줄
        const DOMAIN = /^(배정|전형|입학|지원|접수|원서|등록|고입|중입|대입|수능|내신|졸업|학점|과목|서류|준비물|설명회|교복|급식|학교군|지망|추첨|전학|이사|예비소집|교과서)$/;
        const hitDomain = core.some((w) => DOMAIN.test(w) && cands.some((x) => expand(w).some((v) => norm(x.t + " " + x.s).includes(v))));
        if (!hitDomain && !cands.length) { /* 데이터 어디에도 없는 핵심어가 있고 맞은 건 흔한 낱말뿐이면 다른 주제 행을 정답처럼 내지 않는다 */ r = [["안내", [{ href: "#library/links", t: "이 포털에서 찾기 어려운 내용이에요", s: "찾는 말에 맞는 자료가 없어요 → 학교알리미(학교별 공시)나 해당 학교 누리집에서 확인해요" }]], ["공식 확인처", HELP.slice(1, 2).map(([n, u, d]) => ({ href: u, ext: true, t: n, s: d })).concat([{ href: "#select/curriculum?v=map", t: "학교 지도(학교 홈페이지·전화)", s: "학교 카드에서 학교 누리집으로 이어져요" }])]]; return r; }
      }
    }
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
    if (!r.length && !p) r = [["안내", [{ href: "#library/links", t: "이 포털에서 찾기 어려운 내용이에요", s: "찾는 말에 맞는 자료가 없어요 → 학교알리미(학교별 공시)나 교육청·학교 누리집에서 확인해요" }]], ["공식 확인처", HELP.slice(1, 2).map(([n, u, d]) => ({ href: u, ext: true, t: n, s: d }))]];
    if (p) r = [["바로 안내", p.list], ...r.map(([h, l]) => [h, l.filter((x) => !p.list.some((y) => y.t === x.t))]).filter(([, l]) => l.length)];
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

  const item = (x) => x.term ? `<li><a href="#" data-term="${esc(x.term)}" data-go><b>${esc(x.t)}</b><span>${esc(x.s)}</span></a></li>` : `<li><a href="${esc(x.href)}"${x.ext ? ' target="_blank" rel="noopener"' : ""} data-go><b>${esc(x.t)}${x.ext ? " ↗" : ""}</b><span>${esc(x.s)}</span></a></li>`;
  const paint = () => {
    const q = box.querySelector("input").value, out = box.querySelector(".sr-out");
    if (!q.trim()) { const r = recent(); out.innerHTML = r.length ? `<p class="sr-h">최근 검색</p><p class="sr-rec">${r.map((x) => `<button type="button" class="lnk" data-q="${esc(x)}">${esc(x)}</button>`).join("")}</p>` : '<p class="muted">일정, 학교, 과목, 용어를 찾아 보세요.</p>'; return; }
    const res = search(q);
    out.innerHTML = res.length ? res.map(([h, l]) => `<p class="sr-h">${h} <span class="muted">${l.length}</span></p><ul class="rows">${l.map(item).join("")}</ul>`).join("") : `<div class="empty"><p>찾는 정보가 없어요.</p><small>다른 말로 다시 찾거나, 아래 공식 사이트·학교 공지에서 확인해 보세요.</small></div><p class="sr-h">문의처·공식 링크</p><ul class="rows">${HELP.map(([n, u, d]) => item({ href: u, ext: true, t: n, s: d })).join("")}<li><a href="#select/curriculum?v=map" data-go><b>학교 지도에서 학교 찾기</b><span>학교 홈페이지·전화는 학교 지도 카드에서 볼 수 있어요</span></a></li></ul>`;
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
