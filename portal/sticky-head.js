// 비교 표의 대상 줄(머리 행) 고정: 표 래퍼가 가로 스크롤(overflow)이라 CSS sticky가 래퍼 기준이 되어
// 페이지를 내리면 머리 행이 사라진다. 그래서 머리 행이 화면 위로 지나가면 같은 모양의 사본을 머리글 바로 아래에 고정해 보여 준다.
// 가로 스크롤과 첫 열 고정은 원본과 같이 움직인다. import만 하면 .w-table·.tw 표에 자동으로 적용된다(COMPARE-TABLE.md §2).
const WRAP = ".w-table, .tw";
const active = new Map(); // 래퍼 → { box, table }
let queued = false;

const px = (v) => parseFloat(v) || 0;
const topOffset = () => {
  const hh = px(getComputedStyle(document.documentElement).getPropertyValue("--hh"));
  const cb = document.querySelector("#chipbar"); // 학교 칩 줄이 머리글 밑에 붙어 있으면 그 아래부터
  let off = hh;
  if (cb && cb.getClientRects().length && getComputedStyle(cb).position === "sticky") { const r = cb.getBoundingClientRect(); if (r.top <= hh + 1 && r.bottom > hh) off = r.bottom; }
  return off;
};

function attach(wrap) {
  const table = wrap.querySelector("table"), head = table?.tHead;
  if (!head || active.has(wrap)) return;
  const box = document.createElement("div");
  box.className = "sh-fixed"; box.setAttribute("aria-hidden", "true"); box.hidden = true;
  document.body.appendChild(box);
  active.set(wrap, { box, table });
  wrap.addEventListener("scroll", () => update(wrap), { passive: true });
  update(wrap);
}

function update(wrap) {
  const a = active.get(wrap); if (!a) return;
  const { box, table } = a;
  if (!wrap.isConnected || !table.isConnected) { box.remove(); active.delete(wrap); return; }
  const head = table.tHead; if (!head) { box.hidden = true; return; }
  const off = topOffset(), wr = wrap.getBoundingClientRect(), hr = head.getBoundingClientRect();
  const H = hr.height;
  const show = wr.width > 0 && wr.top < off - 1 && wr.bottom > off + H + 8 && hr.top < off - 1;
  if (!show) { box.hidden = true; return; }
  if (!box.firstChild || box.dataset.sig !== String(table.rows.length) + ":" + head.innerText.length) {
    const clone = table.cloneNode(false); clone.removeAttribute("id"); clone.style.margin = "0"; clone.style.maxWidth = "none";
    const th = head.cloneNode(true); th.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id")); th.querySelectorAll("button").forEach((b) => (b.hidden = true));
    clone.appendChild(th); const inner = document.createElement("div"); inner.appendChild(clone); box.replaceChildren(inner); box.dataset.sig = String(table.rows.length) + ":" + head.innerText.length;
  }
  // 표 폭과 열 너비를 원본과 똑같이(표가 래퍼보다 좁아도 늘어나지 않게)
  const inner = box.firstChild, clone = inner.firstChild, tw = table.getBoundingClientRect().width, cs = getComputedStyle(wrap);
  // 래퍼의 안쪽 여백(padding)까지 같게: 사본 줄 안에 같은 여백을 둔다
  inner.style.cssText = `box-sizing:content-box;width:${tw}px`; box.style.paddingLeft = cs.paddingLeft; box.style.paddingRight = cs.paddingRight; box.style.boxSizing = "border-box"; // 고정 열(sticky)의 기준선이 내용 영역이라 래퍼와 같은 여백을 줄 자체에 둔다
  clone.style.width = clone.style.minWidth = clone.style.maxWidth = tw + "px";
  const o = head.querySelectorAll("th"), c = box.querySelectorAll("th");
  o.forEach((n, i) => { if (c[i]) { const w = n.getBoundingClientRect().width; c[i].style.width = c[i].style.minWidth = c[i].style.maxWidth = w + "px"; c[i].style.boxSizing = "border-box";
    const s = getComputedStyle(n); // 가로로 고정되는 열(sticky left)은 선택자가 원본 id에 걸려 있어도 사본에서 같게 고정
    if (s.position === "sticky" && s.left !== "auto") { c[i].style.position = "sticky"; c[i].style.left = s.left; c[i].style.zIndex = "4"; if (/rgba?\(/.test(s.backgroundColor) && s.backgroundColor !== "rgba(0, 0, 0, 0)") c[i].style.backgroundColor = s.backgroundColor; }
  } });
  // 래퍼의 안쪽 영역(테두리·스크롤바 제외)과 같은 위치·폭
  box.style.top = off + "px"; box.style.left = (wr.left + wrap.clientLeft) + "px"; box.style.width = wrap.clientWidth + "px";
  box.hidden = false; box.scrollLeft = wrap.scrollLeft;
}

const updateAll = () => { queued = false; for (const w of [...active.keys()]) update(w); };
const queue = () => { if (!queued) { queued = true; requestAnimationFrame(updateAll); } };
const scan = () => { document.querySelectorAll(WRAP).forEach(attach); queue(); };

if (typeof document !== "undefined") {
  addEventListener("scroll", queue, { passive: true, capture: true }); // 안쪽 스크롤 영역(.cmp 등)에서도 갱신
  addEventListener("resize", queue, { passive: true });
  new MutationObserver(() => { clearTimeout(scan.t); scan.t = setTimeout(scan, 120); }).observe(document.body, { childList: true, subtree: true });
  scan();
}
export const refreshStickyHead = scan;
