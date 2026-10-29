// 메뉴 트리 정의. 화면 구성은 이 파일만 고치면 된다.
// status: v1 = 1차 구현, v2 = 2차, soon = 준비 중(예약)
export const MENU = [
  { id: "home", title: "홈", icon: "home", status: "v1", view: "home",
    desc: "지금 할 일, 관심 학교, 최근 변경을 한눈에.",
    parts: ["이번 달 할 일 / 다가오는 일정", "관심 학교 위젯 (★ 토글로 모은 학교)", "최근 갱신 · 제도 변경 알림"] },

  { id: "schedule", title: "일정", icon: "calendar", status: "v1", view: "schedule",
    desc: "학년·월별 전체 타임라인.",
    parts: ["학년·월별 타임라인", "필터: 고교 선택 / 고교 생활 / 대입"] },

  { id: "select", title: "고교 선택", icon: "school", status: "v1", children: [
    { id: "select/types", title: "고교 유형·전형 일정", status: "v1", view: "types",
      desc: "일반/자사고/특목 등 유형 개요와 전형 일정·요건.",
      parts: ["유형별 개요", "전형 일정·요건"] },
    { id: "select/curriculum", title: "학교별 과목표", status: "v1", view: "curriculum",
      desc: "학교별 요약을 보고, 상세 비교에서 여러 필터로 과목을 비교합니다." },
  ] },

  { id: "life", title: "고교 생활", icon: "book", status: "soon",
    desc: "입학 후 단계. 지금은 최소한만.",
    children: [
      { id: "life/credit", title: "고교학점제 이해", status: "v1", view: "credit", desc: "학점제 개념과 졸업 요건." },
      { id: "life/checklist", title: "학년별 체크리스트", status: "soon", desc: "학년별로 챙길 일." },
    ] },

  { id: "admission", title: "대입", icon: "cap", status: "v2", children: [
    { id: "admission/system", title: "대입 제도", status: "v1", view: "system", desc: "2030학년도 대입 개요." },
    { id: "admission/univ", title: "대학·학과 비교", status: "v2",
      desc: "대학·학과별 과목 요건(필수/권장/가산). 요강 확정 전까지 상태를 표시한다.",
      parts: ["과목 요건 데이터 틀", "상태: 확정 / 예정 / 추정"] },
  ] },

  { id: "planner", title: "과목 선택 플래너", icon: "compass", status: "v1", view: "planner",
    desc: "계획이 구체화되면 사용. 지금은 예약 메뉴.",
    children: [
      { id: "planner/plan", title: "내 계획표", status: "v1", view: "planner", desc: "학기별 과목 배치, 학점 합계, 졸업 요건 체크." },
      { id: "planner/sim", title: "학교별 시뮬레이션", status: "soon", desc: "같은 계획을 후보 학교에 적용해 이수 불가 과목 확인." },
      { id: "planner/report", title: "목표 학과 요건 충족 리포트", status: "soon", desc: "희망 학과 요건과 내 계획 비교." },
    ] },

  { id: "mid/life", title: "중학교 생활", icon: "book", status: "v1", view: "midlife", desc: "중학교 교육과정·교과서·시기 일정." },

  { id: "changelog", title: "바뀐 소식", icon: "log", status: "v1", view: "changelog",
    desc: "날짜·항목·영향 범위. 편제표·요건 갱신도 자동 기록.", parts: ["날짜 / 항목 / 영향 범위"] },

  { id: "library", title: "자료실", icon: "folder", status: "v1", view: "links", children: [
    { id: "library/sources", title: "출처 목록", status: "v1", view: "sources", desc: "학교 정보 출처 링크." },
    { id: "library/status", title: "업데이트 기록", status: "v1", view: "status", desc: "학교별 기준연도·수집일·확인 필요 건수." },
    { id: "library/files", title: "원본 파일", status: "v1", view: "files", desc: "학교에서 받은 원본 양식·사진. 눌러서 크게 봅니다." },
  ] },
];

export const STATUS = { v1: "1차", v2: "2차", soon: "준비 중" };

// 하단 탭·상단 메뉴(2026-10 개편). 항목 id는 위 MENU의 id를 그대로 쓰므로 기존 링크(#select/curriculum 등)는 깨지지 않는다.
// soon: 아직 열리지 않은 기능은 메뉴에 두지 않고 해당 탭 맨 아래 한 줄로만 알린다.
// 단계 중심 5개 탭(오늘 / 중학교 / 고등학교 / 대입 / 일정). 중학교·고등학교는 화면 안 글자 탭 [입학 | 생활], 보관함은 헤더 링크.
// 항목의 id는 이동 주소(해시)이고 m(id, query)은 지금 화면이 그 항목인지 알려 준다. 기존 주소는 그대로 열린다.
const cur = (f) => (id, q) => id === "select/curriculum" && f(q.get("v") || "summary", q.get("lv"));
const at = (rid) => (id) => id === rid;
export const TABS = [
  { id: "home", title: "오늘", groups: [{ key: "", title: "", items: [{ id: "home", title: "오늘", m: at("home") }] }] },
  { id: "mid", title: "중학교", groups: [
    { key: "enter", title: "입학", items: [
      { id: "select/curriculum?v=middle", title: "중학교 배정", m: cur((v) => v === "middle") },
      { id: "select/curriculum?v=map&lv=middle", title: "학교 지도", m: cur((v, lv) => v === "map" && lv === "middle") }] },
    { key: "life", title: "생활", items: [{ id: "mid/life", title: "중학교 생활", m: at("mid/life") }] }] },
  { id: "high", title: "고등학교", groups: [
    { key: "enter", title: "입학", items: [
      { id: "select/curriculum?v=hs", title: "학교 비교", m: cur((v) => v === "hs") },
      { id: "select/curriculum", title: "학교별 요약", m: cur((v) => v === "summary") },
      { id: "select/curriculum?v=compare", title: "상세 비교", m: cur((v) => v === "compare") },
      { id: "select/types", title: "고교 유형·전형", m: at("select/types") },
      { id: "select/curriculum?v=map", title: "학교 지도", m: cur((v, lv) => v === "map" && lv !== "middle") }] },
    { key: "life", title: "생활", items: [
      { id: "life/credit", title: "고교학점제 이해", m: at("life/credit") },
      { id: "planner/plan", title: "내 계획표", m: at("planner/plan") },
      { id: "schedule?t=road", title: "학년별 로드맵", m: () => false }] }] },
  { id: "admit", title: "대입", groups: [{ key: "", title: "", items: [
    { id: "admission/system", title: "수능·내신 규칙", m: at("admission/system") },
    { id: "select/curriculum?v=univ", title: "대학 요건", m: cur((v) => v === "univ") },
    { id: "schedule?t=univ", title: "입시 일정", m: () => false }], soon: ["대학·학과 찾기", "학교별 시뮬레이션", "목표 학과 체크"] }] },
  { id: "schedule", title: "일정", groups: [{ key: "", title: "", items: [{ id: "schedule", title: "일정", m: at("schedule") }] }], soon: ["학년별 할 일"] },
];
export const VAULT = { id: "vault", title: "보관함", groups: [{ key: "", title: "", items: [
  { id: "changelog", title: "바뀐 소식", m: at("changelog") }, { id: "library", title: "바로가기", m: at("library") }, { id: "library/sources", title: "출처 목록", m: at("library/sources") },
  { id: "library/status", title: "업데이트 기록", m: at("library/status") }, { id: "library/files", title: "원본 파일", m: at("library/files") }] }] };
export const hrefOf = (it) => "#" + it.id;
export const tabHref = (t) => hrefOf(t.groups[0].items[0]);
export const allItems = () => [...TABS, VAULT].flatMap((t) => t.groups.flatMap((g) => g.items.map((it) => ({ ...it, tab: t.title, group: g.title }))));
// 지금 화면(라우트 id·쿼리)이 속한 탭·그룹·항목. 어느 항목도 아니면 가까운 탭(과목표 → 고등학교 입학)으로 둔다.
export function locate(id, query) {
  for (const t of [...TABS, VAULT]) for (const g of t.groups) for (const it of g.items) if (it.m(id, query)) return { tab: t, group: g, item: it };
  if (id === "select/curriculum") return { tab: TABS[2], group: TABS[2].groups[0], item: TABS[2].groups[0].items[1] };
  return null;
}
// 메뉴에서 빠진 옛 주소는 가장 가까운 화면으로 보낸다.
export const REDIRECT = { planner: "planner/plan", select: "select/curriculum", life: "life/credit", "life/checklist": "life/credit", admission: "admission/system", "admission/univ": "admission/system", "planner/sim": "select/curriculum", "planner/report": "select/curriculum" };
