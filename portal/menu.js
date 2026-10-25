// 메뉴 트리 정의. 화면 구성은 이 파일만 고치면 된다.
// status: v1 = 1차 구현, v2 = 2차, soon = 준비 중(예약)
export const MENU = [
  { id: "home", title: "홈", icon: "🏠", status: "v1", view: "home",
    desc: "지금 할 일, 관심 학교, 최근 변경을 한눈에.",
    parts: ["이번 달 할 일 / 다가오는 일정", "관심 학교 위젯 (★ 토글로 모은 학교)", "최근 갱신 · 제도 변경 알림"] },

  { id: "schedule", title: "일정", icon: "📅", status: "v1", view: "schedule",
    desc: "학년·월별 전체 타임라인.",
    parts: ["학년·월별 타임라인", "필터: 고교 선택 / 고교 생활 / 대입"] },

  { id: "select", title: "고교 선택", icon: "🏫", status: "v1", children: [
    { id: "select/types", title: "고교 유형·전형 일정", status: "v1", view: "types",
      desc: "일반/자사고/특목/특성화 등 유형 개요와 전형 일정·요건.",
      parts: ["유형별 개요", "전형 일정·요건"] },
    { id: "select/curriculum", title: "학교별 편제표", status: "v1", view: "curriculum",
      desc: "학교별 요약을 보고, 상세 비교에서 여러 필터로 과목을 비교합니다." },
  ] },

  { id: "life", title: "고교 생활", icon: "📚", status: "soon",
    desc: "입학 후 단계. 지금은 최소한만.",
    children: [
      { id: "life/credit", title: "고교학점제 이해", status: "soon", desc: "학점제 개념과 졸업 요건." },
      { id: "life/checklist", title: "학년별 체크리스트", status: "soon", desc: "학년별로 챙길 일." },
    ] },

  { id: "admission", title: "대입", icon: "🎓", status: "v2", children: [
    { id: "admission/system", title: "대입 제도", status: "v1", view: "system", desc: "2030학년도 대입 개요." },
    { id: "admission/univ", title: "대학·학과 비교", status: "v2",
      desc: "대학·학과별 과목 요건(필수/권장/가산). 요강 확정 전까지 상태를 표시한다.",
      parts: ["과목 요건 데이터 틀", "상태: 확정 / 예정 / 추정"] },
  ] },

  { id: "planner", title: "과목 선택 플래너", icon: "🧭", status: "soon",
    desc: "계획이 구체화되면 사용. 지금은 예약 메뉴.",
    children: [
      { id: "planner/plan", title: "내 계획표", status: "soon", desc: "학기별 과목 배치, 학점 합계, 졸업 요건 체크." },
      { id: "planner/sim", title: "학교별 시뮬레이션", status: "soon", desc: "같은 계획을 후보 학교에 적용해 이수 불가 과목 확인." },
      { id: "planner/report", title: "목표 학과 요건 충족 리포트", status: "soon", desc: "희망 학과 요건과 내 계획 비교." },
    ] },

  { id: "changelog", title: "제도 변경 로그", icon: "📝", status: "v2",
    desc: "날짜·항목·영향 범위. 편제표·요건 갱신도 자동 기록.", parts: ["날짜 / 항목 / 영향 범위"] },

  { id: "library", title: "자료실", icon: "🗂️", status: "v1", children: [
    { id: "library/sources", title: "출처 목록", status: "v1", view: "sources", desc: "학교 정보 출처 링크." },
    { id: "library/status", title: "갱신 현황", status: "v1", view: "status", desc: "학교별 기준연도·수집일·확인 필요 건수." },
    { id: "library/files", title: "원본 파일", status: "v2", desc: "PDF 등 원본." },
  ] },
];

export const STATUS = { v1: "1차", v2: "2차", soon: "준비 중" };
