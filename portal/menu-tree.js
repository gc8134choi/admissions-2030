// 좌측 트리·모바일 서랍·하단 바의 항목 구성과 이름·설명 줄은 이 파일 하나다(IA 검수 evaluation/ia-review.md, 사용자 확정 2026-11-06). 이름·설명만 바꿔도 메뉴가 바뀐다.
// 항목: id = 이동 주소(해시, 기존 이름 그대로), title = 쉬운 말 이름, desc = 이름 아래 작은 회색 한 줄(어떤 내용이 있는지),
//       vals = 비교표 계열 항목이 설명 줄에 적은 항목의 값이 학교 절반 이상에 실제로 있어야 함({data, fields}), keys = 설명 줄의 핵심어(설명 줄 안에 있고 화면에도 실제로 있어야 함: tools/check-menu-captions.mjs), r = 화면 경로 id, q = 이 항목으로 볼 조건(값, 값 배열, null=없어야 함, "!값"=그 값이 아니어야 함; v는 비면 summary), also = 같은 항목으로 켜지는 다른 경로.
export const HOME = { id: "home", title: "스쿨 라이프", desc: "다가올 졸업과 날짜순 일정", keys: ["졸업","일정"], r: "home"};
// 최상위는 중학교·고등학교 두 그룹(사용자 결정 2026-11-08). sub = 그 항목부터 시작하는 의미 단위 소제목(시각 구분만, 메뉴 단계는 2단계). foot = 메뉴 맨 아래 작은 글자 링크 묶음(화면 모드 위).
export const GROUPS = [
  { id: "mid", title: "중학교", items: [
    { id: "select/curriculum?v=middle", title: "배정·입학 준비", desc: "발표·추가배정·등록·재배정·근거리 중학교·예비소집·교복·준비물", keys: ["발표", "추가배정", "등록", "재배정", "근거리", "예비소집", "교복", "준비물"], r: "select/curriculum", q: { v: "middle" } },
    { id: "select/curriculum?v=schools&lv=middle", title: "학교 보기", page: "중학교 보기", desc: "중학교 13곳 학생 수·급식·교복 표로 견주기·지도·교과서", keys: ["학생", "급식", "교복", "지도", "교과서"], vals: { data: "middle-compare", fields: ["students", "meal", "uniform"] }, r: "select/curriculum", q: { v: "schools", lv: "middle" } },
    { id: "schedule?t=life", title: "중학교 일정", page: "중학교 일정", desc: "졸업·입학(배정원서·입학식)", keys: ["졸업", "배정원서", "입학"], r: "schedule", q: { t: "life" } }] },
  { id: "hs", title: "고등학교", items: [
    { id: "select/curriculum?v=types", title: "고교 종류", desc: "일반·특목·자사고 종류와 지원 방법·지망·구역·고입 내신 반영·선지원 추첨", keys: ["일반","자사고","지원","지망","구역","고입 내신","선지원","추첨"], r: "select/curriculum", q: { v: "types"}, sub: "학교 알아보기"},
    { id: "select/curriculum?v=schools&lv=high", title: "학교 보기", page: "고교 보기", desc: "학교별 기본 정보·입학 방식·구역·과목·지도·설명회 노트", keys: ["입학 방식", "구역", "과목", "지도", "설명회"], vals: { data: "hs-compare", fields: ["type", "admission", "zone"] }, r: "select/curriculum", q: { v: "schools", lv: "high" } },
    { id: "life/credit", title: "고교학점제", desc: "졸업 학점·과목 이수 기준", keys: ["졸업","학점","이수"], r: "life/credit", sub: "고교 생활"},
    { id: "planner/plan", title: "내 계획표", desc: "학기별 학점 계획", keys: ["학기","학점","계획"], r: "planner/plan"},
    { id: "admission/system", title: "수능과 내신", desc: "수능 체제·시간표, 내신 5등급 계산, 대교협 기본사항, 대입 개편", keys: ["수능","시간","내신","5등급","대교협","기본사항","개편"], r: "admission/system", q: { t: null}, sub: "대입"},
    { id: "admission/system?t=types", title: "수시·정시", desc: "전형 종류·원서 시기·전형 구조(학생부교과·수능최저)·전형유형별 모집 비율(대교협)", keys: ["전형","원서","학생부교과","수능최저","비율","모집"], r: "admission/system", q: { t: "types"}},
    { id: "select/curriculum?v=univ", title: "대학별 과목", desc: "대학이 요구하는 과목과 학교 과목표 비교", keys: ["대학","과목","과목표"], r: "select/curriculum", q: { v: "univ"}},
    { soon: ["대학·학과 찾기", "학교별 시뮬레이션", "목표 학과 체크"], id: "schedule?t=hs", title: "고교 일정", page: "고교 일정", desc: "고교 입학·대학 입시·학년별 큰 그림(초6~대입)·캘린더 구독", keys: ["학년별 큰 그림","캘린더","구독"], r: "schedule", q: { t: ["hs","univ","road",null]}, sub: "일정"}] },
  { id: "lib", title: "자료·소식", foot: true, items: [
    { id: "changelog", title: "바뀐 소식", desc: "제도가 바뀐 내용", keys: ["바뀐"], r: "changelog"},
    { id: "library", title: "관련 사이트", desc: "학교알리미·교육청 바로가기", keys: ["학교알리미","교육청"], r: "library"},
    { id: "library/sources", title: "출처·확인일", desc: "자료 출처와 확인한 날", keys: ["출처","확인"], r: "library/sources", also: ["library/status"]},
    { id: "library/files", title: "원본 파일", desc: "학교에서 받은 사진·양식", keys: ["사진","양식"], r: "library/files"},
    { id: "library/settings", title: "화면 설정", desc: "어둡게·스킨", keys: ["어둡","스킨"], r: "library/settings"}] },
];
// 하단 바(모바일, 900px 미만): 메뉴 | 오늘 | 일정 | 검색 (일정은 중학교·고등학교 일정을 모두 보는 전체 일정 화면)
export const BOTTOM = [{ key: "menu", label: "메뉴"},{ key: "home", label: "오늘", href: "#home", r: "home"},{ key: "sched", label: "일정", href: "#schedule", r: "schedule"},{ key: "search", label: "검색"}];
