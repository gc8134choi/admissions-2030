# 08 접근성·성능·구현 검토 (계획 초안 2026-10-29)

실측: 현재 CSS에 backdrop-filter 0건, `--glass`는 이미 .74(scrap.css:293)로 계획 하한 .85 미만. 포커스 링은 scrap.css에 3px 정의됨, prefers-reduced-transparency 분기 있음. `<main>`·`<nav>`·`<header>` 랜드마크와 패널별 `<h2>`는 있으나 `<h1>`은 화면 전환 시 app.js:444가 주입(홈은 확인 필요). JS 합계 약 345KB(홈 home.js 30KB).

## (1) 항목별 난이도·위험
| 항목 | 난이도 | 위험 | 비고 |
|---|---|---|---|
| 토큰·간격 스케일 | 하 | 하 | CSS 변수만, 롤백 쉬움 |
| 반투명 패널 | 중 | 중 | 블러는 모바일 비용, 불투명도 .74→.88 상향 필수 |
| 12열 그리드 | 중 | 중 | Grid는 전 브라우저 지원, DOM 순서≠시각 순서이면 키보드 순서 어긋남(WCAG 2.4.3) |
| 허브 띠(크기 차등) | 중 | 하 | 현재 단계 판정 로직이 데이터 의존 |
| 일정 40px 한 줄 | 하 | 중 | 한 줄에 5요소는 390px에서 넘침, 모바일은 2줄 허용 |
| 터치 44px | 하 | 하 | 2.5.8 AA는 24px이라 44는 목표값(AAA 2.5.5) |
| 고교 탭 3→2겹, 비교 small multiples | 상 | 중 | 해시 라우팅·사이드 메뉴 연동, 모바일 첫 열 고정은 sticky 처리 |
| 계획표↔요건 2단 | 상 | 중 | 두 영역 동기 갱신, 라이브 영역 필요 |
| 검색 통합(/ 키) | 중 | 중 | 입력 중 단축키 충돌, 스크린리더 결과 알림 |

## (2) 성능 예산 (홈 Lighthouse 68 이상 유지)
- 블러(backdrop-filter) 동시 화면 내 3개 이하, 반경 8px 이하, 중첩 금지, 스크롤·애니메이션 중인 요소 금지. 모바일은 블러 0으로 시작하고 `.88` 불투명만 사용해도 시각 차이가 작음. 효과가 큰 곳(히어로 1, 상태 띠 1)만 허용.
- 홈 패널 12개 이하, DOM 노드 1,500 이하(Lighthouse 경고 기준 800 초과 주의, 1,400 초과 오류), 초기 JS 추가 +20KB 이하, CSS 추가 +15KB 이하.
- 이미지: 홈 첫 화면 이미지 2장 이하, lazy 로딩, width/height 지정(CLS). 손글씨 폰트 서브셋·font-display:swap.
- 각 단계 후 Lighthouse 3회 중앙값 측정, 3점 이상 하락 시 중단.

## (3) 접근성 필수 체크리스트
1. 본문 4.5:1, 12px 미만 포인트색 금지, 입력·버튼 테두리와 포커스 링 3:1(1.4.3, 1.4.11). 합성 배경은 종이색 위에서만 측정.
2. 반투명 기본값 자체가 AA 통과; reduced-transparency는 Chrome/Edge 계열만 지원이라 보조 수단(Safari 미지원, Firefox 플래그).
3. 터치 목표 24px 이상(2.5.8), 모바일 44px 목표. 포커스된 요소가 고정 헤더·하단 탭에 가려지지 않게 `scroll-padding`(2.4.11).
4. 랜드마크: header/nav(label 구분)/main/aside(label), 화면당 `<h1>` 하나, 패널은 `<section aria-labelledby>`와 h2, 제목 단계 건너뛰기 금지. 하단 탭과 상단 메뉴 nav는 aria-label로 구분.
5. 키보드: 논리적 탭 순서, "본문 바로가기" 링크, `/` 단축키는 입력창 포커스 시 비활성, 모든 필터·탭은 키보드로 조작.
6. 색만으로 구분 금지(보도/추정은 텍스트 병기), forced-colors에서 1px 테두리 유지, 기울어진 종이 조각의 글자는 회전 각 2도 이내.
7. prefers-reduced-motion 준수, 동적 갱신(검색 결과·계획표 수치)은 `aria-live="polite"`.
8. 200% 확대·390px에서 가로 스크롤 0(1.4.10).

## (4) 순서 재조정·롤백
- 순서: 토큰·대비 교정(.74→.88, pencil #5F594F) → 터치·포커스 → 홈 패널 5종(블러 없이) → 블러 최대 3곳 추가 → 고교·일정 → 계획표↔요건 → 전역 정리. 위험이 큰 고교 탭 개편(B)은 일정(C)보다 뒤로.
- 단계마다 별도 PR·`hold` 가능, Lighthouse·sitecheck 통과 후 병합. 새 스타일은 `theme.css`와 분리한 `dense.css` 하나에 모아 index.html 링크 한 줄 제거로 되돌림(scrap.css 방식과 동일). 블러는 `@supports`와 단일 변수 `--glass-blur:0`으로 즉시 끔.

근거: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [reduced-transparency 지원](https://web-platform-dx.github.io/web-features-explorer/features/prefers-reduced-transparency), [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency), [블러 성능](https://blog.openreplay.com/creating-blurred-backgrounds-css-backdrop-filter/), [Firefox 스크롤 이슈](https://bug635044.bugzilla.mozilla.org/show_bug.cgi?id=1732817). 블러 3~5개 한도는 경험칙(벤치마크 근거 없음).
