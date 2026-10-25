// ⚠ 화면 확인용 가짜 데이터. 실제 학교·편제표가 아니다. 실제 자료로 교체 예정.
export const SCHOOLS = [
  { id: "A", name: "예시고 A", type: "일반고", region: "예시구" },
  { id: "B", name: "예시고 B", type: "일반고", region: "예시구" },
  { id: "C", name: "예시고 C", type: "자사고", region: "예시시" },
  { id: "D", name: "예시고 D", type: "일반고", region: "예시구" },
];
// 과목 마스터 코드 기준으로 학교 간 같은 과목을 맞춘다.
export const SUBJECTS = [
  { code: "MAT-CAL2", name: "미적분Ⅱ", area: "수학", kind: "일반", offered: { A: 4, B: 4, C: 0, D: 4 } },
  { code: "MAT-GEO",  name: "기하", area: "수학", kind: "일반", offered: { A: 4, B: 0, C: 4, D: 0 } },
  { code: "SCI-PHY2", name: "물리학Ⅱ", area: "과학", kind: "진로", offered: { A: 4, B: 0, C: 4, D: 0 } },
  { code: "SCI-CHM2", name: "화학Ⅱ", area: "과학", kind: "진로", offered: { A: 4, B: 4, C: 4, D: 0 } },
  { code: "SOC-ECO",  name: "경제", area: "사회", kind: "일반", offered: { A: 4, B: 4, C: 0, D: 4 } },
  { code: "LNG-JPN",  name: "일본어", area: "제2외국어/한문/교양", kind: "일반", offered: { A: 0, B: 4, C: 4, D: 4 } },
];
