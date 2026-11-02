// 전체 검색: 헤더 돋보기 → 일정·제도, 학교, 과목, 바로가기, 화면을 한 번에 찾는다. 한글 부분 일치.
// 데이터는 처음 열 때 한 번에 병렬로 읽는다. 최근 검색은 이 브라우저(localStorage)에만 저장한다.
import { allItems } from "./menu.js";
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
const norm = (s) => String(s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, "");
const ROUTE = {
  "exam-schedule": "#schedule?t=univ", "hs-schedule": "#schedule?t=hs", "gg-hs-entry": "#schedule?t=hs", "life-schedule": "#schedule?t=life",
  "change-log": "#changelog", "hs-types": "#select/types", "hs-choice-opinion": "#select/types", "high-school-assignment": "#select/types", "academy-material": "#admission/system",
  "curriculum-guide": "#life/credit", "hs-credit-system": "#life/credit",
};
// 날짜가 없는 경기 고입 행은 일정 화면에 없고 고교 유형 화면(접이식 안)에 있다
const routeOf = (r) => (r.topic === "gg-hs-entry" && !(r.events && r.events.length) ? "#select/curriculum?v=hs&ty=1"
  : r.topic === "hs-schedule" && r.region === "seoul" ? "#schedule?t=hs&seoul=1" // 서울 행은 일정 화면에서 '서울 보기'를 켜야 보인다
  : ["cur-08", "cur-29", "cur-30"].includes(r.id) ? "#admission/system" // 수능·전형 구조 참고 행은 대입 제도 화면에 있다
  : r.id === "acd-04" ? "#select/types" // 진학 비율은 고교 유형의 학원 의견 구역에 있다
  : r.topic === "exam-schedule" && r.examYear && r.examYear !== 2030 ? "#admission/system" // 다른 학년도 참고 행은 대입 제도 화면에 있다
  : ROUTE[r.topic] || (r.topic.startsWith("admission") ? "#admission/system" : "#home"));

// 같은 뜻의 말(학부모가 쓰는 말 → 화면에 있는 말). 앞 말을 찾으면 뒤 말도 같이 찾는다.
const SYN = [["예비소집", "예비소집일", "예비소집 날짜"], ["생활기록부", "학교생활기록부", "생기부", "학생부"], ["준비물", "서류", "원서"], ["원서", "원서접수", "접수", "지원"], ["상현", "상현중", "상현초", "상현고"], ["성복", "성복중", "성복초", "성복고"], ["설명회", "배정 설명회", "입학설명회"], ["배정", "평준화", "추첨", "배정원서"], ["수시", "학종", "학생부종합"], ["정시", "수능"], ["내신", "5등급", "성적"], ["학점", "학점제", "고교학점제"], ["통학", "거리", "지도"], ["특목", "과학고", "외고", "국제고", "자사고", "영재"], ["날짜", "일정", "시행", "언제"], ["합격", "배정", "추첨"], ["권장과목", "이수 권장", "전공 연계"], ["학생수", "학생 수", "인원"], ["선택과목", "탐구 선택", "문과 이과", "성향"], ["진학", "진학 현황", "합격 실적"], ["시험", "지필", "수행평가", "평가계획"], ["졸업식", "중학교 졸업", "초등학교 졸업"], ["외대부고", "외대부설", "한국외국어대학교부설", "한국외대부고"], ["수능일", "수능 날짜", "수능 시행일", "수능 시행"], ["졸업일", "졸업식", "중학교 졸업", "초등학교 졸업"], ["수능 시간", "시험시간", "시험 시간", "영역별 시간"], ["자유학기", "시험 없는 학기", "자유학년"], ["출결", "출결 감점", "출결 점수", "결석 감점"], ["학비", "수업료", "등록금", "비용", "가격", "낙찰가"], ["입학 서류", "준비물", "제출 서류", "서류"], ["카이스트", "한국과학기술원", "KAIST"], ["포스텍", "포항공과대학교", "포항공대"], ["서울대", "서울대학교"], ["연세대", "연세대학교"], ["고려대", "고려대학교", "고대"], ["서강대", "서강대학교"], ["성균관대", "성균관대학교", "성대"], ["한양대", "한양대학교"], ["중앙대", "중앙대학교"], ["경희대", "경희대학교"], ["외대", "한국외국어대학교", "한국외대"], ["시립대", "서울시립대학교", "서울시립대"]];
// 문장형 질의 정리: 조사·어미·의도 동사(바꾸고·싶어요·가려면 …)를 떼고 핵심어만 남긴다. 학교 이름 판정과 검색이 모두 이 결과를 쓴다.
const VERB_ONLY = /^(바꾸고|바꿔|바꾸|바꾸는|보고|보기|보는|찾고|찾아|찾는|알려줘|알려|알려주세요|알려줘요|싶어요|싶은데|하려면|가려면|가고|해요|해줘|줘|주세요|어떻게|어디|언제|뭐|무엇|뭐예요|어느|어떤|있어요|없어요|있나요|돼요|되나요|할까요|가요|와요|있는|없는|갈|수|걸|것|거|있을까요|되는|하는|하고|싶어|싶다|싶습니다|좀|저|제가|내가)$/;
const ENDINGS = /(들어가려면|하려면|가려면|바꾸고싶어요|보고싶어요|알고싶어요|싶어요|싶은데|해주세요|해줘요|해줘|알려줘요|알려줘|알려주세요|주세요|해요|이에요|예요|인가요|있나요|없나요|할까요|되나요|돼요|나요|까요|는데|은데|려면|으로|에서|에게|한테|에는|에도|까지|부터|이랑|이고|이며|바꾸고|바꿔)$/;
const JOSA = /(은|는|이|가|을|를|에|로|의|도|만|과|와|랑)$/;
export const cleanQuery = (q) => { const out = []; for (const raw of String(q).trim().split(/\s+/)) { let t = raw; if (!t) continue; if (VERB_ONLY.test(t)) continue; const e = t.replace(ENDINGS, ""); if (e !== t) { if (!e) continue; t = e; } if (t.length >= 3 && JOSA.test(t)) t = t.replace(JOSA, ""); if (t && !VERB_ONLY.test(t)) out.push(t); } return out.join(" ") || String(q).trim(); };
const expand = (k) => { const out = new Set([k]); SYN.forEach((g) => { if (g.some((w) => norm(w) === k || k.includes(norm(g[0])))) g.forEach((w) => out.add(norm(w))); }); return [...out]; };
const HELP = [["경기도교육청", "https://www.goe.go.kr", "도 단위 공지·고입 안내"], ["학교알리미", "https://www.schoolinfo.go.kr", "학교별 공시 정보"], ["대입정보포털 어디가", "https://www.adiga.kr", "대학 입시 정보"], ["고입 전형 포털(경기)", "https://www.satp.goe.go.kr", "경기 고입 원서·전형요강"]];

export function mountSearch(btn, { load, store, esc }) {
  let box = null, data = null, loading = null, last = null;
  const prep = () => (loading ??= Promise.all([load("policy"), load("summary"), load("links").catch(() => ({ items: [] })), load("subject-info").catch(() => ({ subjects: [] })), load("places").catch(() => ({ places: [] })), loadSearchExtra(load).catch(() => [])]).then(([policy0, summary, links, si, pl, extra]) => { const policy = filterByProfile(policy0, loadProfile(store), { grade3: true }); /* 화면이 보여 주는 행만 검색 결과로(화면에 없는 행으로 링크되지 않게) */ data = { places: pl.places || [], guide: extra.map((d) => ({ t: d.t, text: d.text, href: d.href, from: "", s: d.s, q: d.q, only: d.only })), policy, summary, links: links.items || [], subjects: si.subjects || (Array.isArray(si) ? si : []) }; }));
  const recent = () => store.get(RECENT_KEY, []);
  const remember = (q) => { if (q.trim().length < 2) return; store.set(RECENT_KEY, [q.trim(), ...recent().filter((x) => x !== q.trim())].slice(0, 6)); };

  let any = false;
  const STOP = new Set(["있는", "없는", "어떤", "어디", "언제", "얼마", "어떻게", "하는", "되는", "알려줘", "알려", "관련"]), STOP2 = new Set(["학교", "정보"]);
  const searchOnce = (q0, orMode) => {
    const PH = [["시험 없는 학기", "자유학기"], ["시험없는학기", "자유학기"], ["출결 감점", "출결"], ["지도에서 학교 찾기", "학교 지도"], ["학교 찾기", "학교 지도"], ["다크 모드", "화면 모드"], ["다크모드", "화면 모드"], ["야간 모드", "화면 모드"], ["논술 전형", "논술전형"], ["수능 절대평가", "절대평가"], ["학교 밖 교육과정", "공동교육과정"], ["수능 응시 영역", "수능 영역"], ["교복 지원비", "교복 지원금"], ["자공고", "자율형공립고"], ["성적 반영 점수", "성적 반영"], ["고등학교 무상교육", "무상교육"], ["학교생활기록부", "생활기록부"], ["용인외대부고", "용인한국외국어대학교부설고등학교"], ["외대부고", "용인한국외국어대학교부설고등학교"], ["외대부", "용인한국외국어대학교부설고등학교"]]; // 여러 낱말로 된 말은 화면에 있는 말 하나로 바꿔 찾는다
    let q = String(q0); for (const [a, b] of PH) q = q.replace(a, b);
    const GEN = /^(일정|방법|안내|기간|날짜|정보|신청|기준|절차|기재)$/; q = q.split(/\s+/).filter((w) => !STOP.has(w) && !(orMode && STOP2.has(w))); { const rest = q.filter((w) => !GEN.test(norm(w))); if (rest.length) q = rest; } q = q.join(" ") || q0; // 일정·방법 같은 흔한 낱말은 다른 낱말이 있으면 맞춤 조건에서 뺀다 // 말버릇(있는·어떤 …)은 빼고 찾는다
    any = orMode;
    const k = norm(q); if (!k) return [];
    const ks = expand(k);
    // 띄어 쓴 검색어는 낱말마다(동의어 포함) 모두 들어 있어야 맞는다. 하나도 못 찾으면 낱말 중 하나만 맞아도 보여 준다.
    const toks = String(q).split(/\s+/).map(norm).filter(Boolean);
    const has = (...xs) => { const n = xs.map(norm).join(" "); if (toks.length < 2) return ks.some((w) => n.includes(w)); const hit = toks.map((tk) => expand(tk).some((w) => n.includes(w))); return any ? hit.some(Boolean) : hit.every(Boolean); };
    const fo = store.get("portal.focus", []), foc = Array.isArray(fo) ? fo : [];
    const rank = (title, body, row) => (norm(title).includes(k) ? 6 : ks.some((w) => norm(title).includes(w)) ? 4 : 1) - (row && (row.region === "seoul" || /^서울/.test(title || "")) ? 3 : 0) + (row && foc.includes(stageOf(row)) ? 1 : 0) + (norm(body || "").includes(k) ? 0.5 : 0) + (!row && toks.some((tk) => tk.length >= 2 && (norm(title) === tk || norm(title).startsWith(tk))) ? 2.5 : 0); // 제목이 검색어로 시작하는 문서(교복·자유학기 …)를 먼저
    const dfOf = (tk) => data.policy.filter((r) => norm(r.title + " " + r.body).includes(tk)).length, rare = toks.length > 1 ? toks.filter((tk) => dfOf(tk) > 0 && dfOf(tk) <= 20) : [];
    const rareHit = (r) => (rare.some((tk) => norm(r.title).includes(tk)) ? 4 : 0); // 드문 낱말(국제고·과학고 등)이 제목에 있는 행을 먼저
    const tokHit = (r) => (toks.length > 1 ? toks.filter((tk) => expand(tk).some((w) => norm(r.title + " " + r.body).includes(w))).length * 1.5 : 0), hsQ = HS_Q.test(norm(q0)) && !MID_Q.test(norm(q0)), hsRow = (r) => /^(hs-|gg-|high-school)/.test(r.topic);
    const rows = data.policy.filter((r) => has(r.title, r.body)).map((r) => ({ href: routeOf(r), t: r.title, s: (r.body || "").slice(0, 90), sc: rank(r.title, r.body, r) + tokHit(r) + rareHit(r) + (hsQ && hsRow(r) ? 2 : 0) })).sort((a, b) => b.sc - a.sc).slice(0, 12);
    const gd = data.guide.filter((g) => has(g.t, g.text)).map((g) => ({ href: g.href, t: g.t, s: (g.s || (g.text.split(/(?<=[.。다요])\s/).find((x) => ks.some((w) => norm(x).includes(w))) || g.text)).slice(0, 80), sc: rank(g.t, g.text) })).sort((a, b) => b.sc - a.sc).slice(0, 8);
    const sch = data.summary.filter((m) => has(m.schoolName, m.region)).map((m) => ({ href: `#select/curriculum?v=summary&s=${m.schoolId}`, t: m.schoolName, s: `${m.creditsRequired}+${m.creditsElective}학점 · ${m.region}` }));
    const sub = data.subjects.filter((x) => has(x.name, x.summary)).slice(0, 10).map((x) => ({ href: `#select/curriculum?v=compare`, t: x.name, s: `${x.area || ""} · ${(x.summary || "").slice(0, 70)}` }));
    const lk = data.links.filter((x) => has(x.name, x.purpose, x.org)).map((x) => ({ href: x.url, ext: true, t: x.name, s: `${x.org} · ${x.purpose}` }));
    const pages = allItems().filter((i) => has(i.title, i.tab)).map((i) => ({ href: `#${i.id}`, t: i.title, s: i.tab }));
    const plc = data.places.filter((x) => has(x.name, x.address)).slice(0, 10).map((x) => ({ href: `#select/curriculum?v=map&p=${encodeURIComponent(x.id)}`, t: x.name, s: `${x.level === "middle" ? "중학교" : x.level === "elementary" ? "초등학교" : "고등학교"} · ${x.address || ""}` }));
    const maps = [["학교 지도", "#select/curriculum?v=map"], ["중학교 배정", "#select/curriculum?v=middle"]].filter(([n]) => has(n, "지도", "중학교", "배정")).map(([n, h]) => ({ href: h, t: n, s: "학교" }));
    return [["가이드·용어", gd], ["일정·제도", rows], ["학교", [...sch, ...plc]], ["과목", sub], ["바로가기", lk], ["화면", [...pages, ...maps]]].filter(([, l]) => l.length);
  };
  // 안내가 정해진 주제(이사·배정 서류·자사고 배점·재수 …)는 느슨하게 맞는 다른 행보다 먼저 보여 준다. 없는 주제는 엉뚱한 행 대신 안내만 보인다.
  const priority = (q) => { const nq = norm(q); const hit = data.guide.filter((g) => g.q && new RegExp(g.q).test(nq)); return hit.length ? { list: hit.map((g) => ({ href: g.href, t: g.t, s: g.s })), only: hit.some((g) => g.only) } : null; };
  // 학교급 가중: 고교 말(고교·후기·일반고·외고 …)이 있으면 고교 정책 행을 중학교 배정 안내보다 먼저, 중학교·초등 말이면 반대로
  const HS_Q = /고교|고등|일반고|후기|외고|국제고|자사고|특성화|마이스터|평준화|고입|전기고|과학고/, MID_Q = /중학교|중입|초등|초6|중학군|근거리|중1/;
  const isMid = (x) => /v=middle/.test(x.href) || /^(초[56]|중[123]) · |배정부터 등록까지|^중학교 /.test(x.t);
  const reweight = (r, q) => {
    const nq = norm(q), hs = HS_Q.test(nq), mid = MID_Q.test(nq); if (hs === mid) return r;
    const part = (l) => [...l.filter((x) => isMid(x) === mid), ...l.filter((x) => isMid(x) !== mid)];
    r = r.map(([h, l]) => (h.startsWith("가이드") ? [h, part(l)] : [h, l]));
    if (hs) { const i = r.findIndex(([h]) => h.startsWith("일정")), j = r.findIndex(([h]) => h.startsWith("가이드")); if (i > j && j >= 0) { const [g] = r.splice(i, 1); r.splice(j, 0, g); } }
    return r;
  };
  // 낱말 일부만 맞은 느슨한 결과(OR)와 없는 학교, 학교+주제 질의를 구조적으로 처리한다
  const TOPICS = [[/방과후/, "방과후학교", null], [/특색|교육 ?목표|교육 ?중점/, "교육 특색", (pl) => (pl.level === "middle" ? "#select/curriculum?v=middle&g=%EA%B5%90%EC%9C%A1" : "#select/curriculum?v=hs&g=%EA%B5%90%EC%9C%A1%EA%B3%BC%EC%A0%95")], [/편제표|개설 ?과목|과목표/, "편제표(학교별 과목표)", (pl) => (pl.schoolId ? `#select/curriculum?s=${encodeURIComponent(pl.schoolId)}` : null)], [/학비|등록금|수업료/, "학비·비용", () => "#select/curriculum?v=hs&ty=1"], [/모집 ?인원|정원|몇 ?명/, "모집 인원", () => "#select/curriculum?v=hs&ty=1"], [/입학|전형|지원|가려면|가고 ?싶|진학|들어가/, "입학·전형", () => "#schedule?t=hs"], [/학군|학교군|중학구/, "학교군", () => "#select/curriculum?v=middle"]];
  const search = (q) => {
    const q0 = String(q); // 원문(의도 낱말 확인용)
    q = cleanQuery(q0).replace(/(용인)?외대부고?/g, "용인한국외국어대학교부설고등학교"); // 약칭 → 학교 이름
    const p = priority(q); if (p && p.only) return [["바로 안내", p.list]];
    let r = searchOnce(q, false), weak = false;
    if (!r.length && String(q).trim().includes(" ")) { r = searchOnce(q, true); weak = r.length > 0; }
    r = reweight(r, q);
    // 학교 이름과 앞부분이 맞는 말이 있으면(예: 상현중) 그 학교를 맨 위에 두고, 이름이 다른 학교(상현고 등) 행은 걷어 낸다
    const words = String(q).split(/\s+/).map(norm).filter((t) => t.length >= 2 && !STOP.has(t));
    const toks0 = words.filter((t) => t.length >= 3);
    const ex = data.places.filter((x) => toks0.some((t) => norm(x.name).startsWith(t)));
    const notes = [];
    if (ex.length) {
      const keys = toks0.filter((t) => ex.some((x) => norm(x.name).startsWith(t)));
      r = r.map(([h, l]) => [h, h === "학교" ? l : l.filter((x) => keys.some((k) => norm(x.t + " " + x.s).includes(k)))]).filter(([, l]) => l.length);
      r = [["학교", ex.map((x) => ({ href: `#select/curriculum?v=map&p=${encodeURIComponent(x.id)}`, t: x.name, s: `${x.level === "middle" ? "중학교" : x.level === "elementary" ? "초등학교" : "고등학교"} · ${x.address || ""}` }))], ...r.filter(([h]) => h !== "학교")];
      weak = false; // 학교 이름이 맞았으면 느슨한 매치가 아니다
      const rest = norm(q); // 학교 + 주제: 주제어에 맞는 화면을 같이 이어 준다
      const first = ex[0];
      for (const [re, label, fn] of TOPICS) if (re.test(q0)) {
        const href = fn ? fn(first) : null;
        notes.push(href ? { href, t: `${first.name} · ${label}`, s: `${label}${(label.charCodeAt(label.length - 1) - 0xac00) % 28 ? "은" : "는"} 학교별 비교 화면에서 볼 수 있어요` } : { href: "#library/links", t: `${first.name} · ${label}`, s: `${label}${(label.charCodeAt(label.length - 1) - 0xac00) % 28 ? "은" : "는"} 이 포털에 아직 없어요 → 학교 홈페이지·학교알리미 공시에서 확인해요` });
      }
      if (/용인한국외국어/.test(rest)) notes.push({ href: "#select/curriculum?v=hs&ty=1", t: "용인외대부고(자율형 사립고)", s: "외·국·자 전형 일정과 유형 설명은 고교 유형 화면에 있어요" });
    } else {
      // 이 포털에 없는 학교(예: 죽전중·풍덕중): 학교 이름 모양의 낱말이 어떤 학교 이름과도 안 맞으면 알려 준다
      const LV = { 중: ["middle", "중학교"], 고: ["high", "고등학교"], 초: ["elementary", "초등학교"] };
      for (const t of words) { const m = /^([가-힣]{2,5})(중학교|고등학교|초등학교|중|고|초)$/.exec(t); if (!m || /(하|되|싶|있|없|보|알|해|서)$/.test(m[1]) || /^(자공|자율|자사|일반|특성화|마이스터|자사|외|국제|과학|영재|예술|체육|특목|자율|자율형|자율형공립|자율형사립|공립|사립|전기|후기|평준화|비평준화|외국어|명문|상위|진학|입시|특수|대안|각종|모든|우리|근처|인근|다른|광역|지역|학군|중학|고등|초등|특성화|연합|통합)$/.test(m[1])) continue; const lv = LV[m[2][0]]; if (!lv || data.places.some((x) => x.level === lv[0] && (norm(x.name).startsWith(t) || norm(x.name).startsWith(m[1])))) continue;
        const all = data.places.filter((x) => x.level === lv[0]).map((x) => x.name.replace(/(중학교|고등학교|초등학교)$/, m[2][0])), names = all.slice(0, 40); // 31교 전체를 보여 준다
        notes.push({ href: `#select/curriculum?v=map`, t: `${t}${(t.charCodeAt(t.length - 1) - 0xac00) % 28 ? "은" : "는"} 이 포털에 없는 학교예요`, s: `있는 ${lv[1]} ${all.length}곳: ${names.join("·")} → 없는 학교는 학교 지도나 학교알리미에서 찾아요` }); weak = true; break; }
    }
    if (/지도/.test(String(q))) { const i = r.findIndex(([h]) => h === "화면"); if (i > 0) r.unshift(...r.splice(i, 1)); } // 화면 이름을 찾는 말이면 화면을 먼저
    if (weak && !notes.length) { // 약한 매치 판정: 데이터 어디에도 없는 핵심어가 있는지(missing)와 가장 잘 맞는 행의 낱말 일치로 정한다
      const core = String(q).split(/\s+/).map(norm).filter((w) => w && !STOP.has(w) && !STOP2.has(w) && !/^(일정|방법|안내|기간|날짜|기준|절차|언제|신청|정보|기재)$/.test(w));
      const cover = (x) => core.filter((w) => expand(w).some((v) => norm(x.t + " " + x.s).includes(v))).length;
      const cands = r.filter(([h]) => h === "일정·제도" || h === "가이드·용어").flatMap(([, l]) => l.slice(0, 8));
      const best = Math.max(0, ...cands.map(cover));
      data.dn ||= data.policy.map((x) => norm(x.title + " " + x.body)).concat(data.guide.map((g) => norm(g.t + " " + g.text)));
      const dfc = (w) => { const ks = expand(w); return data.dn.filter((d) => ks.some((v) => d.includes(v))).length; };
      const missing = core.filter((w) => dfc(w) === 0);
      const covers1 = (x, w) => expand(w).some((v) => norm(x.t + " " + x.s).includes(v));
      const uncov = core.filter((w) => { const d = dfc(w); return d > 0 && d <= 40 && !cands.some((x) => covers1(x, w)); }); // 드문(구체적인) 낱말인데 어떤 후보 행에도 없음
      if (core.length >= 2 && !missing.length && !uncov.length && best >= Math.ceil(core.length * 0.5) || core.length === 1 && best >= 1) { weak = false; r = r.map(([h, l]) => [h, l.slice(0, 5)]); }
      else if (core.length >= 2 && (missing.length || uncov.length) && best <= 1) { // 핵심어가 데이터에 없고 맞은 건 흔한 낱말뿐이면(동아리 활동·학교 평균 등급) 무관 행 대신 안내 한 줄
        const DOMAIN = /^(배정|전형|입학|지원|접수|원서|등록|고입|중입|대입|수능|내신|졸업|학점|과목|서류|준비물|설명회|교복|급식|학교군|지망|추첨|전학|이사|예비소집|교과서)$/;
        const hitDomain = core.some((w) => DOMAIN.test(w) && cands.some((x) => expand(w).some((v) => norm(x.t + " " + x.s).includes(v))));
        if (!hitDomain) { r = [["안내", [{ href: "#library/links", t: "이 포털에서 찾기 어려운 내용이에요", s: `'${[...missing, ...uncov].join("·")}'에 맞는 자료가 없어요 → 학교알리미(학교별 공시)나 해당 학교 누리집에서 확인해요` }]], ["공식 확인처", HELP.slice(1, 2).map(([n, u, d]) => ({ href: u, ext: true, t: n, s: d })).concat([{ href: "#select/curriculum?v=map", t: "학교 지도(학교 홈페이지·전화)", s: "학교 카드에서 학교 누리집으로 이어져요" }])]]; return r; }
      }
    }
    if (weak) { // 신뢰도 낮음: 안내를 먼저 내고 느슨한 결과는 최대 3행
      const flat = r.filter(([h]) => h !== "과목").flatMap(([h, l]) => l.map((x) => ({ ...x, _g: h }))).slice(0, 3);
      r = [["안내", [{ href: "#library/links", t: "이 포털에 정확히 맞는 내용이 없을 수 있어요", s: "아래는 낱말 일부만 맞는 비슷한 화면이에요 → 정확한 내용은 공식 안내(교육청·학교알리미·대입정보포털)에서 확인해요" }, ...notes]], ...(flat.length ? [["비슷한 화면", flat]] : []), ["공식 확인처", HELP.slice(0, 3).map(([n, u, d]) => ({ href: u, ext: true, t: n, s: d }))]];
    } else if (notes.length) r = [["안내", notes], ...r];
    if (p || any) r = r.map(([h, l]) => (["과목", "학교", "바로가기"].includes(h) ? [h, l.slice(0, 3)] : [h, l]));
    if (p) r = [["바로 안내", p.list], ...r.map(([h, l]) => [h, l.filter((x) => !p.list.some((y) => y.t === x.t))]).filter(([, l]) => l.length)];
    return r;
  };
  const item = (x) => `<li><a href="${esc(x.href)}"${x.ext ? ' target="_blank" rel="noopener"' : ""} data-go><b>${esc(x.t)}${x.ext ? " ↗" : ""}</b><span>${esc(x.s)}</span></a></li>`;
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
    await prep().catch(() => { box.querySelector(".sr-out").innerHTML = '<p class="note">정보를 못 가져왔어요. 잠시 뒤 다시 열어 주세요.</p>'; });
    if (!data) return;
    paint();
    inp.addEventListener("input", () => { clearTimeout(last); last = setTimeout(paint, 80); });
    box.addEventListener("click", (e) => {
      if (e.target.closest("[data-x]") || e.target === box) return close();
      const r = e.target.closest("[data-q]"); if (r) { inp.value = r.dataset.q; paint(); inp.focus(); return; }
      if (e.target.closest("[data-go]")) { remember(inp.value); setTimeout(close, 0); }
    });
  };
  btn.addEventListener("click", open);
  document.addEventListener("keydown", (e) => { if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !box) { e.preventDefault(); open(); } });
}
