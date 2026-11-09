// 대학 요건 규칙의 상태(화면·검색 공용): 요건 있음 / 요강에서 못 찾음 / 요강을 아직 못 열어 봄(접속 불가) / 요강 공표 전 / 과목 요건과 무관.
// 데이터: admission-rules.json의 requirements(비어 있지 않음=있음), requirementsReasonKind(not-found | unverified-blocked | unverified-pending | not-applicable).
// 필드가 없는 옛 데이터는 사유 문구로 나눈다.
export const KIND_LABEL = {
  "not-found": "요강에서 과목 요건 항목을 찾지 못했어요",
  "unverified-blocked": "요강을 아직 열어 보지 못했어요(접속 불가, 확인 필요)",
  "unverified-pending": "요강이 아직 공표 전이에요",
  "not-applicable": "이 전형은 과목 요건과 무관해요",
};
export const reqKind = (rule) => {
  if ((rule?.requirements || []).length) return "has";
  const k = rule?.requirementsReasonKind; if (KIND_LABEL[k]) return k;
  const why = String(rule?.requirementsNullReason || "");
  return /접속|열지 못|열어 보지 못/.test(why) ? "unverified-blocked" : /공표 전|미공표|공개 전|발표 전/.test(why) ? "unverified-pending" : "not-found";
};
export const kindText = (rule) => { const k = reqKind(rule); return k === "has" ? "" : KIND_LABEL[k]; };
