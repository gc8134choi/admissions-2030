// 프로필 공통 모듈. 셸·홈·제도 화면이 함께 import 한다. 출생연도는 두지 않는다(이름은 사용 가능).
// 프로필 A = 예나(현 중3, 입학 2027, 대입 2030학년도), B = 예은(현 초6, 입학 2030, 대입 2033학년도).
// 선택값은 localStorage "portal.profile"(JSON)에 저장한다. "A"/"B" 외에 입학연도(2027/2030)도 받아들인다.
export const PROFILES = [
  { id: "A", label: "예나", grade: "현 중3", entryYear: 2027, examYear: 2030 },
  { id: "B", label: "예은", grade: "현 초6", entryYear: 2030, examYear: 2033 },
];
export const PROFILE_KEY = "portal.profile";
export const PROFILE_DEFAULT = "A";
const norm = (v) => (v === "A" || v === "B" ? v : String(v) === "2027" ? "A" : String(v) === "2030" ? "B" : null);
// store = { get(key, default) } (app.js의 store). 선택이 없거나 알 수 없는 값이면 기본 프로필.
export const loadProfile = (store) => norm(store.get(PROFILE_KEY, null)) || PROFILE_DEFAULT;
export const saveProfile = (store, id) => store.set(PROFILE_KEY, norm(id) || PROFILE_DEFAULT);
export const profileOf = (id) => PROFILES.find((p) => p.id === id) || PROFILES[0];
// ---- 행 ↔ 프로필 (홈·일정·제도 화면의 단일 기준) ----
// 1) audience에 grade3(현 고3)가 있으면 "현고3" 칩이 켜졌을 때만 보인다(opts.grade3).
// 2) learners 배열이 있으면 우선 적용한다("a"/"b", "예나"/"예은", 2027/2030, "all"/"common").
// 3) 연도가 둘 다 비어 있으면 두 프로필 공통. 연도가 있으면 entryYear 또는 examYear가 프로필과 같을 때만 그 프로필 행이고,
//    어느 프로필과도 안 맞으면(예: examYear 2027) 어느 프로필에도 보이지 않는다.
const learnerId = (v) => { const t = String(v).trim().toLowerCase(); return ["a", "yena", "예나", "2027"].includes(t) ? "A" : ["b", "yeeun", "예은", "2030"].includes(t) ? "B" : ["all", "common", "both", "공통"].includes(t) ? "*" : null; };
export const isGrade3 = (r) => Array.isArray(r.audience) && r.audience.includes("grade3");
export const rowProfiles = (r) => {
  if (Array.isArray(r.learners) && r.learners.length) { const ids = r.learners.map(learnerId).filter(Boolean); return ids.includes("*") ? PROFILES.map((p) => p.id) : ids; }
  if (r.entryYear == null && r.examYear == null) return PROFILES.map((p) => p.id);
  return PROFILES.filter((p) => r.entryYear === p.entryYear || r.examYear === p.examYear).map((p) => p.id);
};
export const profileMatch = (r, id, { grade3 = false } = {}) => (isGrade3(r) ? grade3 : rowProfiles(r).includes(id));
export const filterByProfile = (rows, id, opts) => rows.filter((r) => profileMatch(r, id, opts));
