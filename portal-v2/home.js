// 홈: ①다음 할 일(dday.json: 큰 1건 + 작은 3건) → ②3년 길(네 칸). events.json은 3년 길 고3 칸의 수능 시행일에만 쓴다.
// 쓴 필드: start·end('YYYY-MM-DD' 또는 월만 'YYYY-MM'), title·label(이름 = label || title), status(confirmed 아니면 날짜 뒤 '예정'), examYear(2030만), region(서울 제외), id.
const DAY = ["일", "월", "화", "수", "목", "금", "토"];
let eventsP;
const seoulToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const dn = (d) => { const [y, m, x] = d.split("-").map(Number); return Date.UTC(y, m - 1, x || 1) / 864e5; };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const nameOf = (e) => e.label || e.title;
const endOf = (e) => e.end || e.start;
const wk = (d) => DAY[new Date(dn(d) * 864e5).getUTCDay()];
const md = (d) => Number(d.slice(5, 7)) + "." + Number(d.slice(8, 10));
// 날짜 문구: 오늘과 연도가 다르면 연도를 붙임. 월만 있는 날짜는 'YYYY.M'(일 미정).
function dateText(e, today) {
  const y = (d) => (d.slice(0, 4) !== today.slice(0, 4) ? d.slice(0, 4) + "." : "");
  if (e.start.length === 7) return Number(e.start.slice(0, 4)) + "." + Number(e.start.slice(5));
  let t = y(e.start) + md(e.start) + "(" + wk(e.start) + ")";
  if (e.end && e.end !== e.start) t += "~" + (e.end.slice(0, 4) !== e.start.slice(0, 4) ? e.end.slice(0, 4) + "." : "") + md(e.end) + "(" + wk(e.end) + ")";
  return t;
}
function dText(e, today) {
  if (e.start.length === 7) return "";
  const n = dn(e.start) - dn(today);
  if (n > 0) return "D-" + n;
  if (n === 0) return "D-Day";
  return dn(endOf(e)) >= dn(today) ? "진행 중" : "";
}
// 'D-N · 날짜(요일) 행사명' (월만 있는 날짜는 'D-' 없이 '2027.3 예정')
function sentence(e, today) {
  const tent = e.status !== "confirmed" || e.start.length === 7;
  const d = dText(e, today);
  return (d ? d + " · " : "") + dateText(e, today) + (tent ? " 예정" : "") + " " + nameOf(e);
}

function partA(items, today) {
  const sec = el("section", "h-a");
  sec.append(el("h2", "h-cap", "다음에 할 일"));
  const core = items;
  if (!core.length) { sec.append(el("p", "h-big", "다가올 일정이 없어요.")); return sec; }
  // 가로 1/2씩: 왼쪽 = 큰 것 1건, 오른쪽 = 작은 것 3건(세로로 쌓음). 900px 이하는 위·아래.
  const grid = el("div", "h-a-grid");
  grid.append(el("p", "h-big", sentence(core[0], today)));
  const ol = el("ol", "h-next");
  core.slice(1, 4).forEach((e) => ol.append(el("li", "", sentence(e, today))));
  grid.append(ol);
  sec.append(grid);
  return sec;
}

// 3년 길: 칸 이름은 학년·연도만. 부가 문구는 데이터 근거가 있는 것만(핵심 일정 순서, 입학식 월, 수능 시행일).
function partD(all, today) {
  const sec = el("section", "h-d");
  sec.append(el("h2", "h-cap", "3년 길"));
  const csat = all.find((e) => e.title === "2030학년도 수능 시행일" && e.start.length === 10);
  const cells = [
    ["중3 겨울", "2026-11-01", "원서 → 졸업 → 입학"],
    ["고1 · 2027", "2027-03-01", ""],
    ["고2 · 2028", "2028-03-01", ""],
    ["고3 · 2029", "2029-03-01", csat ? "수능 " + dateText(csat, "0000-01-01") + " 예정" : ""],
  ];
  const road = el("div", "f-road");
  cells.forEach(([t, from, sub], i) => {
    const next = cells[i + 1] ? cells[i + 1][1] : "9999-12-31";
    const c = el("div", today >= from && today < next ? "now" : "");
    if (c.className) c.setAttribute("aria-current", "step");
    c.append(el("b", "", (c.className ? "지금 · " : "") + t));
    if (sub) c.append(sub);
    road.append(c);
  });
  sec.append(road);
  return sec;
}

export function renderHome(content) {
  if (document.getElementById("home-box")) return;
  const box = el("div", "home"); box.id = "home-box";
  content.append(box);
  const get = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  // D-Day(A)는 사용자가 정한 dday.json, 일정(C)은 조사한 events.json
  eventsP ||= Promise.all([get("../portal/data/events.json"), get("dday.json")]);
  eventsP.then(([raw, dd]) => {
    if (!box.isConnected) return;
    const today = seoulToday();
    const all = (Array.isArray(raw) ? raw : raw.events || []).filter((e) => e.examYear === 2030 && e.start); // 2030학년도 일정만(수능 시행일 조회용)
    const mine = (dd.items || []).map((x) => ({ title: x.title, start: x.date || x.month, status: "confirmed", note: x.note })).filter((x) => x.start)
      .filter((x) => (x.start.length === 7 ? x.start >= today.slice(0, 7) : x.start >= today)).sort((p, q) => p.start.localeCompare(q.start));
    box.append(partA(mine, today), partD(all, today));
  }).catch(() => { eventsP = null; box.textContent = "일정을 불러오지 못했어요."; });
}
