// 전체 검색에 더할 문서(서브 소유 데이터): 입학 준비 가이드(교복·준비물 등), 초6 연표, 고교 유형·달력·절차·서류, 용어사전, 학교 비교(급식·매점·기숙사), 설명회 노트.
//   import { loadSearchExtra } from "./search-extra.js";
//   const extra = await loadSearchExtra(load);                       // [{ href, t, s, text }]
//   extra.filter((d) => has(d.text)).slice(0, 10)                    // 검색어가 text에 있으면 결과로(href로 이동)
// 화면 위치가 정해져 있어 항목을 누르면 해당 화면으로 간다(접이식 안은 화면에서 열어 보게 된다).
const J = (a) => a.filter(Boolean).join(" ");
const ok = (p) => p.catch(() => null);


// "이 포털에 아직 없어요" 류 안내는 하드코딩하지 않는다: 해당 데이터가 있으면 그 데이터로 연결하고(found), 없을 때만 "없음 + 어디서 확인"(none)을 낸다.
// tools/check-search-notices.mjs가 같은 규칙을 데이터로 점검한다(안내가 가리키는 주제의 데이터가 실제로 없는지).
const cnt = (d, k) => (d?.schools || []).filter((s) => s.values?.[k] && s.values[k].value != null && s.values[k].value !== "").length;
const row = (D, id) => (D.pol || []).find((r) => r.id === id);
const firstSent = (s, n = 80) => String(s || "").replace(/\s+/g, " ").slice(0, n);
export const GAPS = [
  { id: "transfer", words: "전학 이사 배정 전입 배정 전입 이사 가는 지역 교육지원청 문의 고입 전학 포털", found: (D) => row(D, "gg-18") && { href: "#select/curriculum?v=hs&ty=1", t: "전학 · 이사(전입) 배정 · 경기 평준화 고교", s: firstSent(row(D, "gg-18").body) }, none: { href: "#library/links", t: "전학 · 이사 배정(전입 배정)", s: "전학·이사 때의 배정 안내는 이 포털에 아직 없어요 → 이사 갈 지역 교육지원청에 문의하고 경기도 고입·전학 포털에서 확인해요" } },
  { id: "failover", words: "외고 불합격 국제고 자사고 불합격 일반고 배정 절차 동시 지원 후기", found: (D) => row(D, "gg-17") && { href: "#select/curriculum?v=hs&ty=1", t: "외·국·자 불합격 시 일반고 배정 절차", s: firstSent(row(D, "gg-17").body) } },
  { id: "uniform", words: "교복 체육복 하복 동복 구입 가격 낙찰가 학교주관구매", found: (D) => cnt(D.mc, "uniform") > 0 && { href: "#select/curriculum?v=middle&g=%EC%83%9D%ED%99%9C", t: "교복 낙찰가 · 중학교 비교", s: `중학교 ${cnt(D.mc, "uniform")}곳의 교복 유형·구입 지원금·낙찰가를 비교해요. 체육복·최종 안내는 배정 뒤 학교 공지에서 확인해요` }, none: { href: "#select/curriculum?v=middle", t: "교복 · 체육복", s: "학교별 값은 배정 뒤 학교 공지에서만 확인돼요 → 학교 홈페이지 공지·입학 안내" } },
  { id: "meal-mid", words: "급식 중학교 급식 급식 방식 급식 현황", found: (D) => cnt(D.mc, "meal") > 0 && { href: "#select/curriculum?v=middle&g=%EC%83%9D%ED%99%9C", t: "중학교 급식 · 비교", s: `중학교 ${cnt(D.mc, "meal")}곳의 급식 방식을 비교해요` }, none: { href: "#select/curriculum?v=middle", t: "중학교 급식 안내", s: "학교별 공시·게시 자료라 학교알리미 급식 현황이나 학교 홈페이지 급식 게시판에서 확인해요" } },
  { id: "commute", words: "통학 통학 거리 통학 시간 등교 집에서 학교까지", found: (D) => cnt(D.mc, "commute") > 0 && { href: "#select/curriculum?v=middle&g=%EC%83%9D%ED%99%9C", t: "통학 · 중학교 비교", s: `중학교 ${cnt(D.mc, "commute")}곳의 통학 정보를 비교해요` }, none: { href: "#select/curriculum?v=middle", t: "통학(거리·시간)", s: "집 주소에 따라 달라서 학교별 값은 없어요 → 학교 지도에서 위치를 보고 지도 앱으로 확인" } },
  { id: "dorm", words: "기숙사 기숙사 있는 학교 운영 여부", found: (D) => cnt(D.hc, "dorm") > 0 && { href: "#select/curriculum?v=hs&g=%EC%83%9D%ED%99%9C", t: "기숙사 · 학교 비교(생활)", s: `고교 ${cnt(D.hc, "dorm")}곳의 기숙사 정보를 비교해요` }, none: { href: "#select/curriculum?v=hs&g=%EC%83%9D%ED%99%9C", t: "기숙사 · 학교 비교(생활)", s: "학교알리미 공시 항목에 없어요 → 학교 설명회·학교 홈페이지에서 확인" } },
  { id: "univ-result", words: "대학 진학 대학 진학 현황 진학 실적 합격 실적 졸업생 진학", found: (D) => cnt(D.hc, "univStats") > 0 && { href: "#select/curriculum?v=hs&g=%EC%A7%84%ED%95%99", t: "대학 진학 현황 · 학교 비교", s: `고교 ${cnt(D.hc, "univStats")}곳의 진학 현황을 비교해요` }, none: { href: "#select/curriculum?v=hs&g=%EC%A7%84%ED%95%99", t: "대학 진학 현황 · 학교 비교", s: "학교알리미 공시 목록에 없어요 → 학교 설명회·학교 홈페이지 자료에서 확인" } },
  { id: "vacation", words: "방학 일정 겨울방학 여름방학 학사일정 개학 종업식", found: (D) => (D.pol || []).find((r) => /방학/.test(r.title + (r.body || ""))) && { href: "#schedule?t=life", t: "방학 · 학사 일정", s: firstSent((D.pol || []).find((r) => /방학/.test(r.title + (r.body || ""))).title) }, none: { href: "#schedule?t=life", t: "방학 · 학사 일정", s: "학교별 방학 날짜는 아직 없어요 → 학교 홈페이지 학사일정·가정통신문에서 확인" } },
  { id: "briefing-sched", words: "설명회 일정 입학설명회 학교 설명회 배정 설명회 신입생 설명회 예비소집 날짜 공고", found: (D) => row(D, "gg-08") && { href: "#schedule?t=hs", t: "고교 평준화 배정 설명회 일정", s: firstSent(row(D, "gg-08").body) + " · 학교별 설명회는 각 학교 홈페이지 공고에서 확인해요" }, none: { href: "#schedule?t=life", t: "학교 설명회 일정", s: "학교별 설명회 날짜는 공고가 나오면 일정에 올라와요 → 배정 학교 홈페이지 공지에서 확인" } },
  { id: "early-grad", words: "조기졸업 조기 졸업 학점 초과 이수 졸업 앞당기기", found: (D) => (D.pol || []).find((r) => /조기 ?졸업/.test(r.title + (r.body || ""))) && { href: "#life/credit", t: "조기졸업", s: firstSent((D.pol || []).find((r) => /조기 ?졸업/.test(r.title + (r.body || ""))).title) }, none: { href: "#life/credit", t: "조기졸업", s: "조기졸업 안내는 이 포털에 아직 없어요 → 학교 교육과정 안내와 경기도교육청 공지에서 확인해요" } },
  { id: "parent-consult", words: "학부모 상담 상담 주간 학부모 면담 담임 상담 학부모 총회", found: (D) => (D.pol || []).find((r) => /학부모 (상담|총회)|상담 주간/.test(r.title + (r.body || ""))) && { href: "#schedule?t=life", t: "학부모 상담", s: firstSent((D.pol || []).find((r) => /학부모 (상담|총회)|상담 주간/.test(r.title + (r.body || ""))).title) }, none: { href: "#schedule?t=life", t: "학부모 상담 · 총회", s: "학교별 상담 주간·총회 날짜는 아직 없어요 → 학교 홈페이지 공지·가정통신문에서 확인해요" } },
  // 아래 항목은 q(공백 뺀 검색어에 맞는 정규식)가 맞으면 다른 결과보다 앞에 "바로 안내"로 나온다. only면 엉뚱한 행을 섞지 않고 안내만 보인다.
  { id: "mid-move", q: "^(?!.*(고교|고등|평준화|외고|자사고)).*(이사|전입)", words: "중학교 이사 이사 전입 중학교 배정 후 변경 재배정 졸업 초등학교 주소지", found: (D) => (D.mid || []).find((r) => r.id === "mp-06") && { href: "#select/curriculum?v=middle", t: "중학교 이사·전입과 배정 후 변경", s: firstSent((D.mid || []).find((r) => r.id === "mp-06").body, 110) } },
  { id: "hs-assign-docs", q: "^(?!.*중학교).*배정.*(서류|준비물)", words: "배정원서 서류 배정 원서 제출 서류 배정 제출 서류 고교 배정 서류 준비물", found: (D) => row(D, "gg-19") && { href: "#select/curriculum?v=hs&ty=1", t: "경기 평준화 고교 배정 제출 서류", s: firstSent(row(D, "gg-19").body, 100) } },
  { id: "mid-assign-docs", q: "중학교.*배정.*(서류|준비물)", words: "중학교 배정원서 제출 서류 중학교 배정 서류 초등학교 배정원서 서류", found: (D) => (D.mid || []).find((r) => /제출 ?서류/.test(r.title)) && { href: "#select/curriculum?v=middle", t: "중학교 배정원서 제출 서류", s: "" }, none: { href: "#select/curriculum?v=middle", t: "중학교 배정원서 제출 서류", s: "이 포털에 아직 없어요(교육지원청 안내 본문에 서류 목록이 적혀 있지 않았어요) → 배정원서 작성은 출신 초등학교(2026.11.2~11.6), 서류는 용인교육지원청 031-8020-9113~4로 확인해요" } },
  { id: "sa-score", q: "(자사고|외고|국제고|외국어고).*(면접|점수|배점)", words: "자사고 면접 점수 외고 국제고 면접 배점 외국어고 자기주도학습전형 배점 용인외대부고", found: (D) => row(D, "gg-21") && { href: "#select/curriculum?v=hs&ty=1", t: "외고·국제고·자사고 전형 배점(용인외대부고 예시)", s: firstSent(row(D, "gg-21").body, 100) } },
  { id: "retake", only: true, q: "재수|n수|삼수|반수", words: "재수 n수 재수생 반수 삼수 재도전", found: () => false, none: { href: "#library/links", t: "재수·N수", s: "이 포털에 아직 없어요(현재는 고입·고교학점제·대입 제도까지 다뤄요) → 대입 제도는 대교협 대입정보포털 어디가·평가원 수능 안내에서 확인해요" } },
  { id: "hs-list", only: true, q: "(수지구?|용인|우리동네|근처).*(고교|고등학교|고등).*(목록|리스트|명단|어디|몇)|(고교|고등학교).*(목록|리스트|명단)", words: "수지구 고교 목록 고등학교 목록 고교 명단 수지구 고등학교 용인 고교 리스트", found: (D) => (D.hc?.schools || []).length > 0 && { href: "#select/curriculum?v=hs", t: "고교 기본 정보 표", s: `고교 ${(D.hc.schools || []).length}곳의 규모·입학 방식·교육과정·진학을 한 표로 보여요(학교 31곳 기본 정보 표)` }, none: { href: "#library/links", t: "고교 목록", s: "이 포털에 아직 없어요 → 경기도교육청 학교 정보·학교알리미에서 지역별 학교 목록을 확인해요" } },
];
export function gapDocs(D) {
  return GAPS.map((g) => { const f = g.found(D); const d = f || g.none; return d ? { gap: g.id, found: !!f, href: d.href, t: d.t, s: d.s, q: g.q, only: !!g.only, text: J([g.words, d.t, d.s]) } : null; }).filter(Boolean);
}

export async function loadSearchExtra(load) {
  const [guide, tl, ht, gl, hc, bf, mc, el, ex, rl, pol, evs, un, ar, mid] = await Promise.all([ok(load("middle-guide")), ok(load("timeline")), ok(load("hs-types")), ok(load("glossary")), ok(load("hs-compare")), ok(load("briefings")), ok(load("middle-compare")), ok(load("electives")), ok(load("exam-trends")), ok(load("rules")), ok(load("policy")), ok(load("events")), ok(load("universities")), ok(load("admission-rules")), ok(load("middle"))]);
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
  for (const r of rl?.csatRegimes || []) if ((r.areas || []).some((a) => a.minutes)) out.push({ href: "#admission/system", t: `${r.label} · 영역별 시험 시간·문항 수`, s: r.areas.filter((a) => a.minutes).map((a) => `${a.area} ${a.minutes}분`).join(" · "), text: J(["수능 시간 시험시간 시험 시간 영역별 문항 수", r.label, ...r.areas.map((a) => `${a.area} ${a.items ?? ""}문항 ${a.minutes ?? ""}분`)]) });
  for (const ty of ht?.types || []) if (ty.cost?.value) out.push({ href: "#select/curriculum?v=hs", t: `${ty.name} · 학비·비용`, s: String(ty.cost.value).slice(0, 80), text: J(["학비 등록금 수업료 비용 무상교육 급식비 기숙사비", ty.name, ty.cost.value]) });
  out.push({ href: "#life/credit", t: "한국사 · 필수 과목", s: "한국사는 공통과목으로 필수예요(졸업 필수 학점 중 6학점)", text: "한국사 필수 필수 과목 한국사 6학점 졸업 필수 학점 공통과목" });
  out.push({ href: "#select/curriculum?v=univ", t: "대학별 과목 요건(서울대 수학 등)", s: "대학·전형별 필수·권장 과목은 대학 요건 화면에서 학교별 편제표와 맞춰 볼 수 있어요", text: "서울대 수학 권장과목 필수과목 대학 요건 과목 선택 모집단위 미적분 기하 확률과 통계" });
  out.push({ href: "#select/curriculum?v=middle", t: "자유학기(시험 없는 학기)", s: "자유학기·자유학년 시행 학기의 성적은 고입 내신에 반영하지 않아요(경기도교육청 2027학년도 고입 내신성적 반영지침 기준). 시행 방식은 학교 안내에서 확인해요", text: "자유학기 자유학년 시험 없는 학기 중1 고입 내신 반영 안 함" });
  // 경기 후기 평준화 일반고 배정 발표(정책 행 gg-04에서 날짜를 읽는다)
  const gg04 = (pol || []).find((r) => r.id === "gg-04"), m04 = gg04 && String(gg04.body).match(/배정 대상자 발표[^,]*,\s*배정 학교 발표[^,]*/);
  if (m04) out.push({ href: "#schedule?t=hs", t: "경기 후기 배정 학교 발표 · 합격자 발표", s: m04[0].slice(0, 80), text: J(["후기 합격자 발표 후기 배정 발표 배정 학교 발표 배정 대상자 발표 경기 후기 평준화 일반고 합격 발표", m04[0]]) });
  out.push({ href: "#select/curriculum?v=middle", t: "중학교 입학 서류 · 준비물", s: "예비소집·준비물·방과후학교 신청은 배정 학교가 정해진 뒤(2027.1월) 각 중학교가 공지해요 → 배정 학교 홈페이지 공지에서 확인", text: "중학교 입학 서류 입학 서류 제출 서류 준비물 예비소집 방과후 신입생 등록 배정 학교 공지" });
  for (const u of un?.universities || []) { const n = (ar?.rules || []).filter((r) => r.universityId === u.id).length; if (n) out.push({ href: "#select/curriculum?v=univ", t: `${u.name} · 과목 요건(대학 요건)`, s: `${n}개 전형·모집단위의 필수·권장 과목을 우리 학교 편제표와 맞춰 볼 수 있어요`, text: J([u.name, "과목 요건 필수 권장 과목 모집단위 전형 대학 요건", ...(u.aliases || [])]) }); }
  for (const r of mid?.principles || []) out.push({ href: "#select/curriculum?v=middle", t: `중학교 배정 · ${r.title}`, s: String(r.body).slice(0, 80), text: J([r.title, r.body, r.id === "mp-06" ? "중학교 이사 이사 전입 재배정" : ""]) });
  out.push(...gapDocs({ pol, mc, hc, ev: evs, mid: mid?.principles }));
  return out;
}
