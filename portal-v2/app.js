// 해시 라우팅(최소): 주소 해시를 읽어 네비바의 현재 항목에 aria-current를 달고 선택된 메뉴 이름을 제목으로 보여 준다.
// 내용은 항목별로 이후 지시에 따라 붙인다(데이터는 필요해질 때 ../portal/data/*.json을 읽는다). 해시가 없거나 모르는 값이면 홈.
const links = [...document.querySelectorAll("#nav a")], content = document.getElementById("content"), title = document.getElementById("title");
function route() {
  let id = location.hash.slice(1);
  if (!links.some((a) => a.getAttribute("href") === "#" + id)) id = "home";
  links.forEach((a) => {
    const on = a.getAttribute("href") === "#" + id;
    if (on) { a.setAttribute("aria-current", "page"); title.textContent = a.textContent; document.title = a.textContent + " · 포털 v2"; } else a.removeAttribute("aria-current");
  });
  content.dataset.route = id;
}
addEventListener("hashchange", route);
route();
