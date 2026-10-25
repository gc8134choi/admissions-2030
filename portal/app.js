import { MENU, STATUS } from "./menu.js";

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

// ---- 데이터 ----
const cache = new Map();
const load = (name) => {
  if (!cache.has(name)) cache.set(name, fetch(`data/${name}.json`).then((r) => { if (!r.ok) throw new Error(name); return r.json(); }));
  return cache.get(name);
};
const stars = () => store.get("stars", []);
const toggleStar = (id) => { const s = stars(); store.set("stars", s.includes(id) ? s.filter((x) => x !== id) : [...s, id]); };
const nameOf = (schools, id) => schools.find((s) => s.id === id)?.name || id;
const SLOT = { required: "지정", elective: "선택", outside: "교외" };
const CSAT = { in: "포함", base: "기초", out: "제외", none: "-" };
const dataNote = '<p class="note">편제표 값은 AI가 학교 배부 사진에서 옮긴 것으로, 일부(flag 22행)만 사진과 대조했습니다. 수능 범위는 2028 통합형 수능 기준 <b>추정</b>이며, 편제표는 개설 가능 <b>후보</b>입니다. 중요한 결정 전에는 원본으로 확인하세요.</p>';
const options = (items, all) => `${all ? `<option value="">${esc(all)}</option>` : ""}${items.map((v) => `<option value="${esc(v.v ?? v)}">${esc(v.t ?? v)}</option>`).join("")}`;
const kindOf = (o) => (o.primaryKind ? o.primaryKind + (o.kindStatus === "inferred" ? "?" : "") : "미표기");

// ---- 뷰 ----
const views = {
  async home(el) {
    const [schools, summary] = await Promise.all([load("schools"), load("summary")]);
    const s = stars();
    el.innerHTML = `<div class="panel"><b>관심 학교</b><p class="muted">${s.length ? s.map((id) => `<a href="#select/curriculum?tab=detail&s=${esc(id)}">${esc(nameOf(schools, id))}</a>`).join(", ") : "비교 화면의 ☆을 누르면 여기에 모입니다."}</p></div>
      <div class="panel"><b>편제표 등록 현황</b><p class="muted">${summary.length}개교 · ${summary[0].entryYear}학년도 입학생(대입 ${summary[0].entryYear + 3}학년도) 기준</p>
      <div class="cards">${summary.map((m) => `<a href="#select/curriculum?tab=detail&s=${esc(m.schoolId)}"><b>${esc(m.schoolName)}</b><div class="muted">${esc(m.region || "")} · ${esc(m.schoolType || "")} · ${esc(m.founding || "")}</div><div>지정 ${m.creditsRequired} / 선택 ${m.creditsElective}학점</div></a>`).join("")}</div></div>
      <div class="panel"><b>이번 달 할 일</b><p class="muted">일정 데이터 연결 예정</p></div>`;
  },

  async search(el) {
    const [subjects, schools] = await Promise.all([load("subjects"), load("schools")]);
    el.innerHTML = `${dataNote}<div class="tools"><input type="search" id="q" placeholder="과목명 검색">
      <select id="area">${options([...new Set(subjects.map((s) => s.area))], "교과군 전체")}</select>
      <select id="kind">${options(["공통", "일반", "진로", "융합"], "구분 전체")}</select>
      <select id="sch">${options(schools.map((s) => ({ v: s.id, t: s.name })), "학교 전체")}</select>
      <label><input type="checkbox" id="only1"> 한 학교에만 있는 과목</label><span class="muted" id="cnt"></span></div>
      <div class="tw"><table><thead><tr><th class="l">과목</th><th>교과군</th><th>구분</th><th>수능 범위(추정)</th><th class="l">개설 학교</th></tr></thead><tbody id="rows"></tbody></table></div>`;
    const draw = () => {
      const q = $("#q").value.replace(/\s/g, ""), a = $("#area").value, k = $("#kind").value, sc = $("#sch").value, one = $("#only1").checked;
      const rows = subjects.filter((s) => (!q || s.name.replace(/\s/g, "").includes(q) || s.aliases.some((x) => x.replace(/\s/g, "").includes(q))) && (!a || s.area === a) && (!k || s.kindsPrinted.includes(k)) && (!sc || s.offeredBy.includes(sc)) && (!one || s.schoolCount === 1));
      $("#cnt").textContent = `${rows.length}개`;
      $("#rows").innerHTML = rows.map((s) => `<tr><td class="l">${esc(s.name)}</td><td>${esc(s.area)}</td><td>${esc(s.kindsPrinted.join("·") || "미표기")}</td><td>${CSAT[s.csatScope] || "-"}${s.csatArea ? " (" + esc(s.csatArea) + ")" : ""}</td><td class="l">${s.offeredBy.map((id) => esc(nameOf(schools, id).replace("등학교", ""))).join(", ")}</td></tr>`).join("") || '<tr><td colspan="5">조건에 맞는 과목이 없습니다.</td></tr>';
    };
    el.addEventListener("input", draw); draw();
  },

  async compare(el) {
    const [summary, matrix] = await Promise.all([load("summary"), load("subject-matrix")]);
    const sch = summary.map((m) => ({ id: m.schoolId, name: m.schoolName }));
    const pct = (a, b) => `${a} (${Math.round((a / b) * 100)}%)`;
    const rows = [
      ["총 이수학점", (m) => m.creditsTotal], ["지정 학점", (m) => pct(m.creditsRequired, m.creditsSubject)], ["선택 학점", (m) => pct(m.creditsElective, m.creditsSubject)],
      ["지정 과목 수", (m) => m.requiredCount], ["택n 묶음 수", (m) => m.groupCount], ["선택해야 하는 과목 수", (m) => m.pickTotal],
      ["선택 후보 과목 수", (m) => m.candidateSubjects], ["선택 폭 (후보÷선택 수)", (m) => m.breadth], ["선택이 처음 나오는 학기", (m) => m.firstElectiveTerm],
      ["확인 필요 건수", (m) => m.reviewCount],
    ];
    const terms = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];
    const st = stars();
    el.innerHTML = `${dataNote}
      <h3>학교 구조 비교</h3><div class="tw"><table><thead><tr><th class="l"></th>${sch.map((s) => `<th>${esc(s.name)}<br><button class="star" data-id="${esc(s.id)}" aria-label="관심">${st.includes(s.id) ? "★" : "☆"}</button></th>`).join("")}</tr></thead>
      <tbody>${rows.map(([l, f]) => `<tr><td class="l">${l}</td>${summary.map((m) => `<td>${esc(f(m) ?? "-")}</td>`).join("")}</tr>`).join("")}
      <tr class="area"><td colspan="${sch.length + 1}">학기별 지정 / 선택 학점</td></tr>
      ${terms.map((t) => `<tr><td class="l">${t}</td>${summary.map((m) => { const b = m.byTerm[t]; return `<td>${b.required} / ${b.elective}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
      <h3>과목 × 학교</h3><div class="tools"><select id="area">${options([...new Set(matrix.map((m) => m.area))], "교과군 전체")}</select>
      <label><input type="checkbox" id="diff"> 차이 나는 과목만</label><label><input type="checkbox" id="elec"> 선택과목만</label><span class="muted" id="cnt"></span></div>
      <div class="tw"><table><thead><tr><th class="l">과목</th>${sch.map((s) => `<th>${esc(s.name)}</th>`).join("")}</tr></thead><tbody id="rows"></tbody></table></div>`;
    const cell = (c) => (c ? `<td class="yes">${c.slots.map((x) => SLOT[x]).join("/")}<br><span class="muted">${esc(c.terms.join(", "))}</span></td>` : '<td class="no">✕</td>');
    const draw = () => {
      const a = $("#area").value, diff = $("#diff").checked, elec = $("#elec").checked; let area = "", html = "", n = 0;
      for (const m of matrix) {
        if (a && m.area !== a) continue;
        const cs = sch.map((s) => m.cells[s.id]);
        if (elec && !cs.some((c) => c && c.slots.includes("elective"))) continue;
        const sig = cs.map((c) => (c ? c.slots.join("+") : "-"));
        if (diff && sig.every((x) => x === sig[0])) continue;
        if (m.area !== area) { area = m.area; html += `<tr class="area"><td colspan="${sch.length + 1}">${esc(area)}</td></tr>`; }
        html += `<tr><td class="l">${esc(m.name)}</td>${cs.map(cell).join("")}</tr>`; n++;
      }
      $("#cnt").textContent = `${n}개`;
      $("#rows").innerHTML = html || `<tr><td colspan="${sch.length + 1}">조건에 맞는 과목이 없습니다.</td></tr>`;
    };
    el.addEventListener("change", (e) => { if (e.target.matches("#area,#diff,#elec")) draw(); });
    el.addEventListener("click", (e) => { const b = e.target.closest(".star"); if (!b) return; toggleStar(b.dataset.id); b.textContent = stars().includes(b.dataset.id) ? "★" : "☆"; });
    draw();
  },

  async detail(el, query) {
    const [schools, summary, offerings, groups] = await Promise.all([load("schools"), load("summary"), load("offerings"), load("groups")]);
    const terms = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];
    el.innerHTML = `${dataNote}<div class="tools"><select id="sc">${options(schools.map((s) => ({ v: s.id, t: s.name })))}</select>
      <select id="term">${options(terms, "전체 학기")}</select></div><div id="info"></div>
      <div class="tw"><table><thead><tr><th>학기</th><th class="l">교과군</th><th class="l">과목</th><th>구분</th><th>학점</th><th>수능(추정)</th></tr></thead><tbody id="rows"></tbody></table></div>
      <div class="panel"><b>메모</b><textarea id="memo" placeholder="이 학교에 대한 메모 (이 브라우저에만 저장됩니다)"></textarea></div>`;
    if (query.get("s") && schools.some((s) => s.id === query.get("s"))) $("#sc").value = query.get("s");
    const draw = () => {
      const id = $("#sc").value, t = $("#term").value, sm = summary.find((m) => m.schoolId === id), sc = schools.find((s) => s.id === id);
      const src = (sc._meta?.source || []).filter((x) => x.kind !== "self");
      $("#info").innerHTML = `<div class="panel"><b>${esc(sc.name)}</b> <span class="muted">${esc([sc.region, sc.schoolType, sc.founding, sm?.gender, sm?.assignment].filter(Boolean).join(" · "))}</span>
        <div>${sm ? `${sm.entryYear}학년도 입학생 · 총 ${sm.creditsTotal}학점 (지정 ${sm.creditsRequired} / 선택 ${sm.creditsElective}${sm.creditsOutside ? ` / 교외 ${sm.creditsOutside}` : ""}) · 확인 필요 ${sm.reviewCount}건` : ""}</div>
        <div class="muted">정보 수집일 ${esc(sc._meta?.updated || "-")}${src.length ? " · 출처 " + src.map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(", ") : ""}</div></div>`;
      const list = offerings.filter((o) => o.schoolId === id && (!t || o.term === t)).sort((a, b) => a.term.localeCompare(b.term) || (a.slot === b.slot ? (a.groupId || "").localeCompare(b.groupId || "") || a.seq - b.seq : a.slot === "required" ? -1 : 1));
      let html = "", cur = "";
      for (const o of list) {
        const key = o.term + "|" + (o.groupId || o.slot);
        if (key !== cur) {
          cur = key;
          const g = o.groupId && groups.find((x) => x.id === o.groupId);
          html += `<tr class="area"><td colspan="6">${o.term} · ${g ? `택${g.pick}/${g.size} (과목당 ${g.creditsEach}학점)` : SLOT[o.slot] + " 과목"}</td></tr>`;
        }
        html += `<tr><td>${o.term}</td><td class="l">${esc(o.area)}</td><td class="l">${esc(o.subject)}${o.openFlagIds.length ? ' <span title="판독 확인 필요">⚠️</span>' : ""}</td><td>${esc(kindOf(o))}</td><td>${o.credits}</td><td>${CSAT[o.csatScope] || "-"}</td></tr>`;
      }
      $("#rows").innerHTML = html || '<tr><td colspan="6">해당 학기의 과목이 없습니다.</td></tr>';
      $("#memo").value = store.get("memo:" + id, "");
    };
    $("#sc").addEventListener("change", draw);
    $("#term").addEventListener("change", draw);
    $("#memo").addEventListener("input", (e) => store.set("memo:" + $("#sc").value, e.target.value));
    draw();
  },

  async curriculum(el, query) {
    const tabs = [["compare", "학교 비교"], ["search", "과목 검색"], ["detail", "학교 상세"]];
    const tab = tabs.some(([k]) => k === query.get("tab")) ? query.get("tab") : "compare";
    el.innerHTML = `<div class="subtabs">${tabs.map(([k, t]) => `<a href="#select/curriculum?tab=${k}" class="${k === tab ? "on" : ""}">${t}</a>`).join("")}</div><div id="tabview"></div>`;
    await views[tab]($("#tabview"), query);
  },

  async sources(el) {
    const schools = await load("schools");
    el.innerHTML = schools.map((s) => `<div class="panel"><b>${esc(s.name)}</b><ul>${(s._meta?.source || []).map((x) => `<li>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name)} <span class="muted">${esc(x.kind)} · ${esc(x.retrieved || "")}</span></li>`).join("")}</ul></div>`).join("");
  },

  async status(el) {
    const [schools, summary] = await Promise.all([load("schools"), load("summary")]);
    el.innerHTML = `<div class="tw"><table><thead><tr><th class="l">학교</th><th>입학학년도</th><th>정보 수집일</th><th>편제표 신뢰도</th><th>열린 flag</th><th>구분 미표기 행</th><th>확인 필요</th></tr></thead><tbody>${summary.map((m) => { const sc = schools.find((s) => s.id === m.schoolId); return `<tr><td class="l">${esc(m.schoolName)}</td><td>${m.entryYear}</td><td>${esc(sc?._meta?.updated || "-")}</td><td>${esc(m.confidence)}</td><td>${m.flagsOpen}</td><td>${m.kindMissingRows}</td><td>${m.reviewCount}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="muted">unverified = 사진 대조 전 / reported = 보도·사용자 확인 / verified = 대조 완료</p>`;
  },
};

function render() {
  const [path, qs] = decodeURIComponent(location.hash.slice(1)).split("?");
  const query = new URLSearchParams(qs || "");
  const id = path || "home";
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
  if (n.view) views[n.view]($("#view"), query).catch(() => ($("#view").innerHTML = '<p class="note">데이터를 불러오지 못했습니다. 페이지를 새로고침해 보세요.</p>'));
}

$("#burger").addEventListener("click", () => $("#nav").classList.toggle("open"));
addEventListener("hashchange", render);
render();
