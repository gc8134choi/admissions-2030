// 전체 검색에 더할 문서(서브 소유 데이터): 입학 준비 가이드(교복·준비물 등), 초6 연표, 고교 유형·달력·절차·서류, 용어사전, 학교 비교(급식·매점·기숙사), 설명회 노트.
//   import { loadSearchExtra } from "./search-extra.js";
//   const extra = await loadSearchExtra(load);                       // [{ href, t, s, text }]
//   extra.filter((d) => has(d.text)).slice(0, 10)                    // 검색어가 text에 있으면 결과로(href로 이동)
// 화면 위치가 정해져 있어 항목을 누르면 해당 화면으로 간다(접이식 안은 화면에서 열어 보게 된다).
const J = (a) => a.filter(Boolean).join(" ");
const ok = (p) => p.catch(() => null);

export async function loadSearchExtra(load) {
  const [guide, tl, ht, gl, hc, bf, mc, el, ex, rl] = await Promise.all([ok(load("middle-guide")), ok(load("timeline")), ok(load("hs-types")), ok(load("glossary")), ok(load("hs-compare")), ok(load("briefings")), ok(load("middle-compare")), ok(load("electives")), ok(load("exam-trends")), ok(load("rules"))]);
  const out = [];
  for (const s of guide?.sections || []) for (const it of s.items) out.push({ href: "#select/curriculum?v=middle", t: s.title, s: it.text.slice(0, 80), text: J([s.title, it.text]) });
  for (const e of tl?.events || []) out.push({ href: "#select/curriculum?v=middle", t: `${e.stage} · 큰 그림 연표`, s: e.what.slice(0, 80), text: J([e.stage, e.what, e.note]) });
  for (const t of ht?.types || []) out.push({ href: "#select/curriculum?v=hs", t: `${t.name} (고교 유형)`, s: (t.selection?.value || "").slice(0, 80), text: J([t.name, t.selection?.value, t.timing?.value, t.admissionTraits?.value, ...(t.pros || []), ...(t.cons || [])]) });
  for (const c of ht?.calendar || []) out.push({ href: "#select/curriculum?v=hs", t: "경기 고입 달력", s: c.what.slice(0, 80), text: J([c.what, c.who]) });
  for (const p of ht?.procedure || []) out.push({ href: "#select/curriculum?v=hs", t: `원서 절차 · ${p.title}`, s: p.text.slice(0, 80), text: J([p.title, p.text]) });
  for (const d of ht?.documents || []) out.push({ href: "#select/curriculum?v=hs", t: `준비 서류 · ${d.item}`, s: (d.note || d.when || "").slice(0, 80), text: J([d.item, d.note]) });
  for (const g of gl?.terms || []) out.push({ href: "#select/curriculum?v=middle", t: `${g.term} (용어)`, s: g.short.slice(0, 80), text: J([g.term, ...(g.aliases || []), g.short]) });
  // 학교 비교 값 전부(학생수·학급수·교원수·급식·매점·기숙사·진학·입학 방식 …): 링크는 빼고 "학교 · 항목" 이름으로 찾는다
  for (const [data, view] of [[hc, "#select/curriculum?v=hs"], [mc, "#select/curriculum?v=middle"]]) for (const fd of data?.fields || []) { if (fd.type === "link" || fd.id === "briefing") continue; for (const s of data.schools) { const v = s.values[fd.id]; if (v?.value != null && v.value !== "") { const val = fd.type === "number" ? `${Number(v.value).toLocaleString("ko-KR")}${fd.unit || ""}` : String(v.value); out.push({ href: fd.group ? `${view}&g=${encodeURIComponent(fd.group)}` : view, t: `${s.name} · ${fd.label}`, s: val.slice(0, 80), text: J([s.name, fd.label, val]) }); } } }
  for (const b of bf?.briefings || []) for (const sec of b.sections) for (const it of sec.items) if (it.text.length > 8) out.push({ href: "#select/curriculum?v=hs", t: `설명회 노트 · ${sec.name}`, s: it.text.slice(0, 80), text: J([sec.name, it.topic, it.text]) });
  for (const e of el?.items || []) if (e.summary) out.push({ href: "#select/curriculum?v=hs&g=%EC%84%A0%ED%83%9D%EA%B3%BC%EB%AA%A9", t: `${e.name} · 선택과목 현황`, s: `탐구 ${e.summary.tendency}(과학 ${e.summary.scienceShare}%, 사회 ${e.summary.socialShare}%)`, text: J([e.name, "선택과목 탐구 사회 과학 문과 이과 성향 선택 인원 수강 인원 인원수", e.summary.tendency, ...e.terms.flatMap((x) => x.subjects.map((s) => s.name))]) });
  for (const e of ex?.items || []) if ((e.plans || []).length) out.push({ href: "#select/curriculum?v=hs&g=%EB%82%B4%EC%8B%A0%20%EC%B6%9C%EC%A0%9C", t: `${e.name} · 내신 평가계획`, s: "교과별 지필·수행 반영 비율", text: J([e.name, "내신 시험 평가계획 지필 수행평가 반영 비율 서술형 출제", ...e.plans.flatMap((p) => p.rows.map((r) => r.subject))]) });
  // 이 포털에 학교별 값이 아직 없는 생활 정보: 검색하면 "없음 + 어디서 확인"으로 안내한다
  out.push({ href: "#select/curriculum?v=hs&g=%EC%83%9D%ED%99%9C", t: "기숙사 · 학교 비교(생활)", s: "학교알리미 공시 항목에 없어요 → 학교 설명회·학교 홈페이지에서 확인", text: "기숙사 기숙사 있는 학교 운영 여부 생활 공시 항목에 없음 설명회 학교 홈페이지" });
  out.push({ href: "#select/curriculum?v=middle", t: "교복 · 체육복", s: "학교별 값은 배정 뒤 학교 공지에서만 확인돼요 → 학교 홈페이지 공지·입학 안내", text: "교복 체육복 하복 동복 구입 방식 가격 학교주관구매 학교 공지" });
  out.push({ href: "#schedule?t=life", t: "방학 · 학사 일정", s: "학교별 방학 날짜는 아직 없어요 → 학교 홈페이지 학사일정·가정통신문에서 확인", text: "방학 일정 겨울방학 여름방학 학사일정 개학 종업식 학교 공지" });
  out.push({ href: "#select/curriculum?v=middle", t: "통학(거리·시간)", s: "집 주소에 따라 달라서 학교별 값은 없어요 → 학교 지도에서 위치를 보고 지도 앱으로 확인", text: "통학 통학 거리 통학 시간 등교 학교 지도 집에서 학교까지" });
  out.push({ href: "#select/curriculum?v=hs&g=%EC%A7%84%ED%95%99", t: "대학 진학 현황 · 학교 비교", s: "학교알리미 공시 목록에 없어요 → 학교 설명회·학교 홈페이지 자료에서 확인", text: "대학 진학 대학 진학 현황 진학 실적 합격 실적 졸업생 진학 서울대 학교 설명회" });
  out.push({ href: "#schedule?t=life", t: "학교 설명회 일정", s: "학교별 설명회 날짜는 공고가 나오면 일정에 올라와요 → 배정 학교 홈페이지 공지에서 확인", text: "설명회 일정 입학설명회 학교 설명회 신입생 설명회 예비소집 날짜 공고" });
  out.push({ href: "#select/curriculum?v=middle", t: "중학교 급식 안내", s: "학교별 공시·게시 자료라 학교알리미 급식 현황이나 학교 홈페이지 급식 게시판에서 확인해요", text: "급식 중학교 급식 급식 방식 급식 현황 학교 홈페이지 급식 게시판 학교알리미" });
  for (const r of rl?.csatRegimes || []) if ((r.areas || []).some((a) => a.minutes)) out.push({ href: "#admission/system", t: `${r.label} · 영역별 시험 시간·문항 수`, s: r.areas.filter((a) => a.minutes).map((a) => `${a.area} ${a.minutes}분`).join(" · "), text: J(["수능 시간 시험시간 시험 시간 영역별 문항 수", r.label, ...r.areas.map((a) => `${a.area} ${a.items ?? ""}문항 ${a.minutes ?? ""}분`)]) });
  return out;
}
