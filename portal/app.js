import { MENU, STATUS } from "./menu.js";
import { SCHOOLS, SUBJECTS } from "./sample.js";

const $ = (s) => document.querySelector(s);
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ---- 메뉴 인덱스 ----
const byId = new Map();
(function index(nodes, parent) { for (const n of nodes) { n.parent = parent; byId.set(n.id, n); if (n.children) index(n.children, n); } })(MENU, null);
const trail = (n) => (n ? [...trail(n.parent), n] : []);
const badge = (s) => `<span class="badge ${s}">${STATUS[s]}</span>`;

function drawNav(activeId) {
  const li = (n, top) => `<li class="${top ? "top-item" : ""}"><a href="#${n.id}" class="${n.id === activeId ? "on" : ""}">${n.icon ? n.icon + " " : ""}${esc(n.title)}${badge(n.status)}</a>${n.children ? `<ul>${n.children.map((c) => li(c)).join("")}</ul>` : ""}</li>`;
  $("#nav").innerHTML = `<ul>${MENU.map((n) => li(n, true)).join("")}</ul>`;
}

// ---- 공용 ----
const stars = () => store.get("stars", []);
const toggleStar = (id) => { const s = stars(); store.set("stars", s.includes(id) ? s.filter((x) => x !== id) : [...s, id]); };
const sampleNote = '<p class="note">⚠ 화면 확인용 <b>예시 데이터</b>입니다. 실제 학교·편제표가 아닙니다.</p>';

// ---- 뷰 ----
const views = {
  home(el) {
    const s = stars();
    el.innerHTML = `<div class="panel"><b>관심 학교</b><p class="muted">${s.length ? s.map((id) => esc(SCHOOLS.find((x) => x.id === id)?.name || id)).join(", ") : "★을 누른 학교가 여기에 모입니다."}</p></div>
      <div class="panel"><b>이번 달 할 일</b><p class="muted">일정 데이터 연결 예정</p></div>
      <div class="panel"><b>최근 갱신 · 제도 변경</b><p class="muted">제도 변경 로그 연결 예정</p></div>`;
  },

  search(el) {
    el.innerHTML = `${sampleNote}<div class="tools"><input type="search" id="q" placeholder="과목명 검색">
      <select id="area"><option value="">교과군 전체</option>${[...new Set(SUBJECTS.map((s) => s.area))].map((a) => `<option>${esc(a)}</option>`).join("")}</select>
      <select id="track"><option>관심 계열: 미정</option><option>이과</option><option>문과</option><option>예체능</option></select></div>
      <div class="tw"><table><thead><tr><th class="l">과목</th><th>교과군</th><th>유형</th><th>개설 학교</th></tr></thead><tbody id="rows"></tbody></table></div>`;
    const draw = () => {
      const q = $("#q").value.trim(), a = $("#area").value;
      $("#rows").innerHTML = SUBJECTS.filter((s) => s.name.includes(q) && (!a || s.area === a))
        .map((s) => `<tr><td class="l">${esc(s.name)}</td><td>${esc(s.area)}</td><td>${esc(s.kind)}</td><td>${SCHOOLS.filter((x) => s.offered[x.id] > 0).map((x) => esc(x.name)).join(", ") || "-"}</td></tr>`).join("");
    };
    el.addEventListener("input", draw); draw();
  },

  compare(el) {
    const st = stars();
    el.innerHTML = `${sampleNote}<div class="tools"><label><input type="checkbox" id="diff"> 차이 나는 과목만 보기</label></div>
      <div class="tw"><table><thead><tr><th class="l">과목</th>${SCHOOLS.map((s) => `<th>${esc(s.name)}<br><button class="star" data-id="${s.id}" aria-label="관심">${st.includes(s.id) ? "★" : "☆"}</button></th>`).join("")}</tr></thead><tbody id="rows"></tbody>
      <tfoot id="sum"></tfoot></table></div>`;
    const draw = () => {
      const diff = $("#diff").checked; let area = "", html = "";
      for (const s of [...SUBJECTS].sort((a, b) => a.area.localeCompare(b.area, "ko"))) {
        const vals = SCHOOLS.map((x) => s.offered[x.id] > 0);
        if (diff && vals.every((v) => v === vals[0])) continue;
        if (s.area !== area) { area = s.area; html += `<tr class="area"><td colspan="${SCHOOLS.length + 1}">${esc(area)}</td></tr>`; }
        html += `<tr><td class="l">${esc(s.name)} <span class="muted">${esc(s.kind)}</span></td>${SCHOOLS.map((x) => (s.offered[x.id] > 0 ? `<td class="yes">○ ${s.offered[x.id]}</td>` : '<td class="no">✕</td>')).join("")}</tr>`;
      }
      $("#rows").innerHTML = html || `<tr><td colspan="${SCHOOLS.length + 1}">차이 나는 과목이 없습니다.</td></tr>`;
      $("#sum").innerHTML = `<tr><th class="l">개설 선택과목 수</th>${SCHOOLS.map((x) => `<th>${SUBJECTS.filter((s) => s.offered[x.id] > 0).length}</th>`).join("")}</tr>`;
    };
    $("#diff").addEventListener("change", draw);
    el.addEventListener("click", (e) => { const b = e.target.closest(".star"); if (!b) return; toggleStar(b.dataset.id); b.textContent = stars().includes(b.dataset.id) ? "★" : "☆"; });
    draw();
  },

  detail(el) {
    el.innerHTML = `${sampleNote}<div class="tools"><select id="sc">${SCHOOLS.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
      <span class="muted">기준연도 ○○ · 출처 ○○ · 수집일 ○○ (실데이터 연결 시 표시)</span></div>
      <div class="tw"><table><thead><tr><th class="l">교과군</th><th class="l">과목</th><th>유형</th><th>학점</th></tr></thead><tbody id="rows"></tbody></table></div>
      <div class="panel"><b>메모</b><textarea id="memo" placeholder="이 학교에 대한 메모 (이 브라우저에만 저장됩니다)"></textarea></div>`;
    const draw = () => {
      const id = $("#sc").value;
      $("#rows").innerHTML = SUBJECTS.filter((s) => s.offered[id] > 0).map((s) => `<tr><td class="l">${esc(s.area)}</td><td class="l">${esc(s.name)}</td><td>${esc(s.kind)}</td><td>${s.offered[id]}</td></tr>`).join("");
      $("#memo").value = store.get("memo:" + id, "");
    };
    $("#sc").addEventListener("change", draw);
    $("#memo").addEventListener("input", (e) => store.set("memo:" + $("#sc").value, e.target.value));
    draw();
  },
};

function render() {
  const id = decodeURIComponent(location.hash.slice(1)) || "home";
  const n = byId.get(id) || byId.get("home");
  drawNav(n.id);
  $("#nav").classList.remove("open");
  const kids = n.children
    ? `<div class="cards">${n.children.map((c) => `<a href="#${c.id}"><b>${esc(c.title)}</b> ${badge(c.status)}<div class="muted">${esc(c.desc || (c.children ? c.children.map((x) => x.title).join(" · ") : ""))}</div></a>`).join("")}</div>`
    : "";
  const parts = n.parts && !n.view ? `<div class="panel"><b>예정 구성</b><ul>${n.parts.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>` : "";
  $("#main").innerHTML = `<div class="crumb">${trail(n).map((t) => esc(t.title)).join(" › ")}</div>
    <h2>${esc(n.title)} ${badge(n.status)}</h2><p class="muted">${esc(n.desc || "")}</p>
    ${n.status !== "v1" ? '<p class="note">아직 구현 전인 메뉴입니다. 구조 확인용 자리표시입니다.</p>' : ""}
    <div id="view"></div>${parts}${kids}`;
  if (n.view) views[n.view]($("#view"));
}

$("#burger").addEventListener("click", () => $("#nav").classList.toggle("open"));
addEventListener("hashchange", render);
render();
