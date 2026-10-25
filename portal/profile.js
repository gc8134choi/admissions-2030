// 프로필 공통 모듈. 셸·홈·제도 화면이 함께 import 한다. 출생연도·이름은 두지 않는다(사용자 결정 2026-10-25: 두 사람 구분은 화면에 내지 않는다).
// 프로필 A = 현 중3(입학 2027, 대입 2030학년도), B = 현 초6(입학 2030, 대입 2033학년도).
// UI.showProfiles=false(기본)이면 A 한 가지 기준만 쓰고, B 전용 행(2033학년도 등)은 숨긴다. 졸업·입학(life-schedule)은 항상 보인다.
// 기존 프로필 전환 코드는 이 플래그를 true로 바꾸면 되살아난다.
export const UI = { showProfiles: false };
// 선택값은 localStorage "portal.profile"(JSON)에 저장한다. "A"/"B" 외에 입학연도(2027/2030)도 받아들인다.
export const PROFILES = [
  { id: "A", label: "중3 기준", grade: "현 중3", entryYear: 2027, examYear: 2030 },
  { id: "B", label: "초6 기준", grade: "현 초6", entryYear: 2030, examYear: 2033 },
];
export const PROFILE_KEY = "portal.profile";
export const PROFILE_DEFAULT = "A";
const norm = (v) => (v === "A" || v === "B" ? v : String(v) === "2027" ? "A" : String(v) === "2030" ? "B" : null);
// store = { get(key, default) } (app.js의 store). 선택이 없거나 알 수 없는 값이면 기본 프로필.
export const loadProfile = (store) => (UI.showProfiles ? norm(store.get(PROFILE_KEY, null)) : null) || PROFILE_DEFAULT;
export const saveProfile = (store, id) => store.set(PROFILE_KEY, norm(id) || PROFILE_DEFAULT);
export const profileOf = (id) => PROFILES.find((p) => p.id === id) || PROFILES[0];
// ---- 행 ↔ 프로필 (홈·일정·제도 화면의 단일 기준) ----
// 1) audience에 grade3(현 고3)가 있으면 "현고3" 칩이 켜졌을 때만 보인다(opts.grade3).
// 2) learners 배열이 있으면 우선 적용한다("a"/"b", 2027/2030, "all"/"common").
// 3) 연도가 둘 다 비어 있으면 두 프로필 공통. 연도가 있으면 entryYear 또는 examYear가 프로필과 같을 때만 그 프로필 행이고,
//    어느 프로필과도 안 맞으면(예: examYear 2027) 어느 프로필에도 보이지 않는다.
const learnerId = (v) => { const t = String(v).trim().toLowerCase(); return ["a", "2027"].includes(t) ? "A" : ["b", "2030"].includes(t) ? "B" : ["all", "common", "both", "공통"].includes(t) ? "*" : null; };
export const isGrade3 = (r) => Array.isArray(r.audience) && r.audience.includes("grade3");
export const rowProfiles = (r) => {
  if (Array.isArray(r.learners) && r.learners.length) { const ids = r.learners.map(learnerId).filter(Boolean); return ids.includes("*") ? PROFILES.map((p) => p.id) : ids; }
  if (r.entryYear == null && r.examYear == null) return PROFILES.map((p) => p.id);
  return PROFILES.filter((p) => r.entryYear === p.entryYear || r.examYear === p.examYear).map((p) => p.id);
};
// 졸업·입학 일정(life-schedule: 초졸·중입·중졸·고입·고교 입학)은 프로필과 상관없이 항상 보인다.
export const profileMatch = (r, id, { grade3 = false } = {}) => (isGrade3(r) ? grade3 : !UI.showProfiles && r.topic === "life-schedule" ? true : rowProfiles(r).includes(id));
export const filterByProfile = (rows, id, opts) => rows.filter((r) => profileMatch(r, id, opts));
