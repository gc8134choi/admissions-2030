# 03. 이용자 특성과 최신 UX·디자인 트렌드 (2026-11-01)

범위: WebSearch 요약 기준, 원문 미확인 항목은 "2차". 에브리타임·당근·무신사의 하단 탭/바텀시트 구조, bento·마이크로 인터랙션은 근거를 못 찾음(미확인, 앱 실사와 학생 테스트 필요).

## 1. 한국 10대 앱과 한 손 조작
- 토스: 말투를 딱딱한 금융 어투에서 대화체로 바꾸고 불필요한 단어를 줄였으며, 디자인 시스템(TDS)과 전담 UX 라이터로 40여 개 서비스의 어조를 통일. https://toss.im/tossfeed/article/uxwriter-interview (토스 공식 / 일부는 2차: https://pminginkorea.blogspot.com/2025/03/toss-trendsetter-shaping-koreas-tech.html)
  - 시사점: 우리 문구(수능 체제, 내신 산출 규칙 등)도 한 문장 한 뜻, 어조 하나로 통일. 용어는 첫 등장에 풀이.
- 한 손 조작: Hoober 2013 관찰(1,333명)에서 한 손 49%, 받쳐 쥠 36%, 양손 15%. 이후 본인이 "엄지 영역 도식은 부정확하고 쥐는 방식은 계속 바뀐다"고 정정. 하단 내비 효과를 수치로 입증한 근거는 못 찾음. 최하단은 닿기 어렵다는 소형폰 연구도 있음. https://garciamedia.com/?p=7518 , https://medium.com/@mibosc/mobile-ui-ergonomics-how-hard-is-it-really-to-tap-different-areas-of-your-phone-interface-bb043d409af8
  - 시사점: 하단 탭은 유지하되 "하단=무조건 쉬움"으로 믿지 말고, 자주 쓰는 동작을 화면 하단 절반에 두고 터치 목표를 넉넉히(48px 이상). 기기 하단 제스처 바와 겹치지 않게 safe-area 여백.

## 2. 40~50대 학부모
- 노년층 대상 문헌 리뷰: 큰 글자 선호, 다만 일정 크기를 넘으면 오히려 가독성 저하. 대비는 WCAG 4.5:1 이상, 가능하면 7:1을 권고하는 글이 다수. 중요 요소에 파란색 지양, 아이콘보다 텍스트 라벨 선호, 글자 크기 조절 옵션 제공. https://pmc.ncbi.nlm.nih.gov/articles/PMC9376262 , https://uxplanet.org/ux-study-designing-for-older-people-6c67575d9c2f (대상은 주로 고령층이라 40~50대에는 보수적 참고치)
  - 시사점: 손글씨체·종이 질감 위에서도 본문 대비 7:1 목표, 아이콘 단독 금지(라벨 병기), 글자 크기 조절 제공.

## 3. 2025~2026 웹 트렌드와 글래스
- Liquid Glass: NN/g가 iOS 26을 "볼거리 중심으로 사용성을 희생"한다고 비판(2025.10, 2차 요약). Infinum은 일부 화면 대비 1.5:1 측정, 시스템의 "투명도 줄이기"로도 완전 해결 안 됨. https://anderegg.ca/2025/10/12/nielsen-norman-group-on-ios-26-usability , https://infinum.com/blog/apples-ios-26-liquid-glass-sleek-shiny-and-questionably-accessible/
  - 시사점: 글래스는 장식 영역(헤더 배경 등)에만, 글자가 올라가는 면은 불투명 처리. prefers-reduced-transparency/contrast 대응 필수.
- View Transitions: 동일 문서 전환은 2025.10 Baseline(MDN). 문서 간(MPA) 전환은 Firefox 지원 출처가 엇갈림(미확인). https://developer.mozilla.org/docs/Web/API/ViewTransition , https://botmonster.com/web-dev/smooth-page-animations-with-the-view-transitions-api/
- Scroll-driven animation: Chrome 115, Firefox 133, Safari 18.2부터라는 2차 보도(공식 표로 재확인 필요). https://blog.codercops.com/blog/css-view-transitions-scroll-animations-2026

## 4. "AI가 만든 듯한" UI
- 공통 지적: 의미 없는 보라-파랑 그라디언트, 모든 카드에 같은 큰 둥근 모서리, 히어로+카드 3개+후기+CTA 반복, Inter/Roboto 기본 폰트, 그라디언트 글자. 회피책: 폰트부터 바꾸기, 위계에 따라 모서리·그림자 차등, 표 데이터는 행/표로, 요소마다 존재 이유. 금지만 하면 다음 기본값(크림+테라코타)으로 쏠림. https://capitalandcompute.net/blog/fix-ai-slop-design/ , https://noqta.tn/blog/ai-design-slop-overused-ui-patterns-fix-2026 , https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c
  - 시사점: 우리의 "종이 베이지+주황빨강 포인트+손글씨"는 바로 그 "다음 기본값"에 가깝다. 스크랩북이 장식(각도 조각)에 그치지 않고 정보 구조(바인더 탭=학년, 메모=핵심)에서 의미를 가져야 한다.

## 5. 정보 많은 사이트의 스캔 구조
- 아코디언은 가독성을 떨어뜨리고 조작 비용을 늘리지만 인지 부하를 줄임. NN/g 2014 "Accordions Are Not Always the Answer for Complex Content on Desktops"는 원문 미확인. https://www.parallelhq.com/blog/what-accordion-website , https://thedecisionlab.com/reference-guide/design/progressive-disclosure
  - 시사점: 숨기는 것은 "부가 근거(출처, 상세)"만, 비교 판단에 필요한 값은 노출. 요약→비교표→출처 1탭 순서(COMPARE-TABLE.md와 일치). PC에서는 접기보다 2단 배치로 펼쳐 보여준다.

## 추천 UX·디자인 원칙 12개 (측정 기준)
1. 첫 화면 한 문장 결론: 각 화면 상단 40px~120px 안에 "지금 알아야 할 것" 1줄. 5초 테스트에서 80% 정답.
2. 본문 16px 이상(모바일), 행간 1.6, 글자 크기 조절 3단계 제공.
3. 본문 대비 7:1(AAA) 목표, 최소 4.5:1. 상태색·포인트색 포함 전수 점검.
4. 터치 목표 48×48px 이상, 간격 8px 이상.
5. 핵심 동작(탭 전환, 필터, 학교 선택)은 화면 하단 절반 배치, 하단 safe-area 반영.
6. 글래스는 글자가 없는 면에만. 글자 면은 불투명 배경, reduce-transparency 시 전부 불투명.
7. 모션은 150~300ms, 정보 전달에 불필요, prefers-reduced-motion 시 0.
8. 모서리·그림자·각도는 위계로 차등: 같은 반지름 카드가 한 화면에 3개 이상 연속 금지.
9. 용어 첫 등장 풀이(ⓘ), 한 화면 신규 용어 3개 이하, 문장 40자 이내 지향.
10. 아이콘 단독 금지, 모든 메뉴·버튼에 텍스트 라벨.
11. 요약→비교→출처 3단 구조, 어느 값이든 출처까지 2탭 이내. 숨김은 부가 근거만.
12. PC는 본문 폭 제한(읽기 65~75자)과 2~3단 배치로 넓게 쓰되, 모바일과 정보 순서 동일. 1280px, 390px 두 폭에서 가로 스크롤 0.

## 지금 컨셉(스크랩북+글래스)의 위험 5개
1. 종이 질감·손글씨·각도 조각 위 본문 대비 저하와 가독성(40~50대 부모). 질감 위 텍스트 대비 실측 필요.
2. 글래스 + 스크랩북 혼용으로 장식 과잉: NN/g·Infinum식 비판을 그대로 받을 수 있음. 방향이 둘이면 "AI 템플릿 혼합" 인상.
3. "베이지+포인트 한 색+손글씨"가 최신 AI 기본값 계열. 구조적 의미 없이 쓰면 오히려 AI스러움.
4. 비뚤어진 각도·겹침이 스캔을 방해하고 비교표(정렬 기반)와 충돌, 터치 영역 오인.
5. 하단 탭 + 하단 시트가 기기 제스처 바와 겹치거나 엄지 비도달 영역(최하단) 문제. 또한 PC에서 모바일 레이아웃이 늘어나 "넓고 시원함" 상실.


- 동일 문서 View Transition은 점진적 향상으로만 쓰고 `prefers-reduced-motion`을 지킨다.
