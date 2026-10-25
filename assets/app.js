import { openManifest, importFileKey, decrypt } from "./crypto.js";

const $ = (id) => document.getElementById(id);
const esc = (s = "") =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const link = (url) => (url ? ` <a href="${esc(url)}" target="_blank" rel="noopener">출처</a>` : "");

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

// 섹션 타입별 렌더러. 새 메뉴 유형은 여기에 추가합니다.
const renderers = {
  gallery(el, { items }) {
    el.innerHTML = `<input type="search" placeholder="학교·연도·제목 검색">
      <div class="grid"></div>`;
    const grid = el.querySelector(".grid");
    const draw = (q = "") => {
      const rows = items.filter((i) => [i.school, i.year, i.title, i.note].join(" ").toLowerCase().includes(q.toLowerCase()));
      grid.innerHTML = rows.length
        ? rows.map((i, n) => `<figure data-n="${n}">
            <div class="thumb" data-id="${esc((i.images || [i.image])[0] || "")}"></div>
            <figcaption><b>${esc(i.school || i.title)}</b>
              <span class="muted">${esc([i.year, i.title && i.school ? i.title : "", i.note].filter(Boolean).join(" · "))}</span>${link(i.source)}
            </figcaption></figure>`).join("")
        : '<p class="empty">아직 등록된 항목이 없습니다.</p>';
      grid.querySelectorAll(".thumb").forEach(async (t) => {
        if (!t.dataset.id) return;
        const url = await blobUrl(t.dataset.id);
        t.innerHTML = `<img src="${url}" loading="lazy" alt="">`;
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

function show(id) {
  const section = vault.sections.find((s) => s.id === id);
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
  const main = $("main");
  main.innerHTML = `<h2>${esc(section.title)}</h2><div class="panel"></div>`;
  (renderers[section.type] || (() => (main.querySelector(".panel").textContent = `지원하지 않는 유형: ${section.type}`)))(
    main.querySelector(".panel"),
    section.data
  );
  history.replaceState(null, "", `#${id}`);
}

function start() {
  document.title = vault.title;
  $("site-title").textContent = vault.title;
  $("updated").textContent = `최종 업데이트: ${vault.updated}`;
  $("tabs").innerHTML = vault.sections
    .map((s) => `<button class="tab" role="tab" data-id="${esc(s.id)}">${esc(s.title)}</button>`)
    .join("");
  $("tabs").addEventListener("click", (e) => e.target.dataset.id && show(e.target.dataset.id));
  $("gate").hidden = true;
  $("app").hidden = false;
  const first = location.hash.slice(1);
  show(vault.sections.some((s) => s.id === first) ? first : vault.sections[0].id);
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
