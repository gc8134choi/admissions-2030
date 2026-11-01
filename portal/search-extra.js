// 전체 검색에 더할 문서(서브 소유 데이터): 입학 준비 가이드(교복·준비물 등), 초6 연표, 고교 유형·달력·절차·서류, 용어사전, 학교 비교(급식·매점·기숙사), 설명회 노트.
//   import { loadSearchExtra } from "./search-extra.js";
//   const extra = await loadSearchExtra(load);                       // [{ href, t, s, text }]
//   extra.filter((d) => has(d.text)).slice(0, 10)                    // 검색어가 text에 있으면 결과로(href로 이동)
// 화면 위치가 정해져 있어 항목을 누르면 해당 화면으로 간다(접이식 안은 화면에서 열어 보게 된다).
const J = (a) => a.filter(Boolean).join(" ");
const ok = (p) => p.catch(() => null);

export async function loadSearchExtra(load) {
  const [guide, tl, ht, gl, hc, bf] = await Promise.all([ok(load("middle-guide")), ok(load("timeline")), ok(load("hs-types")), ok(load("glossary")), ok(load("hs-compare")), ok(load("briefings"))]);
  const out = [];
  for (const s of guide?.sections || []) for (const it of s.items) out.push({ href: "#select/curriculum?v=middle", t: s.title, s: it.text.slice(0, 80), text: J([s.title, it.text]) });
  for (const e of tl?.events || []) out.push({ href: "#select/curriculum?v=middle", t: `${e.stage} · 큰 그림 연표`, s: e.what.slice(0, 80), text: J([e.stage, e.what, e.note]) });
  for (const t of ht?.types || []) out.push({ href: "#select/curriculum?v=hs", t: `${t.name} (고교 유형)`, s: (t.selection?.value || "").slice(0, 80), text: J([t.name, t.selection?.value, t.timing?.value, t.admissionTraits?.value, ...(t.pros || []), ...(t.cons || [])]) });
  for (const c of ht?.calendar || []) out.push({ href: "#select/curriculum?v=hs", t: "경기 고입 달력", s: c.what.slice(0, 80), text: J([c.what, c.who]) });
  for (const p of ht?.procedure || []) out.push({ href: "#select/curriculum?v=hs", t: `원서 절차 · ${p.title}`, s: p.text.slice(0, 80), text: J([p.title, p.text]) });
  for (const d of ht?.documents || []) out.push({ href: "#select/curriculum?v=hs", t: `준비 서류 · ${d.item}`, s: (d.note || d.when || "").slice(0, 80), text: J([d.item, d.note]) });
  for (const g of gl?.terms || []) out.push({ href: "#select/curriculum?v=middle", t: `${g.term} (용어)`, s: g.short.slice(0, 80), text: J([g.term, ...(g.aliases || []), g.short]) });
  for (const f of ["canteen", "meal", "dorm"]) { const fd = hc?.fields?.find((x) => x.id === f); if (!fd) continue; for (const s of hc.schools) { const v = s.values[f]; if (v?.value) out.push({ href: "#select/curriculum?v=hs", t: `${s.name} · ${fd.label}`, s: String(v.value).slice(0, 80), text: J([s.name, fd.label, String(v.value)]) }); } }
  for (const b of bf?.briefings || []) for (const sec of b.sections) for (const it of sec.items) if (it.text.length > 8) out.push({ href: "#select/curriculum?v=hs", t: `설명회 노트 · ${sec.name}`, s: it.text.slice(0, 80), text: J([sec.name, it.topic, it.text]) });
  return out;
}
