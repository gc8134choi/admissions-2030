// 검색 결과에서 온 "?hl=<제목 앞부분>" 주소: 접힌 "더 보기"·접이식을 펴서 그 행을 찾아 강조하고 그 자리로 간다.
const key = (s) => String(s || "").replace(/ⓘ/g, "").replace(/\s+/g, "").toLowerCase();
export function applyHl() {
  const hl = new URLSearchParams(decodeURIComponent(location.hash.slice(1)).split("?")[1] || "").get("hl");
  if (!hl) return;
  const k = key(hl).slice(0, 16); if (k.length < 2) return;
  let tries = 0; const at = location.hash.split("?")[0]; // 화면이 주소의 ?뒤를 다시 쓰므로(필터 동기화) 처음 읽은 값을 쓰고, 다른 화면으로 가면 멈춘다
  const t = setInterval(() => {
    if (++tries > 25 || location.hash.split("?")[0] !== at) return clearInterval(t);
    const cand = [...document.querySelectorAll("#main .ed-row, #main tr, #main li, #main summary, #main dd, #main td, #main p, #main .aux")].filter((e) => key(e.textContent).includes(k));
    const el = cand.find((c) => !cand.some((o) => o !== c && c.contains(o)));
    if (!el) return;
    clearInterval(t);
    const tl = el.closest("#tl"); if (tl && !tl.classList.contains("all")) { tl.classList.add("all"); tl.querySelector(".more-rows")?.remove(); } // 일정 표의 "N건 더 보기"
    for (let a = el; a && a.id !== "main"; a = a.parentElement) { if (a.hidden) a.hidden = false; if (a.tagName === "DETAILS") a.open = true; if (a.classList?.contains("m-fold")) a.classList.add("m-open"); }
    const row = el.closest(".ed-row, tr, li") || el; row.classList.add("hl-row");
    setTimeout(() => row.scrollIntoView({ block: "center" }), 80); setTimeout(() => row.classList.remove("hl-row"), 7000);
  }, 200);
}
