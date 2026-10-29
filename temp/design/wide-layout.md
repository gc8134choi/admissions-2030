# 와이드 레이아웃 패턴 (PC 1280~1920px, 2026-10-29)

`portal/scrap.css` 맨 아래 "와이드 레이아웃 패턴" 블록에 있다. 새 화면(설명회 노트, 전형 한눈에 등)은 이 클래스만 쓰면 된다. 새 CSS를 만들기 전에 `grep`으로 이름이 겹치는지 본다.

## 컨테이너
| 클래스 | 용도 |
|---|---|
| `.w-page` | 화면 전체를 감싼다(`#view` 바로 아래). 1100px 미만에서는 1단으로 쌓인다(목록→본문→보조) |
| `.w-page.w-2` | 좌 목록(260~320px) + 본문 |
| `.w-page.w-2r` | 본문 + 우 보조 정보(300~380px) |
| `.w-page.w-3` | 좌 목록 + 본문 + 우 보조 |
| `.w-list`, `.w-aside` | 1100px 이상에서 위쪽에 붙어 따라다니는(sticky) 보조 열. 안쪽이 길면 스스로 스크롤 |
| `.w-cols` | 세로로 긴 조각 목록을 2단 흐름(1280+)으로. 3단은 `.w-cols.w-cols3`(1700+). 조각 높이가 제각각이라 격자처럼 보이지 않는다 |
| `.w-table` | 표 감싸개. `table` 최소 640px, 넘치면 안에서만 가로로 민다 |

## 조각
- `.piece` = 종이 조각(흰 종이+그림자). `.piece.r1`(살짝 왼쪽으로 기움), `.r2`(오른쪽), `.r3`(거의 평평)을 섞어 쓴다. 같은 각도를 반복하지 않는다.
- 균일한 카드 격자, 왼쪽 색 막대, 파스텔 바탕, 알약 배지는 쓰지 않는다. 구분은 종이 조각의 각도·크기·테이프로.

## 글자
- 제목·숫자 강조만 명조(`var(--serif)`)·손글씨(`var(--hand)`). 본문·표·작은 글자는 Pretendard.
- 1280px 이상에서 본문 16px, 1600px 이상 17px. 줄글은 `max-width:62em`(이미 `.ed .ed-b`에 적용).

## 폭
- 본문 최대 폭: 1280px 이상 1360px, 1600px 이상 1640px(`--maxw`). 좌우 여백 `--pad` 56/72px.
- 점검: `python3 tools/pm/sitecheck.py`, `python3 tools/pm/layoutcheck.py`가 390·1280·1440·1920px 네 폭을 본다.

## 쓰는 예
```html
<div class="w-page w-2r">
  <div class="w-body">  <!-- 본문 -->
    <article class="piece r1">…</article>
  </div>
  <aside class="w-aside"><div class="piece r2">…</div></aside>
</div>
```
