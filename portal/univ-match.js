// 학교별 과목표 > "대학 요건 맞춰보기" 탭: 학교 × 대학·모집단위를 고르면 권장 과목을 이 학교 과목표(개설 후보)에서 몇 과목 고를 수 있는지 보여 준다.
// 데이터: matches.json(tools/build-matches.mjs), admission-rules.json, subject-master.json. 확정은 표시하지 않고 보도·추정만 조용히 표시한다.
import { stageTag } from "./stage.js";
import { reqKind, kindText, plainReason } from "./req-state.js";
import { emptyLine } from "./empty.js";
import { srcWrap } from "./src-ref.js";
// 머리글의 기준 학년도는 (선택한 대학의) 규칙 행의 실제 학년도에서 만든다(2027·2028 행이 섞여 있는데 한 해로 쓰지 않게)
export const refNote = (rules) => { const ys = [...new Set((rules.rules || []).map((r) => r.admissionYear).filter(Boolean))].sort(); return ys.length ? `${ys.join("·")}학년도 기준 참고 구조이며 2030학년도에는 달라질 수 있어요` : "요강은 참고 구조예요. 2030학년도에는 달라질 수 있어요."; };
const NOREQ = "이 학교의 과목표와 맞춰 볼 대학 요건이 아직 없어요 → 대학 입학처의 모집요강 공고(보통 6~7월)에서 확인해요";
import { cmpTable } from "./compare-table.js";
const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const STATE = { guaranteed: "학교 지정", reachable: "고를 수 있음", blocked: "택n 묶음 충돌", absent: "과목표에 없음" };
const TRACK = { "susi-gyogwa": "학생부교과", "susi-jonghap": "학생부종합", "susi-nonsul": "논술", "jeongsi-csat": "정시 수능", special: "특별전형" };

// 문장 경계에서 자른다(말줄임 없이 중간에서 끊기지 않게). 한도 안이면 그대로
const strLab = (q) => (q.strength === "required" ? "필수" : /권장/.test(q.orGroupLabel || q.label || "") ? "권장" : q.strength === "advised" ? "참고" : "권장"); // 요강 문구에 '권장'이 있으면 '참고'로 바꿔 쓰지 않는다
const cutSentence = (t, n) => { t = String(t || ""); if (t.length <= n) return t; const head = t.slice(0, n), k = Math.max(head.lastIndexOf("。"), head.lastIndexOf(". "), head.lastIndexOf("다 "), head.lastIndexOf("요 ")); return k > n * 0.4 ? head.slice(0, k + 1).trim() : t; /* 경계가 없으면 전체 */ };

export async function univBody(el, { load, esc, profile, schools, sel, pick }) {
  const [rules, matches, master, ul] = await Promise.all([load("admission-rules"), load("matches"), load("subject-master"), load("universities")]);
  const univs = ul.universities;
  const name = new Map(master.subjects.map((m) => [m.subjectId, m.name]));
  const picked = (profile.schoolIds || []).length ? schools.filter((s) => profile.schoolIds.includes(s.id)) : [];
  const mine = picked.length ? picked : schools;
  if (!mine.length) { el.innerHTML = `<div class="ed"><p class="muted">아직 맞춰볼 과목표가 없어요.</p></div>`; return; }
  const st = (el.__univ ||= { school: (sel.find((id) => mine.some((s) => s.id === id)) || mine[0].id), univ: (univs.find((u) => rules.rules.some((r) => r.universityId === u.id)) || univs[0]).id, rule: null });
  if (!mine.some((s) => s.id === st.school)) st.school = mine[0].id;
  { const uq = new URLSearchParams((location.hash.split("?")[1] || "")).get("u"); if (uq && el.__uq !== uq && univs.some((x) => x.id === uq)) { el.__uq = uq; st.univ = uq; st.rule = null; } } // 검색 결과 등에서 ?u=<대학id>로 오면 그 대학을 고른다
  const units = () => rules.rules.filter((r) => r.universityId === st.univ);

  const chips = (items, key, cur, cls = "") => items.map(([v, t]) => `<button type="button" class="chip ${v === cur ? "on" : ""}" data-k="${key}" data-v="${esc(v)}" aria-pressed="${v === cur}">${esc(t)}</button>`).join("");
  const top = () => `<div class="ed-top"><b>${esc(refNote({ rules: rules.rules.filter((r) => r.universityId === st.univ) }))}</b><details><summary>자세히</summary><p>과목표는 개설 후보예요. 학교가 매년 확정하는 개설 과목과 다를 수 있어요. 교과군 요건은 교과군 안의 과목으로 계산했어요.</p></details></div>
      <div class="chipbar uv-bar"><span class="flabel">대학</span><div class="chips uv-chips">${chips(univs.map((u) => [u.id, u.name]), "univ", st.univ)}</div></div>`;
  const draw = () => {
    if (!units().some((r) => r.ruleId === st.rule)) st.rule = (units().find((r) => r.requirements.length) || units()[0])?.ruleId ?? null;
    if (!st.rule) {
      const u = univs.find((x) => x.id === st.univ);
      el.innerHTML = `<div class="ed">${top()}<h2>${esc(u.name)}</h2>${emptyLine(esc, { why: "이 대학 모집요강은 아직 정리하지 못했어요. 공개되면 채워요.", next: u.admissionsUrl ? { label: "입학처에서 먼저 확인", url: u.admissionsUrl } : { label: "대학 이름으로 검색", url: `https://search.naver.com/search.naver?query=${encodeURIComponent(u.name + " 입학처 모집요강")}` } })}</div>`;
      return;
    }
    const rule = rules.rules.find((r) => r.ruleId === st.rule);
    const m = matches.matches.find((x) => x.schoolId === st.school && x.ruleId === st.rule);
    const sc = schools.find((s) => s.id === st.school);
    const stt = ES[rule.status] ? `<span class="es ${ES[rule.status][0]}">${ES[rule.status][1]}</span>` : "";
    const src = (rule.sources || []).map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(" · ");
    const nm = (id) => esc(name.get(id) || id);
    let body;
    // 대학 요건 맞춰보기: 공용 비교 표(대상=학교 열, 항목=요건 행). 학교 4곳이 같은 모집단위 요건을 얼마나 채우는지 견준다.
    const mOf = (schoolId) => matches.matches.find((x) => x.schoolId === schoolId && x.ruleId === st.rule);
    const anyM = mine.some((x) => mOf(x.id)?.summary);
    const reqTxt = (rule.requirements || []).length ? `<ul class="um-req">${rule.requirements.map((q) => `<li><b>${strLab(q)}</b> · ${esc(q.orGroupLabel || "")}</li>`).join("")}</ul><p class="muted small">요건 문구는 요강 그대로예요${src ? ` — ${src}` : ""}. 우리 학교 과목표와 맞춰 보는 것은 이 모집단위는 아직 안 돼요(과목 묶음을 만들지 못했어요).</p>` : "";
    if (!anyM && reqTxt) body = `<h3 class="um-h">과목 요건(요강 문구)</h3>${reqTxt}`;
    else if (!anyM) { const u = univs.find((x) => x.id === st.univ); body = emptyLine(esc, { why: kindText(rule), next: u?.admissionsUrl ? { label: "입학처에서 먼저 확인", url: u.admissionsUrl } : { label: "대학 이름으로 검색", url: `https://search.naver.com/search.naver?query=${encodeURIComponent((u?.name || "") + " 입학처 모집요강")}` } }) + (rule.requirementsNullReason ? `<details class="um-more"><summary>사유 자세히</summary><p class="muted small">${esc(plainReason(rule.requirementsNullReason))}</p></details>` : ""); }
    else body = `<div id="um-cmp"></div>`;
    const reqCount = (mOf(mine[0].id)?.requirements || []).length;
    st.cfg = anyM ? () => ({
      esc, stage: "대입", title: `${rule.universityName} ${rule.unitName}`, summary: "우리 학교 4곳의 과목표(개설 후보)로 권장 과목을 얼마나 고를 수 있는지 견줘요",
      targets: mine.map((x) => ({ id: x.id, name: x.name, sub: "", href: `#select/curriculum?s=${encodeURIComponent(x.id)}`, search: x.name })),
      rows: [
        { id: "reach", label: "고를 수 있는 과목", group: "요약", kind: "number", get: (t) => { const sm = mOf(t.id)?.summary; return sm ? { text: `${sm.reachable}/${sm.need}`, num: sm.reachable, html: `<b>${sm.reachable}</b> / ${sm.need}과목` } : { empty: true, why: NOREQ }; } },
        { id: "guar", label: "학교 지정", group: "요약", kind: "number", get: (t) => { const sm = mOf(t.id)?.summary; return sm ? { text: String(sm.guaranteed), num: sm.guaranteed } : { empty: true, why: NOREQ }; } },
        { id: "blk", label: "택n 묶음 충돌", group: "요약", kind: "number", get: (t) => { const sm = mOf(t.id)?.summary; return sm ? { text: String(sm.blocked), num: sm.blocked } : { empty: true, why: NOREQ }; } },
        { id: "abs", label: "과목표에 없음", group: "요약", kind: "number", get: (t) => { const sm = mOf(t.id)?.summary; return sm ? { text: String(sm.absent), num: sm.absent } : { empty: true, why: NOREQ }; } },
        ...Array.from({ length: reqCount }, (_, i) => { const r0 = mOf(mine[0].id).requirements[i]; return { id: `req${i}`, label: `${r0.label}${(() => { const rq = rule?.requirements || []; return rq.filter((x) => x.orGroupLabel === r0.label).length > 1 && rq[i]?.legacyKeys?.length ? ` · ${rq[i].legacyKeys.join("·")}` : ""; })()} (${strLab(r0)})`, group: "요건별 과목", kind: "text", get: (t) => {
          const r = mOf(t.id)?.requirements?.[i]; if (!r) return { empty: true, why: NOREQ };
          const list = [...r.guaranteed.map((g) => `${nm(g.subjectId)} <span class="muted small">${g.terms.join("·")} 지정</span>`), ...r.selectable.map((g) => `${nm(g.subjectId)} <span class="muted small">${g.terms.join("·")}${g.pick ? ` · 택${g.pick}` : ""}</span>`)];
          const shown = list.length > 6 ? `${list.slice(0, 6).join("<br>")}<br><span class="muted small">외 ${list.length - 6}과목</span>` : list.join("<br>");
          return { text: `${STATE[r.state]}|${[...r.guaranteed, ...r.selectable].map((g) => g.subjectId).join(",")}`, html: `<b>${STATE[r.state]}</b>${shown ? `<div>${shown}</div>` : ""}${r.blockedBy.length ? `<div class="muted small">${r.blockedBy.map((b) => `${b.term} 택${b.pick}(${b.size}과목 중): ${b.wanted.map(nm).join(", ")}`).join(" / ")}</div>` : ""}` };
        } }; }),
      ],
      select: { key: "portal.univ.schools", param: "us", def: mine.map((x) => x.id), defN: 4, max: 4, min: 2 },
      sources: (rule.sources || []).map((x) => ({ name: x.name, url: x.url })),
    }) : null;
    el.innerHTML = `<div class="ed">${top()}
      <div class="chipbar"><span class="flabel">모집단위</span><div class="chips">${chips(units().map((r) => [r.ruleId, `${r.unitName} · ${TRACK[r.track] || r.track}`]), "rule", st.rule)}</div></div>
      ${body}${anyM ? "" : `<h2>${stageTag("대입", esc)}${esc(rule.universityName)} ${esc(rule.unitName)} ${stt}</h2>`}
      <p class="ed-go"><a class="btn primary" href="#planner/plan?s=${esc(st.school)}">내 계획표에서 고르기</a></p></div>`;
    if (anyM) cmpTable(el.querySelector("#um-cmp"), st.cfg());
  };
  el.onclick = (e) => { const b = e.target.closest("button[data-k]"); if (!b) return; st[b.dataset.k] = b.dataset.v; if (b.dataset.k === "univ") st.rule = null; draw(); };
  draw();
}
