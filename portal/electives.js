// 학교 비교의 "선택과목 현황(현 2학년)": 비교 표 행 + 학교별 접이식 상세 + "유불리 보는 법".
//   데이터: electives.json(tools/build-electives.mjs). 성향은 '선택 비중 기준 추정'이며 문과·이과 학생 수가 아니다.
//   hs-compare.js가 부른다: electiveRows(data, esc) → cmpTable 행, electivesPanel(data, esc) → 표 아래 HTML, bindElectives(root, data, esc).
import { emptyLine } from "./empty.js";
import { srcWrap } from "./src-ref.js";
import "./policy-css.js";
import { decorateGlossary } from "./glossary.js";

export const EL_GROUP = "선택과목 현황(현 2학년)";
const NO_DATA = "이 학교의 선택과목 인원 자료를 아직 정리하지 못했어요";
const ymd = (d) => (d ? d.replace(/-/g, ".") : "");
const by = (data) => new Map((data?.items ?? []).map((i) => [i.placeId, i]));

export function electiveRows(data, esc) {
  const m = by(data);
  const g = (t) => m.get(t.id);
  const none = { empty: true, why: NO_DATA };
  const whyOf = (e) => [e.classProxy?.held ? e.classProxy.nullReason : e.nullReason || NO_DATA, e.classProxy?.nextAction || e.nextAction].filter(Boolean).join(" → ");
  const px = (e) => (e?.classProxy?.rows?.length ? e.classProxy : null);
  const share = (area) => (t) => {
    const e = g(t), k = area === "사회" ? "socialShare" : "scienceShare";
    if (e?.summary) return { text: String(e.summary[k]), num: e.summary[k], status: e.status };
    const p = px(e); if (p) return { text: String(p.shares[area]), num: p.shares[area], html: `${p.shares[area]}<span class="muted sma el-est"> 학급 수 기준</span>`, status: "estimated" };
    return e ? { empty: true, why: whyOf(e) } : none;
  };
  return [
    { id: "el-soc", label: "탐구 사회 선택 비중", unit: "%", group: EL_GROUP, kind: "number", max: 100, get: share("사회") },
    { id: "el-sci", label: "탐구 과학 선택 비중", unit: "%", group: EL_GROUP, kind: "number", max: 100, get: share("과학") },
    { id: "el-tend", label: "성향", group: EL_GROUP, kind: "text", get: (t) => { const e = g(t); if (e?.summary) return { text: e.summary.tendency, html: `${esc(e.summary.tendency)}<span class="muted sma el-est"> 인원 기준 추정</span>` }; const p = px(e); if (p) return { text: p.tendency, html: `${esc(p.tendency)}<span class="muted sma el-est"> ${esc(p.basis)}</span>` }; return e ? { empty: true, why: whyOf(e) } : none; } },
    { id: "el-n", label: "현원", unit: "명", group: EL_GROUP, kind: "number", get: (t) => { const e = g(t); return e?.summary && e.headcount ? { text: e.headcount.toLocaleString("ko-KR"), num: e.headcount } : e && px(e) ? { empty: true, why: "선택 인원이 아니라 개설 학급 수로 본 값이라 현원은 없어요" } : none; } },
    { id: "el-d", label: "자료 기준일", group: EL_GROUP, kind: "text", get: (t) => { const e = g(t); const d = e?.summary ? e.asOf : px(e)?.asOf; return d ? { text: ymd(d) } : none; } },
  ];
}

const barList = (term, esc) => {
  const max = Math.max(1, ...term.subjects.map((s) => s.count));
  return `<ul class="el-list">${term.subjects.map((s) => `<li class="el-r"><span class="el-n">${esc(s.name)}<span class="muted sma"> ${esc(s.area)}</span></span><span class="el-b" aria-hidden="true"><i class="${s.area === "과학" ? "sci" : "soc"}" style="width:${Math.max(2, Math.round((s.count / max) * 100))}%"></i></span><span class="el-v">${s.count.toLocaleString("ko-KR")}명 · ${s.share}%</span></li>`).join("")}</ul>`;
};
function detail(e, esc, files) {
  const pics = (e.fileIds || []).map((id) => files.get(id)).filter(Boolean);
  const src = (e.sources || []).map((s) => (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>` : esc(s.name))).join(" · ");
  return `<div class="el-body"><p class="muted sma">${esc(e.grade || "현 2학년")} ${esc(e.area || "탐구")} 택${e.pick} · 현원 ${e.headcount}명${e.asOf ? ` · 기준 ${esc(ymd(e.asOf))}` : ""}${e.sourceKind ? ` · ${esc(e.sourceKind)}` : ""}</p>
    ${e.terms.map((t) => `<h4 class="el-h">${esc(t.label)} <span class="muted sma">사회 ${t.shares.사회}% · 과학 ${t.shares.과학}%</span></h4>${barList(t, esc)}`).join("")}
    <p class="el-note">학생이 ${e.pick}과목을 고르므로 문과·이과 학생 수가 아니라 선택 과목 비중이에요.</p>
    <p class="el-links">${pics.map((f, i) => `<a href="${esc(f.file)}" target="_blank" rel="noopener">원본 사진 보기${pics.length > 1 ? ` ${i + 1}` : ""}</a>`).join(" · ")}${pics.length && src ? " " : ""}${srcWrap(src)}</p></div>`;
}

function proxyDetail(e, esc) {
  const p = e.classProxy, max = Math.max(1, ...p.rows.map((x) => x.classes));
  const src = (e.sources || []).map((s) => (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>` : esc(s.name))).join(" · ");
  return `<div class="el-body"><p class="el-note"><b>학생 수가 아니에요.</b> 학교 평가계획에 적힌 탐구 과목별 개설 학급 수(${esc(p.term || "")})를 센 대리 지표예요. 실제 선택 인원과 다를 수 있어요.</p>
    <h4 class="el-h">${esc(p.term || "2학년")} <span class="muted sma">사회 ${p.totals.사회}학급(${p.shares.사회}%) · 과학 ${p.totals.과학}학급(${p.shares.과학}%) · ${esc(p.tendency)}(${esc(p.basis)})</span></h4>
    <ul class="el-list">${p.rows.map((s) => `<li class="el-r"><span class="el-n">${esc(s.name)}<span class="muted sma"> ${esc(s.area)}</span></span><span class="el-b" aria-hidden="true"><i class="${s.area === "과학" ? "sci" : "soc"}" style="width:${Math.max(2, Math.round((s.classes / max) * 100))}%"></i></span><span class="el-v">${s.classes}학급</span></li>`).join("")}</ul>
    ${p.note ? `<p class="muted sma">${esc(p.note)}</p>` : ""}<p class="el-links">${srcWrap(src)}</p></div>`;
}
const body = (e, esc, files) => (e.terms.length ? detail(e, esc, files) : proxyDetail(e, esc));

export function electivesPanel(data, esc, files = new Map()) {
  const have = (data?.items ?? []).filter((i) => i.terms.length || i.classProxy?.rows?.length).sort((a, b) => !!b.terms.length - !!a.terms.length);
  const g = data?.guide;
  const guide = g && ((g.basis || []).length || (g.questions || []).length) ? `<details class="dn el-guide"><summary>유불리 보는 법</summary>
    <p>${esc(g.intro || "학교마다 고르는 과목이 달라서, 어느 쪽이 유리한지는 이 표만으로는 판단하기 어려워요.")}</p>
    ${(g.basis || []).length ? `<h4 class="el-h">공식 근거</h4><ul>${g.basis.map((b) => `<li>${esc(b.text)}${b.source ? srcWrap(b.source.url ? `<a href="${esc(b.source.url)}" target="_blank" rel="noopener">${esc(b.source.name)} ↗</a>` : esc(b.source.name)) : ""}</li>`).join("")}</ul>` : ""}
    ${(g.questions || []).length ? `<h4 class="el-h">설명회에서 물어볼 질문</h4><ul>${g.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}</details>` : "";
  const none = (data?.items ?? []).filter((i) => !i.terms.length && !i.classProxy?.rows?.length);
  const noneHtml = none.length ? `<details class="dn el-none"><summary>자료 없는 학교 ${none.length}곳</summary><ul>${none.map((e) => emptyLine(esc, { why: `${e.name}: ${e.classProxy?.held ? e.classProxy.nullReason : e.nullReason || NO_DATA}` }).replace(/^<p class="muted gap">/, '<li class="muted gap">').replace(/<\/p>$/, e.nextAction ? ` <b>다음</b> ${esc(e.nextAction)}</li>` : "</li>")).join("")}</ul></details>` : "";
  if (!have.length) return `<section class="el-sec">${emptyLine(esc, { why: "학교별 선택과목 현황은 설명회·학교 안내 자료를 정리하는 대로 채워요", next: { label: "학교 상세에서 설명회 노트 보기", url: "#select/curriculum?v=hs" } })}${guide}</section>`;
  return `<section class="el-sec"><details class="dn el-d" id="el-detail"><summary>선택과목 현황 (현 2학년)</summary>
    ${have.length > 1 ? `<label class="el-pick">학교 <select data-el-pick aria-label="학교 고르기">${have.map((e) => `<option value="${esc(e.placeId)}">${esc(e.name)}${e.terms.length ? "" : " (학급 수 기준)"}</option>`).join("")}</select></label>` : ""}
    <div data-el-body>${body(have[0], esc, files)}</div>${noneHtml}</details>${guide}</section>`;
}

export function bindElectives(root, data, esc, files = new Map()) {
  const sel = root.querySelector("[data-el-pick]");
  if (!sel) return;
  const m = by(data);
  sel.addEventListener("change", () => { const e = m.get(sel.value); const b = root.querySelector("[data-el-body]"); if (e && b) { b.innerHTML = body(e, esc, files); try { decorateGlossary(b); } catch {} } });
}
