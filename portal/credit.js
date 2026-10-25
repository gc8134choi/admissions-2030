// 고교학점제 이해 화면(A안 에디토리얼): 한 문장 + 큰 숫자 + 헤어라인 격자, 얇은 선 그래프. 스타일은 policy.css(.ed-*).
// 숫자는 policy.json 행의 본문에서 코드로 읽고(못 읽으면 그 그림은 뺀다), 학년별·학교별 학점은 편제표 DB(summary.json)에서 읽는다.
// 각 섹션 끝에 "근거·상태" 행(상태·출처 포함)을 접어 둔다. 공식 이미지 슬롯: portal/img/credit/manifest.json (README.md 참고).
import { preloadSubjectInfo, subjectName, hasSubjectInfo } from "./subject-info.js";

// 섹션 머리 옆의 작은 선 그림(직접 그림). 번호는 섹션 번호와 같고, 선은 먹색·강조 1곳만 포인트색(policy.css가 칠한다).
const SPOT = {
  1: '<path d="M14 54V10" /><path d="M14 12h30l-7 9 7 9H14z" fill="var(--c)"/><path d="M4 54h60" /><circle cx="58" cy="14" r="6"/>',
  2: '<circle cx="36" cy="38" r="20"/><path d="M36 38V18A20 20 0 0 1 43 19.3z" fill="var(--c)" transform="translate(3 -4)"/><path d="M2 14l14-5 14 5-14 5z"/>',
  3: '<path d="M4 54h14V42h14V30h14V18h16v36"/><circle cx="24" cy="22" r="5"/><path d="M24 27v9M24 31l-6 5M24 31l6 4" /><path d="M62 18V6l8 3-8 3" fill="var(--c)"/>',
  4: '<rect x="14" y="10" width="40" height="46" rx="4"/><rect x="26" y="5" width="16" height="9" rx="3" fill="var(--c)"/><path d="M22 24l4 4 7-8M22 38l4 4 7-8M38 25h10M38 39h10" />',
  5: '<rect x="8" y="40" width="50" height="12" rx="2"/><rect x="14" y="28" width="44" height="12" rx="2" fill="var(--c)"/><rect x="10" y="16" width="46" height="12" rx="2"/><path d="M60 52l8-34 4 2-6 34z"/>',
  6: '<path d="M34 56V8" /><path d="M34 10h22l5 6-5 6H34z"/><path d="M34 26H14l-5 6 5 6h20z" fill="var(--c)"/><path d="M34 42h22l5 6-5 6H34z"/>',
  7: '<rect x="12" y="6" width="42" height="52" rx="4"/><text x="33" y="30" text-anchor="middle" font-size="20" font-weight="700" fill="var(--c)" stroke="none">A</text><path d="M20 40v10M28 36v14M36 43v7M44 38v12" stroke-width="4"/>',
  8: '<path d="M8 54c18-4 6-18 22-22s8-14 26-18" stroke-dasharray="3 5"/><circle cx="8" cy="54" r="5"/><circle cx="30" cy="32" r="5"/><circle cx="56" cy="14" r="5" fill="var(--c)"/><path d="M56 9V1l9 3-9 3" fill="var(--c)"/>',
  9: '<path d="M6 24L34 8l28 16z" fill="var(--c)"/><path d="M12 28v22M24 28v22M44 28v22M56 28v22M6 54h56" /><path d="M2 6l10-3 10 3-10 3z" transform="translate(48 -2)"/>',
  10: '<path d="M4 56V34l9-8 9 8v22z"/><path d="M26 56V28l9-8 9 8v28z" fill="var(--c)"/><path d="M48 56V34l9-8 9 8v22z"/><path d="M10 56V46h6v10M32 56V44h6v12M54 56V46h6v10" />',
};
const spot = (n) => (SPOT[n] ? `<svg class="ed-art" viewBox="0 0 72 62" stroke-width="2" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round" fill="none" aria-hidden="true">${SPOT[n]}</svg>` : "");

export async function creditView(el, { load, profile, esc, badge, badgeMain, src, table, basic }) {
  const [rows, summary, manifest] = await Promise.all([load("policy"), load("summary"), fetch("img/credit/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}))]);
  const get = (id) => rows.find((r) => r.id === id);
  const by = (...ids) => ids.map(get).filter(Boolean);
  const num = (id, re) => { const m = get(id)?.body.match(re); return m ? m.slice(1).map(Number) : null; };
  const dot = (id) => { const r = get(id); return r ? badgeMain(r) : ""; };
  const pct = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  // 공식 이미지 슬롯: manifest[slot] = { file, caption, source }. file이 없으면 아무것도 그리지 않는다.
  const fig = (slot) => {
    const m = manifest[slot];
    if (!m || typeof m.file !== "string" || !/^[\w.-]+$/.test(m.file)) return "";
    return `<figure class="ed-fig"><img src="img/credit/${esc(m.file)}" alt="${esc(m.caption || "")}" loading="lazy"><figcaption>${esc(m.caption || "")}${m.source ? ` · 출처 ${esc(m.source)}` : ""}</figcaption></figure>`;
  };
  const basis = (ids) => { const rs = by(...ids); return rs.length ? `<details class="ed-basis"><summary>근거와 출처 ${rs.length}건</summary>${table(rs)}</details>` : ""; };
  const toc = [];
  // 섹션: 번호는 CSS 카운터(01, 02…). lead는 한 문장, body는 그림, ids는 근거 행.
  const sec = (n, title, lead, body, ids, slot) => (toc.push([n, title]), `<section id="cv-sec-${n}"><h2>${title}</h2>${spot(n)}${lead ? `<p class="ed-b">${lead}</p>` : ""}${body}${fig(slot)}${basis(ids)}</section>`);

  // ---- 숫자 읽기 ----
  const grad = num("cur-01", /(\d+)학점\s*=\s*교과\s*(\d+).*?창의적 체험활동\s*(\d+)/); // [192, 174, 18]
  const split = num("cur-14", /필수\s*(\d+)학점.*?나머지\s*(\d+)학점/) || num("cur-14", /필수\s*(\d+)\s*\+\s*자율\s*(\d+)/); // [84, 90]
  const unit = num("cur-09", /(\d+)회/); // [16]
  const unitMin = (get("cur-09")?.body.match(/(\d+)분 수업/) || [])[1]; // 1회 수업 시간(본문에 있을 때만)
  // 이수 기준: 선택과목은 출석률만, 공통과목은 출석률+학업성취율(2026.1.28 완화, log-16). 못 읽으면 cur-02·cur-16 본문을 쓴다.
  const att = num("log-16", /출석률\(?\s*(\d+)\s*\/\s*(\d+)/) || num("cur-02", /출석\s*(\d+)\s*\/\s*(\d+)/); // [2, 3]
  const ach = num("log-16", /공통과목은[^.]*?학업성취율\s*(\d+)\s*%/) || num("cur-16", /성취율\s*(\d+)\s*%/); // [40] 공통과목 한정
  const relax = get("log-16");
  const applyText = (relax?.body.match(/\d{4}학년도 고1~2, \d{4}학년도 전 학년 적용 예정/) || [])[0];
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

  const out = [];

  // ---- 한눈에: 한 문장 + 큰 숫자 + 헤어라인 격자 ----
  const g = (v, k, n, id, cls = "", st = "") => `<div class="ed-g${cls}"${st ? ` style="${st}"` : ""}><span class="v">${v}</span><span class="k">${k}</span>${n ? `<span class="n">${n}</span>` : ""}${id ? `<span class="n">${dot(id)}</span>` : ""}</div>`;
  // 큰 숫자(192) 옆 칸들은 데스크톱 3열, 모바일 2열. 마지막 칸이 줄을 채우도록 넓힌다.
  const tiles = grad ? [
    [grad[1], "교과 학점", "", ""],
    [grad[2], "창의적 체험활동", "", ""],
    unit && [`${unit[0]}<sup>회</sup>`, "1학점당 수업", unitMin ? `1회 ${unitMin}분 수업` : "", "cur-09"],
    att && [`${att[0]}/${att[1]}`, "출석률 기준", "", relax ? "log-16" : "cur-02"],
    ach && [`${ach[0]}<sup>%</sup>`, "공통과목 학업성취율", "선택과목은 출석률만 봐요", relax ? "log-16" : "cur-16"],
  ].filter(Boolean) : [];
  const spanFor = (cols) => cols - ((tiles.length - 1) % cols);
  const glance = grad ? `<div class="ed-glance">${g(grad[0], "졸업까지 채울 학점", `교과 ${grad[1]} + 창의적 체험활동 ${grad[2]}`, "cur-01", " main")}${tiles.map((t, i) => g(t[0], t[1], t[2], t[3], i === tiles.length - 1 ? " last" : "", i === tiles.length - 1 ? `--sp-d:${spanFor(3)};--sp-m:${spanFor(2)}` : "")).join("")}</div><p class="ed-src">출처 ${get("cur-01") ? src(get("cur-01")) : ""}</p>` : "";
  const lead = grad ? `<p class="ed-lead">3년 동안 <mark>${grad[0]}학점</mark>을 스스로 채웁니다.</p>` : "";
  const profNote = profile && profile.id !== "A" ? `<p class="ed-src">${esc(profile.label)}이 입학하는 ${profile.entryYear}학년도에도 같은 틀일지는 아직 확정이 아니에요. 바뀔 수 있어요(추정).</p>` : "";

  // ---- 졸업 학점 구성 ----
  if (grad && grad[1] + grad[2] === grad[0]) {
    const seg2 = split && split[0] + split[1] === grad[1]
      ? `<p class="ed-key" style="margin-top:18px"><span>교과 ${grad[1]}학점의 구성</span> ${dot("cur-14")}</p><div class="ed-seg" role="img" aria-label="필수 ${split[0]}, 나머지 ${split[1]}"><i style="width:${pct(split[0], grad[1])}%;background:var(--e-req)"></i><i style="width:${pct(split[1], grad[1])}%;background:var(--e-ele)"></i></div><p class="ed-key"><span><i class="ed-dot" style="background:var(--e-req)"></i>필수 <b>${split[0]}</b></span><span><i class="ed-dot" style="background:var(--e-ele)"></i>나머지 <b>${split[1]}</b></span></p>` : "";
    out.push(sec(1, "졸업 학점 구성", `3년간 ${grad[0]}학점을 채워요. ${dot("cur-01")}`,
      `<div class="ed-seg" role="img" aria-label="교과 ${grad[1]}, 창의적 체험활동 ${grad[2]}"><i style="width:${pct(grad[1], grad[0])}%;background:var(--e-ink)"></i><i style="width:${pct(grad[2], grad[0])}%;background:var(--e-accent)"></i></div><p class="ed-key"><span><i class="ed-dot" style="background:var(--e-ink)"></i>교과 <b>${grad[1]}</b> (${pct(grad[1], grad[0])}%)</span><span><i class="ed-dot" style="background:var(--e-accent)"></i>창의적 체험활동 <b>${grad[2]}</b> (${pct(grad[2], grad[0])}%)</span></p>${seg2}`, ["cur-01", "cur-14", "cur-09", "hs-14"], "credit-02-structure"));
  }

  // ---- 학년별 여정: 편제표 기준 지정→선택 ----
  const years = [["1학년", ["1-1", "1-2"]], ["2학년", ["2-1", "2-2"]], ["3학년", ["3-1", "3-2"]]];
  const yearSum = (m, ts, k) => ts.reduce((n, t) => n + (m.byTerm?.[t]?.[k] || 0), 0);
  const ymax = Math.max(...summary.flatMap((m) => years.map(([, ts]) => yearSum(m, ts, "required") + yearSum(m, ts, "elective"))), 1);
  if (summary.length && ymax > 1) {
    const mini = (m) => `<div class="ed-ym"><h3>${esc(m.schoolName)}</h3><div class="ed-yc">${years.map(([lab, ts]) => { const r = yearSum(m, ts, "required"), e = yearSum(m, ts, "elective"); return `<div><div class="ed-yb" style="height:${pct(r + e, ymax) * 0.9}px"><span class="ele" style="flex:${e || 0.0001}">${e || ""}</span><span class="req" style="flex:${r || 0.0001}">${r || ""}</span></div><em>${lab}</em></div>`; }).join("")}</div></div>`;
    out.push(sec(3, "학년별 여정", "1학년은 지정 과목이 중심이고, 학년이 올라갈수록 선택 과목이 늘어요(학교 편제표 기준).",
      `<p class="ed-ylegend"><span><i style="background:var(--e-req)"></i>지정</span><span><i style="background:var(--e-ele)"></i>선택</span></p><div class="ed-years">${summary.map(mini).join("")}</div><p class="ed-src">학교별 학년 교과 학점이에요. 창의적 체험활동은 빼요. <a href="#select/curriculum">학교별 편제표 보기</a></p>`, [], "credit-03-journey"));
  }

  // ---- 과목 이수 요건: 공통 / 선택 ----
  const gauge = (l, p, id) => `<div class="ed-gauge"><div class="l">${esc(l)} ${dot(id)}</div><div class="t"><i style="width:${p}%"></i></div></div>`;
  const rid = relax ? "log-16" : "cur-02";
  const common = [att && gauge(`출석률 ${att[0]}/${att[1]} 이상`, pct(att[0], att[1]), rid), ach && gauge(`학업성취율 ${ach[0]}% 이상`, ach[0], relax ? "log-16" : "cur-16")].filter(Boolean);
  const elective = att ? [gauge(`출석률 ${att[0]}/${att[1]} 이상`, pct(att[0], att[1]), rid)] : [];
  if (common.length || elective.length) {
    const capG = cap && grad ? `<div style="margin-top:22px">${gauge(`국·수·영 이수학점 합 ${cap[0]}학점 이하 (교과 ${grad[1]} 중)`, pct(cap[0], grad[1]), "cur-12")}</div>` : "";
    const extra = [applyText && `적용: ${esc(applyText)}`, onlineText && `미이수하면 ${esc(onlineText)}`].filter(Boolean);
    out.push(sec(4, "과목 이수 요건", relax && ach ? `선택과목은 출석률만, 공통과목은 출석률과 학업성취율 ${ach[0]}%가 요건이에요.` : "과목 이수 기준이에요.",
      `<div class="ed-two"><div><h3>공통과목</h3>${common.join("")}</div><div><h3>선택과목</h3>${elective.join("")}</div></div>${capG}${extra.length ? `<ul class="ed-plain">${extra.map((t) => `<li>${t}</li>`).join("")}</ul>` : ""}`, ["log-16", "cur-02", "cur-16", "cur-12"], "credit-04-requirements"));
  }

  // ---- 공통과목 필수학점: 얇은 선 ----
  if (c3) {
    const max = Math.max(...items.map((x) => x[1]), 1);
    out.push(sec(5, "공통과목 필수학점", "모든 학생이 듣는 공통과목의 학점이에요.",
      itemsOk ? `<div class="ed-lines">${items.map(([n, v]) => `<div class="ed-ln"><span>${esc(n)}</span><span class="t"><i style="width:${pct(v, max)}%"></i></span><b>${v}</b></div>`).join("")}</div><p class="ed-b" style="margin-top:16px">합계 <b>${sum}</b>학점 ${dot("cur-03")}</p>` : `<p class="ed-b">${esc(c3.body)}</p>`, ["cur-03"], "credit-05-common"));
  }

  // ---- 과목 유형 ----
  const KIND = ["일반선택", "진로선택", "융합선택"];
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
    const kinds = `<div class="ed-kinds"><div><b>공통과목</b><span class="n">모두</span><small>필수 ${sum || "-"}학점</small></div>${KIND.map((k) => `<div><b>${k}</b>${matrix.length ? `<span class="n">${total(k)}<small style="font-size:14px;font-weight:600"> 과목</small></span><small>${sample(k).map(esc).join(" · ")}</small>` : ""}</div>`).join("")}</div>`;
    const grid = matrix.length ? `<div class="ed-mx" role="table" aria-label="교과군별 선택과목 수"><span class="h"></span>${KIND.map((k) => `<span class="h">${k}</span>`).join("")}${matrix.map(([a, c]) => `<span>${esc(a)}</span>${KIND.map((k) => `<span class="c">${c[k] ?? "-"}</span>`).join("")}`).join("")}</div><p class="ed-src">교과군별로 열 수 있는 과목 수예요(서울교육청 안내서 기준). 체육·예술·제2외국어는 아래 과목표를 봐요.</p>` : "";
    out.push(sec(6, "과목 유형", `공통과목과 선택과목 3종이 있어요. ${dot("cur-05")}`, kinds + grid, ["cur-05", "cur-10", "cur-11", "cur-13", "cur-18", "cur-19", "cur-20", "cur-21", "cur-22", "cur-23"], "credit-06-types"));
  }

  // ---- 성적 산출 ----
  if (ratio && ratio.length === 5) {
    const mx = Math.max(...ratio);
    out.push(sec(7, "성적 산출", `공통·일반선택은 성취도 5단계와 석차 5등급이 같이 기록돼요. ${dot("cur-04")}`,
      `<div class="ed-cols" role="img" aria-label="5등급 비율 ${ratio.join("/")}%">${ratio.map((v, i) => `<div class="ed-col"><b>${v}%</b><span style="height:${pct(v, mx) * 0.9}px"></span><em>${i + 1}등급</em></div>`).join("")}</div><p class="ed-src">상위 누적 비율로 1등급은 상위 ${ratio[0]}%예요. 일부 과목은 석차등급이 없어요.</p>`, ["cur-04", "cur-15", "cur-28", "hs-13"], "credit-07-grading"));
  }

  // ---- 과목 선택 절차 ----
  if (steps.length || months.length) {
    const flow = steps.length ? `<ol class="ed-steps">${steps.map((t, i) => `<li><b>${i + 1}</b>${esc(t)}</li>`).join("")}</ol>` : "";
    const tl = months.length ? `<p class="ed-key" style="margin-top:22px"><span>선택과목 수요 조사</span> ${dot("cur-06")}</p><div class="ed-tl">${months.map((m, i) => `<div class="p"><small>${i + 1}차</small><b>${m}월</b></div>`).join('<i class="a"></i>')}</div><p class="ed-src">서울 설명회 자료의 예시라 학교마다 다를 수 있어요.</p>` : "";
    out.push(sec(8, "과목 선택 절차", `선택과목은 네 단계로 정해요. ${dot("cur-26")}`, flow + tl, ["cur-06", "cur-26", "cur-07", "cur-31", "cur-32"], "credit-08-process"));
  }

  // ---- 대학 권장이수·학교 교육과정 ----
  const info = by("cur-07", "cur-31", "cur-32");
  if (info.length) out.push(sec(9, "대학 권장이수과목과 학교 교육과정", "", `<div class="ed-rows">${info.map((r) => `<article class="ed-row"><div class="ed-st">${badgeMain(r)}</div><h3>${esc(r.title)}</h3><p class="ed-b">${esc(r.body)}</p></article>`).join("")}</div>`, ["cur-07", "cur-31", "cur-32"], "credit-09-university"));

  // ---- 우리 4개교 ----
  if (summary.length) {
    const mx = Math.max(...summary.map((m) => m.creditsSubject), 1);
    out.push(sec(10, "우리 4개교", "학교 편제표 기준 교과 학점이에요(서울교육청 기준 필수·자율 분류와는 달라요).",
      `<div>${summary.map((m) => `<div class="ed-sch"><span class="nm">${esc(m.schoolName)}</span><div><div class="ed-bar2" style="width:${pct(m.creditsSubject, mx)}%" role="img" aria-label="${esc(m.schoolName)} 지정 ${m.creditsRequired}, 선택 ${m.creditsElective}"><span class="r" style="width:${pct(m.creditsRequired, m.creditsSubject)}%"></span><span class="e" style="width:${pct(m.creditsElective, m.creditsSubject)}%"></span></div></div><span class="f">지정 ${m.creditsRequired} · 선택 ${m.creditsElective}</span></div>`).join("")}</div><p class="ed-src"><a href="#select/curriculum">학교별 편제표 보기</a></p>`, [], "credit-10-schools"));
  }

  // 과목표(교과군별): 행만 접어서
  const subj = by("cur-17", "cur-18", "cur-19", "cur-20", "cur-21", "cur-22", "cur-23", "cur-24", "cur-25", "cur-27");
  const tail = subj.length ? `<details class="ed-basis cv-big"><summary>과목표(교과군별) 전체 보기</summary>${table(subj)}</details>` : "";

  const nav = `<nav class="ed-toc" aria-label="섹션 목차">${toc.map(([n, t], i) => `<button type="button" data-go="cv-sec-${n}"><b>${String(i + 1).padStart(2, "0")}</b>${esc(t)}</button>`).join("")}</nav>`;
  el.innerHTML = `<div class="ed">${lead}${glance}${profNote}<p class="ed-src">서울교육청 자료는 경기 적용 확인이 필요해요. 경기도교육청 행은 요약본이라 출처가 다를 수 있어요. 항목별 상태와 출처는 각 섹션의 "근거와 출처"에서 볼 수 있어요.</p>${nav}${out.join("")}${tail}<p class="ed-src" style="margin-top:36px">수능 출제범위는 <a href="#admission/system">대입 제도</a>에서 봐요.</p></div>`;
  el.querySelector(".ed-toc")?.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) document.getElementById(b.dataset.go)?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  // 과목표(교과군별) 행 본문의 과목명에 ⓘ(subject-info.js)를 붙인다. 설명이 있는 과목만 붙는다.
  await preloadSubjectInfo(load);
  el.querySelectorAll(".cv-big .ed-b").forEach((p) => {
    const parts = p.textContent.split(/([,·/:|()]|\s{2,})/);
    if (parts.some((t) => t.trim() && hasSubjectInfo(t))) p.innerHTML = parts.map((t) => (t.trim() && hasSubjectInfo(t) ? subjectName(t.trim()) : esc(t))).join("");
  });
}
