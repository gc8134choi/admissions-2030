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
  schoolsP ||= fetch("../portal/data/schools.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  schoolsP.then((all) => {
    if (!box.isConnected) return;
    const list = Array.isArray(all) ? all : all.schools || [];
    const head = document.createElement("div"); head.className = "sc-row sc-head";
    SCHOOL_IDS.forEach((id) => {
      const h = document.createElement("h2"); h.className = "sc-cell";
      h.textContent = list.find((s) => s.id === id)?.name || "";
      head.append(h);
    });
    box.append(head);
  }).catch(() => { schoolsP = null; box.textContent = "학교 목록을 불러오지 못했어요."; });
}
