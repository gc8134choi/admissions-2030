// 해시 라우팅(최소): 주소 해시를 읽어 네비바의 현재 항목에 aria-current를 달고 컨텐츠 영역을 비운다.
// 컨텐츠·데이터 연결은 이후 지시에 따라 붙인다(데이터는 필요해질 때 ../portal/data/*.json을 읽는다).
const links = [...document.querySelectorAll("#nav a")], content = document.getElementById("content");
function route() {
  const id = location.hash.slice(1);
  links.forEach((a) => (a.getAttribute("href") === "#" + id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  content.dataset.route = id;
}
addEventListener("hashchange", route);
route();
