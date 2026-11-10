# 작업 흐름 (2026-11-08 재정리, 사용자 확정 2026-11-01 기반)

## 원칙
- 사용자는 모바일로 짧게 말한다. PM이 받아 분류하고 담당 세션에 나눠 맡기며, 사용자는 결정이 필요한 것만 본다.
- **자율(보고만):** 내용 보완, 버그 수정, 점수 개선, 성능, 접근성, 데이터 갱신, 감시 처리.
- **확인 필요:** 디자인 방향, 메뉴 구조, 화면 구조 대개편. 사용자가 직접 지시한 변경은 그대로 따른다. 그 밖의 구조 제안은 PM이 근거와 함께 묻는다(옵션 박스).
- **보고:** 완료 한 줄(링크) + 변화가 있는 날 요약. 결정이 필요한 것만 옵션 박스. **변화 없는 정기 점검은 보고하지 않는다**(한 줄 '변화 없음'으로 끝낸다).
- 사용자 말과 최신 결정이 문서와 다르면 문서가 틀린 것이다. 같은 날 `CLAUDE.md`의 '사용자 결정'에 날짜와 함께 적고 관련 문서를 맞춘다.

## 한 바퀴
1. **접수**: 사용자 말·스크린샷·평가 결과를 한 줄 요구로 정리(근거 파일 경로 포함).
2. **분류**: 자율/확인 필요, 담당 세션 결정(`CLAUDE.md` 세션 역할). 두 세션이 같은 파일을 만지지 않게 한다.
3. **지시**: 세션별 한 메시지(목표, 사용자 결정 인용, 점검 방법, 보고 형식). 같은 지시를 반복해야 하는 것은 이 문서나 `evaluation/evaluator-guide.md`에 적어 두고 링크만 보낸다.
4. **구현**: 작업 브랜치 → `prs.py ship` → CI → 자동 머지 → 배포. 지시가 겹치면 같은 PR로 묶지 말고 작게 나눈다.
5. **검증(자동)**: 아래 점검 도구. 실패는 담당 세션에 되돌린다.
6. **독립 평가**: `evaluation/rubric.md`로 채점, `scorecard.md`에 기록.
7. **반영**: 평가 결과와 사용자 지적을 1번으로 되돌려 우선순위 큐에 넣는다.

## 평가 운영 (PM 제안 2026-11-08)
- 배포 판정이 최근 3회 평균이므로 평가는 **수정 묶음이 하나 머지된 뒤** 한 번 돈다(A·C, B, D·E 평가자 3명 동시). 같은 코드에 두 번 돌리지 않는다. 큰 구조 변경 직후에는 한 번 더 확인한다.
- 질의·과업·표본은 매번 새로 구성하되 분류와 비중은 직전과 같게 한다. 상세 절차는 `evaluation/evaluator-guide.md`.
- 평가자 결과 파일은 평가가 끝나기 전에 커밋하지 않는다(stop hook의 untracked 경고는 평가 중에는 무시하고, 세 평가가 끝나면 PM이 점수와 함께 한 번에 커밋). 커밋 절차: 파일을 임시 폴더에 복사 → `git fetch origin main` → `git checkout -B pm/<이름> FETCH_HEAD` → 복사해 넣고 scorecard.md에 기록 → 커밋 → `prs.py open`.
- 정기 점검(3시간): `prs.py status`·`merge-ready` 한 번씩, 필요할 때만 세션 상태 확인. 멈춘 세션이 있으면 한 줄로 이어 가라고 보낸다. 하루 한 번 `sitecheck`.

## 점검 도구
`tools/pm/sitecheck.py`(로컬 주소 인자로, 25화면×5폭), `layoutcheck.py`(비교 표 규칙 포함), `density.py`, `fontscan.py`, `skincheck`, `preserve-check`, `codescan`, `check-exposed`, `tools/check-menu-captions.mjs`(브라우저 필요, 수동), `tools/check-screen-names.mjs`(문구 속 '○○ 화면' 이름 대조, CI), `tools/check-location-claims.mjs`(위치 문장 4종을 화면을 열어 확인 + 비교표 학교 조합별 사유 대조, 브라우저 필요, 수동·평가 전 실행), `tools/check-joint-zones.mjs`(공동학군 해석 대조, CI), `tools/check-screen-claims.mjs`(화면 23곳의 '없어요·아직·찾지 못했어요' 문장 전수 대조, 브라우저·로컬 서버 필요, 수동·평가 전 실행), CI 자동: `check-topic-claims`·`check-no-assertions`·`check-school-aliases`·`check-event-dates`, `research/tools/check-counts/check_counts.py`, 각 `tools/build-*.mjs --check`(`build-db`는 이 환경에서 `content/curriculum`이 없어 실패하는 것이 정상). 평가에서 Lighthouse 절대 점수는 샌드박스·동시 실행의 영향이 커서 직전 커밋과의 상대 비교로만 본다. 추가 점검(2026-11-10): `tools/check-search-links.mjs`(검색 안내 문구가 가리키는 링크를 실제로 열어 문장 속 값 낱말이 도착 화면에 있는지, 브라우저 필요, 수동·평가 전), `tools/check-search-rows.mjs`(정책 행 제목·본문 첫머리로 검색해 요약 속 값이 도착 화면에 있는지, 안내가 값 있는 화면에 붙었는지 반대 방향까지), `tools/check-date-words.mjs`(코드 안 연도·시한 문구를 정책 데이터와 대조), `tools/check-hl-cls.mjs`·`check-load-cls.mjs`·`check-req-state.mjs`·`check-home-events.mjs`(브라우저 필요, 수동).

## 데이터 원칙
- 새로 손댄 데이터는 오류가 잘 난다(24~37차 반복): 원문 장·쪽을 같이 기록하고(인쇄쪽/PDF쪽 구분), 새 값은 두 번째 판독으로 대조하며 `research/reverify-log.md`에 남긴다. 개수·날짜가 문구에 박혀 있으면 빌더가 세어서 만든다.
- 지시할 때 평가자 지적에는 원문 위치(파일·행·쪽)를 같이 넘긴다.
- 사용자 제공 자료(status material)는 '원문 미확인'으로 표기하지 않는다. 그 밖의 항목은 확인 전까지 상태를 유지한다.

## 함께 보기(피드백 수집)
사용자가 "나중에"로 미뤘다. 사용자가 원하면 화면 5개 안팎을 같이 보며 `evaluation/feedback.md`에 `날짜 | 화면 | 반응 | 한마디 | 분류 | 담당 | 링크` 한 줄씩 기록한다.

## changes.json 충돌 규칙 (2026-11-02)
`portal/data/changes.json`과 `tools/state/changes-state.json`은 생성물이라 충돌이 나면 `origin/main`의 두 파일을 받고 `node tools/build-changes.mjs`로 다시 생성한다. 손으로 합치지 않는다. 데이터를 바꾼 PR만 변경 기록을 남기고 문구·스타일 PR은 남기지 않는다. 같은 방식으로 `portal/schedule.ics`는 일정 데이터를 바꾼 PR에서 `build-ics`로 다시 만든다(CI 검사 대상).
