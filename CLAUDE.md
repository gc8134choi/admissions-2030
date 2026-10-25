# 2030학년도 대입 포털 (admissions-2030)

현 중3(2027학년도 입학, 2030학년도 대입) 가정용 개인 포털. 정적 사이트(GitHub Pages), 서버 없음.
화면은 `portal/`, 데이터는 `portal/data/*.json`. 저장소는 **public**이고, 현재 보안상 문제되는 자료는 없다(사용자 확인). 학교 이름·편제표·사진·출처 파일명은 공개 여부를 매번 묻지 않고 다룬다. 로그인 토큰·비밀번호 같은 접속 정보만 올리지 않는다.

> 루트의 `index.html`, `assets/`, `build.mjs`, `vault/`는 예전 암호화 대시보드(제목 2028학년도) 잔재다. 새 작업은 `portal/`에서 한다.

## 용어·규칙
- `entryYear` = 입학학년도(현 중3 = 2027), `examYear` = 대입학년도 = entryYear + 3 = 2030. 섞어 쓰지 않는다.
- 학교는 `schoolId`로만 연결한다. 표시 이름은 `schools.json`의 `name`. 기존 id(`school-pungdeok` 등)는 바꾸지 않고, 새 학교는 `s-001` 형태.
- 정본은 전사본(`content/curriculum/*.json`), DB(`portal/data/`)는 생성물이다. DB를 손으로 고치지 않는다.
- 제도·일정 정보에는 **출처 URL과 상태(확정/보도/추정)** 를 반드시 붙인다. 공식(교육부·평가원·대교협·교육청)과 매체를 구분한다.
- 편제표 값은 AI가 학교 배부 사진에서 옮긴 것이고 전체 대조가 안 됐다(flag 22행만 대조). 화면에 이 한계를 표시한다. 편제표는 개설 "후보"이며 수능 범위는 추정이다.
- 정부의 중장기 대입 개편안은 2027.3 공표 예정이며, 2030학년도 수능 시행 기본계획(평가원)은 시험 해 3월 공고 관행에 따라 2029.3 전후로 추정한다(2027학년도 수능은 2026.3.31 공고). 그 전까지 수능 세부 범위는 확정이 아니다.

## 구조
```
portal/index.html, app.js, menu.js, style.css   화면 (프레임워크 없음, 빌드 없음)
portal/data/*.json                              편제표 DB (build-db.mjs 산출물 복사본)
```
- 메뉴 트리는 `portal/menu.js`, 화면은 `portal/app.js`의 `views`에 있다.
- 학교별 편제표: 첫 화면은 학교별 요약, `?v=compare`는 필터 비교(필터 | 내용 2단 + 사이드 메뉴).
- 데이터 원본·생성기·스키마 문서는 브랜치 `add-curriculum-data`의 `data-src/curriculum-analysis/`(README, HOW-TO-USE, `docs/db-schema.md`)에 있다. 스키마 주 버전은 `2`.

## 확인 방법
```bash
python3 -m http.server 8000     # http://localhost:8000/portal/
```
Playwright는 설치돼 있다(`require('playwright')`). 화면 변경 후 스크린샷과 콘솔 오류를 확인한다.

## 작업 규칙
- `main`에 직접 푸시하지 않는다. 브랜치 → 사용자 확인 후 머지. PR은 요청할 때만 만든다.
- 푸시하면 **클릭 가능한 링크**(브랜치, 커밋, Pages 화면)를 알려준다. Pages 주소: `https://gc8134choi.github.io/admissions-2030/portal/`
- 이 저장소의 클론은 `main`만 추적한다. 푸시 직후 stop hook 경고를 막으려면 `git fetch origin +refs/heads/<브랜치>:refs/remotes/origin/<브랜치>` 를 실행한다.
- 메뉴는 단순하게 유지한다(사용자가 하위 메뉴 증가를 싫어함). 새 기능은 기존 화면의 필터·탭으로 먼저 푼다.

## 현재 상태
- 완료: 메뉴 틀, 학교별 편제표(요약 + 상세 비교), 자료실(출처·갱신 현황), 홈(관심 학교).
- 자리표시(데이터 없음): 일정, 고교 유형·전형, 고교 생활, 대입 제도, 대학·학과 비교, 과목 선택 플래너, 제도 변경 로그.
- 사용자 로컬(`/Users/gc.choi/Claude/2610_대입`)에 미커밋 작업(`assets/pages.js`, `db-views.js`, `tools/release.mjs` 등)이 있다. 아직 가져오지 않았다. 가져올지는 사용자 결정 대기.
- 세션(2026-10-25): PM, 개발(dev/portal), 개발 서브(dev/portal-policy, 조사 결과 화면), 분석(data/verify-curriculum, 학교 배부 사진 대기), 조사(research/materials), 의사결정(질문은 이 세션에서 옵션 다이얼로그로).
- 완료: 학교 칩 비교, 좌측 정렬 레이아웃, 메뉴 구분, 학교 이름(풍덕고·성복고·수지고·홍천고), tools 2.1.0, CI(.github/workflows/ci.yml). 대기: PR #1(data-src를 main에 합치기) 머지, 정책 화면 반영.
- 결정 대기: 작업 브랜치 main 머지와 Pages 복귀, 로컬 미커밋 작업 통합 여부, 정기 감시 알림 채널·주기, `add-curriculum-data` 정리(편제표 원본·스키마가 이 브랜치에만 있어 옮기기 전에는 삭제 금지).

## 다음 할 일 (우선순위)
1. 작업 브랜치를 main에 머지하고 Pages를 main으로 되돌리기(사용자 승인 필요)
2. CI: PR마다 JSON 검증, `build-db.mjs --check` (개발 세션, 브랜치 `dev/portal`)
3. 기존 4개교 편제표 전체 대조(분석 세션, 브랜치 `data/verify-curriculum`, 학교 배부 사진 필요)
4. 일정·제도 변경 로그·대입 제도 자료 조사(조사 세션, 브랜치 `research/materials`, 출처·상태 필수)
5. 정기 감시(제도·일정) — 알림 채널과 주기는 사용자와 합의 후 등록. 결과는 PR로만 올린다.

## 에이전트·세션 역할(설계안)
분석·조사 결과는 모두 이 포털(`portal/`)로 모인다. 데이터를 내는 세션은 `portal/data` 스키마(주 버전 2)에 맞추고 출처·상태를 붙이며, 화면 연결은 개발 세션만 한다.
전사(수동) → 검증(별도 세션, 수동) → 제도 감시(정기, PR만) → 일정 알림(정기) → CI(자동). 감시·알림은 매번 새 세션이므로 맥락은 이 파일과 저장소 파일에서 읽는다.
세션 제목 `입시포털 <개발|데이터|감시|조사>: <주제>`, 태그 `admissions:dev|data|watch|research`. PM 세션은 `입시포털 PM: 전체 진행 관리`, 태그 `admissions:pm`. 초기 설계 세션은 `입시포털 TF: 킥오프`, 태그 `admissions:tf`(참고용, 작업 없음).
