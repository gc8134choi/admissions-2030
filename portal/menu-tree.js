// 좌측 트리·모바일 서랍·하단 바의 항목 구성과 이름·설명 줄은 이 파일 하나다(IA 검수 evaluation/ia-review.md, 사용자 확정 2026-11-06). 이름·설명만 바꿔도 메뉴가 바뀐다.
// 항목: id = 이동 주소(해시, 기존 이름 그대로), title = 쉬운 말 이름, desc = 이름 아래 작은 회색 한 줄(어떤 내용이 있는지),
//       keys = 설명 줄의 핵심어(설명 줄 안에 있고 화면에도 실제로 있어야 함: tools/check-menu-captions.mjs), r = 화면 경로 id, q = 이 항목으로 볼 조건(값, 값 배열, null=없어야 함, "!값"=그 값이 아니어야 함; v는 비면 summary), also = 같은 항목으로 켜지는 다른 경로.
export const HOME = { id: "home", title: "스쿨 라이프", desc: "오늘 할 일 · 수능 D-day", keys: ["오늘", "D-", "수능"], r: "home" };
export const GROUPS = [
  { id: "mid", title: "중학교 입학", items: [
    { id: "select/curriculum?v=middle", title: "배정 안내", desc: "발표·추가배정·등록·배정 후 변경(이사·전입)·근거리 중학교", keys: ["발표", "추가배정", "등록", "배정 후", "이사", "근거리"], r: "select/curriculum", q: { v: "middle", open: null } },
    { id: "select/curriculum?v=middle&open=cmp", title: "중학교 비교", desc: "학생 수·급식·통학 나란히", keys: ["학생", "급식", "통학"], r: "select/curriculum", q: { v: "middle", open: "cmp" } },
    { id: "select/curriculum?v=map&lv=middle", title: "중학교 지도", page: "중학교 지도", desc: "중학교 위치", keys: ["중학교"], r: "select/curriculum", q: { v: "map", lv: "middle" } },
    { id: "select/curriculum?v=middle&open=guide", title: "입학 준비", desc: "배정부터 등록까지·예비소집·교복·준비물·자유학기제·교과서", keys: ["배정부터 등록까지", "예비소집", "교복", "준비물", "자유학기", "교과서"], r: "select/curriculum", q: { v: "middle", open: "guide" } }] },
  { id: "hs", title: "고등학교 입학", items: [
    { id: "select/curriculum?v=hs&ty=1", title: "고교 종류", desc: "일반·특목·자사고 종류와 지원 방법", keys: ["일반", "자사고", "지원"], r: "select/curriculum", q: { v: "hs", ty: "1" } },
    { id: "select/curriculum?v=hs", title: "학교 비교", desc: "학교별 기본 정보·급식·기숙사·대학 진학 현황", keys: ["급식", "기숙사", "진학"], r: "select/curriculum", q: { v: ["hs", "summary"], ty: "!1", bf: null } },
    { id: "select/curriculum?v=compare", title: "과목 비교", desc: "학교별 과목 목록 나란히", keys: ["과목", "학교별"], r: "select/curriculum", q: { v: "compare" } },
    { id: "select/curriculum?v=map", title: "고교 지도", page: "고교 지도", desc: "고등학교 위치", keys: ["고등학교"], r: "select/curriculum", q: { v: "map", lv: "!middle" } },
    { id: "select/curriculum?v=hs&bf=1", title: "설명회 노트", desc: "학교 설명회 내용 요약(일정은 일정 화면)", keys: ["설명회"], r: "select/curriculum", q: { v: ["hs", "summary"], bf: "*" } }] },
  { id: "life", title: "고교 생활", items: [
    { id: "life/credit", title: "고교학점제", desc: "졸업 학점·과목 이수 기준", keys: ["졸업", "학점", "이수"], r: "life/credit" },
    { id: "planner/plan", title: "내 계획표", desc: "학기별 학점 계획", keys: ["학기", "학점", "계획"], r: "planner/plan" }] },
  { id: "admit", title: "대학 입시", items: [
    { id: "admission/system", title: "수능과 내신", desc: "수능 체제·시간표, 내신 5등급 계산, 대입 개편", keys: ["수능", "시간", "내신", "5등급", "개편"], r: "admission/system", q: { t: null } },
    { id: "admission/system?t=types", title: "수시·정시", desc: "전형 종류·원서 시기", keys: ["전형", "원서"], r: "admission/system", q: { t: "types" } },
    { id: "select/curriculum?v=univ", title: "대학별 과목", desc: "대학이 요구하는 과목·내 학교 과목과 맞춰 보기", keys: ["대학", "과목", "맞춰"], r: "select/curriculum", q: { v: "univ" } }],
    soon: ["대학·학과 찾기", "학교별 시뮬레이션", "목표 학과 체크"] },
  { id: "sched", title: "일정", leaf: true, items: [
    { id: "schedule", title: "일정", desc: "고교 입학·대학 입시·졸업·입학·학년별 큰 그림(초6~대입)·캘린더 구독", keys: ["학년별 큰 그림", "캘린더", "구독", "졸업"], r: "schedule" }] },
  { id: "lib", title: "자료·소식", items: [
    { id: "changelog", title: "바뀐 소식", desc: "제도가 바뀐 내용", keys: ["바뀐"], r: "changelog" },
    { id: "library", title: "관련 사이트", desc: "학교알리미·교육청 바로가기", keys: ["학교알리미", "교육청"], r: "library" },
    { id: "library/sources", title: "출처·확인일", desc: "자료 출처와 확인한 날", keys: ["출처", "확인"], r: "library/sources", also: ["library/status"] },
    { id: "library/files", title: "원본 파일", desc: "학교에서 받은 사진·양식", keys: ["사진", "양식"], r: "library/files" },
    { id: "library/settings", title: "화면 설정", desc: "어둡게·스킨·글자 크기", keys: ["어둡", "스킨", "글자"], r: "library/settings" }] },
];
// 하단 바(모바일, 900px 미만): 메뉴 | 오늘 | 일정 | 검색
export const BOTTOM = [{ key: "menu", label: "메뉴" }, { key: "home", label: "오늘", href: "#home", r: "home" }, { key: "sched", label: "일정", href: "#schedule", r: "schedule" }, { key: "search", label: "검색" }];
