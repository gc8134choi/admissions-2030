import { openManifest, importFileKey, decrypt, decryptJson } from "./crypto.js";

const $ = (id) => document.getElementById(id);
const esc = (s = "") =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// 링크는 http(s)만 허용한다(javascript: 등 다른 주소는 링크로 만들지 않는다).
const safeUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : "");
const link = (url) => (safeUrl(url) ? ` <a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">출처</a>` : "");

let vault; // 복호화된 매니페스트
let fileKey;
const blobCache = new Map();

async function blobUrl(id) {
  if (!blobCache.has(id)) {
    blobCache.set(
      id,
      fetch(`vault/files/${id}.enc`)
        .then((r) => r.arrayBuffer())
        .then((buf) => decrypt(fileKey, buf))
        .then((plain) => URL.createObjectURL(new Blob([plain], { type: vault.files[id] })))
    );
  }
  return blobCache.get(id);
}

// 지연 로딩 표식({ "$lazy": id })이면 vault/data/<id>.enc 를 받아 복호화한다.
const lazyCache = new Map();
async function resolve(v) {
  if (!v || typeof v !== "object" || typeof v.$lazy !== "string") return v;
  if (!lazyCache.has(v.$lazy)) {
    lazyCache.set(
      v.$lazy,
      fetch(`vault/data/${v.$lazy}.enc`)
        .then((r) => {
          if (!r.ok) throw new Error(`데이터 파일을 받지 못했습니다 (${r.status})`);
          return r.arrayBuffer();
        })
        .then((buf) => decryptJson(fileKey, buf))
    );
  }
  return lazyCache.get(v.$lazy);
}

// 메뉴는 그룹({ children })과 섹션(화면)으로 이뤄진다. 화면 목록은 그룹을 펼친 섹션들이다.
const flatten = (list) => list.flatMap((x) => (x.children ? flatten(x.children) : [x]));
let leaves = [];

// 렌더러가 쓰는 도우미: load(이름)은 자기 섹션 데이터에서, 없으면 다른 섹션(통합 DB)의 데이터에서 "…/이름" 키를 찾아 읽는다
// (지연 로딩이면 그때 복호화).
function makeApi(data) {
  const find = (d, name) => (d && typeof d === "object" ? Object.keys(d).find((k) => k === name || k.endsWith(`/${name}`)) : undefined);
  return {
    blobUrl,
    openLightbox(url) {
      const lb = $("lightbox");
      lb.querySelector("img").src = url;
      lb.hidden = false;
    },
    async load(name) {
      const own = find(data, name);
      if (own) return resolve(data[own]);
      for (const s of leaves) {
        const k = find(s.data, name);
        if (k) return resolve(s.data[k]);
      }
      throw new Error(`데이터 없음: ${name}`);
    },
  };
}

// 섹션 타입별 렌더러. 새 메뉴 유형은 여기에 추가합니다.
const renderers = {
  db: (el, data, api) => import("./db-views.js").then((m) => m.renderDb(el, data, api)),
  ...Object.fromEntries(
    ["home", "timeline", "hstypes", "system", "policy", "sources", "soon"].map((t) => [t, (el, data, api, section) => import("./pages.js").then((m) => m.pages[t](el, data, api, section))])
  ),

  gallery(el, { items }) {
    el.innerHTML = `<input type="search" placeholder="학교·연도·제목 검색">
      <div class="grid"></div>`;
    const grid = el.querySelector(".grid");
    const draw = (q = "") => {
      const rows = items.filter((i) => [i.school, i.year, i.title, i.note].join(" ").toLowerCase().includes(q.toLowerCase()));
      grid.innerHTML = rows.length
        ? rows.map((i, n) => `<figure data-n="${n}">
            <div class="thumb" data-id="${esc((i.images || [i.image])[0] || "")}"></div>
            <figcaption><b>${esc(i.school || i.title || "(미확인)")}</b>
              <span class="muted">${esc([i.year, i.title && i.school ? i.title : "", i.note].filter(Boolean).join(" · "))}</span>${link(i.source)}
            </figcaption></figure>`).join("")
        : '<p class="empty">아직 등록된 항목이 없습니다.</p>';
      grid.querySelectorAll(".thumb").forEach(async (t) => {
        if (!t.dataset.id) return;
        const url = await blobUrl(t.dataset.id);
        t.innerHTML = `<img src="${url}" alt="">`; // blob 은 이미 메모리에 있어 lazy 불필요
        t.addEventListener("click", () => {
          const lb = $("lightbox");
          lb.querySelector("img").src = url;
          lb.hidden = false;
        });
      });
    };
    draw();
    el.querySelector("input").addEventListener("input", (e) => draw(e.target.value));
  },

  table(el, { columns, rows }) {
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td>${esc(r[c.key] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>`;
  },

  cards(el, { items }) {
    el.innerHTML = items.length
      ? `<ul class="cards">${items.map((i) => `<li>
          ${i.date ? `<div class="date">${esc(i.date)}</div>` : ""}<div class="title">${esc(i.title)}</div>
          <div>${esc(i.summary || "")}</div><div class="muted">${esc(i.note || "")}${link(i.source)}</div></li>`).join("")}</ul>`
      : '<p class="empty">아직 등록된 항목이 없습니다.</p>';
  },
};

const openGroups = new Set();
const groupOf = (id) => vault.sections.find((g) => g.children?.some((c) => c.id === id));

function drawNav(activeId) {
  const item = (c) => `<li><button class="item${c.id === activeId ? " active" : ""}" data-id="${esc(c.id)}">${esc(c.title)}${c.pri ? `<span class="dot">${esc(c.pri)}</span>` : ""}</button></li>`;
  $("tabs").innerHTML = vault.sections
    .map((x) => {
      if (!x.children) return `<ul class="solo">${item(x)}</ul>`;
      const open = openGroups.has(x.id);
      return `<div class="group"><button class="gtitle" data-g="${esc(x.id)}" aria-expanded="${open}"><span>${x.icon ? esc(x.icon) + " " : ""}${esc(x.title)}</span><span class="muted">${open ? "▾" : "▸"}</span></button>${open ? `<ul>${x.children.map(item).join("")}</ul>` : ""}</div>`;
    })
    .join("");
}

async function show(id) {
  const section = leaves.find((s) => s.id === id);
  openGroups.add(groupOf(id)?.id);
  drawNav(id);
  $("menu-current").textContent = section.title;
  $("tabs").classList.remove("open");
  $("menu-toggle").setAttribute("aria-expanded", "false");
  const main = $("main");
  main.innerHTML = `<h2>${esc(section.title)}</h2><div class="panel"></div>`;
  const panel = main.querySelector(".panel");
  history.replaceState(null, "", `#${id}`);
  try {
    const data = await resolve(section.data);
    const render = renderers[section.type];
    if (!render) panel.textContent = `지원하지 않는 유형: ${section.type}`;
    else await render(panel, data, makeApi(data), section);
  } catch (e) {
    panel.innerHTML = `<p class="empty">화면을 불러오지 못했습니다: ${esc(e.message)}</p>`;
  }
}

function start() {
  leaves = flatten(vault.sections);
  document.title = vault.title;
  $("site-title").textContent = vault.title;
  $("updated").textContent = `최종 업데이트: ${vault.updated}`;
  vault.sections.forEach((x) => x.children && openGroups.add(x.id));
  $("tabs").addEventListener("click", (e) => {
    const g = e.target.closest("[data-g]"), i = e.target.closest("[data-id]");
    if (g) {
      openGroups.has(g.dataset.g) ? openGroups.delete(g.dataset.g) : openGroups.add(g.dataset.g);
      drawNav(location.hash.slice(1));
    } else if (i) show(i.dataset.id);
  });
  $("menu-toggle").addEventListener("click", () => {
    const open = $("tabs").classList.toggle("open");
    $("menu-toggle").setAttribute("aria-expanded", String(open));
  });
  $("gate").hidden = true;
  $("app").hidden = false;
  const first = location.hash.slice(1);
  show(leaves.some((s) => s.id === first) ? first : leaves[0].id);
}

$("lightbox").addEventListener("click", () => ($("lightbox").hidden = true));

$("gate-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("gate-msg");
  msg.textContent = "확인 중…";
  try {
    const buf = await fetch("vault/manifest.enc").then((r) => {
      if (!r.ok) throw new Error("vault 없음");
      return r.arrayBuffer();
    });
    vault = await openManifest($("pw").value, buf);
    fileKey = await importFileKey(vault.fileKey);
    start();
  } catch {
    msg.textContent = "비밀번호가 올바르지 않거나 데이터를 불러오지 못했습니다.";
  }
});
