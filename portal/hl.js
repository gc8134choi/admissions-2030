// 검색 결과에서 온 "?hl=<제목 앞부분>" 주소: 접힌 "더 보기"·접이식을 펴서 그 행을 찾아 강조하고 그 자리로 간다.
const key = (s) => String(s || "").replace(/ⓘ/g, "").replace(/\s+/g, "").toLowerCase();
export function applyHl() {
  const hl = new URLSearchParams(decodeURIComponent(location.hash.slice(1)).split("?")[1] || "").get("hl");
  if (!hl) return;
  const inTr = new URLSearchParams(decodeURIComponent(location.hash.slice(1)).split("?")[1] || "").get("in") === "tr"; // in=tr: 표의 행만 찾는다(요약 카드가 아니라 비교 표의 학교 줄)
  const k = key(hl).slice(0, 16), k3 = key(hl).slice(0, 8), k2 = key(String(hl).replace(/^\s*\d{4}[-.]\d{1,2}(?:[-.]\d{1,2})?\s*/, "")).slice(0, 16); if (k.length < 2) return; // 변경 소식 제목은 앞의 날짜(2025-06)가 화면에서 따로 쓰여 있어 날짜를 뺀 제목으로도 찾는다
  let tries = 0; const at = location.hash.split("?")[0]; // 화면이 주소의 ?뒤를 다시 쓰므로(필터 동기화) 처음 읽은 값을 쓰고, 다른 화면으로 가면 멈춘다
  const t = setInterval(() => {
    if (++tries > 60 || location.hash.split("?")[0] !== at) return clearInterval(t);
    const cand = [...document.querySelectorAll(inTr ? "#main tbody tr" : "#main .ed-row, #main tr, #main li, #main summary, #main dd, #main td, #main th, #main h2, #main h3, #main h4, #main label, #main p, #main .aux")].filter((e) => { const t = key(e.textContent); return t.includes(k) || (k2.length >= 4 && t.includes(k2)); });
    if (!cand.length && tries > 12) cand.push(...[...document.querySelectorAll("#main .ed-row, #main tr, #main li, #main summary, #main dd, #main td, #main p")].filter((e) => k3.length >= 6 && key(e.textContent).includes(k3))); // 오래 못 찾으면 제목 앞 8자로 느슨하게
    const el = cand.find((c) => !cand.some((o) => o !== c && c.contains(o)));
    if (!el) return;
    clearInterval(t);
    const tl = el.closest("#tl"); if (tl && !tl.classList.contains("all")) { tl.classList.add("all"); tl.querySelector(".more-rows")?.remove(); } // 일정 표의 "N건 더 보기"
    for (let a = el; a && a.id !== "main"; a = a.parentElement) { if (a.hidden) a.hidden = false; if (a.tagName === "DETAILS") a.open = true; if (a.classList?.contains("m-fold")) a.classList.add("m-open"); }
    const row = el.closest(".ed-row, tr, li") || el; row.classList.add("hl-row");
    // 스크롤: 머리(헤더·고정 줄) 높이를 빼고, 화면보다 큰 행은 위쪽을 맞춘다. 늦게 그려지는 구역 때문에 자리가 밀리면 사용자가 손대기 전까지만 같은 자리로 되돌린다(마지막에 한 번 더 튀지 않게).
    const head = () => { let h = 0; for (const e of document.querySelectorAll("header, .tabbar-top, #chipbar")) { const cs = getComputedStyle(e); if ((cs.position === "sticky" || cs.position === "fixed") && e.getBoundingClientRect().top <= 1) h = Math.max(h, e.getBoundingClientRect().bottom); } return h + 12; };
    const want = () => { const r = row.getBoundingClientRect(), avail = innerHeight - head(); return scrollY + r.top - (r.height < avail * 0.8 ? head() + (avail - r.height) / 2 : head()); };
    let touched = false; const stop = () => { touched = true; };
    ["wheel", "touchstart", "keydown", "mousedown"].forEach((ev) => addEventListener(ev, stop, { once: true, passive: true }));
    const go = () => { if (!touched) { const y = Math.max(0, want()); if (Math.abs(y - scrollY) > 3) scrollTo(0, y); } };
    setTimeout(go, 80); const t0 = performance.now(); let still = performance.now(), lastY = -1; // 위치가 1.5초 동안 그대로면(레이아웃 안정) 멈춘다, 최대 9초
    const tick = () => { const now = performance.now(); if (touched || now - t0 > 9000) return; go(); if (Math.abs(scrollY - lastY) > 1) { lastY = scrollY; still = now; } if (now - still > 1500 && now - t0 > 1200) return; requestAnimationFrame(tick); }; setTimeout(() => requestAnimationFrame(tick), 160);
    setTimeout(() => row.classList.remove("hl-row"), 13000);
  }, 200);
}
