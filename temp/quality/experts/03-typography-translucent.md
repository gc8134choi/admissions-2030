# 03 타이포그래피·반투명 접근성 패널 의견

## 1. 조사 요약
- **한글 본문**: 본문 `Pretendard` + `line-height:1.6`, `word-break:keep-all; overflow-wrap:break-word`가 관행이다. keep-all만 쓰면 긴 URL이 넘치므로 overflow-wrap 병기. `text-wrap:balance`는 제목·짧은 문구에만. 공식 수치 근거는 없고 커뮤니티 관행이다. [daleseo](https://daleseo.com/css-text-wrap/), [DEV](https://dev.to/junhee916/my-websites-readability-is-lacking-solved-with-pretendard-font-and-code-line-wrapping-2026-3bmi), [Pretendard](https://github.com/orioncactus/pretendard)
- **WCAG 2.2**: 일반 글자 4.5:1, 큰 글자(24px 또는 굵은 18.66px) 3:1, 비텍스트 3:1(1.4.11). 터치 목표 최소 24px(2.5.8 AA), 44px는 AAA 권장. [W3C](https://www.w3.org/TR/WCAG22/)
- **반투명**: 배경이 비치면 대비가 위치마다 달라지고 블러 20px 이상은 피하라는 권고가 있다. `prefers-reduced-transparency`는 Safari 미지원, Firefox 기본 꺼짐이라 기본값 자체가 대비를 만족해야 한다. 강제 색상 모드에서는 투명이 사라지므로 1px 테두리 필수. [Axess Lab](https://axesslab.com/?p=5111), [buildmvpfast](https://www.buildmvpfast.com/blog/liquid-glass-css-backdrop-filter-recipes-2026), [matuzo](https://matuzo.at/blog/2023/100daysof-day103)
- **표**: Tufte는 지브라 대신 옅은 가는 선을 선호. 지브라 효과는 연구상 결론 없음. 숫자는 `tabular-nums`가 근거가 가장 강한 개선이다. 배경색 채움은 피하는 쪽이 우세. [Tufte](https://www.edwardtufte.com/notebook/zebra-tables-and-lists/), [A List Apart](https://alistapart.com/article/web-typography-tables/)
- 토스 등 한국 포털 공식 수치는 확인하지 못했다(미검증). 아래는 사이트 실측 위주.

## 2. 현재값 실측 (Playwright, 1440/390)
| 요소 | 현재 | 권장 |
|---|---|---|
| `#main` 본문 | 14px/1.5 (body 16px·1.65와 불일치) | 15px/1.6, 모바일 15px 유지 |
| `.row p`, `.hm-list` | 13~14px, 보조색 #6C665B | 14px 이상 |
| `.small`, `.flabel`, `.pst` | 11~13px | 최소 12px, 상태표시 12px |
| `.fchip`, `.chip` | 12px, 높이 33px(PC)/41px(모바일) | 높이 44px(터치 영역) |
| 터치 목표 | 44px 미만 32/46개(PC), 22/46개(모바일) | 모바일 44px 확보, 최소 24px |
| 제목 `.hm-hero-t` | 37px, 자간 -3% | 유지(제목만), 본문 자간 -0.01em → -0.005em |
| 지표 `.g .v` | 54px/행간 0.95, 자간 -6% | 숫자 `tabular-nums` 추가, 자간 -3% |
| 구분선 `--line` | rgba(.18) → 대비 1.44:1 | 구분선 장식용 유지, 입력·버튼 테두리는 3:1 이상 |
| 보조색 pencil/paper | 4.72:1 (경계) | #5F594F로 5.75:1 |

## 3. 반투명 패널 토큰안 (제안: 종이 위에서만 사용, 사진·그림 위 금지)
```css
:root{
  --glass-bg: rgba(251,247,238,.88);   /* 불투명도 하한 .85, 아래로 내리지 않음 */
  --glass-bd: rgba(29,26,22,.32);      /* 패널 경계 2.02:1 장식, 입력용은 .55 */
  --glass-blur: 8px;                   /* 상한 12px */
  --glass-sh: 0 1px 0 rgba(255,255,255,.5) inset, 0 2px 8px rgba(29,26,22,.08);
  --pencil: #5F594F;
}
@media (prefers-color-scheme:dark){:root{
  --glass-bg: rgba(42,36,29,.90);
  --glass-bd: rgba(243,235,220,.42);   /* 3.5:1 */
  --pencil:#B4AA97;
}}
.glass{background:var(--glass-bg);border:1px solid var(--glass-bd)}
@supports (backdrop-filter:blur(1px)){.glass{backdrop-filter:blur(var(--glass-blur)) saturate(1.1);-webkit-backdrop-filter:blur(var(--glass-blur)) saturate(1.1)}}
@media (prefers-reduced-transparency:reduce),(prefers-contrast:more){
  .glass{background:var(--paper2);backdrop-filter:none;-webkit-backdrop-filter:none;border-color:var(--ink)}}
@media (forced-colors:active){.glass{border:1px solid CanvasText}}
```
계산한 대비비(최악 배경 kraft #D9C6A0 위, 불투명도 .88 → 합성색 #F7F1E5):
- 본문 잉크 15.41:1, pencil(#6C665B) 5.06:1, 포인트 #C4310D 4.92:1 통과.
- 같은 .88을 어두운 갈색(#4A3F2E) 위에 올리면 pencil 4.37, 포인트 4.25로 미달 → 패널 아래에는 항상 종이색만 깔 것.
- 불투명도 .55는 pencil 4.39, 포인트 4.27(kraft 위)로 실패, .7은 간신히 통과하나 변동이 커서 비권장.
- 다크 .90: 잉크 10.3~13.1, pencil 4.90~6.76 통과. 다크 포인트 #FF6A45는 .90에서도 밝은 배경 위 3.97이므로 큰 글자·아이콘에만, 본문 링크는 #FF8A70 이상 검토.
- 종이 위 기본: 잉크 14.37, 포인트 4.59(경계, 12px 미만 글자에 쓰지 말 것).

## 4. 고밀도 규칙
- 표·목록: 가는 선(1px) 기본, 지브라 금지(스크랩북 톤에도 맞음), 숫자 열 `font-variant-numeric:tabular-nums` + 오른쪽 정렬, 행 높이 40~44px.
- 줄 길이: 한글 본문 28~38자 이내(`max-width:36em`). 표·목록은 예외.
- 한 화면 정보를 늘리려면 글자 축소가 아니라 열·접기(details)·탭으로 푼다.
- 상태색(보도/추정)은 글자 12px 이상 + 텍스트 병기(색만으로 구분 금지).
