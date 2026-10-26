// 입시 단계(중입·고입·대입) 규칙 한 곳. 화면(홈·바로가기)과 다른 세션이 함께 import한다.
// 행의 stage 필드 값(초졸·중입·중졸·고교 …)과 topic·제목으로 3단계로 접는다. 어느 단계도 아니면 null(태그 없음).
export const STAGES = ["중입", "고입", "대입"];
const TOPIC = {
  "hs-schedule": "고입", "gg-hs-entry": "고입", "hs-types": "고입", "high-school-assignment": "고입", "hs-choice-opinion": "고입",
  "hs-credit-system": "고입", "curriculum-guide": "고입", "academy-material": "고입",
  "exam-schedule": "대입", "admission-system": "대입", "admission-outlook": "대입", "admission-structure": "대입", "profile-2033": "대입",
};
const FIELD = { 초졸: "중입", 중입: "중입", 중졸: "고입", 고입: "고입", 고교: "고입", 대입: "대입" }; // 초등 졸업은 중입 준비, 중학교 졸업은 고입 쪽
export function stageOf(row) {
  if (!row || row.topic === "change-log") return null;
  if (row.topic === "life-schedule") {
    if (/중학교 배정|신입생|재배정|초등학교 졸업|중학교 입학/.test(row.title || "")) return "중입";
    return "고입"; // 중학교 졸업, 고교 입학식
  }
  return TOPIC[row.topic] || FIELD[row.stage] || null;
}
const LINK = { 고입: "고입", "학교 정보": "고입", 고교학점제: "고입", "대입 전형": "대입", 수능: "대입" };
export const linkStage = (item) => LINK[item?.category] || null; // 일정·성적/내신·학습/상담은 단계 공통
export const stageTag = (s, esc = (x) => x) => (s ? `<span class="stg">${esc(s)}</span>` : "");
