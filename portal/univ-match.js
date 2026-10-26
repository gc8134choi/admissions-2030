// 학교별 과목표 > "대학 요건 맞춰보기" 탭: 학교 × 대학·모집단위를 고르면 권장 과목을 이 학교 편제표(개설 후보)에서 몇 과목 고를 수 있는지 보여 준다.
// 데이터: matches.json(tools/build-matches.mjs), admission-rules.json, subject-master.json. 확정은 표시하지 않고 보도·추정만 조용히 표시한다.
const ES = { reported: ["rep", "보도"], estimated: ["est", "추정"] };
const STATE = { guaranteed: "학교 지정", reachable: "고를 수 있음", blocked: "택n 묶음 충돌", absent: "편제표에 없음" };
const TRACK = { "susi-gyogwa": "학생부교과", "susi-jonghap": "학생부종합", "susi-nonsul": "논술", "jeongsi-csat": "정시 수능", special: "특별전형" };

export async function univBody(el, { load, esc, profile, schools, sel, pick }) {
  const [rules, matches, master, ul] = await Promise.all([load("admission-rules"), load("matches"), load("subject-master"), load("universities")]);
  const univs = ul.universities;
  const name = new Map(master.subjects.map((m) => [m.subjectId, m.name]));
  const picked = (profile.schoolIds || []).length ? schools.filter((s) => profile.schoolIds.includes(s.id)) : [];
  const mine = picked.length ? picked : schools;
  if (!mine.length) { el.innerHTML = `<div class="ed"><p class="muted">아직 맞춰볼 편제표가 없어요.</p></div>`; return; }
  const st = (el.__univ ||= { school: (sel.find((id) => mine.some((s) => s.id === id)) || mine[0].id), univ: (univs.find((u) => rules.rules.some((r) => r.universityId === u.id)) || univs[0]).id, rule: null });
  if (!mine.some((s) => s.id === st.school)) st.school = mine[0].id;
  const units = () => rules.rules.filter((r) => r.universityId === st.univ);

  const chips = (items, key, cur, cls = "") => items.map(([v, t]) => `<button type="button" class="chip ${v === cur ? "on" : ""}" data-k="${key}" data-v="${esc(v)}" aria-pressed="${v === cur}">${esc(t)}</button>`).join("");
  const top = () => `<div class="ed-top"><b>${esc(rules._meta.referenceNote)}</b><details><summary>자세히</summary><p>편제표는 개설 후보예요. 학교가 매년 확정하는 개설 과목과 다를 수 있어요. 교과군 요건은 교과군 안의 과목으로 계산했어요.</p></details></div>
      <div class="chipbar"><span class="flabel">학교</span><div class="chips">${chips(mine.map((s) => [s.id, s.name]), "school", st.school)}</div></div>
      <div class="chipbar uv-bar"><span class="flabel">대학</span><div class="chips uv-chips">${chips(univs.map((u) => [u.id, u.name]), "univ", st.univ)}</div></div>`;
  const draw = () => {
    if (!units().some((r) => r.ruleId === st.rule)) st.rule = (units().find((r) => r.requirements.length) || units()[0])?.ruleId ?? null;
    if (!st.rule) {
      const u = univs.find((x) => x.id === st.univ);
      el.innerHTML = `<div class="ed">${top()}<h2>${esc(u.name)}</h2><p class="muted">아직 정리 중이에요.</p>${u.admissionsUrl ? `<p class="ed-src">입학처: <a href="${esc(u.admissionsUrl)}" target="_blank" rel="noopener">${esc(u.admissionsUrl.replace(/^https:\/\//, "").replace(/\/$/, ""))}</a></p>` : ""}</div>`;
      return;
    }
    const rule = rules.rules.find((r) => r.ruleId === st.rule);
    const m = matches.matches.find((x) => x.schoolId === st.school && x.ruleId === st.rule);
    const sc = schools.find((s) => s.id === st.school);
    const stt = ES[rule.status] ? `<span class="es ${ES[rule.status][0]}">${ES[rule.status][1]}</span>` : "";
    const src = (rule.sources || []).map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(" · ");
    const nm = (id) => esc(name.get(id) || id);
    let body;
    if (!m || !m.summary) body = `<p class="muted">이 모집단위는 과목 요건 정보가 아직 없어요.</p><p class="ed-src">${esc(m?.nullReason || "")}</p>`;
    else {
      const s = m.summary;
      const parts = [`권장 ${s.need}과목 중 <b>${s.reachable}과목</b>을 개설 후보에서 고를 수 있어요`];
      if (s.guaranteed) parts.push(`${s.guaranteed}과목은 학교 지정이에요`);
      if (s.blocked) parts.push(`${s.blocked}과목은 같은 택n 묶음이라 함께 고르기 어려워요`);
      if (s.absent) parts.push(`${s.absent}과목은 이 학교 편제표에 없어요`);
      const rows = m.requirements.map((r) => {
        const list = [...r.guaranteed.map((g) => `${nm(g.subjectId)} <span class="muted small">${g.terms.join("·")} 지정</span>`),
          ...r.selectable.map((g) => `${nm(g.subjectId)} <span class="muted small">${g.terms.join("·")}${g.pick ? ` · 택${g.pick}` : ""}</span>`)];
        const shown = list.length > 6 ? list.slice(0, 6).join("<br>") + `<br><span class="muted small">외 ${list.length - 6}과목</span>` : list.join("<br>");
        const conflict = r.blockedBy.length ? `<div class="muted small">${r.blockedBy.map((b) => `${b.term} 택${b.pick}(${b.size}과목 중): ${b.wanted.map(nm).join(", ")}`).join(" / ")}</div>` : "";
        return `<tr><td>${esc(r.label)}<div class="muted small">${r.strength === "required" ? "필수" : r.strength === "advised" ? "참고" : "권장"} ${r.minCount}과목${r.note ? ` · ${esc(r.note)}` : ""}</div></td><td>${STATE[r.state]}</td><td>${shown || '<span class="muted">없음</span>'}${conflict}</td></tr>`;
      }).join("");
      body = `<p class="ed-b"><b>${esc(sc.name)}</b>: ${parts.join(", ")}.</p><table class="ed-tbl"><thead><tr><th>요건</th><th>상태</th><th>이 학교 편제표</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    el.innerHTML = `<div class="ed">${top()}
      <div class="chipbar"><span class="flabel">모집단위</span><div class="chips">${chips(units().map((r) => [r.ruleId, `${r.unitName} · ${TRACK[r.track] || r.track}`]), "rule", st.rule)}</div></div>
      <h2>${esc(rule.universityName)} ${esc(rule.unitName)} ${stt}</h2>${body}
      <p class="ed-src">출처: ${src || "표기 없음"}</p></div>`;
  };
  el.onclick = (e) => { const b = e.target.closest("button[data-k]"); if (!b) return; st[b.dataset.k] = b.dataset.v; if (b.dataset.k === "univ") st.rule = null; draw(); };
  draw();
}
