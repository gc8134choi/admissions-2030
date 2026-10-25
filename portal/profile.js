// 프로필(자녀 학년) 공통 모듈. 셸·홈·제도 화면이 함께 import 한다. 이름·출생연도는 두지 않는다.
// 프로필 A = 현 중3(입학 2027, 대입 2030학년도), B = 현 초6(입학 2030, 대입 2033학년도).
// 선택값은 localStorage "portal.profile"(JSON)에 저장한다. "A"/"B" 외에 입학연도(2027/2030)도 받아들인다.
export const PROFILES = [
  { id: "A", label: "현 중3", entryYear: 2027, examYear: 2030 },
  { id: "B", label: "현 초6", entryYear: 2030, examYear: 2033 },
];
export const PROFILE_KEY = "portal.profile";
export const PROFILE_DEFAULT = "A";
const norm = (v) => (v === "A" || v === "B" ? v : String(v) === "2027" ? "A" : String(v) === "2030" ? "B" : null);
// store = { get(key, default) } (app.js의 store). 선택이 없거나 알 수 없는 값이면 기본 프로필.
export const loadProfile = (store) => norm(store.get(PROFILE_KEY, null)) || PROFILE_DEFAULT;
export const saveProfile = (store, id) => store.set(PROFILE_KEY, norm(id) || PROFILE_DEFAULT);
export const profileOf = (id) => PROFILES.find((p) => p.id === id) || PROFILES[0];
// 행이 속한 프로필: entryYear 또는 examYear가 프로필과 같으면 그 프로필. 어느 프로필과도 안 맞으면(연도 없음, 2026·2028 등 참고 연도) 공통.
export const rowProfiles = (r) => PROFILES.filter((p) => r.entryYear === p.entryYear || r.examYear === p.examYear).map((p) => p.id);
// 선택된 프로필의 행 + 공통 행만 보인다.
export const profileMatch = (r, id) => { const t = rowProfiles(r); return !t.length || t.includes(id); };
export const filterByProfile = (rows, id) => rows.filter((r) => profileMatch(r, id));
