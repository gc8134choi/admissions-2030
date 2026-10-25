// 고교학점제 이해 화면: 일러스트(직접 그린 인라인 SVG)·도표·카드 중심.
// 숫자는 policy.json 행의 본문에서 코드로 읽고(못 읽으면 그 그림은 뺀다), 학년별 학점은 편제표 DB(summary.json)에서 읽는다.
// 모든 그림 아래에 "근거·상태 표"(원래 행, 상태·출처 배지 포함)를 접어 둔다.
// 공식 이미지 슬롯: portal/img/credit/manifest.json 에 파일명을 적으면 해당 섹션에 figure로 자동 표시된다(README.md 참고).
const STATUS_TEXT = { confirmed: "확정", reported: "보도", estimated: "추정", unknown: "확인 못 함", material: "학교 배부 자료", seoul: "서울교육청 자료", "seoul-verified": "서울교육청 자료(원문 확인)", match: "서울·경기 일치", gyeonggi: "경기도교육청 자료", opinion: "의견", academy: "학원 자료" };

// 선 아이콘(24x24, currentColor). 모두 직접 그린 단순 도형이다.
const ICON = {
  book: '<path d="M4 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-7a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h7z"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1 3 3 6 3s6-2 6-3v-4.5"/>',
  gauge: '<path d="M3 18a9 9 0 0 1 18 0"/><path d="M12 18l4-6"/><circle cx="12" cy="18" r="1"/>',
  bars: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  merge: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  flag: '<path d="M6 21V4"/><path d="M6 5h11l-2 4 2 4H6"/>',
  school: '<path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M10 21v-6h4v6"/>',
  list: '<path d="M5 6l2 2 3-3M5 14l2 2 3-3M13 7h6M13 15h6"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  pie: '<path d="M12 3v9h9"/><circle cx="12" cy="12" r="9"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  steps: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
};
const icon = (n, cls = "") => `<svg class="cv-ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ""}</svg>`;

// 상단 히어로 일러스트: 학교 건물, 책 더미, 졸업 모자, 구름. 색은 테마 변수로 칠해 다크 모드에서도 읽힌다.
const HERO_SVG = `<svg class="cv-hero-art" viewBox="0 0 320 190" role="img" aria-label="학교와 책, 졸업 모자 일러스트">
  <circle cx="262" cy="42" r="18" fill="var(--cv-sun)"/>
  <g fill="var(--panel)" opacity=".9"><ellipse cx="60" cy="40" rx="26" ry="9"/><ellipse cx="78" cy="34" rx="18" ry="8"/><ellipse cx="215" cy="26" rx="22" ry="7"/></g>
  <path d="M0 170 Q80 140 160 160 T320 150 V190 H0Z" fill="var(--cv-hill)"/>
  <g transform="translate(70 62)">
    <rect x="0" y="34" width="130" height="78" rx="3" fill="var(--panel)" stroke="var(--cv-ink)" stroke-width="2.5"/>
    <path d="M-8 36 L65 0 L138 36Z" fill="var(--cv-roof)" stroke="var(--cv-ink)" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="52" y="72" width="26" height="40" rx="2" fill="var(--cv-door)" stroke="var(--cv-ink)" stroke-width="2.5"/>
    <g fill="var(--cv-glass)" stroke="var(--cv-ink)" stroke-width="2"><rect x="14" y="50" width="26" height="22" rx="2"/><rect x="90" y="50" width="26" height="22" rx="2"/></g>
    <circle cx="65" cy="22" r="6" fill="var(--panel)" stroke="var(--cv-ink)" stroke-width="2"/>
    <path d="M148 112V58" stroke="var(--cv-ink)" stroke-width="2.5"/><path d="M148 58h22l-6 8 6 8h-22z" fill="var(--cv-roof)" stroke="var(--cv-ink)" stroke-width="2" stroke-linejoin="round"/>
  </g>
  <g transform="translate(12 128)" stroke="var(--cv-ink)" stroke-width="2.2" stroke-linejoin="round">
    <rect x="0" y="26" width="64" height="12" rx="2" fill="var(--cv-b1)"/><rect x="6" y="14" width="56" height="12" rx="2" fill="var(--cv-b2)"/><rect x="2" y="2" width="58" height="12" rx="2" fill="var(--cv-b3)"/>
  </g>
  <g transform="translate(236 118)" stroke="var(--cv-ink)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
    <path d="M0 18 L34 4 L68 18 L34 32Z" fill="var(--cv-cap)"/><path d="M14 25v14c0 4 10 8 20 8s20-4 20-8V25" fill="none"/><path d="M62 21v22" /><circle cx="62" cy="46" r="3" fill="var(--cv-sun)"/>
  </g>
</svg>`;

// 섹션 머리 오른쪽의 작은 일러스트(직접 그림). 번호는 카드 번호(.cv-sN)와 같다. 색은 --c(섹션색)와 테마 변수만 쓴다.
const SPOT_STYLE = 'stroke="var(--cv-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
const SPOT = {
  1: '<path d="M14 54V10" /><path d="M14 12h30l-7 9 7 9H14z" fill="var(--c)"/><path d="M4 54h60" /><circle cx="58" cy="14" r="6" fill="var(--cv-sun)"/>',
  2: '<circle cx="36" cy="38" r="20" fill="var(--c)"/><path d="M36 38V18A20 20 0 0 1 43 19.3z" fill="var(--cv5)" transform="translate(3 -4)"/><path d="M2 14l14-5 14 5-14 5z" fill="var(--cv-cap)"/>',
  3: '<path d="M4 54h14V42h14V30h14V18h16v36" fill="color-mix(in srgb,var(--c) 30%,var(--panel))"/><circle cx="24" cy="22" r="5" fill="var(--panel)"/><path d="M24 27v9M24 31l-6 5M24 31l6 4" /><path d="M62 18V6l8 3-8 3" fill="var(--c)"/>',
  4: '<rect x="14" y="10" width="40" height="46" rx="4" fill="var(--panel)"/><rect x="26" y="5" width="16" height="9" rx="3" fill="var(--c)"/><path d="M22 24l4 4 7-8M22 38l4 4 7-8M38 25h10M38 39h10" />',
  5: '<rect x="8" y="40" width="50" height="12" rx="2" fill="var(--cv-b1)"/><rect x="14" y="28" width="44" height="12" rx="2" fill="var(--c)"/><rect x="10" y="16" width="46" height="12" rx="2" fill="var(--cv-b3)"/><path d="M60 52l8-34 4 2-6 34z" fill="var(--cv-sun)"/>',
  6: '<path d="M34 56V8" /><path d="M34 10h22l5 6-5 6H34z" fill="var(--cv-b2)"/><path d="M34 26H14l-5 6 5 6h20z" fill="var(--cv-b1)"/><path d="M34 42h22l5 6-5 6H34z" fill="var(--cv-b3)"/>',
  7: '<rect x="12" y="6" width="42" height="52" rx="4" fill="var(--panel)"/><text x="33" y="30" text-anchor="middle" font-size="20" font-weight="700" fill="var(--c)" stroke="none">A</text><path d="M20 40v10M28 36v14M36 43v7M44 38v12" stroke="var(--c)" stroke-width="4"/>',
  8: '<path d="M8 54c18-4 6-18 22-22s8-14 26-18" fill="none" stroke-dasharray="3 5"/><circle cx="8" cy="54" r="5" fill="var(--panel)"/><circle cx="30" cy="32" r="5" fill="var(--panel)"/><circle cx="56" cy="14" r="5" fill="var(--c)"/><path d="M56 9V1l9 3-9 3" fill="var(--c)"/>',
  9: '<path d="M6 24L34 8l28 16z" fill="var(--c)"/><path d="M12 28v22M24 28v22M44 28v22M56 28v22M6 54h56" /><path d="M2 6l10-3 10 3-10 3z" fill="var(--cv-cap)" transform="translate(48 -2)"/>',
  10: '<g fill="var(--panel)"><path d="M4 56V34l9-8 9 8v22z"/><path d="M26 56V28l9-8 9 8v28z" fill="color-mix(in srgb,var(--c) 30%,var(--panel))"/><path d="M48 56V34l9-8 9 8v22z"/></g><path d="M10 56V46h6v10M32 56V44h6v12M54 56V46h6v10" />',
};
const spot = (n) => (SPOT[n] ? `<svg class="cv-spot" viewBox="0 0 72 62" ${SPOT_STYLE} fill="none" aria-hidden="true">${SPOT[n]}</svg>` : "");

export async function creditView(el, { load, esc, badge, src, table, basic }) {
  const [rows, summary, manifest] = await Promise.all([load("policy"), load("summary"), fetch("img/credit/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}))]);
  const get = (id) => rows.find((r) => r.id === id);
  const by = (...ids) => ids.map(get).filter(Boolean);
  const num = (id, re) => { const m = get(id)?.body.match(re); return m ? m.slice(1).map(Number) : null; };
  const chip = (id) => { const r = get(id); return r ? `<span class="pst ${r.status} cv-chip">${esc(STATUS_TEXT[r.status] || r.status)}</span>` : ""; };
  const basis = (title, ids) => { const rs = by(...ids); return rs.length ? `<details class="cv-basis"><summary>${esc(title)}</summary>${table(rs, basic)}</details>` : ""; };
  const pct = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  // 공식 이미지 슬롯: manifest[slot] = { file, caption, source }. file이 없으면 아무것도 그리지 않는다.
  const fig = (slot) => {
    const m = manifest[slot];
    if (!m || typeof m.file !== "string" || !/^[\w.-]+$/.test(m.file)) return "";
    return `<figure class="cv-fig"><img src="img/credit/${esc(m.file)}" alt="${esc(m.caption || "")}" loading="lazy"><figcaption>${esc(m.caption || "")}${m.source ? ` <span class="muted">출처: ${esc(m.source)}</span>` : ""}</figcaption></figure>`;
  };
  // 섹션 카드: 색(.cv-sN), 아이콘 헤더, 한 줄 요약, 본문, 공식 이미지 슬롯, 근거 표.
  const toc = [];
  const card = (n, ic, title, lead, body, ids, slot, basisTitle = "근거·상태 표") => (toc.push([n, title]),
    `<section class="cv-card cv-s${n}" id="cv-sec-${n}"><header class="cv-h"><span class="cv-hi">${icon(ic)}</span><div class="cv-ht"><h3><span class="cv-no"></span>${title}</h3>${lead ? `<p class="cv-lead">${lead}</p>` : ""}</div>${spot(n)}</header>${body}${fig(slot)}${basis(basisTitle, ids)}</section>`);

  // ---- 숫자 읽기 ----
  const grad = num("cur-01", /(\d+)학점\s*=\s*교과\s*(\d+).*?창의적 체험활동\s*(\d+)/); // [192, 174, 18]
  const split = num("cur-14", /필수\s*(\d+)학점.*?나머지\s*(\d+)학점/) || num("cur-14", /필수\s*(\d+)\s*\+\s*자율\s*(\d+)/); // [84, 90]
  const unit = num("cur-09", /1학점당 수업량은\s*(\d+)회/); // [16] (1회 시간은 원문 확인 전이라 쓰지 않는다)
  // 이수 기준: 선택과목은 출석률만, 공통과목은 출석률+학업성취율(2026.1.28 완화, log-16). 못 읽으면 cur-02·cur-16 본문을 쓴다.
  const att = num("log-16", /출석률\(?\s*(\d+)\s*\/\s*(\d+)/) || num("cur-02", /출석\s*(\d+)\s*\/\s*(\d+)/); // [2, 3]
  const ach = num("log-16", /공통과목은[^.]*?학업성취율\s*(\d+)\s*%/) || num("cur-16", /성취율\s*(\d+)\s*%/); // [40] 공통과목 한정
  const relax = get("log-16");
  const applyText = (relax?.body.match(/\d{4}학년도 고1~2, \d{4}학년도 전 학년 적용 예정/) || [])[0]; // 적용 시기(본문 그대로)
  const onlineText = (relax?.body.match(/미이수 시 ([^(]+?)(?:\(|$)/) || [])[1]?.trim();
  const cap = num("cur-12", /(\d+)학점을 넘을 수/); // [81]
  const ratioText = (get("cur-15")?.body.match(/((?:\d+\/){4}\d+)\s*%/) || get("cur-04")?.body.match(/((?:\d+\/){4}\d+)\s*%/) || [])[1];
  const ratio = ratioText ? ratioText.split("/").map(Number) : null; // [10, 24, 32, 24, 10]
  const months = get("cur-06") ? [...get("cur-06").body.matchAll(/(\d+)월/g)].map((m) => Number(m[1])) : [];
  const steps = get("cur-26") ? get("cur-26").body.split(/[①②③④]/).slice(1).map((t) => t.replace(/\s*(→|\.).*$/s, "").trim()).filter(Boolean) : [];
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

  // ---- 히어로 ----
  const heroImg = fig("credit-00-hero");
  const hero = `<section class="cv-hero"><div class="cv-hero-t"><span class="cv-kicker">${icon("cap")} 고교학점제 이해</span><h2>${grad ? `3년간 <em>${grad[0]}학점</em>을<br>스스로 채워 가는 고등학교` : "스스로 과목을 골라 학점을 채우는 고등학교"}</h2><p>졸업 기준, 이수 조건, 과목 유형, 성적 산출, 선택 절차를 그림으로 정리했습니다.</p></div>${heroImg ? `<div class="cv-hero-img">${heroImg}</div>` : HERO_SVG}</section>`;

  // ---- 1. 한눈에: 큰 숫자 타일 ----
  const tiles = [
    grad && [grad[0], "졸업 학점", "cur-01", "flag"], grad && [grad[1], "교과 학점", "cur-01", "book"], grad && [grad[2], "창의적 체험활동", "cur-01", "merge"],
    unit && [`${unit[0]}회`, "1학점당 수업량", "cur-09", "calendar"], att && [`${att[0]}/${att[1]}`, "출석률 기준", relax ? "log-16" : "cur-02", "list"], ach && [`${ach[0]}%`, "공통과목 학업성취율", relax ? "log-16" : "cur-16", "gauge"],
  ].filter(Boolean);
  if (tiles.length) cards.push(card(1, "flag", "한눈에", "졸업과 이수 기준의 핵심 숫자", `<div class="cv-tiles">${tiles.map(([v, l, id, ic], i) => `<div class="cv-tile t${i % 6}"><span class="cv-ti">${icon(ic)}</span><b>${esc(String(v))}</b><span>${l}</span>${chip(id)}</div>`).join("")}</div>`, ["cur-01", "cur-14", "cur-09", "log-16", "cur-02", "cur-16", "hs-14"], "credit-01-overview"));

  // ---- 2. 졸업 학점 구성: 도넛 + 스택바 ----
  if (grad && grad[1] + grad[2] === grad[0]) {
    const p1 = pct(grad[1], grad[0]), p2 = pct(grad[2], grad[0]);
    const donut = `<svg class="cv-donut" viewBox="0 0 42 42" role="img" aria-label="졸업 ${grad[0]}학점: 교과 ${grad[1]}, 창의적 체험활동 ${grad[2]}">
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--line)" stroke-width="6"/>
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--cv2)" stroke-width="6" stroke-dasharray="${p1} ${100 - p1}" stroke-dashoffset="25"/>
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--cv5)" stroke-width="6" stroke-dasharray="${p2} ${100 - p2}" stroke-dashoffset="${25 - p1}"/>
      <text x="21" y="21.5" text-anchor="middle" class="cv-dn">${grad[0]}</text><text x="21" y="27" text-anchor="middle" class="cv-ds">학점</text></svg>`;
    const legend = `<ul class="cv-legend"><li><i style="background:var(--cv2)"></i>교과 <b>${grad[1]}</b>학점 <span class="muted">(${p1}%)</span></li><li><i style="background:var(--cv5)"></i>창의적 체험활동 <b>${grad[2]}</b>학점 <span class="muted">(${p2}%)</span></li></ul>`;
    const sub = split && split[0] + split[1] === grad[1]
      ? `<div class="cv-sub"><div class="cv-subt">교과 ${grad[1]}학점의 구성 ${chip("cur-14")}</div><div class="cv-stack" role="img" aria-label="필수 ${split[0]}, 나머지 ${split[1]}"><span class="req" style="width:${pct(split[0], grad[1])}%">필수 ${split[0]}</span><span class="ele" style="width:${pct(split[1], grad[1])}%">나머지 ${split[1]}</span></div></div>` : "";
    cards.push(card(2, "pie", "졸업 학점 구성", `3년간 ${grad[0]}학점 ${chip("cur-01")}`, `<div class="cv-row">${donut}<div>${legend}</div></div>${sub}`, ["cur-01", "cur-14"], "credit-02-structure"));
  }

  // ---- 3. 학년별 여정: 편제표 기준 지정→선택 흐름 ----
  const years = [["1학년", ["1-1", "1-2"]], ["2학년", ["2-1", "2-2"]], ["3학년", ["3-1", "3-2"]]];
  const yearSum = (m, ts, k) => ts.reduce((n, t) => n + (m.byTerm?.[t]?.[k] || 0), 0);
  const ymax = Math.max(...summary.flatMap((m) => years.map(([, ts]) => yearSum(m, ts, "required") + yearSum(m, ts, "elective"))), 1);
  if (summary.length && ymax > 1) {
    const road = `<svg class="cv-road" viewBox="0 0 300 36" aria-hidden="true"><path d="M8 26 C 60 4, 110 4, 150 18 S 240 34, 292 10" fill="none" stroke="var(--cv3)" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>${[24, 150, 276].map((x, i) => `<circle cx="${x}" cy="${[22, 18, 14][i]}" r="7" fill="var(--cv3)"/><text x="${x}" y="${[25, 21, 17][i]}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--bg)">${i + 1}</text>`).join("")}</svg>`;
    const mini = (m) => `<div class="cv-ym"><div class="cv-yn">${esc(m.schoolName)}</div><div class="cv-ycols">${years.map(([lab, ts]) => { const r = yearSum(m, ts, "required"), e = yearSum(m, ts, "elective"); return `<div class="cv-yc"><div class="cv-yb" style="height:${pct(r + e, ymax) * 0.9}px"><span class="ele" style="flex:${e || 0.0001}">${e || ""}</span><span class="req" style="flex:${r || 0.0001}">${r || ""}</span></div><em>${lab}</em></div>`; }).join("")}</div></div>`;
    cards.push(card(3, "steps", "학년별 여정", "1학년은 지정 과목 중심, 학년이 올라갈수록 선택 과목이 늘어납니다(학교 편제표 기준).",
      `${road}<div class="cv-ylegend"><span><i class="req"></i>지정</span><span><i class="ele"></i>선택</span></div><div class="cv-years">${summary.map(mini).join("")}</div><p class="muted small">학교별 학년 교과 학점. 창의적 체험활동 제외. <a href="#select/curriculum">학교별 편제표 보기</a></p>`, [], "credit-03-journey"));
  }

  // ---- 4. 이수 요건: 공통과목 / 선택과목 게이지 ----
  const gauge = (l, p, id) => `<div class="cv-g"><div class="cv-gl">${esc(l)} ${chip(id)}</div><div class="cv-gb"><span style="width:${p}%"></span></div></div>`;
  const rid = relax ? "log-16" : "cur-02";
  const common = [att && gauge(`출석률 ${att[0]}/${att[1]} 이상`, pct(att[0], att[1]), rid), ach && gauge(`학업성취율 ${ach[0]}% 이상`, ach[0], relax ? "log-16" : "cur-16")].filter(Boolean);
  const elective = att ? [gauge(`출석률 ${att[0]}/${att[1]} 이상`, pct(att[0], att[1]), rid)] : [];
  const capG = cap && grad ? gauge(`국·수·영 이수학점 합 ${cap[0]}학점 이하 (교과 ${grad[1]} 중)`, pct(cap[0], grad[1]), "cur-12") : "";
  if (common.length || elective.length) {
    const lead = relax && ach ? `선택과목은 출석률만, 공통과목은 출석률과 학업성취율 ${ach[0]}%가 요건입니다.` : "과목 이수 기준입니다.";
    const extra = [applyText && `적용: ${esc(applyText)}`, onlineText && `미이수 시 ${esc(onlineText)}`].filter(Boolean);
    const body = `<div class="cv-two"><div class="cv-pane"><h4><i class="cv-dot c0"></i>공통과목</h4>${common.join("")}</div><div class="cv-pane"><h4><i class="cv-dot c1"></i>선택과목</h4>${elective.join("")}<p class="muted small">학업성취율은 선택과목의 이수 요건이 아닙니다.</p></div></div>${capG ? `<div class="cv-cap">${capG}</div>` : ""}${extra.length ? `<ul class="cv-extra">${extra.map((t) => `<li>${t}</li>`).join("")}</ul>` : ""}`;
    cards.push(card(4, "shield", "과목 이수 요건", lead, body, ["log-16", "cur-02", "cur-16", "cur-12"], "credit-04-requirements"));
  }

  // ---- 5. 공통과목 필수학점 ----
  if (c3) {
    const max = Math.max(...items.map((x) => x[1]), 1);
    const chart = itemsOk
      ? `<div class="cv-bars">${items.map(([n, v]) => `<div class="cv-br"><span class="cv-bn">${esc(n)}</span><span class="cv-bt"><i style="width:${pct(v, max)}%"></i></span><b>${v}</b></div>`).join("")}</div><p class="cv-total">합계 <b>${sum}</b>학점 ${chip("cur-03")}</p>`
      : `<p>${esc(c3.body)}</p>`;
    cards.push(card(5, "book", "공통과목 필수학점", "모든 학생이 듣는 공통과목의 학점", chart, ["cur-03"], "credit-05-common"));
  }

  // ---- 6. 과목 유형: 캐릭터형 아이콘 카드 + 교과군별 개수 ----
  const KIND = [["일반선택", "book"], ["진로선택", "compass"], ["융합선택", "merge"]];
  const matrix = [];
  for (const id of ["cur-18", "cur-19", "cur-20", "cur-21", "cur-22", "cur-23"]) {
    const r = get(id);
    if (!r) continue;
    const cnt = {}, ex = {};
    for (const seg of r.body.replace(/\s*\(경기[^)]*\)\s*$/, "").split(/\s*\/\s*/)) {
      const m = seg.match(/^(일반선택|진로선택|융합선택):\s*(.+)$/);
      if (m) { const list = m[2].split(/,\s*/).filter(Boolean); cnt[m[1]] = list.length; ex[m[1]] = list; }
    }
    if (Object.keys(cnt).length) matrix.push([r.title.replace(/^선택과목:\s*/, "").replace(/\(.*\)/, ""), cnt, ex]);
  }
  if (matrix.length || get("cur-05")) {
    const total = (k) => matrix.reduce((n, [, c]) => n + (c[k] || 0), 0);
    const sample = (k) => matrix.slice(0, 3).map(([, , ex]) => ex[k]?.[0]).filter(Boolean).slice(0, 3);
    const kindCards = `<div class="cv-kinds"><div class="cv-kind k0"><span class="cv-ki">${icon("school")}</span><b>공통과목</b><span class="cv-kn">모두 이수</span><small>필수 ${sum || "-"}학점</small></div>${KIND.map(([k, ic], i) => `<div class="cv-kind k${i + 1}"><span class="cv-ki">${icon(ic)}</span><b>${k}</b>${matrix.length ? `<span class="cv-kn">${total(k)}과목</span><small>${sample(k).map(esc).join(" · ")}</small>` : ""}</div>`).join("")}</div>`;
    const mx = Math.max(...matrix.flatMap(([, c]) => Object.values(c)), 1);
    const grid = matrix.length ? `<div class="cv-mx" role="table" aria-label="교과군별 선택과목 수"><div class="cv-mh"></div>${KIND.map(([k]) => `<div class="cv-mh">${k}</div>`).join("")}${matrix.map(([a, c]) => `<div class="cv-ma">${esc(a)}</div>${KIND.map(([k]) => `<div class="cv-mc" style="--a:${c[k] ? 0.15 + 0.6 * (c[k] / mx) : 0}">${c[k] ?? "-"}</div>`).join("")}`).join("")}</div><p class="muted small">교과군별 개설 가능한 과목 수(서울교육청 안내서 기준). 체육·예술·제2외국어 등은 아래 과목표를 보세요.</p>` : "";
    cards.push(card(6, "merge", "과목 유형", `공통과목과 선택과목 3종 ${chip("cur-05")}`, kindCards + grid, ["cur-05", "cur-10", "cur-11", "cur-13", "cur-18", "cur-19", "cur-20", "cur-21", "cur-22", "cur-23"], "credit-06-types", "근거·상태 표 / 교과군별 과목표"));
  }

  // ---- 7. 성적 산출 ----
  if (ratio && ratio.length === 5) {
    const mx = Math.max(...ratio);
    cards.push(card(7, "bars", "성적 산출", `공통·일반선택은 성취도 5단계와 함께 석차 5등급이 기록됩니다 ${chip("cur-04")}`,
      `<div class="cv-cols" role="img" aria-label="5등급 비율 ${ratio.join("/")}%">${ratio.map((v, i) => `<div class="cv-col"><b>${v}%</b><span style="height:${pct(v, mx) * 0.9}px"></span><em>${i + 1}등급</em></div>`).join("")}</div><p class="muted small">상위 누적 비율 기준(1등급 상위 ${ratio[0]}%). 일부 과목은 석차등급을 산출하지 않습니다.</p>`,
      ["cur-04", "cur-15", "cur-28", "hs-13"], "credit-07-grading"));
  }

  // ---- 8. 과목 선택 절차: 단계별 일러스트 + 조사 타임라인 ----
  if (steps.length || months.length) {
    const STEP_IC = ["list", "search", "chat", "pencil"];
    const flow = steps.length ? `<ol class="cv-flow">${steps.map((t, i) => `<li><span class="cv-fi">${icon(STEP_IC[i % 4])}</span><b>STEP ${i + 1}</b><span>${esc(t)}</span></li>`).join("")}</ol>` : "";
    const tl = months.length ? `<div class="cv-tl"><div class="cv-subt">선택과목 수요 조사 ${chip("cur-06")}</div><div class="cv-tlr">${months.map((m, i) => `<div class="cv-tp"><b>${i + 1}차</b><span>${m}월</span></div>`).join('<i class="cv-ta"></i>')}</div><p class="muted small">서울 설명회 자료 예시이며 학교별로 다를 수 있습니다.</p></div>` : "";
    cards.push(card(8, "compass", "과목 선택 절차", `선택과목은 4단계로 정합니다 ${chip("cur-26")}`, flow + tl, ["cur-06", "cur-26", "cur-07", "cur-31", "cur-32"], "credit-08-process"));
  }

  // ---- 9. 대학 권장이수·학교 교육과정 ----
  const info = by("cur-07", "cur-31", "cur-32");
  if (info.length) cards.push(card(9, "school", "대학 권장이수과목과 학교 교육과정", "", `<div class="cv-notes">${info.map((r) => `<div class="cv-note"><b>${esc(r.title)}</b><p>${esc(r.body)}</p>${chip(r.id)}</div>`).join("")}</div>`, ["cur-07", "cur-31", "cur-32"], "credit-09-university"));

  // ---- 10. 우리 4개교 ----
  if (summary.length) {
    const mx = Math.max(...summary.map((m) => m.creditsSubject), 1);
    cards.push(card(10, "school", "우리 4개교", "학교 편제표 기준 교과 학점(서울교육청 기준 필수·자율 분류와 다릅니다)",
      `<div class="cv-schools">${summary.map((m) => `<div class="cv-sc"><span class="cv-sn">${esc(m.schoolName)}</span><div class="cv-stack" style="width:${pct(m.creditsSubject, mx)}%" role="img" aria-label="${esc(m.schoolName)} 지정 ${m.creditsRequired}, 선택 ${m.creditsElective}"><span class="req" style="width:${pct(m.creditsRequired, m.creditsSubject)}%">지정 ${m.creditsRequired}</span><span class="ele" style="width:${pct(m.creditsElective, m.creditsSubject)}%">선택 ${m.creditsElective}</span></div></div>`).join("")}</div><p><a class="btn" href="#select/curriculum">학교별 편제표 보기</a></p>`, [], "credit-10-schools"));
  }

  // 과목표(교과군별): 표만 접어서
  const subj = by("cur-17", "cur-18", "cur-19", "cur-20", "cur-21", "cur-22", "cur-23", "cur-24", "cur-25", "cur-27");
  const tail = subj.length ? `<details class="cv-basis cv-big"><summary>과목표(교과군별) 전체 보기</summary>${table(subj, basic)}</details>` : "";

  const nav = `<nav class="cv-toc" aria-label="섹션 목차">${toc.map(([n, t], i) => `<button type="button" class="fchip" data-go="cv-sec-${n}"><b>${i + 1}</b> ${esc(t)}</button>`).join("")}</nav>`;
  el.innerHTML = `${hero}<p class="note">서울교육청 자료는 경기 적용 확인 필요. 경기도교육청 행은 요약본(출처 불일치 가능). 그림 위 배지와 "근거·상태 표"에서 상태·출처를 확인하세요.</p>
    ${nav}${cards.map((c, i) => c.replace('<span class="cv-no"></span>', `<span class="cv-no">${i + 1}</span>`)).join("")}${tail}
    <p class="muted">수능 출제범위는 <a href="#admission/system">대입 제도</a>에서 봅니다.</p>`;
  el.querySelector(".cv-toc")?.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) document.getElementById(b.dataset.go)?.scrollIntoView({ behavior: "smooth", block: "start" }); });
}
