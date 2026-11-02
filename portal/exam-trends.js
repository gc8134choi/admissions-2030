// 학교 비교의 "내신 출제·평가 경향(국영수과사)": 비교 표 행 + 학교별 접이식 상세("내신 시험 어떻게 나오나").
//   데이터: exam-trends.json(tools/build-exam-trends.mjs). 경향 한 줄은 평균·표준편차 기준 추정이며 학교가 어렵다는 단정이 아니다.
//   hs-compare.js가 부른다: examRows(data, esc) → cmpTable 행, examPanel(data, esc, {hrefOf}) → 표 아래 HTML, bindExam(root, data, esc, opts).
import { emptyLine } from "./empty.js";
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
  const row = (id, label, unit, kind, pick, extra = {}) => ({ id, label, unit, group: EX_GROUP, kind, ...extra, get: (t) => { const e = m.get(t.id); if (!e) return { empty: true, why: NO_DATA }; if (!e.subjects.length) return { empty: true, why: whyOf(e) }; return pick(e) ?? { empty: true, why: "이 교과 값은 아직 정리하지 못했어요" }; } });
  const rows = [
    row("ex-tend", "경향 한 줄", "", "text", (e) => e.summary && { text: e.summary.tendency, html: `${esc(e.summary.tendency)}<span class="muted sma el-est"> ${esc(e.summary.basis)}</span>` }),
    row("ex-term", "기준 학기", "", "text", (e) => e.term && { text: e.term }),
    row("ex-asof", "자료 기준일", "", "text", (e) => e.asOf && { text: ymd(e.asOf) }),
  ];
  for (const s of SUBJ) {
    const g = (fn) => (e) => { const x = sub(e, s); return x ? fn(x, e) : null; };
    rows.push(
      row(`ex-${s}-m`, `${s} 평균`, "점", "number", g((x) => x.mean != null && { text: f1(x.mean), num: x.mean, status: undefined }), { max: 100 }),
      row(`ex-${s}-sd`, `${s} 표준편차`, "", "number", g((x) => x.sd != null && { text: f1(x.sd), num: x.sd }), { max: 30 }),
      row(`ex-${s}-a`, `${s} A 비율`, "%", "number", g((x) => x.aPct != null && { text: f1(x.aPct), num: x.aPct }), { max: 100 }),
      row(`ex-${s}-pp`, `${s} 지필:수행`, "", "text", g((x) => x.paperPct != null && { text: `${f1(x.paperPct)}:${f1(x.performancePct)}` })),
      row(`ex-${s}-es`, `${s} 서술형 비율`, "%", "number", g((x) => x.essayPct != null && { text: f1(x.essayPct), num: x.essayPct }), { max: 100 }),
    );
  }
  return rows;
}

function detail(e, esc, { hrefOf } = {}) {
  const src = (e.sources || []).map((s) => (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>` : esc(s.name))).join(" · ");
  const link = hrefOf && e.briefingNote ? hrefOf(e) : null;
  return `<div class="el-body"><p class="muted sma">${e.term ? esc(e.term) : ""}${e.asOf ? ` · 기준 ${esc(ymd(e.asOf))}` : ""}${e.sourceKind ? ` · ${esc(e.sourceKind)}` : ""}</p>
    ${e.subjects.map((s) => `<h4 class="el-h">${esc(s.subject)} <span class="muted sma">${[s.mean != null ? `평균 ${f1(s.mean)}점` : "", s.sd != null ? `표준편차 ${f1(s.sd)}` : "", s.takers ? `${s.takers.toLocaleString("ko-KR")}명` : ""].filter(Boolean).join(" · ")}</span></h4>
      ${s.dist ? `<div class="ex-dist" role="img" aria-label="성취도 분포 ${esc(Object.entries(s.dist).map(([k, v]) => `${k} ${f1(v)}%`).join(", "))}">${Object.entries(s.dist).map(([k, v]) => `<i style="flex:${v}" title="${esc(k)} ${f1(v)}%"><b>${esc(k)}</b> ${f1(v)}%</i>`).join("")}</div>` : ""}
      ${s.plan ? `<p class="ex-plan">${esc(s.plan)}</p>` : ""}`).join("")}
    ${e.briefingNote ? `<p class="el-note"><b>설명회에서 나온 말</b> ${esc(e.briefingNote)}${link ? ` <a href="${esc(link)}">설명회 노트 보기</a>` : ""}</p>` : ""}
    <p class="el-links">${srcWrap(src)}</p></div>`;
}

export function examPanel(data, esc, opts = {}) {
  const have = (data?.items ?? []).filter((i) => i.subjects.length);
  const none = (data?.items ?? []).filter((i) => !i.subjects.length);
  const g = data?.guide;
  const tail = `<p class="el-note">${esc(g?.intro || "이 숫자만으로 어려운 학교인지 단정하기 어려워요.")}</p>${(g?.questions || []).length ? `<h4 class="el-h">설명회에서 물어볼 질문</h4><ul>${g.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}`;
  if (!have.length) return `<section class="el-sec">${emptyLine(esc, { why: "내신 시험 경향은 학교알리미 공시와 학교 평가계획을 정리하는 대로 채워요", next: { label: "학교알리미에서 확인", url: "https://www.schoolinfo.go.kr/" } })}</section>`;
  const noneHtml = none.length ? `<details class="dn el-none"><summary>자료 없는 학교 ${none.length}곳</summary><ul>${none.map((e) => `<li class="muted gap">${esc(e.name)}: ${esc(e.nullReason || NO_DATA)}${e.nextAction ? ` <b>다음</b> ${esc(e.nextAction)}` : ""}</li>`).join("")}</ul></details>` : "";
  return `<section class="el-sec"><details class="dn el-d" id="ex-detail"><summary>내신 시험 어떻게 나오나</summary>
    ${have.length > 1 ? `<label class="el-pick">학교 <select data-ex-pick aria-label="학교 고르기">${have.map((e) => `<option value="${esc(e.placeId)}">${esc(e.name)}</option>`).join("")}</select></label>` : ""}
    <div data-ex-body>${detail(have[0], esc, opts)}</div>${noneHtml}${tail}</details></section>`;
}

export function bindExam(root, data, esc, opts = {}) {
  const sel = root.querySelector("[data-ex-pick]");
  if (!sel) return;
  const m = by(data);
  sel.addEventListener("change", () => { const e = m.get(sel.value); const b = root.querySelector("[data-ex-body]"); if (e && b) b.innerHTML = detail(e, esc, opts); });
}
