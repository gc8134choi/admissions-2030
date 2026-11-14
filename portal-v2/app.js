// 해시 라우팅(최소): 주소 해시를 읽어 네비바의 현재 항목에 aria-current를 달고 선택된 메뉴 이름을 제목으로 보여 준다.
// 내용은 항목별로 이후 지시에 따라 붙인다(데이터는 필요해질 때 ../portal/data/*.json을 읽는다). 해시가 없거나 모르는 값이면 홈.
let schoolsP;
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
      sub.append(sc.address || "");
      if (hp) {
        const a = document.createElement("a"); a.href = hp.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = "홈페이지";
        sub.append(", ", a);
      }
      txt.append(h, sub); cell.append(img, txt); head.append(cell);
    });
    box.append(head);
  }).catch(() => { schoolsP = null; box.textContent = "학교 목록을 불러오지 못했어요."; });
}
