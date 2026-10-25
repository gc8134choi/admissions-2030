// 학년별 로드맵(일정 > 학년별 탭). 데이터: data/roadmap.json(학습자별 시기표). 스타일은 policy.css(.ed-*, .rd-*).
// 시기 축 칩(중3 겨울·고1·고2·고3·수능)은 스크롤해도 위에 붙고, 누르면 그 시기로 이동한다. 확정은 표시하지 않고 보도·추정만 조용히 표시한다.
export async function roadmapView(el, { load, esc, learner, fmt, badgeMain, notice }) {
  const d = await load("roadmap");
  const items = d.items.filter((x) => x.learner === learner.id);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const stages = [];
  for (const x of items) { if (!stages.find((s) => s.key === x.stageKey)) stages.push({ key: x.stageKey, label: x.stage, order: x.stageOrder, first: x.start }); }
  stages.sort((a, b) => a.order - b.order);
  // 지금 시기: 시작일이 오늘 이전인 마지막 시기(없으면 첫 시기).
  const cur = [...stages].reverse().find((s) => s.first.slice(0, 7) <= today.slice(0, 7)) || stages[0];
  let who = "";
  const rowHtml = (x) => {
    const last = x.end || x.start;
    const past = last < (last.length === 7 ? today.slice(0, 7) : today); // 월 단위 날짜는 그 달이 지나야 지난 일정
    const lbl = fmt({ start: x.start, ...(x.end ? { end: x.end } : {}) });
    const tags = x.who.map((t) => `<b class="rd-who${t === "학부모" ? " p" : ""}">${esc(t)}</b>`).join(" · ");
    const src = x.sourceName ? `<p class="ed-s">출처 ${x.sourceUrl ? `<a href="${esc(x.sourceUrl)}" target="_blank" rel="noopener">${esc(x.sourceName)}</a>` : esc(x.sourceName)}</p>` : "";
    return `<article class="rd-row${past ? " past" : ""}" data-who="${esc(x.who.join(","))}"><div class="rd-d">${lbl.split("~").map((t, i) => `<span>${i ? "~" : ""}${esc(t)}</span>`).join("")}</div><div><p class="rd-w">${tags}</p><p class="ed-b">${esc(x.what)}</p><div class="ed-st">${badgeMain(x)}</div>${x.note ? `<div class="ed-note">${esc(x.note)}</div>` : ""}${src}</div></article>`;
  };
  const draw = () => {
    $sections.innerHTML = stages.map((s) => {
      const rs = items.filter((x) => x.stageKey === s.key && (!who || x.who.includes(who)));
      return rs.length ? `<section id="rd-${esc(s.key)}"><h2>${esc(s.label)}${s.key === cur.key ? '<span class="ed-tag">지금</span>' : ""}</h2>${rs.map(rowHtml).join("")}</section>` : "";
    }).join("") || '<p class="ed-src">이 조건에 맞는 항목이 없어요.</p>';
  };
  el.innerHTML = `<div class="ed"><p class="ed-top"><b>${esc(learner.label)}의 학년별 로드맵이에요.</b> 추정은 아직 공고 전이라 바뀔 수 있어요.</p>
    <nav class="ed-toc" aria-label="시기 축">${stages.map((s) => `<button type="button" data-go="rd-${esc(s.key)}"${s.key === cur.key ? ' aria-current="true"' : ""}>${esc(s.label)}</button>`).join("")}</nav>
    <div class="ed-filter" id="rdw" role="group" aria-label="누구 할 일"><span>보기</span><button type="button" class="on" data-w="">전체</button><button type="button" data-w="학생">학생</button><button type="button" data-w="학부모">학부모</button></div>
    <div id="rdsec"></div><p class="ed-src">확정된 항목은 공식 원문을 확인했어요. 표시가 없으면 확인된 거예요.</p></div>`;
  const $sections = el.querySelector("#rdsec");
  draw();
  el.querySelector("#rdw").addEventListener("click", (e) => { const b = e.target.closest("[data-w]"); if (!b) return; who = b.dataset.w; el.querySelectorAll("#rdw button").forEach((x) => x.classList.toggle("on", x === b)); draw(); });
  el.querySelector(".ed-toc").addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) document.getElementById(b.dataset.go)?.scrollIntoView({ behavior: "smooth", block: "start" }); });
}
