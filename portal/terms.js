// 용어 팝오버: 입시 용어를 누르면(탭·Enter) 그 자리에서 한 줄 풀이가 열린다. 마우스 올림에 기대지 않아 모바일에서도 된다.
// decorateTerms(root, scope)는 root 안의 글자에서 사전의 용어를 scope(예: ".dp") 묶음마다 처음 한 번만 버튼으로 바꾼다.
const TERMS = [
  ["평준화", "시험 없이 추첨으로 학교를 배정하는 지역 제도예요(공식명 평준화)."],
  ["학교군", "같은 추첨 단위로 묶인 학교들의 모음이에요. 이 안에서 배정돼요."],
  ["중학구", "학교군 안에서 다시 나눈 통학 구역이에요."],
  ["수능 최저", "수시인데도 수능에서 '몇 등급 이상'을 요구하는 조건이에요."],
  ["권장과목", "대학이 입학 전에 들으면 좋다고 안내한 과목이에요(필수는 아니에요)."],
  ["학종", "학생부종합전형. 내신뿐 아니라 생활기록부 전체를 봐요."],
  ["택n", "'n개 중 1개 고르기' 묶음이에요."],
  ["선택 폭", "내가 고를 수 있는 후보가 얼마나 넓은지 보여 주는 숫자예요(클수록 폭이 넓어요)."],
];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function decorateTerms(root, scope = ".dp") {
  if (!root) return;
  const scopes = scope ? [...root.querySelectorAll(scope)] : [root];
  for (const sc of scopes) {
    const done = new Set();
    const walker = document.createTreeWalker(sc, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest("a,button,summary,script,style,.term,.tip,textarea,input") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      for (const [t, d] of TERMS) {
        if (done.has(t)) continue;
        const i = n.nodeValue.indexOf(t); if (i < 0) continue;
        done.add(t);
        const after = n.splitText(i); after.nodeValue = after.nodeValue.slice(t.length);
        const b = document.createElement("button"); b.type = "button"; b.className = "term"; b.dataset.def = d; b.setAttribute("aria-expanded", "false"); b.textContent = t;
        n.parentNode.insertBefore(b, after);
        break; // 한 글자 덩어리에서는 하나만 바꾼다(남은 용어는 다음 덩어리에서)
      }
    }
  }
}

// 문서 어디서나 한 번만 붙인다. 용어 버튼을 누르면 풀이 말풍선이 열리고, 바깥을 누르거나 Esc면 닫힌다.
let tip = null, owner = null;
const close = () => { if (tip) { tip.remove(); tip = null; } if (owner) { owner.setAttribute("aria-expanded", "false"); owner = null; } };
export function initTerms() {
  if (initTerms.done) return; initTerms.done = true;
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".term");
    if (!b) { if (!e.target.closest(".tip")) close(); return; }
    const same = owner === b; close(); if (same) return;
    tip = document.createElement("span"); tip.className = "tip"; tip.setAttribute("role", "tooltip"); tip.innerHTML = esc(b.dataset.def);
    document.body.appendChild(tip); owner = b; b.setAttribute("aria-expanded", "true");
    const r = b.getBoundingClientRect(), w = Math.min(280, innerWidth - 24);
    tip.style.width = w + "px"; tip.style.left = Math.max(12, Math.min(scrollX + r.left, scrollX + innerWidth - w - 12)) + "px"; tip.style.top = scrollY + r.bottom + 6 + "px";
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  addEventListener("hashchange", close); addEventListener("scroll", () => { if (tip) close(); }, { passive: true });
}
