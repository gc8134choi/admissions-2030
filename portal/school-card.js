// 학교 카드 공통 부품: 큰 로고 + 학교별 포인트 색 밴드. 홈 "내 학교"와 학교별 편제표 요약 카드가 함께 쓴다.
// 포인트 색은 학교 로고에서 뽑은 값(흰 글자 대비 4.5 이상). 새 학교는 기본 강조색으로 보인다.
const ACCENT = { "school-pungdeok": "#3651a7", "school-seongbok": "#4a2c8f", "school-suji": "#9a5a42", "school-yonginheungcheon": "#0f486e" };
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// m: summary 행, opts: {starred, sub(밴드 아래줄 글), logoOk}
export function schoolBand(m, { starred = false, sub = "", logoOk = true } = {}) {
  const c = ACCENT[m.schoolId];
  return `<div class="sb"${c ? ` style="--sc:${c}"` : ""}>
    ${logoOk ? `<img class="sb-logo" src="img/schools/256/${esc(m.schoolId)}.png" alt="${esc(m.schoolName)} 로고" width="84" height="84">` : ""}
    <div class="sb-t"><b>${esc(m.schoolName)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</div>
    <button type="button" class="star sb-star" data-id="${esc(m.schoolId)}" aria-label="${starred ? "관심 해제" : "관심 학교로 고정"}" aria-pressed="${starred}">${starred ? "★" : "☆"}</button></div>`;
}

// 홈 카드: 밴드 + 핵심 숫자 타일 + 지정/선택 막대 + 창체 칩 + 주 버튼
export function homeSchoolCard(m, { starred, sub, logoOk, cr }) {
  const total = m.creditsRequired + m.creditsElective;
  return `<section class="hs${starred ? " fav" : ""}" style="--sc:${ACCENT[m.schoolId] || "var(--accent)"}">${schoolBand(m, { starred, sub, logoOk })}
    <div class="hs-tiles"><div><b>${m.creditsRequired}</b><span>필수 학점</span></div><div><b>${m.creditsElective}</b><span>내가 고르는 학점</span></div><div><b>${m.creditsSubject}</b><span>교과 합계</span></div></div>
    <div class="bar" title="필수 ${m.creditsRequired} / 내가 고르는 ${m.creditsElective}"><span class="req" style="width:${(m.creditsRequired / total) * 100}%">필수</span><span class="ele" style="width:${(m.creditsElective / total) * 100}%">내가 고르는</span></div>
    <div class="hs-chips"><span>창체 ${m.creditsCreative}학점</span>${cr ? `<span>${cr.totalHours}시간</span>` : ""}</div>
    <a class="btn primary hs-go" href="#select/curriculum?v=compare&s=${esc(m.schoolId)}">이 학교 과목 보기 →</a></section>`;
}
