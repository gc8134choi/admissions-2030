// 학교 비교의 "내신 출제·평가 경향(국영수과사)": 비교 표 행 + 학교별 접이식 상세("내신 시험 어떻게 나오나").
//   데이터: exam-trends.json(tools/build-exam-trends.mjs). 경향 한 줄은 평균·표준편차 기준 추정이며 학교가 어렵다는 단정이 아니다.
//   hs-compare.js가 부른다: examRows(data, esc) → cmpTable 행, examPanel(data, esc, {hrefOf}) → 표 아래 HTML, bindExam(root, data, esc, opts).
import { emptyLine, WHERE } from "./empty.js";
import { srcWrap } from "./src-ref.js";
import "./policy-css.js";

export const EX_GROUP = "내신 출제·평가 경향(국영수과사)";
const SUBJ = ["국어", "영어", "수학", "과학", "사회"];
const NO_DATA = "이 학교의 내신 평균·분포 자료를 아직 정리하지 못했어요";
const ymd = (d) => (d ? d.replace(/-/g, ".") : "");
const by = (data) => new Map((data?.items ?? []).map((i) => [i.placeId, i]));
const f1 = (n) => (n == null ? null : Number.isInteger(n) ? String(n) : n.toFixed(1));

export function examRows(data, esc) {
  const m = by(data);
  const whyOf = (e) => [e?.nullReason || NO_DATA, e?.nextAction].filter(Boolean).join(" → ");
  const sub = (e, s) => e?.subjects.find((x) => x.subject === s);
  const hasAch = (data?.items ?? []).some((i) => i.subjects.length), hasEssay = (data?.items ?? []).some((i) => i.subjects.some((s) => s.essayPct != null));
  const grade1 = (e) => (e.plans || []).find((p) => p.grade === 1) ?? e.plans?.[0];
  const row = (id, label, unit, kind, pick, extra = {}) => ({ id, label, unit, group: EX_GROUP, kind, ...extra, get: (t) => { const e = m.get(t.id); if (!e) return { empty: true, why: NO_DATA }; if (!e.subjects.length && !(e.plans || []).length) return { empty: true, why: whyOf(e) }; return pick(e) ?? { empty: true, why: "이 칸은 아직 정리하지 못했어요" }; } });
  const rows = [];
  if (hasAch) rows.push(row("ex-tend", "경향 한 줄", "", "text", (e) => e.summary && { text: e.summary.tendency, html: `${esc(e.summary.tendency)}<span class="muted sma el-est"> ${esc(e.summary.basis)}</span>` }));
  // 평가계획(공개값): 1학년 공통과목의 교과별 지필 반영 비율(수행은 100에서 뺀 값)
  for (const s of SUBJ) rows.push(row(`ex-${s}-pl`, `${s} 지필 반영`, "%", "number", (e) => { const p = grade1(e); const r = (p?.rows || []).filter((x) => x.area === s); if (!r.length) return null; const paper = Math.round(r.reduce((a, x) => a + x.paperPct, 0) / r.length); return { text: String(paper), num: paper, html: `${paper}<span class="muted sma el-est"> 수행 ${100 - paper}</span>` }; }, { max: 100 }));
  if (hasAch) for (const s of SUBJ) {
    const g = (fn) => (e) => { const x = sub(e, s); return x ? fn(x, e) : null; };
    rows.push(
      row(`ex-${s}-m`, `${s} 평균`, "점", "number", g((x) => x.mean != null && { text: f1(x.mean), num: x.mean }), { max: 100 }),
      row(`ex-${s}-sd`, `${s} 표준편차`, "", "number", g((x) => x.sd != null && { text: f1(x.sd), num: x.sd }), { max: 30 }),
      row(`ex-${s}-a`, `${s} A 비율`, "%", "number", g((x) => x.aPct != null && { text: f1(x.aPct), num: x.aPct }), { max: 100 }),
    );
    if (hasEssay) rows.push(row(`ex-${s}-es`, `${s} 서술형 비율`, "%", "number", g((x) => x.essayPct != null && { text: f1(x.essayPct), num: x.essayPct }), { max: 100 }));
  }
  rows.push(row("ex-term", "기준 학기", "", "text", (e) => { const p = grade1(e); return (p?.term || e.term) && { text: `${p?.term || e.term}${p ? " (1학년 계획)" : ""}` }; }),
    row("ex-asof", "자료 기준일", "", "text", (e) => e.asOf && { text: ymd(e.asOf) }));
  return rows;
}

const planList = (rows, esc) => `<ul class="el-list">${rows.map((x) => `<li class="el-r"><span class="el-n">${esc(x.subject)}<span class="muted sma"> ${esc(x.area)}</span></span><span class="el-b" aria-hidden="true"><i class="sci" style="width:${x.paperPct}%"></i></span><span class="el-v">지필 ${f1(x.paperPct)} · 수행 ${f1(x.performancePct)}</span></li>`).join("")}</ul>`;
function detail(e, esc, { hrefOf } = {}) {
  const src = (e.sources || []).map((s) => (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>` : esc(s.name))).join(" · ");
  const link = hrefOf && (e.qualitative || []).length ? hrefOf(e) : null;
  const plans = (e.plans || []).map((p) => `<details class="dn"${p.grade === 1 ? " open" : ""}><summary>${p.grade}학년 평가계획 <span class="muted sma">${esc(p.term)} · ${p.rows.length}과목</span></summary><p class="muted sma">막대는 지필 반영 비율이에요(나머지는 수행평가).</p>${planList(p.rows, esc)}</details>`).join("");
  const ach = e.subjects.length ? e.subjects.map((s) => `<h4 class="el-h">${esc(s.subject)} <span class="muted sma">${[s.mean != null ? `평균 ${f1(s.mean)}점` : "", s.sd != null ? `표준편차 ${f1(s.sd)}` : "", s.takers ? `${s.takers.toLocaleString("ko-KR")}명` : ""].filter(Boolean).join(" · ")}</span></h4>
      ${s.dist ? `<div class="ex-dist" role="img" aria-label="성취도 분포 ${esc(Object.entries(s.dist).map(([k, v]) => `${k} ${f1(v)}%`).join(", "))}">${Object.entries(s.dist).map(([k, v]) => `<i style="flex:${v}" title="${esc(k)} ${f1(v)}%"><b>${esc(k)}</b> ${f1(v)}%</i>`).join("")}</div>` : ""}
      ${s.plan ? `<p class="ex-plan">${esc(s.plan)}</p>` : ""}`).join("") : emptyLine(esc, { why: `과목별 평균·표준편차·성취도 분포는 아직 없어요${e.achievementNull ? ` — ${e.achievementNull}` : ""}`, next: WHERE.schoolinfo });
  const q = (e.qualitative || []).length ? `<h4 class="el-h">설명회에서 나온 말</h4><ul>${e.qualitative.map((x) => `<li>${esc(x.text)}</li>`).join("")}</ul>${link ? `<p><a href="${esc(link)}">설명회 노트 보기</a></p>` : ""}` : "";
  return `<div class="el-body"><p class="muted sma">${e.term ? esc(e.term) : ""}${e.asOf ? ` · 기준 ${esc(ymd(e.asOf))}` : ""}${e.sourceKind ? ` · ${esc(e.sourceKind)}` : ""}</p>${plans}${ach}${q}<p class="el-links">${srcWrap(src)}</p></div>`;
}

export function examPanel(data, esc, opts = {}) {
  const has = (i) => i.subjects.length || (i.plans || []).length;
  const have = (data?.items ?? []).filter(has), none = (data?.items ?? []).filter((i) => !has(i));
  const g = data?.guide;
  const rules = g?.commonRules ? `<p class="el-rules"><b>학교 평가운영계획에 적힌 공통 규칙</b> ${esc(g.commonRules.text)}${g.commonRules.source ? srcWrap(g.commonRules.source.url ? `<a href="${esc(g.commonRules.source.url)}" target="_blank" rel="noopener">${esc(g.commonRules.source.name)} ↗</a>` : esc(g.commonRules.source.name)) : ""}</p>` : "";
  const basis = (g?.basis || []).length ? `<h4 class="el-h">공식 근거</h4><ul>${g.basis.map((b) => `<li>${esc(b.text)}${b.source ? srcWrap(b.source.url ? `<a href="${esc(b.source.url)}" target="_blank" rel="noopener">${esc(b.source.name)} ↗</a>` : esc(b.source.name)) : ""}</li>`).join("")}</ul>` : "";
  const tail = `<p class="el-note">${esc(g?.intro || "이 숫자만으로 어려운 학교인지 단정하기 어려워요.")}</p>${basis}${(g?.questions || []).length ? `<h4 class="el-h">설명회에서 물어볼 질문</h4><ul>${g.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}`;
  if (!have.length) return `<section class="el-sec">${emptyLine(esc, { why: "내신 시험 경향은 학교알리미 공시와 학교 평가계획을 정리하는 대로 채워요", next: WHERE.schoolinfo })}</section>`;
  const noneHtml = none.length ? `<details class="dn el-none"><summary>평가계획 정리 전인 학교 ${none.length}곳</summary><ul>${none.map((e) => `<li class="muted gap">${esc(e.name)}: ${esc(e.nullReason || NO_DATA)}${e.nextAction ? ` <b>다음</b> ${esc(e.nextAction)}` : ""} <a class="gap-next" href="${esc(WHERE.schoolinfo.url)}" target="_blank" rel="noopener">${esc(WHERE.schoolinfo.label)}</a></li>`).join("")}</ul></details>` : "";
  return `<section class="el-sec"><details class="dn el-d" id="ex-detail"><summary>내신 시험 어떻게 나오나</summary>${rules}
    ${have.length > 1 ? `<label class="el-pick">학교 <select data-ex-pick aria-label="학교 고르기">${have.map((e) => `<option value="${esc(e.placeId)}">${esc(e.name)}</option>`).join("")}</select></label>` : ""}
    <div data-ex-body>${detail(have[0], esc, opts)}</div>${noneHtml}${tail}</details></section>`;
}

export function bindExam(root, data, esc, opts = {}) {
  const sel = root.querySelector("[data-ex-pick]");
  if (!sel) return;
  const m = by(data);
  sel.addEventListener("change", () => { const e = m.get(sel.value); const b = root.querySelector("[data-ex-body]"); if (e && b) b.innerHTML = detail(e, esc, opts); });
}
