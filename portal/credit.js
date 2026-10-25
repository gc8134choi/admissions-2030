// 고교학점제 이해 화면: 표 대신 도표·그림(CSS/인라인 SVG) 중심. 숫자는 policy.json 행의 본문에서 코드로 읽고, 못 읽으면 해당 그림은 빼고 표만 보여 준다.
// 모든 그림 아래에 "근거·상태 표"(원래 행, 상태·출처 배지 포함)를 접어 둔다.
export async function creditView(el, { load, esc, badge, src, table, basic }) {
  const [rows, summary] = await Promise.all([load("policy"), load("summary")]);
  const get = (id) => rows.find((r) => r.id === id);
  const by = (...ids) => ids.map(get).filter(Boolean);
  const num = (id, re) => { const m = get(id)?.body.match(re); return m ? m.slice(1).map(Number) : null; };
  const chip = (id) => { const r = get(id); return r ? `<span class="pst ${r.status} cv-chip">${esc(STATUS_TEXT[r.status] || r.status)}</span>` : ""; };
  const STATUS_TEXT = { confirmed: "확정", reported: "보도", estimated: "추정", unknown: "확인 못 함", material: "학교 배부 자료", seoul: "서울교육청 자료", "seoul-verified": "서울교육청 자료(원문 확인)", match: "서울·경기 일치", gyeonggi: "경기도교육청 자료", opinion: "의견", academy: "학원 자료" };
  const basis = (title, ids) => { const rs = by(...ids); return rs.length ? `<details class="cv-basis"><summary>${esc(title)}</summary>${table(rs, basic)}</details>` : ""; };
  const card = (title, lead, body, ids, basisTitle = "근거·상태 표") => `<section class="cv-card"><h3>${title}</h3>${lead ? `<p class="muted cv-lead">${lead}</p>` : ""}${body}${basis(basisTitle, ids)}</section>`;
  const pct = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);

  // ---- 숫자 읽기 ----
  const grad = num("cur-01", /(\d+)학점\s*=\s*교과\s*(\d+).*?창의적 체험활동\s*(\d+)/); // [192, 174, 18]
  const split = num("cur-14", /필수\s*(\d+)학점.*?나머지\s*(\d+)학점/) || num("cur-14", /필수\s*(\d+)\s*\+\s*자율\s*(\d+)/); // [84, 90]
  const unit = num("cur-09", /1학점당 수업량은\s*(\d+)회/); // [16] (1회 시간은 원문 확인 전이라 쓰지 않는다)
  const att = num("cur-02", /출석\s*(\d+)\s*\/\s*(\d+)/); // [2, 3]
  const ach = num("cur-16", /성취율\s*(\d+)\s*%/); // [40]
  const cap = num("cur-12", /(\d+)학점을 넘을 수/); // [81]
  const ratioText = (get("cur-15")?.body.match(/((?:\d+\/){4}\d+)\s*%/) || get("cur-04")?.body.match(/((?:\d+\/){4}\d+)\s*%/) || [])[1];
  const ratio = ratioText ? ratioText.split("/").map(Number) : null; // [10, 24, 32, 24, 10]
  const months = get("cur-06") ? [...get("cur-06").body.matchAll(/(\d+)월/g)].map((m) => Number(m[1])) : [];
  const steps = get("cur-26") ? get("cur-26").body.split(/[①②③④]/).slice(1).map((t) => t.replace(/\s*(→|\.).*$/s, "").trim()).filter(Boolean) : [];
  const types = get("cur-05") ? get("cur-05").body.split("/").map((t) => t.trim()).filter(Boolean) : [];
  const c3 = get("cur-03");
  const items = [];
  if (c3) {
    for (const seg of c3.body.split(/,\s*/)) {
      let m;
      if ((m = seg.match(/^(.+?)\s*각\s*(\d+)학점/))) m[1].split("·").forEach((n) => items.push([n.trim(), Number(m[2])]));
      else if ((m = seg.match(/^(.+?)\s*합\s*(\d+)학점/)) || (m = seg.match(/^(.+?)\s+(\d+)학점/))) items.push([m[1].trim(), Number(m[2])]);
    }
  }
  const sum = items.reduce((n, x) => n + x[1], 0);
  const stated = Number((c3?.body.match(/필수\s*(\d+)학점/) || [])[1]) || null;
  const itemsOk = items.length && (!stated || stated === sum);

  const cards = [];

  // 1. 한눈에: 숫자 타일
  const tiles = [
    grad && [grad[0], "졸업 학점", "cur-01"], grad && [grad[1], "교과 학점", "cur-01"], grad && [grad[2], "창의적 체험활동", "cur-01"],
    unit && [`${unit[0]}회`, "1학점당 수업량", "cur-09"], att && [`${att[0]}/${att[1]}`, "출석 기준", "cur-02"], ach && [`${ach[0]}%`, "학업성취율 기준", "cur-16"],
  ].filter(Boolean);
  if (tiles.length) cards.push(card("한눈에", "졸업과 이수 기준의 핵심 숫자입니다.", `<div class="cv-tiles">${tiles.map(([v, l, id]) => `<div class="cv-tile"><b>${esc(String(v))}</b><span>${l}</span>${chip(id)}</div>`).join("")}</div>`, ["cur-01", "cur-14", "cur-09", "cur-02", "cur-16", "hs-14"]));

  // 2. 졸업 학점 구성: 도넛 + 스택바
  if (grad && grad[1] + grad[2] === grad[0]) {
    const p1 = pct(grad[1], grad[0]), p2 = pct(grad[2], grad[0]);
    const donut = `<svg class="cv-donut" viewBox="0 0 42 42" role="img" aria-label="졸업 ${grad[0]}학점: 교과 ${grad[1]}, 창의적 체험활동 ${grad[2]}">
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--line)" stroke-width="6"/>
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--accent)" stroke-width="6" stroke-dasharray="${p1} ${100 - p1}" stroke-dashoffset="25"/>
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--v2)" stroke-width="6" stroke-dasharray="${p2} ${100 - p2}" stroke-dashoffset="${25 - p1}"/>
      <text x="21" y="21.5" text-anchor="middle" class="cv-dn">${grad[0]}</text><text x="21" y="27" text-anchor="middle" class="cv-ds">학점</text></svg>`;
    const legend = `<ul class="cv-legend"><li><i style="background:var(--accent)"></i>교과 <b>${grad[1]}</b> (${p1}%)</li><li><i style="background:var(--v2)"></i>창의적 체험활동 <b>${grad[2]}</b> (${p2}%)</li></ul>`;
    const sub = split && split[0] + split[1] === grad[1]
      ? `<div class="cv-sub"><div class="cv-subt">교과 ${grad[1]}학점의 구성 ${chip("cur-14")}</div><div class="cv-stack" role="img" aria-label="필수 ${split[0]}, 나머지 ${split[1]}"><span class="req" style="width:${pct(split[0], grad[1])}%">필수 ${split[0]}</span><span class="ele" style="width:${pct(split[1], grad[1])}%">나머지 ${split[1]}</span></div></div>` : "";
    cards.push(card("졸업 학점 구성", `3년간 ${grad[0]}학점. ${chip("cur-01")}`, `<div class="cv-row">${donut}<div>${legend}</div></div>${sub}`, ["cur-01", "cur-14"]));
  }

  // 3. 이수 요건: 게이지
  const gauges = [
    att && [`출석 ${att[0]}/${att[1]} 이상`, pct(att[0], att[1]), "cur-02"],
    ach && [`학업성취율 ${ach[0]}% 이상`, ach[0], "cur-16"],
    cap && grad && [`국·수·영 이수학점 합 ${cap[0]}학점 이하 (교과 ${grad[1]} 중)`, pct(cap[0], grad[1]), "cur-12"],
  ].filter(Boolean);
  if (gauges.length) cards.push(card("과목 이수 요건", "이 기준에 못 미치면 학점이 인정되지 않습니다(보충이수 가능).", `<div class="cv-gauges">${gauges.map(([l, p, id]) => `<div class="cv-g"><div class="cv-gl">${esc(l)} ${chip(id)}</div><div class="cv-gb"><span style="width:${p}%"></span></div></div>`).join("")}</div>`, ["cur-02", "cur-16", "cur-12"]));

  // 4. 공통과목 필수학점: 가로 막대
  if (c3) {
    const max = Math.max(...items.map((x) => x[1]), 1);
    const chart = itemsOk
      ? `<div class="cv-bars">${items.map(([n, v]) => `<div class="cv-br"><span class="cv-bn">${esc(n)}</span><span class="cv-bt"><i style="width:${pct(v, max)}%"></i></span><b>${v}</b></div>`).join("")}</div><p class="cv-total">합계 <b>${sum}</b>학점 ${chip("cur-03")}</p>`
      : `<p>${esc(c3.body)}</p>`;
    cards.push(card("공통과목 필수학점", "모든 학생이 듣는 공통과목의 학점입니다.", chart, ["cur-03"]));
  }

  // 5. 과목 유형 + 교과군별 개수 매트릭스
  const KIND = ["일반선택", "진로선택", "융합선택"];
  const matrix = [];
  for (const id of ["cur-18", "cur-19", "cur-20", "cur-21", "cur-22", "cur-23"]) {
    const r = get(id);
    if (!r) continue;
    const cnt = {};
    for (const seg of r.body.replace(/\s*\(경기[^)]*\)\s*$/, "").split(/\s*\/\s*/)) {
      const m = seg.match(/^(일반선택|진로선택|융합선택):\s*(.+)$/);
      if (m) cnt[m[1]] = m[2].split(/,\s*/).filter(Boolean).length;
    }
    if (Object.keys(cnt).length) matrix.push([r.title.replace(/^선택과목:\s*/, ""), cnt]);
  }
  if (types.length || matrix.length) {
    const typeCards = types.length ? `<div class="cv-types">${types.map((t) => `<div class="cv-type">${esc(t)}</div>`).join("")}</div>` : "";
    const mx = Math.max(...matrix.flatMap(([, c]) => Object.values(c)), 1);
    const grid = matrix.length ? `<div class="cv-mx" role="table" aria-label="교과군별 선택과목 수"><div class="cv-mh"></div>${KIND.map((k) => `<div class="cv-mh">${k}</div>`).join("")}${matrix.map(([a, c]) => `<div class="cv-ma">${esc(a.replace(/\(.*\)/, ""))}</div>${KIND.map((k) => `<div class="cv-mc" style="--a:${c[k] ? 0.15 + 0.6 * (c[k] / mx) : 0}">${c[k] ?? "-"}</div>`).join("")}`).join("")}</div><p class="muted small">교과군별 개설 가능한 과목 수입니다. 체육·예술·제2외국어 등은 아래 과목표를 보세요.</p>` : "";
    cards.push(card("과목 유형", `공통과목과 선택과목 3종. ${chip("cur-05")}`, typeCards + grid, ["cur-05", "cur-10", "cur-11", "cur-13", "cur-18", "cur-19", "cur-20", "cur-21", "cur-22", "cur-23"], "근거·상태 표 / 교과군별 과목표"));
  }

  // 6. 성적 산출: 5등급 비율 막대
  if (ratio && ratio.length === 5) {
    const mx = Math.max(...ratio);
    cards.push(card("성적 산출", `공통·일반선택은 성취도 5단계와 함께 석차 5등급이 기록됩니다. ${chip("cur-04")}`,
      `<div class="cv-cols" role="img" aria-label="5등급 비율 ${ratio.join("/")}%">${ratio.map((v, i) => `<div class="cv-col"><b>${v}%</b><span style="height:${pct(v, mx) * 0.9}px"></span><em>${i + 1}등급</em></div>`).join("")}</div><p class="muted small">상위 누적 비율 기준(1등급 상위 ${ratio[0]}%). 일부 과목은 석차등급을 산출하지 않습니다.</p>`,
      ["cur-04", "cur-15", "cur-28", "hs-13"]));
  }

  // 7. 과목 선택 절차 흐름도 + 조사 타임라인
  if (steps.length || months.length) {
    const flow = steps.length ? `<ol class="cv-flow">${steps.map((t, i) => `<li><b>${i + 1}</b><span>${esc(t)}</span></li>`).join("")}</ol>` : "";
    const tl = months.length ? `<div class="cv-tl"><div class="cv-subt">선택과목 수요 조사 ${chip("cur-06")}</div><div class="cv-tlr">${months.map((m, i) => `<div class="cv-tp"><b>${i + 1}차</b><span>${m}월</span></div>`).join('<i class="cv-ta"></i>')}</div><p class="muted small">서울 설명회 자료 예시이며 학교별로 다를 수 있습니다.</p></div>` : "";
    cards.push(card("과목 선택 절차", `선택과목은 4단계로 정합니다. ${chip("cur-26")}`, flow + tl, ["cur-06", "cur-26", "cur-07", "cur-31", "cur-32"]));
  }

  // 8. 대학 권장이수·학교 교육과정 확인: 카드
  const info = by("cur-07", "cur-31", "cur-32");
  if (info.length) cards.push(card("대학 권장이수과목과 학교 교육과정", "", `<div class="cv-notes">${info.map((r) => `<div class="cv-note"><b>${esc(r.title)}</b><p>${esc(r.body)}</p>${chip(r.id)}</div>`).join("")}</div>`, ["cur-07", "cur-31", "cur-32"]));

  // 9. 우리 4개교: 지정·선택 학점 막대
  if (summary.length) {
    const mx = Math.max(...summary.map((m) => m.creditsSubject), 1);
    cards.push(card("우리 4개교", "학교 편제표 기준 교과 학점입니다(서울교육청 기준 필수·자율 분류와 다릅니다).",
      `<div class="cv-schools">${summary.map((m) => `<div class="cv-sc"><span class="cv-sn">${esc(m.schoolName)}</span><div class="cv-stack" style="width:${pct(m.creditsSubject, mx)}%" role="img" aria-label="${esc(m.schoolName)} 지정 ${m.creditsRequired}, 선택 ${m.creditsElective}"><span class="req" style="width:${pct(m.creditsRequired, m.creditsSubject)}%">지정 ${m.creditsRequired}</span><span class="ele" style="width:${pct(m.creditsElective, m.creditsSubject)}%">선택 ${m.creditsElective}</span></div></div>`).join("")}</div><p><a class="btn" href="#select/curriculum">학교별 편제표 보기</a></p>`, []));
  }

  // 과목표(교과군별): 표만 접어서
  const subj = by("cur-17", "cur-18", "cur-19", "cur-20", "cur-21", "cur-22", "cur-23", "cur-24", "cur-25", "cur-27");
  const tail = subj.length ? `<details class="cv-basis cv-big"><summary>과목표(교과군별) 전체 보기</summary>${table(subj, basic)}</details>` : "";

  el.innerHTML = `<p class="note">서울교육청 자료는 경기 적용 확인 필요. 경기도교육청 행은 요약본(출처 불일치 가능). 그림 위 배지와 "근거·상태 표"에서 상태·출처를 확인하세요.</p>
    ${cards.join("")}${tail}
    <p class="muted">수능 출제범위는 <a href="#admission/system">대입 제도</a>에서 봅니다.</p>`;
}
