// 홈: ①다음 할 일(큰 한 문장 + 다음 3건) → ②겨울 시간 띠(11~3월) → ③3년 길(네 칸). 데이터: ../portal/data/events.json
// 쓴 필드: start·end('YYYY-MM-DD' 또는 월만 'YYYY-MM'), title·label(이름 = label || title), status(confirmed 아니면 날짜 뒤 '예정'), examYear(2030만), region(서울 제외), id.
const DAY = ["일", "월", "화", "수", "목", "금", "토"];
// '핵심 일정'(①·②의 뼈대): 경기 후기 원서접수 · 중학교 졸업 · 평준화 일반고 추가 배정 · 고교 입학식. 데이터 행의 id로만 고른다(새 값을 만들지 않음).
const CORE = ["ev-gg-02-1", "ev-life-01-1", "ev-gg-16-1", "ev-life-10-1"];
const SPAN = "ev-gg-04-1"; // 시간 띠에만 추가: 경기 평준화 일반고 원서접수~추가배정(기간)
const EXCLUDED = (e) => e.title === "평준화 배정 설명회" && e.start === "2026-10-19" && e.end === "2026-11-27";
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

function partA(core, today) {
  const sec = el("section", "h-a");
  sec.append(el("h2", "h-cap", "다음에 할 일"));
  if (!core.length) { sec.append(el("p", "h-big", "다가올 일정이 없어요.")); return sec; }
  sec.append(el("p", "h-big", sentence(core[0], today)));
  const ol = el("ol", "h-next");
  core.slice(1, 4).forEach((e) => ol.append(el("li", "", sentence(e, today))));
  sec.append(ol);
  return sec;
}

// 겨울 띠: 11월 1일 ~ 3월 31일(오늘이 4~10월이면 올해 11월부터). 900px 이하는 CSS로 날짜순 세로 목록.
function partC(all, today) {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const y0 = m >= 11 ? y : m <= 3 ? y - 1 : y; // 4~10월은 올해 11월~내년 3월
  const a = dn(y0 + "-11-01"), b = dn(y0 + 1 + "-03-31") + 1;
  const items = [];
  [...CORE, SPAN].forEach((id) => { const e = all.find((x) => x.id === id); if (e) items.push({ e, text: nameOf(e) }); });
  // 설명회처럼 같은 제목이 반복되는 일정은 한 줄(점)로 묶는다
  const grp = {};
  all.filter((e) => /설명회/.test(e.title) && !EXCLUDED(e) && e.start.length === 10 && e.start >= today).forEach((e) => (grp[e.title] ||= []).push(e));
  Object.values(grp).forEach((g) => { const f = g[0]; items.push({ e: f, text: f.title.replace(/\(.*\)$/, "") + (g.length > 1 ? " " + g.length + "건" : "") }); });
  const vis = items.filter(({ e }) => dn(endOf(e).length === 7 ? endOf(e) + "-28" : endOf(e)) >= dn(today) && dn(e.start.length === 7 ? e.start + "-01" : e.start) < b)
    .sort((p, q) => p.e.start.localeCompare(q.e.start));
  const sec = el("section", "h-c");
  sec.append(el("h2", "h-cap", "이번 겨울 (11월 ~ 3월)"));
  const ol = el("ol", "f-tl");
  ["11월", "12월", "1월", "2월", "3월"].forEach((t, i) => { const s = el("span", "m", t); s.style.left = i * 20 + "%"; ol.append(s); });
  const tl = (d) => Math.max(0, Math.min(100, ((dn(d.length === 7 ? d + "-01" : d) - a) / (b - a)) * 100));
  const td = el("span", "today"); td.style.left = tl(today) + "%"; td.append(el("span", "", "오늘 " + md(today))); ol.append(td);
  vis.forEach(({ e, text }, i) => {
    const li = el("li", e.end && e.end !== e.start ? "bar" : "dot");
    const l = tl(e.start), r = e.end && e.end.length === 10 ? tl(e.end) : l;
    li.style.setProperty("--l", l + "%"); li.style.setProperty("--t", 30 + i * 36 + "px");
    if (li.className === "bar") li.style.setProperty("--w", Math.max(r - l, 3) + "%");
    li.append(el("span", "d", dateText(e, today) + (e.status !== "confirmed" || e.start.length === 7 ? " 예정" : "")), " ", text);
    ol.append(li);
  });
  ol.style.setProperty("--h", 30 + vis.length * 36 + "px");
  sec.append(ol);
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
  eventsP ||= fetch("../portal/data/events.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  eventsP.then((raw) => {
    if (!box.isConnected) return;
    const today = seoulToday();
    // 제외 규칙: 2030학년도(examYear)만 → 중입·초졸·2033·2028 참고 제외, 서울 일정 제외, 평준화 배정 설명회 제외
    const all = (Array.isArray(raw) ? raw : raw.events || []).filter((e) => e.examYear === 2030 && e.start && e.region !== "seoul" && !EXCLUDED(e));
    const core = CORE.map((id) => all.find((e) => e.id === id)).filter((e) => e && dn(endOf(e).length === 7 ? endOf(e) + "-28" : endOf(e)) >= dn(today))
      .sort((p, q) => p.start.localeCompare(q.start));
    box.append(partA(core, today), partC(all, today), partD(all, today));
  }).catch(() => { eventsP = null; box.textContent = "일정을 불러오지 못했어요."; });
}
