// 해시 라우팅(최소): 주소 해시를 읽어 네비바의 현재 항목에 aria-current를 달고 선택된 메뉴 이름을 제목으로 보여 준다.
// 내용은 항목별로 이후 지시에 따라 붙인다(데이터는 필요해질 때 ../portal/data/*.json을 읽는다). 해시가 없거나 모르는 값이면 홈.
let schoolsP, eventsP;
const links = [...document.querySelectorAll("#nav a")], content = document.getElementById("content"), title = document.getElementById("title");
function route() {
  let id = location.hash.slice(1);
  if (!links.some((a) => a.getAttribute("href") === "#" + id)) id = "home";
  links.forEach((a) => {
    const on = a.getAttribute("href") === "#" + id;
    if (on) { a.setAttribute("aria-current", "page"); title.textContent = a.textContent; document.title = a.textContent + " · 포털 v2"; } else a.removeAttribute("aria-current");
  });
  content.dataset.route = id;
  title.hidden = id === "schools"; // 학교 보기는 화면 제목을 보이지 않는다(네비 항목으로 충분)
  if (id === "schools") renderSchools(); else document.getElementById("schools")?.remove();
  if (id === "home") renderHome(); else document.getElementById("home-box")?.remove();
}
addEventListener("hashchange", route);
route();

// 학교 보기: 근처 고등학교 4곳을 왼쪽→오른쪽 풍덕·홍천·성복·수지 순서로 가로 4칸. 표시 이름은 schools.json에서 id로 읽는다.
// 칸 아래 내용은 이후 지시에 따라 행(.sc-row)으로 추가한다(같은 행이 4칸에 정렬되는 그리드).
const SCHOOL_IDS = ["school-pungdeok", "school-yonginheungcheon", "school-seongbok", "school-suji"];
function renderSchools() {
  if (document.getElementById("schools")) return;
  const box = document.createElement("div");
  box.id = "schools"; box.className = "sc-grid";
  content.append(box);
  const get = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  schoolsP ||= Promise.all([get("../portal/data/schools.json"), get("../portal/data/links.json")]);
  schoolsP.then(([all, links]) => {
    if (!box.isConnected) return;
    const list = Array.isArray(all) ? all : all.schools || [];
    const head = document.createElement("div"); head.className = "sc-row sc-head";
    SCHOOL_IDS.forEach((id) => {
      const sc = list.find((s) => s.id === id) || {};
      // 공식 홈페이지: links.json '학교 정보' 항목 중 기관명이 '<학교명 줄임>고등학교'를 포함하는 것(없으면 비워 둔다)
      const stem = (sc.name || "").replace(/고$/, "");
      const hp = stem && links.items.find((l) => l.category === "학교 정보" && l.name === "학교 홈페이지" && l.org.includes(stem + "고등학교"));
      const cell = document.createElement("div"); cell.className = "sc-cell sc-school";
      const img = document.createElement("img");
      img.src = "../portal/img/schools/128/" + id + ".png"; img.alt = sc.name || ""; img.width = 56; img.height = 56; img.className = "sc-logo";
      const txt = document.createElement("div"); txt.className = "sc-text";
      const h = document.createElement("h2"); h.className = "sc-name"; h.textContent = sc.name || "";
      const sub = document.createElement("p"); sub.className = "sc-sub";
      const addr = document.createElement("span"); addr.className = "sc-addr"; addr.textContent = sc.address || "";
      sub.append(addr);
      if (hp) {
        const a = document.createElement("a"); a.href = hp.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = "홈페이지";
        sub.append(", ", a);
      }
      txt.append(h, sub); cell.append(img, txt); head.append(cell);
    });
    box.append(head);
  }).catch(() => { schoolsP = null; box.textContent = "학교 목록을 불러오지 못했어요."; });
}

// 홈: 왼쪽 1/4 D-Day 박스(가장 가까운 일정 1건) + 오른쪽 3/4 일정 목록(오늘 이후, 날짜순). 데이터: ../portal/data/events.json
// 사용 필드: start·end(날짜, 'YYYY-MM-DD' 또는 월만 'YYYY-MM'), title·label(이름), status(확정 여부), examYear(2030만).
const pad = (n) => String(n).padStart(2, "0");
const seoulToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()); // YYYY-MM-DD
const dayNum = (d) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd) / 864e5; };
const fmtDate = (d) => d.replaceAll("-", ".");
function renderHome() {
  if (document.getElementById("home-box")) return;
  const box = document.createElement("div"); box.id = "home-box"; box.className = "home";
  content.append(box);
  eventsP ||= fetch("../portal/data/events.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  eventsP.then((all) => {
    if (!box.isConnected) return;
    const today = seoulToday(), month = today.slice(0, 7);
    const list = (Array.isArray(all) ? all : all.events || [])
      .filter((e) => !(e.title === "평준화 배정 설명회" && e.start === "2026-10-19" && e.end === "2026-11-27")) // 홈에서 제외(사용자 지시): 제목+기간이 정확히 일치하는 1건만
      .filter((e) => e.examYear === 2030 && e.start) // 중입·초6(2033)·2028 참고 일정 제외
      .filter((e) => (e.end || e.start).length === 7 ? (e.end || e.start) >= month : (e.end || e.start) >= today)
      .sort((a, b) => a.start.localeCompare(b.start));
    const name = (e) => (e.label ? e.title + " · " + e.label : e.title);
    // D-Day 박스: 졸업식 = ev-life-01-1('중학교 졸업'), 입학식 = ev-life-10-1('고교 입학식·개학').
    // 입학식은 날짜가 월만('2027-03') 있어 D-일수를 만들지 않고 'YYYY.M 예정'으로 표기한다.
    const rows = [["졸업식", "ev-life-01-1"], ["입학식", "ev-life-10-1"]].map(([label, id]) => [label, (Array.isArray(all) ? all : all.events || []).find((e) => e.id === id)]);
    const dday = document.createElement("section"); dday.className = "home-dday";
    const ol = document.createElement("ol"); ol.className = "dday-list";
    rows.forEach(([label, e]) => {
      if (!e) return;
      const li = document.createElement("li");
      const big = document.createElement("p"); big.className = "dday-n";
      if (e.start.length === 10) {
        const n = dayNum(e.start) - dayNum(today);
        big.textContent = n === 0 ? "D-Day" : n > 0 ? "D-" + n : "D+" + -n;
      } else big.textContent = Number(e.start.slice(0, 4)) + "." + Number(e.start.slice(5)) + " 예정";
      const t = document.createElement("p"); t.className = "dday-t";
      t.textContent = label + (e.start.length === 10 && e.status !== "confirmed" ? " (예정)" : "");
      li.append(big, t); ol.append(li);
    });
    dday.append(ol);
    const ul = document.createElement("ul"); ul.className = "home-list";
    list.forEach((e) => {
      const li = document.createElement("li");
      const d = document.createElement("span"); d.className = "ev-date";
      d.textContent = fmtDate(e.start) + (e.end && e.end !== e.start ? "~" + fmtDate(e.end) : "") + (e.status !== "confirmed" ? " 예정" : "");
      const t = document.createElement("span"); t.className = "ev-title"; t.textContent = name(e);
      li.append(d, t); ul.append(li);
    });
    box.append(dday, ul);
  }).catch(() => { eventsP = null; box.textContent = "일정을 불러오지 못했어요."; });
}
