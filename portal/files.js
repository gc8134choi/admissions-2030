// 자료실 > 원본 파일: data/files.json 목록을 썸네일 카드로 보여 주고, 눌러서 전체 화면 뷰어로 연다.
// 뷰어는 어느 화면에서든 열 수 있다(예: 고교 유형·전형 일정의 "원본 양식 보기" 버튼).
const TOPIC = { "high-school-assignment": "고교 배정" };

export function registerFiles(views, { esc, load, nm }) {
  let last = null; // 뷰어를 닫을 때 포커스를 돌려줄 요소

  const closeViewer = () => {
    const v = document.querySelector(".fv");
    if (!v) return;
    v.remove();
    document.body.classList.remove("fv-open");
    document.removeEventListener("keydown", onKey);
    last?.focus?.();
  };
  const onKey = (e) => { if (e.key === "Escape") closeViewer(); };

  // 전체 화면 뷰어: 확대·축소·맞춤, 새 탭 열기, 닫기. 이미지가 없으면 "파일 준비 중".
  function openViewer(f) {
    closeViewer();
    last = document.activeElement;
    let zoom = 1;
    const v = document.createElement("div");
    v.className = "fv";
    v.setAttribute("role", "dialog");
    v.setAttribute("aria-modal", "true");
    v.setAttribute("aria-label", f.title);
    v.innerHTML = `<div class="fv-bar"><b class="fv-title">${esc(f.title)}</b>
        <span class="fv-tools"><button type="button" class="ib" data-z="-" aria-label="축소" title="축소">−</button><span class="fv-pct">100%</span><button type="button" class="ib" data-z="+" aria-label="확대" title="확대">+</button><button type="button" class="ib" data-z="fit" title="화면에 맞춤">맞춤</button>
        <a class="ib" href="${esc(f.file)}" target="_blank" rel="noopener" title="새 탭에서 원본 열기">새 탭</a><button type="button" class="ib fv-x" aria-label="닫기" title="닫기(Esc)">×</button></span></div>
      <div class="fv-stage"><img class="fv-img" src="${esc(f.file)}" alt="${esc(f.title)}" draggable="false"></div>`;
    document.body.appendChild(v);
    document.body.classList.add("fv-open");
    document.addEventListener("keydown", onKey);
    const img = v.querySelector(".fv-img"), stage = v.querySelector(".fv-stage"), pct = v.querySelector(".fv-pct");
    const set = (z) => { zoom = Math.min(5, Math.max(0.5, z)); img.style.width = `${zoom * 100}%`; pct.textContent = `${Math.round(zoom * 100)}%`; };
    img.addEventListener("error", () => { stage.innerHTML = '<p class="fv-none">파일 준비 중입니다.</p>'; v.querySelector(".fv-tools").classList.add("off"); });
    v.addEventListener("click", (e) => {
      if (e.target === stage || e.target.closest(".fv-x")) return closeViewer();
      const z = e.target.closest("[data-z]")?.dataset.z;
      if (z) set(z === "+" ? zoom + 0.25 : z === "-" ? zoom - 0.25 : 1);
    });
    img.addEventListener("dblclick", () => set(zoom > 1 ? 1 : 2));
    stage.addEventListener("wheel", (e) => { if (e.ctrlKey) { e.preventDefault(); set(zoom + (e.deltaY < 0 ? 0.15 : -0.15)); } }, { passive: false });
    v.querySelector(".fv-x").focus();
  }

  const card = (f, schools) => `<button type="button" class="fl-card" data-id="${esc(f.id)}">
      <span class="fl-thumb"><img src="${esc(f.thumb || f.file)}" alt="" loading="lazy"><span class="fl-none">파일 준비 중</span></span>
      <span class="fl-body"><b>${esc(f.title)}</b>${f.description ? `<span class="muted small">${esc(f.description)}</span>` : ""}
        <span class="fl-meta muted small">${[TOPIC[f.topic] || f.topic, f.source, f.date].filter(Boolean).map(esc).join(" · ")}</span>
        ${(f.schoolIds || []).length ? `<span class="fl-sch">${f.schoolIds.map((id) => nm(id, schools.find((s) => s.id === id)?.name || id, 18)).join(" ")}</span>` : ""}</span></button>`;

  views.files = async (el, query) => {
    const [files, schools] = await Promise.all([load("files"), load("schools")]);
    el.innerHTML = files.length ? `<div class="fl-grid">${files.map((f) => card(f, schools)).join("")}</div><p class="muted small">카드를 누르면 크게 볼 수 있습니다. 학교에서 받은 원본 사진·양식입니다.</p>` : '<p class="muted">등록된 원본 파일이 없습니다.</p>';
    // 이미지가 없으면(아직 올리기 전) 썸네일 대신 "파일 준비 중"만 보인다
    el.querySelectorAll(".fl-thumb img").forEach((im) => { const miss = () => im.closest(".fl-thumb").classList.add("miss"); im.addEventListener("error", miss); if (im.complete && im.naturalWidth === 0) miss(); });
    el.addEventListener("click", (e) => { const c = e.target.closest(".fl-card"); if (c) openViewer(files.find((f) => f.id === c.dataset.id)); });
    const open = query.get("open"); if (open) { const f = files.find((x) => x.id === open); if (f) openViewer(f); }
  };

  // 다른 화면에 "원본 양식 보기" 버튼 붙이기: 화면이 그려진 뒤 호출한다(해당 화면 파일은 건드리지 않는다).
  async function decorateTypes(el) {
    const h = [...el.querySelectorAll("h3")].find((x) => x.textContent.includes("용인 평준화 배정"));
    if (!h || h.querySelector(".fl-open")) return;
    const files = (await load("files")).filter((f) => f.topic === "high-school-assignment");
    for (const f of files) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn fl-open"; b.textContent = "원본 양식 보기";
      b.title = f.title;
      b.addEventListener("click", () => openViewer(f));
      h.appendChild(b);
    }
  }

  return { openViewer, afterView: (name, el) => (name === "types" ? decorateTypes(el) : null) };
}
