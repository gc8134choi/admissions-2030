// 과목 선택 플래너 > 내 계획표: 학교를 고르고 학기별(1-1~3-2) 택n 묶음에서 과목을 골라 학점 합계와 대학 권장과목 충족을 본다.
// 데이터: offerings(개설 후보)·groups·offerings-index·subject-master·summary·matches·admission-rules·universities. 계획은 이 브라우저(localStorage)에만 저장한다.
const TERMS = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];
const AREA7 = ["국어", "수학", "영어", "한국사", "사회", "과학", "기타"];
const area7 = (a) => (AREA7.includes(a) ? a : "기타");
const BASIC = ["국어", "수학", "영어"];
const KEY = (id) => `portal.plan.${id}`;
const LAST = "portal.plan.last";

export function registerPlanner(views, { esc, load, store }) {
  views.planner = async (el, query) => {
    const [schools, offerings, ix, master, summary, groups, ul, rules, matches, policy] = await Promise.all(
      ["schools", "offerings", "offerings-index", "subject-master", "summary", "groups", "universities", "admission-rules", "matches", "policy"].map((n) => load(n)));
    const pol = Array.isArray(policy) ? policy : policy.rows || policy;
    const cap = +((pol.find((r) => r.id === "cur-12")?.body || "").match(/(\d+)학점을 넘을 수/) || [])[1] || null;
    const univs = ul.universities;
    const name = new Map(master.subjects.map((m) => [m.subjectId, m.name]));

    const known = (id) => schools.some((s) => s.id === id);
    const st = { school: [query.get("s"), store.get(LAST, null), schools[0]?.id].find((x) => x && known(x)), areas: [], univ: null, picks: new Set(), msg: "" };
    const loadPlan = () => { const p = store.get(KEY(st.school), null); st.picks = new Set(p && Array.isArray(p.picks) ? p.picks : []); };
    const savePlan = () => { store.set(KEY(st.school), { v: 1, picks: [...st.picks], at: new Date().toISOString() }); store.set(LAST, st.school); };
    loadPlan();

    const draw = () => {
      const sch = schools.find((s) => s.id === st.school);
      const sum = summary.find((m) => m.schoolId === st.school);
      const offs = offerings.filter((o) => o.schoolId === st.school);
      const subj = (o) => ix.byOffering[o.id];
      const req = offs.filter((o) => o.slot === "required");
      const gmap = new Map();
      offs.filter((o) => o.slot === "elective" && o.groupId).forEach((o) => { if (!gmap.has(o.groupId)) gmap.set(o.groupId, []); gmap.get(o.groupId).push(o); });
      const gmeta = new Map(groups.filter((g) => g.schoolId === st.school).map((g) => [g.id, g]));
      // 이 학교 편제표에 없는 id(옛 저장값)는 걸러 낸다
      const valid = new Set(offs.map((o) => o.id));
      st.picks = new Set([...st.picks].filter((id) => valid.has(id)));
      const chosen = [...req, ...offs.filter((o) => st.picks.has(o.id))];
      const credit = (xs) => xs.reduce((a, o) => a + (o.credits || 0), 0);
      const subjectCr = credit(chosen), creative = sum?.creditsCreative ?? 18;
      const goalSubj = sum?.creditsSubject ?? 174, goalAll = sum?.creditsTotal ?? 192;
      const basicCr = credit(chosen.filter((o) => BASIC.includes(o.area)));
      const planned = new Set(chosen.map(subj).filter(Boolean));

      const chips = (items, key, cur, multi) => items.map(([v, t]) => `<button type="button" class="chip${multi ? (cur.includes(v) ? " on" : "") : (v === cur ? " on" : "")}" data-k="${key}" data-v="${esc(v)}" aria-pressed="${multi ? cur.includes(v) : v === cur}">${esc(t)}</button>`).join("");

      const termHtml = (t) => {
        const rs = req.filter((o) => o.term === t);
        const gs = [...gmap.entries()].filter(([, xs]) => xs[0].term === t).sort((a, b) => a[0].localeCompare(b[0]));
        const tc = credit(chosen.filter((o) => o.term === t));
        const body = gs.map(([gid, xs]) => {
          const pick = gmeta.get(gid)?.pick ?? xs[0].pick ?? 1;
          const n = xs.filter((o) => st.picks.has(o.id)).length;
          const full = n >= pick;
          const list = xs.filter((o) => st.picks.has(o.id) || !st.areas.length || st.areas.includes(area7(o.area)));
          return `<div class="pn-g"><p class="pn-gh"><b>${xs.length}개 중 ${pick}개 고르기</b> <span class="num ${full ? "done" : ""}">${n}/${pick}</span></p><ul class="pn-opts">${list.map((o) => {
            const on = st.picks.has(o.id), off = !on && full;
            return `<li><button type="button" class="pn-o${on ? " on" : ""}" data-pick="${esc(o.id)}" aria-pressed="${on}"${off ? ' aria-disabled="true"' : ""}><span class="pn-n">${esc(o.subject)}</span><span class="pn-m">${esc(area7(o.area))} · <span class="num">${o.credits}</span>학점</span></button></li>`;
          }).join("")}</ul></div>`;
        }).join("");
        return `<section class="pn-t" id="pn-${t}"><h3><span class="num">${t}</span> <small class="num">${tc}학점</small></h3>
          <p class="pn-req"><span class="pn-rl">지정</span> ${rs.map((o) => `${esc(o.subject)} <span class="num">${o.credits}</span>`).join(" · ") || "-"}</p>${body}</section>`;
      };

      // 대학 요건: 있는 데이터(match)만 한 줄씩
      const uMatches = st.univ ? matches.matches.filter((m) => m.schoolId === st.school && m.universityId === st.univ && m.requirements) : [];
      const uHtml = () => {
        if (!st.univ) return "";
        if (!uMatches.length) return `<p class="muted">아직 정리 중이에요.</p>`;
        return `<ul class="pn-um">${uMatches.map((m) => {
          const rule = rules.rules.find((r) => r.ruleId === m.ruleId);
          const rs = m.requirements.map((q) => {
            const ids = new Set([...(q.guaranteed || []), ...(q.selectable || [])].map((x) => x.subjectId || x));
            const have = [...planned].filter((id) => ids.has(id)).length;
            return { q, have, ok: have >= q.minCount };
          });
          const okN = rs.filter((x) => x.ok).length;
          return `<li><b>${esc(rule?.unitName || m.ruleId)}</b> <span class="num ${okN === rs.length ? "done" : ""}">${okN}/${rs.length} 충족</span>
            <small>${rs.map((x) => `${x.ok ? "✓" : "·"} ${esc(x.q.label)} (${x.have}/${x.q.minCount})`).join(" / ")}</small></li>`;
        }).join("")}</ul><p class="pn-ref">${esc(rules._meta?.referenceNote || "요강은 참고 구조예요. 2030학년도에는 달라질 수 있어요.")}</p>`;
      };

      el.innerHTML = `<div class="ed pn">
        <div class="phead"><h2>내 계획표</h2></div>
        <div class="chipbar"><span class="flabel">학교</span><div class="chips">${chips(schools.map((s) => [s.id, s.name]), "school", st.school)}</div></div>
        <div class="chipbar"><span class="flabel">영역</span><div class="chips">${chips(AREA7.map((a) => [a, a]), "area", st.areas, true)}</div></div>
        <div id="pn-terms">${TERMS.map(termHtml).join("")}</div>
        <section class="pn-u"><h3>대학 요건</h3><div class="chips">${chips(univs.map((u) => [u.id, u.name]), "univ", st.univ)}</div>${uHtml()}</section>
        <p class="pn-act"><button type="button" class="lnk" data-act="copy">계획 복사</button> <button type="button" class="lnk" data-act="reset">초기화</button> <span class="muted small" id="pn-msg" role="status">${esc(st.msg)}</span></p>
        <p class="hint">계획은 이 기기에만 저장돼요.</p>
      </div>
      <div class="pn-bar" role="status" aria-label="학점 합계"><span><b class="num">${subjectCr + creative}</b><small>/ ${goalAll}학점</small></span>
        <span><b class="num">${subjectCr}</b><small>/ 교과 ${goalSubj}</small></span>
        <span class="${cap && basicCr > cap ? "warn" : ""}"><b class="num">${basicCr}</b><small>${cap ? `/ 국·수·영 ${cap} 이하` : "국·수·영"}</small></span></div>`;
    };

    const flash = (m) => { st.msg = m; const e = el.querySelector("#pn-msg"); if (e) e.textContent = m; };
    el.onclick = async (e) => {
      const b = e.target.closest("[data-k],[data-pick],[data-act]"); if (!b) return;
      if (b.dataset.pick) {
        if (b.getAttribute("aria-disabled") === "true") return flash("이 묶음은 다 골랐어요. 하나를 빼야 바꿀 수 있어요.");
        const id = b.dataset.pick; st.picks.has(id) ? st.picks.delete(id) : st.picks.add(id); st.msg = ""; savePlan(); const y = scrollY; draw(); scrollTo(0, y); return;
      }
      if (b.dataset.act === "copy") {
        const offs = offerings.filter((o) => st.picks.has(o.id));
        const txt = JSON.stringify({ school: st.school, picks: offs.map((o) => ({ term: o.term, subject: o.subject })) }, null, 1);
        try { await navigator.clipboard.writeText(txt); flash("복사했어요."); } catch { const ta = Object.assign(document.createElement("textarea"), { value: txt }); document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); flash("복사했어요."); } catch { flash("복사하지 못했어요."); } ta.remove(); }
        return;
      }
      if (b.dataset.act === "reset") { if (st.picks.size && !confirm("이 학교의 선택을 모두 지울까요?")) return; st.picks = new Set(); st.msg = "지웠어요."; savePlan(); draw(); return; }
      const { k, v } = b.dataset;
      if (k === "school") { st.school = v; st.msg = ""; loadPlan(); store.set(LAST, v); }
      else if (k === "area") st.areas = st.areas.includes(v) ? st.areas.filter((x) => x !== v) : [...st.areas, v];
      else if (k === "univ") st.univ = st.univ === v ? null : v;
      draw();
    };
    draw();
  };
}
