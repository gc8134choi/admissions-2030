// 출처 표시 공용 부품: 출처·기준연도·확인일·근거는 기본으로 숨기고, 필요할 때 "출처" 버튼 한 번으로 연다.
// 곧바로 보이는 것은 제목·핵심 값·행동 링크·상태(보도/추정/미정) 점 하나뿐이다. 데이터는 그대로이고 표시만 바꾼다.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// 이미 만든 출처 HTML(링크 등)을 "출처" 버튼 뒤로 접는다. checked는 확인일(있으면 같이 보임).
export function srcWrap(inner, { checked = "", label = "출처" } = {}) {
  if (!inner || !String(inner).trim()) return "";
  return `<span class="srcw"><button type="button" class="srcb" aria-expanded="false" aria-label="${esc(label)} 보기">${esc(label)}</button><span class="srcp" hidden>${inner}${checked ? ` <span class="srcd">확인 ${esc(checked)}</span>` : ""}</span></span>`;
}

// 행 하나의 출처 → 버튼. r: { sources[]|sourceName+sourceUrl, checkedAt }
export function srcRef(r) {
  const list = r.sources || (r.sourceName ? [{ name: r.sourceName, url: r.sourceUrl }] : []);
  const html = list.map((x) => (x.url && /^https?:\/\//.test(x.url) ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)} ↗</a>` : esc(x.name))).join(" · ");
  return srcWrap(html, { checked: r.checkedAt || "" });
}

// 섹션·화면 맨 아래: 같은 출처는 한 번만 모아 접이식 한 줄로. items: [{name,url,asOf?}]
export function srcFooter(items, title = "이 화면의 출처") {
  const seen = new Map();
  for (const x of items || []) { if (x?.name && !seen.has(x.name + "|" + (x.url || ""))) seen.set(x.name + "|" + (x.url || ""), x); }
  const l = [...seen.values()];
  if (!l.length) return "";
  return `<details class="srcf"><summary>${esc(title)} ${l.length}건</summary><ul>${l.map((x) => `<li>${x.url && /^https?:\/\//.test(x.url) ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)} ↗</a>` : esc(x.name)}${x.asOf ? ` <span class="srcd">${esc(x.asOf)} 기준</span>` : ""}</li>`).join("")}</ul></details>`;
}

// 이미 그려진 "출처 …" 줄(.ed-s)을 버튼으로 바꾼다. 화면마다 자기 방식으로 쓴 출처 줄을 한 곳에서 정리한다.
export function foldSources(root) {
  if (!root) return;
  root.querySelectorAll(".ed-s, .src-line").forEach((p) => {
    if (p.dataset.folded || p.closest(".srcp, .srcf")) return;
    const t = (p.textContent || "").trim();
    if (!/^출처/.test(t)) return;
    p.dataset.folded = "1";
    const inner = p.innerHTML.replace(/^\s*출처[:\s]*/, "").trim();
    if (!inner) return;
    p.innerHTML = srcWrap(inner);
    p.classList.add("ed-s-fold");
  });
}

// 문서 어디서나 한 번만: 출처 버튼을 누르면 그 자리에서 펼치고 접힌다. Esc는 열린 것을 모두 닫는다.
export function initSrcRef() {
  if (initSrcRef.done) return; initSrcRef.done = true;
  const set = (b, on) => { b.setAttribute("aria-expanded", on); const p = b.nextElementSibling; if (p) p.hidden = !on; };
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".srcb");
    if (b) { set(b, b.getAttribute("aria-expanded") !== "true"); return; }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.querySelectorAll('.srcb[aria-expanded="true"]').forEach((b) => set(b, false)); });
}
