// 전체 검색: 헤더 돋보기 → 일정·제도, 학교, 과목, 바로가기, 화면을 한 번에 찾는다. 한글 부분 일치.
// 데이터는 처음 열 때 한 번에 병렬로 읽는다. 최근 검색은 이 브라우저(localStorage)에만 저장한다.
import { allItems } from "./menu.js";
const RECENT_KEY = "portal.search.recent";
const norm = (s) => String(s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, "");
const ROUTE = {
  "exam-schedule": "#schedule?t=univ", "hs-schedule": "#schedule?t=hs", "gg-hs-entry": "#schedule?t=hs", "life-schedule": "#schedule?t=life",
  "change-log": "#changelog", "hs-types": "#select/types", "hs-choice-opinion": "#select/types", "high-school-assignment": "#select/types", "academy-material": "#select/types",
  "curriculum-guide": "#life/credit", "hs-credit-system": "#life/credit",
};
const routeOf = (r) => ROUTE[r.topic] || (r.topic.startsWith("admission") ? "#admission/system" : "#home");

// 같은 뜻의 말(학부모가 쓰는 말 → 화면에 있는 말). 앞 말을 찾으면 뒤 말도 같이 찾는다.
const SYN = [["준비물", "서류", "원서"], ["원서", "원서접수", "접수", "지원"], ["상현", "상현중", "상현초", "상현고"], ["성복", "성복중", "성복초", "성복고"], ["설명회", "배정 설명회", "입학설명회"], ["배정", "평준화", "추첨", "배정원서"], ["수시", "학종", "학생부종합"], ["정시", "수능"], ["내신", "5등급", "성적"], ["학점", "학점제", "고교학점제"], ["통학", "거리", "지도"], ["특목", "과학고", "외고", "국제고", "자사고", "영재"]];
const expand = (k) => { const out = new Set([k]); SYN.forEach((g) => { if (g.some((w) => norm(w) === k || k.includes(norm(g[0])))) g.forEach((w) => out.add(norm(w))); }); return [...out]; };
const HELP = [["경기도교육청", "https://www.goe.go.kr", "도 단위 공지·고입 안내"], ["학교알리미", "https://www.schoolinfo.go.kr", "학교별 공시 정보"], ["대입정보포털 어디가", "https://www.adiga.kr", "대학 입시 정보"], ["고입 전형 포털(경기)", "https://www.satp.goe.go.kr", "경기 고입 원서·전형요강"]];

export function mountSearch(btn, { load, store, esc }) {
  let box = null, data = null, loading = null, last = null;
  const prep = () => (loading ??= Promise.all([load("policy"), load("summary"), load("links").catch(() => ({ items: [] })), load("subject-info").catch(() => ({ subjects: [] })), load("places").catch(() => ({ places: [] }))]).then(([policy, summary, links, si, pl]) => { data = { places: pl.places || [], policy, summary, links: links.items || [], subjects: si.subjects || (Array.isArray(si) ? si : []) }; }));
  const recent = () => store.get(RECENT_KEY, []);
  const remember = (q) => { if (q.trim().length < 2) return; store.set(RECENT_KEY, [q.trim(), ...recent().filter((x) => x !== q.trim())].slice(0, 6)); };

  const search = (q) => {
    const k = norm(q); if (!k) return [];
    const ks = expand(k);
    const has = (...xs) => xs.some((x) => { const n = norm(x); return ks.some((w) => n.includes(w)); });
    const rows = data.policy.filter((r) => has(r.title, r.body)).slice(0, 12).map((r) => ({ href: routeOf(r), t: r.title, s: (r.body || "").slice(0, 90) }));
    const sch = data.summary.filter((m) => has(m.schoolName, m.region)).map((m) => ({ href: `#select/curriculum?v=compare&s=${m.schoolId}`, t: m.schoolName, s: `${m.creditsRequired}+${m.creditsElective}학점 · ${m.region}` }));
    const sub = data.subjects.filter((x) => has(x.name, x.summary)).slice(0, 10).map((x) => ({ href: `#select/curriculum?v=compare`, t: x.name, s: `${x.area || ""} · ${(x.summary || "").slice(0, 70)}` }));
    const lk = data.links.filter((x) => has(x.name, x.purpose, x.org)).map((x) => ({ href: x.url, ext: true, t: x.name, s: `${x.org} · ${x.purpose}` }));
    const pages = allItems().filter((i) => has(i.title, i.tab)).map((i) => ({ href: `#${i.id}`, t: i.title, s: i.tab }));
    const plc = data.places.filter((x) => has(x.name, x.address)).slice(0, 10).map((x) => ({ href: `#select/curriculum?v=map&p=${encodeURIComponent(x.id)}`, t: x.name, s: `${x.level === "middle" ? "중학교" : x.level === "elementary" ? "초등학교" : "고등학교"} · ${x.address || ""}` }));
    const maps = [["학교 지도", "#select/curriculum?v=map"], ["중학교 배정", "#select/curriculum?v=middle"]].filter(([n]) => has(n, "지도", "중학교", "배정")).map(([n, h]) => ({ href: h, t: n, s: "학교" }));
    return [["일정·제도", rows], ["학교", [...sch, ...plc]], ["과목", sub], ["바로가기", lk], ["화면", [...pages, ...maps]]].filter(([, l]) => l.length);
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
