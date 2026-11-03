// 검색 결과에서 온 "?hl=<제목 앞부분>" 주소: 접힌 "더 보기"·접이식을 펴서 그 행을 찾아 강조하고 그 자리로 간다.
const key = (s) => String(s || "").replace(/ⓘ|·/g, "").replace(/\s+/g, "").toLowerCase();
export function applyHl() {
  const hl = new URLSearchParams(decodeURIComponent(location.hash.slice(1)).split("?")[1] || "").get("hl");
  if (!hl) return;
  const colName = new URLSearchParams(decodeURIComponent(location.hash.slice(1)).split("?")[1] || "").get("col"); // col=학교 이름: 비교 표에서 그 학교 칸도 강조하고 가로로 보이게
  const inTr = new URLSearchParams(decodeURIComponent(location.hash.slice(1)).split("?")[1] || "").get("in") === "tr"; // in=tr: 표의 행만 찾는다(요약 카드가 아니라 비교 표의 학교 줄)
  const k = key(hl).slice(0, 16), k3 = key(hl).slice(0, 8), k4 = key(String(hl).replace(/[(（].*$/, "")).slice(0, 16), k2 = key(String(hl).replace(/^\s*\d{4}[-.]\d{1,2}(?:[-.]\d{1,2})?\s*/, "")).slice(0, 16); if (k.length < 2) return; // 변경 소식 제목은 앞의 날짜(2025-06)가 화면에서 따로 쓰여 있어 날짜를 뺀 제목으로도 찾는다
  let tries = 0; const at = location.hash.split("?")[0]; // 화면이 주소의 ?뒤를 다시 쓰므로(필터 동기화) 처음 읽은 값을 쓰고, 다른 화면으로 가면 멈춘다
  const pick = () => {
    const cand = [...document.querySelectorAll(inTr ? "#main tbody tr" : "#main .ed-row, #main tr, #main li, #main summary, #main dd, #main td, #main th, #main h2, #main h3, #main h4, #main label, #main p, #main .aux")].filter((e) => { const t = key(e.textContent); return t.includes(k) || (k2.length >= 4 && t.includes(k2)) || (tries > 14 && k4.length >= 2 && k4 !== k && t.includes(k4)); });
    if (!cand.length && tries > 12) cand.push(...[...document.querySelectorAll("#main .ed-row, #main tr, #main li, #main summary, #main dd, #main td, #main p")].filter((e) => k3.length >= 6 && key(e.textContent).includes(k3))); // 오래 못 찾으면 제목 앞 8자로 느슨하게
    // 제목 칸(b·strong·제목 요소)에 찾는 말이 든 줄을 먼저(본문에만 그 말이 나오는 다른 줄이 강조되지 않게), 없으면 가장 안쪽 일치
    const inTitle = (c) => [...c.querySelectorAll("b, strong, h2, h3, h4, .lg-t, .ed-t")].some((x) => { const t = key(x.textContent); return t.includes(k) || (k2.length >= 4 && t.includes(k2)); });
    const el = cand.find((c) => !cand.some((o) => o !== c && c.contains(o)) && inTitle(c)) || cand.find((c) => inTitle(c)) || cand.find((c) => !cand.some((o) => o !== c && c.contains(o)));
    return el;
  };
  let first = -1;
  const t = setInterval(() => {
    if (tries > 3 && tries % 3 === 0) document.querySelector("#rowsmore [data-all]")?.click(); // 비교 표의 "모두 보기"(과목을 나눠 그리는 표)
    if (tries === 7) document.querySelectorAll("#main details:not([open])").forEach((d) => { if (/비교/.test(d.querySelector(":scope > summary")?.textContent || "")) d.open = true; }); // 늦게 그려지는 비교 표 접이식을 먼저 편다
    if (tries === 25) document.querySelectorAll("#main details:not([open])").forEach((d) => { d.open = true; }); // 그래도 없으면 접이식을 모두 편다
    if (++tries > 60 || location.hash.split("?")[0] !== at) return clearInterval(t);
    const el = pick();
    if (!el) return;
    /* 같은 주소를 열 때마다 같은 줄이 되게: 처음 찾은 줄이 "글자가 딱 맞는 제목 줄"이 아니면 0.8초 더 기다려 늦게 그려지는 더 알맞은 줄이 있는지 본 뒤 정한다 */
    const exact = (e) => { const c = e.matches?.("tr") ? e.querySelector("th, td") : e.querySelector?.("b, strong, .lg-t, .ed-t, h2, h3, h4, summary") || e; return key(c.textContent) === k; };
    if (first < 0) first = tries;
    if (!exact(el) && tries - first < 4) return;
    clearInterval(t);
    const tl = el.closest("#tl"); if (tl && !tl.classList.contains("all")) { tl.classList.add("all"); tl.querySelector(".more-rows")?.remove(); } // 일정 표의 "N건 더 보기"
    for (let a = el; a && a.id !== "main"; a = a.parentElement) { if (a.hidden) a.hidden = false; if (a.tagName === "DETAILS") a.open = true; if (a.classList?.contains("m-fold")) a.classList.add("m-open"); }
    let row = el.closest(".ed-row, tr, li") || el; row.classList.add("hl-row");
    const unfold = (n) => { for (let a = n; a && a.id !== "main"; a = a.parentElement) { if (a.hidden) a.hidden = false; if (a.tagName === "DETAILS") a.open = true; if (a.classList?.contains("m-fold")) a.classList.add("m-open"); } };
    if (colName) { const tb = row.closest("table"); if (tb) { const hr = tb.tHead?.rows[0] || tb.rows[0]; const ci = [...(hr?.cells || [])].findIndex((c) => { const t = key(c.textContent), full = key(colName), shortN = key(colName.replace(/(중학교|고등학교|초등학교)$/, "")); return t.includes(full) || (shortN.length >= 2 && t.includes(shortN)); }); const cell = ci >= 0 ? row.cells[ci] : null; if (cell) { cell.classList.add("hl-cell"); setTimeout(() => cell.scrollIntoView({ block: "nearest", inline: "center" }), 400); setTimeout(() => cell.classList.remove("hl-cell"), 13000); } } }
    // 스크롤: 머리(헤더·고정 줄) 높이를 빼고, 화면보다 큰 행은 위쪽을 맞춘다. 늦게 그려지는 구역 때문에 자리가 밀리면 사용자가 손대기 전까지만 같은 자리로 되돌린다(마지막에 한 번 더 튀지 않게).
    const head = () => { let h = 0; for (const e of document.querySelectorAll("header, .tabbar-top, #chipbar")) { const cs = getComputedStyle(e); if ((cs.position === "sticky" || cs.position === "fixed") && e.getBoundingClientRect().top <= 1) h = Math.max(h, e.getBoundingClientRect().bottom); } return h + 12; };
    const want = () => { const r = row.getBoundingClientRect(), avail = innerHeight - head(); return scrollY + r.top - (r.height < avail * 0.8 ? head() + (avail - r.height) / 2 : head()); };
    let touched = false; const stop = () => { touched = true; };
    ["wheel", "touchstart", "keydown", "mousedown"].forEach((ev) => addEventListener(ev, stop, { once: true, passive: true }));
    let hh = -1, hAt = performance.now(); const tS = performance.now(); // 문서 높이가 0.25초 동안 안 변할 때(최대 2.5초)까지 기다렸다가 한 번에 이동: 늦게 그려지는 구역 때문에 조금씩 밀려 가는 모습을 줄인다
    const settled = () => { const n = performance.now(), h = document.documentElement.scrollHeight; if (h !== hh) { hh = h; hAt = n; } return n - hAt > 250 || n - tS > 2500; };
    const go = () => { if (!row.isConnected) { const ne = pick(); if (ne) { row = ne.closest(".ed-row, tr, li") || ne; row.classList.add("hl-row"); } } if (row.isConnected && !row.checkVisibility?.()) unfold(row); /* 접이식이 다시 접히거나 다시 그려지면 그 줄을 다시 펴고 찾는다 */ if (!settled()) return; if (!touched) { const y = Math.max(0, want()); if (Math.abs(y - scrollY) > 3) scrollTo(0, y); } };
    setTimeout(go, 80); const t0 = performance.now(); let still = performance.now(), lastY = -1; // 위치가 1.5초 동안 그대로면(레이아웃 안정) 멈춘다, 최대 9초
    const tick = () => { const now = performance.now(); if (touched || now - t0 > 5000) return; go(); if (Math.abs(scrollY - lastY) > 1) { lastY = scrollY; still = now; } if (now - still > 700 && now - t0 > 900 && settled()) return; requestAnimationFrame(tick); }; setTimeout(() => requestAnimationFrame(tick), 160);
    setTimeout(() => row.classList.remove("hl-row"), 13000);
  }, 200);
}
