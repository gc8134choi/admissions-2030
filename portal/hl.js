// 검색 결과에서 온 "?hl=<제목 앞부분>" 주소: 접힌 "더 보기"·접이식을 펴서 그 행을 찾아 강조하고 그 자리로 간다.
const key = (s) => String(s || "").replace(/ⓘ|·/g, "").replace(/\s+/g, "").toLowerCase();
let HLGEN = 0; /* 같은 주소를 두 번 처리해도(처음 그리기 + 주소 바뀜) 스크롤은 가장 나중 한 곳만 */
export function applyHl() {
  const hl = new URLSearchParams(decodeURIComponent(location.hash.slice(1)).split("?")[1] || "").get("hl");
  if (!hl) return;
  const myGen = ++HLGEN;
  const colName = new URLSearchParams(decodeURIComponent(location.hash.slice(1)).split("?")[1] || "").get("col"); // col=학교 이름: 비교 표에서 그 학교 칸도 강조하고 가로로 보이게
  const inTr = new URLSearchParams(decodeURIComponent(location.hash.slice(1)).split("?")[1] || "").get("in") === "tr"; // in=tr: 표의 행만 찾는다(요약 카드가 아니라 비교 표의 학교 줄)
  const k = key(hl).slice(0, 16), k3 = key(hl).slice(0, 8), k4 = key(String(hl).replace(/[(（].*$/, "")).slice(0, 16), k2 = key(String(hl).replace(/^\s*\d{4}[-.]\d{1,2}(?:[-.]\d{1,2})?\s*/, "")).slice(0, 16); if (k.length < 2) return; // 변경 소식 제목은 앞의 날짜(2025-06)가 화면에서 따로 쓰여 있어 날짜를 뺀 제목으로도 찾는다
  const unwait = () => document.documentElement.classList.remove("hl-wait"); // 본문은 숨기지 않는다(빈 화면·스크린리더·포커스 문제). 위치는 아래 settled()로 안정된 뒤 한 번에 이동
  let tries = 0; const at = location.hash.split("?")[0]; // 화면이 주소의 ?뒤를 다시 쓰므로(필터 동기화) 처음 읽은 값을 쓰고, 다른 화면으로 가면 멈춘다
  const pick = () => {
    const cand = [...document.querySelectorAll(inTr ? "#main tbody tr" : "#main .ed-row, #main tr, #main li, #main summary, #main dd, #main td, #main th, #main h2, #main h3, #main h4, #main label, #main p, #main .aux")].filter((e) => { const t = key(e.textContent); return t.includes(k) || (k2.length >= 4 && t.includes(k2)) || (tries > 14 && k4.length >= 2 && k4 !== k && t.includes(k4)); });
    { const np = cand.filter((c) => !c.closest(".cmp-add, .cmp-f2, .cmp-pick")); if (np.length && np.length < cand.length) cand.splice(0, cand.length, ...np); } // 비교 표의 학교 고르기 목록(필터 글자)이 아니라 표의 줄을 강조(그 목록이 열리며 표가 밀리던 것 방지)
    { const nh = cand.filter((c) => !c.closest(".cmp-gh")); if (nh.length && nh.length < cand.length) cand.splice(0, cand.length, ...nh); } // 접힌 묶음 머리글(비용·교육과정 2)이 아니라 그 안의 값 줄을 강조
    if (!cand.length && tries > 12) cand.push(...[...document.querySelectorAll("#main .ed-row, #main tr, #main li, #main summary, #main dd, #main td, #main p")].filter((e) => k3.length >= 6 && key(e.textContent).includes(k3))); // 오래 못 찾으면 제목 앞 8자로 느슨하게
    // 제목 칸(b·strong·제목 요소)에 찾는 말이 든 줄을 먼저(본문에만 그 말이 나오는 다른 줄이 강조되지 않게), 없으면 가장 안쪽 일치
    const inTitle = (c) => [...c.querySelectorAll("b, strong, h2, h3, h4, .lg-t, .ed-t")].some((x) => { const t = key(x.textContent); return t.includes(k) || (k2.length >= 4 && t.includes(k2)); });
    const el = cand.find((c) => !cand.some((o) => o !== c && c.contains(o)) && inTitle(c)) || cand.find((c) => inTitle(c)) || cand.find((c) => !cand.some((o) => o !== c && c.contains(o)));
    // 같은 제목의 일정 줄이 여럿(행사별)이면 설명(본문)이 붙은 첫 줄로: 검색 결과가 보여 준 내용이 그 줄이다(접힌 '지난 일정' 안이어도 펴서 간다)
    const tr0 = el?.closest?.("tr"); if (tr0 && !tr0.querySelector(".muted.small")) { const f = [...document.querySelectorAll("#main tr")].find((c) => c.querySelector(".muted.small") && key(c.querySelector("b:not(.dn)")?.textContent) === key(tr0.querySelector("b:not(.dn)")?.textContent) && cand.some((o) => c.contains(o))); if (f) return f; }
    return el;
  };
  let first = -1, lastH = -1, stable = 0;
  const t = setInterval(() => {
    if (tries > 3 && tries % 3 === 0) document.querySelector("#rowsmore [data-all]")?.click(); // 비교 표의 "모두 보기"(과목을 나눠 그리는 표)
    if (tries === 7) document.querySelectorAll("#main details:not([open])").forEach((d) => { if (/비교/.test(d.querySelector(":scope > summary")?.textContent || "")) d.open = true; }); // 늦게 그려지는 비교 표 접이식을 먼저 편다
    if (tries === 25) document.querySelectorAll("#main details:not([open])").forEach((d) => { d.open = true; }); // 그래도 없으면 접이식을 모두 편다
    if (++tries > 60 || location.hash.split("?")[0] !== at) { unwait(); return clearInterval(t); }
    const el = pick();
    if (!el) return;
    /* 같은 주소를 열 때마다 같은 줄이 되게: 처음 찾은 줄이 "글자가 딱 맞는 제목 줄"이 아니면 0.8초 더 기다려 늦게 그려지는 더 알맞은 줄이 있는지 본 뒤 정한다 */
    const exact = (e) => { const c = e.matches?.("tr") ? e.querySelector("th, td") : e.querySelector?.("b, strong, .lg-t, .ed-t, h2, h3, h4, summary") || e; return key(c.textContent) === k; };
    if (first < 0) first = tries;
    { const h = document.documentElement.scrollHeight; if (h !== lastH) { lastH = h; stable = 0; } else stable++; if (!exact(el) && !(stable >= 1 && tries - first >= 1) && tries - first < 4) return; } /* 0.8초 고정 대기 대신 문서 높이가 한 틱(0.2초) 안 변하면 확정 */
    clearInterval(t);
    const tl = el.closest("#tl"); if (tl && !tl.classList.contains("all")) { tl.classList.add("all"); tl.querySelector(".more-rows")?.remove(); } // 일정 표의 "N건 더 보기"
    for (let a = el; a && a.id !== "main"; a = a.parentElement) { if (a.hidden) a.hidden = false; if (a.tagName === "DETAILS") a.open = true; if (a.classList?.contains("m-fold")) a.classList.add("m-open"); }
    try { window.__flushDecor?.(); } catch {} /* 용어 점선·ⓘ 장식은 줄을 찾자마자 끝내 두어, 첫 이동 전에 DOM이 조용해질 시간을 번다(이동과 같은 틱에 장식하면 이동한 자리에서 글이 밀려 CLS) */
    let row = el.closest(".ed-row, tr, li") || el; row.classList.add("hl-row");
    { const g = row.dataset?.g, gb = g != null && row.closest("table")?.querySelector(`.cmp-gb[data-gt="${CSS.escape(g)}"]`); if (gb && gb.getAttribute("aria-expanded") === "false") { gb.setAttribute("aria-expanded", "true"); gb.firstChild && (gb.firstChild.textContent = gb.firstChild.textContent.replace("▸", "▾")); } } // 강조한 줄이 든 접힌 묶음은 머리글도 열린 모양으로
    const unfold = (n) => { for (let a = n; a && a.id !== "main"; a = a.parentElement) { if (a.hidden) a.hidden = false; if (a.tagName === "DETAILS") a.open = true; if (a.classList?.contains("m-fold")) a.classList.add("m-open"); } };
    if (colName) { const tb = row.closest("table"); if (tb) { const hr = tb.tHead?.rows[0] || tb.rows[0]; const ci = [...(hr?.cells || [])].findIndex((c) => { const t = key(c.textContent), full = key(colName), shortN = key(colName.replace(/(중학교|고등학교|초등학교)$/, "")); return t.includes(full) || (shortN.length >= 2 && t.includes(shortN)); }); const cell = ci >= 0 ? row.cells[ci] : null; if (cell) { cell.classList.add("hl-cell"); setTimeout(() => { /* 가로 스크롤 칸만 움직인다(세로 이동은 아래 한 번의 스크롤이 맡는다: scrollIntoView는 세로로도 움직여 두 번 튀었다) */ for (let a = cell.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (/(auto|scroll)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 2) { const cr = cell.getBoundingClientRect(), ar = a.getBoundingClientRect(); a.scrollLeft += (cr.left + cr.width / 2) - (ar.left + ar.width / 2); break; } } }, 400); setTimeout(() => cell.classList.remove("hl-cell"), 13000); } } }
    // 스크롤: 머리(헤더·고정 줄) 높이를 빼고, 화면보다 큰 행은 위쪽을 맞춘다. 늦게 그려지는 구역 때문에 자리가 밀리면 사용자가 손대기 전까지만 같은 자리로 되돌린다(마지막에 한 번 더 튀지 않게).
    const head = () => { let h = 0; for (const e of document.querySelectorAll("header, .tabbar-top, #chipbar")) { const cs = getComputedStyle(e); if ((cs.position === "sticky" || cs.position === "fixed") && e.getBoundingClientRect().top <= 1) h = Math.max(h, e.getBoundingClientRect().bottom); } return h + 12; };
    const want = () => { const r = row.getBoundingClientRect(), avail = innerHeight - head(); return scrollY + r.top - (r.height < avail * 0.8 ? head() + (avail - r.height) / 2 : head()); };
    let lastMut = performance.now(); try { const mo = new MutationObserver(() => { lastMut = performance.now(); }); mo.observe(document.querySelector("#main") || document.body, { childList: true, subtree: true, characterData: true }); setTimeout(() => mo.disconnect(), 3000); } catch {}
    let justUnfolded = false, moved1 = false, moved2 = false, touched = false, lastT = -1, prevY = -9, stableAt = performance.now(); const tFound = performance.now(); /* 줄을 찾은 시각: 안정을 최대 0.5초만 기다린 뒤 첫 이동 */ const stop = () => { touched = true; };
    ["wheel", "touchstart", "keydown", "mousedown"].forEach((ev) => addEventListener(ev, stop, { once: true, passive: true }));
    let hh = -1, hAt = performance.now(); const tS = performance.now(); // 문서 높이가 0.15초 동안 안 변할 때(최대 1.5초)까지 기다렸다가 한 번에 이동: 늦게 그려지는 구역 때문에 조금씩 밀려 가는 모습을 줄인다
    let ry = -1; const settled = () => { const n = performance.now(), h = document.documentElement.scrollHeight, y = row.isConnected ? Math.round(row.getBoundingClientRect().top + scrollY) : -1; if (h !== hh || Math.abs(y - ry) > 2) { hh = h; ry = y; hAt = n; } /* 문서 높이뿐 아니라 그 줄의 자리도 안 변할 때까지 */ const busy = document.querySelector("#main.view-loading, #main.fw, body.lazy-pending") || document.fonts?.status === "loading"; /* 화면·늦게 그리는 구역이 아직 그려지는 중이면 기다린다(첫 이동이 임시 자리로 가는 것을 막음) */ return (n - hAt > 250 && !busy) || n - tS > 2500; };
    const go = () => { if (myGen !== HLGEN) return; if (!row.isConnected) { const ne = pick(); if (ne) { row = ne.closest(".ed-row, tr, li") || ne; row.classList.add("hl-row"); } } if (row.isConnected && !row.checkVisibility?.()) { unfold(row); justUnfolded = true; /* 펼친 직후에는 같은 틱에서 바로 이동해, 펼침으로 밀린 내용이 화면에 한 번 그려지지 않게(CLS) */ } /* 접이식이 다시 접히거나 다시 그려지면 그 줄을 다시 펴고 찾는다 */ { const nowT = performance.now(), yAbs = row.isConnected ? Math.round(row.getBoundingClientRect().top + scrollY) : -1; if (Math.abs(yAbs - prevY) > 2) { prevY = yAbs; stableAt = nowT; } if (!moved1) { if (!(justUnfolded || (nowT - stableAt >= 48 && nowT - lastMut >= 60 && document.fonts?.status !== "loading" && want() <= document.documentElement.scrollHeight - innerHeight + 2) || nowT - tFound > 700)) return; /* 본문에 마지막 DOM 변화(용어 점선·출처 접기·표 행 추가)가 있은 지 0.11초 지나야 첫 이동: 이동 뒤 줄이 또 밀려 다시 움직이는 일을 막는다 */ /* 목표 자리까지 스크롤할 수 있을 만큼 문서가 길어졌을 때(아니면 잘려서 한 번 더 움직임) */ /* 첫 이동: 줄 자리가 3프레임(≈50ms) 같으면 바로, 늦어도 0.38초 안에 */ } else if (!settled()) return; /* 이동 뒤 보정은 완전히 안정된 다음 한 번만 */ } /* 첫 이동은 안정을 기다리지 않고 바로(위쪽을 한참 보여 주다 점프하지 않게), 이후 밀림은 안정된 뒤에만 보정 */ if (!touched) { if (!moved1) { try { window.__flushDecor?.(); } catch {} } try { for (let a = row.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (/(auto|scroll)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 2) { const ar = a.getBoundingClientRect(), rb = row.getBoundingClientRect(); if (rb.top < ar.top || rb.bottom > ar.bottom) a.scrollTop += (rb.top - ar.top) - Math.max(0, (a.clientHeight - rb.height) / 3); } } } catch {} /* 비교표처럼 안쪽 스크롤 영역 안의 줄이면 그 영역도 줄 자리까지 스크롤 */ /* 늦은 용어 점선·ⓘ 장식을 이동 전에 끝내서 이동 뒤 줄이 밀리지 않게 */ const y = Math.max(0, want()); const rr = row.getBoundingClientRect(); const bb = document.getElementById("btabs")?.offsetHeight || 0, okVisible = (moved1 || scrollY < 4) && rr.top >= head() && rr.bottom <= innerHeight - Math.max(40, bb + 8); /* 행이 첫 화면에 이미 온전히 보이면(하단 고정 바 제외) 가운데 맞춤 스크롤을 하지 않는다 */ /* 한 번 이동한 뒤 줄이 화면 안에 잘 보이면 작은 자리 밀림에는 따라가지 않는다(조금씩 계속 움직이는 모습 방지) */ if (!okVisible && Math.abs(y - scrollY) > 3 && !moved2 && !(lastT >= 0 && Math.abs(y - lastT) <= 3)) { lastT = y; if (moved1) moved2 = true; /* 첫 이동 뒤 보정은 안정된 다음 한 번만 */ moved1 = true; scrollTo(0, y); justUnfolded = false; requestAnimationFrame(unwait); } } };
    setTimeout(go, 80); const t0 = performance.now(); let still = performance.now(), lastY = -1; // 위치가 1.5초 동안 그대로면(레이아웃 안정) 멈춘다, 최대 9초
    const tick = () => { const now = performance.now(); if (myGen !== HLGEN || touched || now - t0 > 5000) return; go(); if (Math.abs(scrollY - lastY) > 1) { lastY = scrollY; still = now; } if (now - still > 700 && now - t0 > 900 && settled()) return; requestAnimationFrame(tick); }; setTimeout(() => requestAnimationFrame(tick), 160);
    setTimeout(() => row.classList.remove("hl-row"), 13000);
  }, 200);
}
