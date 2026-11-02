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
const SYN = [["준비물", "서류", "원서"], ["원서", "원서접수", "접수", "지원"], ["상현", "상현중", "상현초", "상현고"], ["성복", "성복중", "성복초", "성복고"], ["설명회", "배정 설명회", "입학설명회"], ["배정", "평준화", "추첨", "배정원서"], ["수시", "학종", "학생부종합"], ["정시", "수능"], ["내신", "5등급", "성적"], ["학점", "학점제", "고교학점제"], ["통학", "거리", "지도"], ["특목", "과학고", "외고", "국제고", "자사고", "영재"], ["날짜", "일정", "시행", "언제"], ["합격", "배정", "추첨"], ["권장과목", "이수 권장", "전공 연계"], ["학생수", "학생 수", "인원"], ["선택과목", "탐구 선택", "문과 이과", "성향"], ["진학", "진학 현황", "합격 실적"], ["시험", "지필", "수행평가", "평가계획"], ["졸업식", "중학교 졸업", "초등학교 졸업"], ["외대부고", "외대부설", "한국외국어대학교부설", "한국외대부고"], ["수능일", "수능 날짜", "수능 시행일", "수능 시행"], ["졸업일", "졸업식", "중학교 졸업", "초등학교 졸업"], ["수능 시간", "시험시간", "시험 시간", "영역별 시간"], ["자유학기", "시험 없는 학기", "자유학년"], ["출결", "출결 감점", "출결 점수", "결석 감점"], ["학비", "수업료", "등록금", "비용", "가격", "낙찰가"], ["입학 서류", "준비물", "제출 서류", "서류"], ["카이스트", "한국과학기술원", "KAIST"], ["포스텍", "포항공과대학교", "포항공대"], ["서울대", "서울대학교"], ["연세대", "연세대학교"], ["고려대", "고려대학교", "고대"], ["서강대", "서강대학교"], ["성균관대", "성균관대학교", "성대"], ["한양대", "한양대학교"], ["중앙대", "중앙대학교"], ["경희대", "경희대학교"], ["외대", "한국외국어대학교", "한국외대"], ["시립대", "서울시립대학교", "서울시립대"]];
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
    const PH = [["시험 없는 학기", "자유학기"], ["시험없는학기", "자유학기"], ["출결 감점", "출결"]]; // 여러 낱말로 된 말은 화면에 있는 말 하나로 바꿔 찾는다
    let q = String(q0); for (const [a, b] of PH) q = q.replace(a, b);
    q = q.split(/\s+/).filter((w) => !STOP.has(w) && !(orMode && STOP2.has(w))).join(" ") || q0; // 말버릇(있는·어떤 …)은 빼고 찾는다
    any = orMode;
    const k = norm(q); if (!k) return [];
    const ks = expand(k);
    // 띄어 쓴 검색어는 낱말마다(동의어 포함) 모두 들어 있어야 맞는다. 하나도 못 찾으면 낱말 중 하나만 맞아도 보여 준다.
    const toks = String(q).split(/\s+/).map(norm).filter(Boolean);
    const has = (...xs) => { const n = xs.map(norm).join(" "); if (toks.length < 2) return ks.some((w) => n.includes(w)); const hit = toks.map((tk) => expand(tk).some((w) => n.includes(w))); return any ? hit.some(Boolean) : hit.every(Boolean); };
    const fo = store.get("portal.focus", []), foc = Array.isArray(fo) ? fo : [];
    const rank = (title, body, row) => (norm(title).includes(k) ? 6 : ks.some((w) => norm(title).includes(w)) ? 4 : 1) - (row && (row.region === "seoul" || /^서울/.test(title || "")) ? 3 : 0) + (row && foc.includes(stageOf(row)) ? 1 : 0) + (norm(body || "").includes(k) ? 0.5 : 0);
    const tokHit = (r) => (toks.length > 1 ? toks.filter((tk) => expand(tk).some((w) => norm(r.title + " " + r.body).includes(w))).length * 1.5 : 0), hsQ = HS_Q.test(norm(q0)) && !MID_Q.test(norm(q0)), hsRow = (r) => /^(hs-|gg-|high-school)/.test(r.topic);
    const rows = data.policy.filter((r) => has(r.title, r.body)).map((r) => ({ href: routeOf(r), t: r.title, s: (r.body || "").slice(0, 90), sc: rank(r.title, r.body, r) + tokHit(r) + (hsQ && hsRow(r) ? 2 : 0) })).sort((a, b) => b.sc - a.sc).slice(0, 12);
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
  const search = (q) => { const p = priority(q); if (p && p.only) return [["바로 안내", p.list]]; let r = searchOnce(q, false); if (!r.length && String(q).trim().includes(" ")) r = searchOnce(q, true); r = reweight(r, q); if (p) r = [["바로 안내", p.list], ...r.map(([h, l]) => [h, l.filter((x) => !p.list.some((y) => y.t === x.t))]).filter(([, l]) => l.length)]; return r; };
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
