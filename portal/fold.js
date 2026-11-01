// 화면 밀도 도구(서브 담당 화면 공용): 긴 화면을 "한 줄 요약 + 펼침"으로 접는다. 이미 그려진 DOM에 적용한다.
//   densify(root, { open: [0], keep: 5, chars: 110, stop: "…" })
//   groups:false 면 ①의 h2 형제 묶기는 하지 않고 <section>만 접는다.
//   ① 섹션 접기: <section><h2>…</h2>본문</section> 또는 h2 + 뒤따르는 형제들 → <details class="dn"> (summary = 제목 + 개수 + 첫 항목 한 줄). open 번호만 처음부터 펼침.
//   ② 목록 더 보기: .ed-rows의 카드/표 행이 keep개를 넘으면 나머지를 숨기고 "더 보기 (n)" 버튼.
//   ③ 긴 문단 줄이기: .ed-b가 chars자를 넘으면 3줄까지만 보이고 "자세히" 버튼.
// 여러 번 불러도 중복되지 않는다(data-dn). 접힌 안의 내용은 그대로 DOM에 있어서 용어 ⓘ·검색에 영향이 없다.
const one = (s, n = 46) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

function mkDetails(head, nodes, isOpen) {
  const d = document.createElement("details");
  d.className = "dn"; d.dataset.dn = "1"; if (isOpen) d.open = true;
  const s = document.createElement("summary");
  const title = head.textContent.replace(/\s+/g, " ").trim();
  const first = nodes.map((n) => n.querySelector?.(".ed-row h3, tbody tr td, h3, p")).find(Boolean);
  const count = nodes.reduce((n, x) => n + (x.querySelectorAll?.(".ed-row, tbody tr").length || 0), 0);
  s.innerHTML = `<b></b>${count > 1 ? ` <span class="muted small dn-n">${count}</span>` : ""}${first ? ` <span class="muted small dn-h"></span>` : ""}`;
  s.querySelector("b").textContent = title.replace(/\s*\d+$/, "");
  if (first) s.querySelector(".dn-h").textContent = one(first.textContent);
  d.append(s, ...nodes);
  return d;
}

export function densify(root, { open = [0], keep = 5, chars = 110, groups = true, stop = "#pstw,#ptbl,.subtabs,.tabs,.ed-top,.ed-filter,.chipbar" } = {}) {
  if (!root) return;
  let i = 0;
  // (a) <section><h2>…</h2>…</section>
  for (const sec of [...root.querySelectorAll("section")]) {
    if (sec.dataset.dn || sec.closest("details.dn") || sec.parentElement.closest("section")) continue;
    const h = sec.firstElementChild;
    if (!h || !/^H[23]$/.test(h.tagName)) continue;
    const d = mkDetails(h, [...sec.children].slice(1), open.includes(i++));
    if (sec.id) d.id = sec.id;
    sec.replaceWith(d);
  }
  // (b) h2 + 뒤따르는 형제들(멈춤 선택자 앞까지)
  for (const box of groups ? [root, ...root.querySelectorAll(".ed, #ptbl")] : []) {
    for (const h of [...box.children].filter((c) => c.tagName === "H2" && !c.closest("summary"))) {
      if (h.dataset.dn) continue;
      const kids = []; let n = h.nextElementSibling;
      while (n && n.tagName !== "H2" && !n.matches(stop)) { kids.push(n); n = n.nextElementSibling; }
      if (!kids.length) continue;
      const d = mkDetails(h, kids, open.includes(i++));
      h.replaceWith(d);
    }
  }
  // (c) 목록 더 보기
  for (const list of root.querySelectorAll(".ed-rows, tbody")) {
    if (list.dataset.dnMore) continue;
    const items = [...list.children].filter((c) => c.matches(".ed-row, tr"));
    if (items.length <= keep + 1) continue;
    list.dataset.dnMore = "1";
    const rest = items.slice(keep); rest.forEach((x) => (x.hidden = true));
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "dn-more"; btn.textContent = `더 보기 (${rest.length})`;
    btn.onclick = () => { const on = rest[0].hidden; rest.forEach((x) => (x.hidden = !on)); btn.textContent = on ? "접기" : `더 보기 (${rest.length})`; };
    (list.tagName === "TBODY" ? list.closest("table").parentElement : list.parentElement).insertBefore(btn, (list.tagName === "TBODY" ? list.closest("table") : list).nextSibling);
  }
  // (d) 긴 문단 3줄 + 자세히
  for (const p of root.querySelectorAll(".ed-b, .ed-row > p")) {
    if (p.dataset.dnClamp || p.closest("summary") || p.textContent.length <= chars) continue;
    p.dataset.dnClamp = "1"; p.classList.add("dn-clamp");
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "dn-more dn-detail"; btn.textContent = "자세히";
    btn.onclick = () => { const on = p.classList.toggle("dn-clamp"); btn.textContent = on ? "자세히" : "접기"; };
    p.after(btn);
  }
}
