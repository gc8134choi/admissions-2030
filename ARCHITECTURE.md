# 데이터·정보 아키텍처 설계 (A안)

작성 2026-10-25 · 대상: 예나(입학 2027·대입 2030학년도)와 예은(입학 2030·대입 2033학년도) · 구현은 하지 않았고 `portal/`·`portal/data`는 읽기만 했다. 스키마 초안은 `schema/*.schema.json`, 저장 방식 대안은 `temp/options/data-architecture.md`.

## 0. 핵심 요약

1. 지금 포털은 "읽는 화면"이고, 부모가 3년 동안 필요한 것은 "오늘 할 일 + 학교 선택 + 대학 요건과의 대조"다. 화면보다 **엔티티 분리**가 먼저다.
2. 현재 구조의 약점 3가지: (a) 일정이 `policy.json` 안 `events[]`에 섞여 있고 날짜가 `tools/build-policy.mjs`의 `EVENTS` 상수에 하드코딩, (b) 과목 식별자 `subjectKey`가 이름에서 파생(이름·표기가 바뀌면 깨짐), (c) 대학 요강·내신 산출·수능 체제 버전이 구조화될 자리가 없음.
3. 핵심 설계는 **과목 마스터(subjects, 안정 코드 `sj-NNNN`) -> 학교 개설(offerings) -> 대학 요강(admission_rules)** 의 3단 연결이다. 요강의 "필수·권장 과목"을 `subjectId` 묶음(OR)로 구조화하면 "이 학교 편제표로 이 모집단위 권장과목을 몇 개 충족하나"가 생성기에서 계산된다.
4. 수능 체제(`csat_regimes`)와 내신 산출(`grading_rules`)은 **시점별 버전**으로 둔다. 2027.3 정부 개편안 공표 전까지 2030 적용은 `estimated`로 고정한다.
5. 한 명 vs 두 명은 **A안**: 데이터는 학습자 N명(`learners[]`) + 행의 연도/learner 관련성 규칙, UI는 기본 한 명(예나) + 예은은 보조 줄·토글, "한 명만 보기" 설정. 완전 분리(B)나 프로필 없음(C)보다 마이그레이션이 작고 되돌리기 쉽다.
6. 정본은 전사본·조사 초안, DB는 생성물이라는 원칙은 그대로. 스키마 주 버전 **2 -> 3**, 3.x 동안 v2 필드를 유지(하위 호환), `subjectKey`는 v4에서 제거.
7. 개인 정보 경계: 이름은 허용, 출생연도·사진·메모·할 일은 **브라우저 저장만**(공개 저장소 금지). CI가 검사한다.

## 1. 여정과 정보 수요

예나 = 중3 -> 고입(2026.12 후기 원서접수) -> 고1 2027.3 -> 대입 2030학년도. 예은 = 초6 -> 중입(배정) -> 고입 2029.12 무렵 -> 고1 2030.3 -> 대입 2033학년도. 아래 표는 단계별 부모의 수요이고, 마지막 열이 데이터 엔티티다.

| 단계 | 부모가 알아야 할 것 | 형태 | 엔티티 |
|---|---|---|---|
| 초졸·중입 (예은) | 졸업 2026.12.31(사용자 제공), 중학교 배정 방식·일정, 배정 결과 | 일정, 링크 | events(life), links, schools(mid) |
| 중학 | 내신 반영 시작 시점, 학교생활 기록, 영재·특목 준비 여부 | 정보, 할 일 | policies, roadmap |
| 고입 (예나 지금) | 유형별 전형(일반·과학·영재·자사·외·국제·특성화·마이스터) 일정, 지망 작성, 평준화 배정, 후기 원서 2026.12.4~10(경기, 확정), 배정 발표 2027.1.22 | 일정, 문서 | events(stage=hs-entry, region, audience), policies, documents(가정통신문) |
| 졸업 (예나) | 중졸 2026.12.18(사용자 제공), 입학·개학 2027.3(추정) | D-day, 사진 슬롯 | events(life), user-local(사진) |
| 고1 | 공통과목 중심(4개교 모두 1학년 학기당 29학점 전부 학교 지정), 2학년 선택과목 설계 시작 | 과목, 계획 | subjects, offerings, planner(user-local) |
| 고2·고3 | 선택과목 이수, 학교별 3학년 선택 비중(홍천 3-1 선택 24, 수지·홍천 3-2 선택 27), 내신 5등급·융합선택 절대평가 | 과목, 규칙 | offerings, grading_rules |
| 생기부·모의고사 | 학기별 세특·창체 기록 점검, 모의고사 일정 | 할 일, 일정 | roadmap, events(stage=hs1~3), user-local |
| 수능·수시·정시 | 수능 2029.11.15(추정, 예은 2032.11.18 추정), 수시 원서 2029.9 중하순(추정), 정시 | D-day, 일정 | events(csat, susi, jeongsi), csat_regimes |
| 대학·학과 선택 | 모집단위별 필수·권장 과목, 교과 반영 방법, 수능 최저 | 규칙, 비교 | admission_rules, matches(생성물) |
| 상시 | 제도 변경 소식, 믿을 수 있는 링크, 학교에서 받은 자료 | 로그, 링크, 파일 | policies(변경 로그), links, watchlist, documents |

D-day 카드는 `events`를 읽고(가장 가까운 미래 일정 + 학습자의 `lifeEvents`), 사진 슬롯은 브라우저 저장(`user-local`)에서 읽는다. 사진은 저장소에 올리지 않는다.

## 2. 엔티티와 ID 규칙

| 엔티티 | 파일(목표) | id 규칙 | 정본 | 비고 |
|---|---|---|---|---|
| learners | `learners.json` | `A`,`B` 유지, 추가는 `lrn-03` | 손으로 관리(설정) | `enabled`, `primary`, `entryYear`, `examYear`(=entry+3, CI 검증), `lifeEvents`. 이름 허용, 출생연도 금지 |
| schools | `schools.json` | 기존 `school-*` 불변, 신규 `s-001`~ (대학·중학 포함) | `content/data/schools.json` | `level`: elem/mid/hs/univ, 관심 학습자 `learnerIds` |
| curricula | `curricula.json` | `curriculum-<slug>-<entryYear>` | 전사본 | 현행 유지 |
| subjects | `subjects.json` | `sj-0001`~ 불변·재사용 금지, `legacyKey`=현 subjectKey | `tools/subjects-master.json`(손 관리) | 2015/2022 대응, 동의어 |
| offerings | `offerings.json` | `<curriculumId>#<term>#<r|e|o><nn>` | 전사본에서 생성 | `subjectId` 추가 |
| groups | `groups.json` | `<curriculumId>#<라벨>` | 전사본에서 생성 | 택n, 현행 유지 |
| events | `events.json` | `ev-<slug>` | `research/data/events-draft.json` + 학습자 lifeEvents | 신규. 확정은 표시 안 함, 추정·보도만 표시 |
| policies | `policy.json` | `adm-01`, `sch-12`, `log-01` 등 현행 유지 | `research/data/policy-draft.json` | `events[]` 제거 -> `eventIds` |
| csat_regimes, grading_rules | `rules.json` | `csat-2028`, `gr-2028` | 조사 초안 | 시점별 버전 |
| admission_rules | `admission-rules.json` | `ar-<학년도>-<slug>` | `research/data/admission-draft.json` | 신규 |
| matches | `matches.json` | 생성물 | 생성기 | 학교×모집단위 충족표 |
| links | `links.json` | `lnk-NN` | `links-draft.json` | 출처 모아보기와 별개로 "바로가기" |
| watchlist | `research/data/watchlist.json` | `w-*` | 조사 세션 | 포털에 싣지 않음 |
| roadmap | `roadmap.json` | `rm-a-NN`, `rm-b-NN` -> `rm-<learner>-NN` | `roadmap-draft.json` | learner별 시기표 |
| documents | `files.json` | 현행(slug) | 사람이 올림 | 학교 배부 자료. 개인 서류 금지 |
| user-local | 브라우저 | `portal.*` 키 | 사용자 | 할 일, 사진, 메모, 계획표, 선택 학습자 |

**공통 필드 규칙**: 제도·일정·요강 행은 `status`(확정/보도/추정), `sources[]`(name·url·kind), `checkedAt` 필수. 공식(official)과 매체(media)를 `kind`로 구분. 학교는 `schoolId`로만 연결한다.

**일정(events)의 학습자 관련성 규칙**: (1) `learnerIds`가 있으면 그 학습자만, (2) 없으면 `entryYear` 또는 `examYear`가 학습자와 같으면 해당 학습자, (3) 연도도 없으면 공통. 현행 `portal/profile.js`의 `rowProfiles`와 동일한 규칙이므로 코드 변경이 작다.

## 3. 편제표 <-> 대학 요강 분석 구조 (핵심)

### 3-1. 연결 모델

```
subjects (sj-0001 미적분Ⅰ) <--- offerings (suji, 2-2, 필수, 4학점)
        ^                                  
        |  requirements[].subjectIds
admission_rules (대학 s-xxx, 모집단위, 학년도, 전형)
        |
        v
matches (학교×모집단위: 필수 충족 여부, 권장 n/m, 못 채우는 과목) <- 생성기 계산
```

### 3-2. 과목 마스터(subjects)

현 `subjects.json`(136개 과목, `subjectKey`=이름에서 공백 제거)을 승격한다.

| 필드 | 내용 | 현재 대응 |
|---|---|---|
| `subjectId` | `sj-0001` 안정 코드(불변) | 신규 |
| `legacyKey`, `name`, `aliases` | 표기 변형 흡수(공백·로마숫자·"기술가정") | subjectKey, aliases |
| `area` / `areaGroup` | 교과군 10종 / 영역 7개(국어·수학·영어·한국사·사회·과학·기타) | area(10종) -> 7개는 파생 |
| `kind` | 공통/일반/진로/융합/전문교과/학교지정 | kindsPrinted(학교별 인쇄 값) |
| `defaultCredits` | 교육청 안내 기본 4학점(3~5 편성 가능) | subject-info.credit |
| `rev` | 2022 개정 여부, `predecessors2015`(예: 미적분Ⅰ <- 2015 수학Ⅱ) | subject-info.old2015(231개 중 9개만 채워짐) |
| `csat[]` | 수능 체제별 범위(in/base/out/none)와 신뢰도 | csatScope, csatConfidence |

`kind`는 학교마다 인쇄 표기가 다를 수 있으므로(풍덕은 융합만 인쇄) 마스터에는 **표준 유형**, `offerings`에는 학교별 인쇄 값(`kindStatus`)을 둔다. 마스터의 `subject-info.json`(231개, 교육청 안내 원문)은 `subjectId`를 붙여 `summary`·`majorsHint`·`type`을 흡수한다. 현재 136개와 231개의 이름이 일치하지 않는 경우가 있어(공백·표기) 매칭 리뷰가 1회 필요하다.

### 3-3. 학교 개설(offerings)

v2의 평탄 행에 `subjectId`, `availability`(편제표는 `candidate` — 현행 "개설 후보" 원칙), `openYears`, `provenance`(원본 파일·판독자·검증일)를 더한다. 택n 제약은 현행 `groups`(pick·size·creditsEach)를 그대로 쓰고 offering의 `groupId`로 연결한다. 학교 밖 과목(`outside`)은 교내 학점에 불포함이라는 규칙을 유지한다.

### 3-4. 대학 요강(admission_rules)

| 필드 | 설명 |
|---|---|
| `universityId`, `unitName`, `admissionYear`, `track` | 대학(`s-NNN`), 모집단위, 대입학년도, 전형 유형 |
| `requirements[]` | `{subjectIds[](OR), minCount, strength: required/recommended/advised}` |
| `gradeReflection` | 반영 교과·과목 수·등급 산출 방법·진로선택 과목 처리 |
| `csatMinimum` | 최저 식 문자열, 필수 응시 영역, 지정 과목 |
| `announcedAt`, `status`, `sources[]` | 발표일, 확정/보도/추정, 출처 URL(대교협·대학 모집요강) |

조건식 DSL은 쓰지 않고 **구조화 필드(A)** 로 시작한다. 이유: 요강의 권장과목은 거의 "과목 묶음 중 n개" 형태라 `requirements[]`로 충분하고, 사람 눈으로 검수하기 쉽다. 복잡한 경우만 `requirements[].expr`에 `all/any/atLeast(n, [...])` 식을 문자열로 넣는 확장 자리를 열어 둔다.

### 3-5. 판정(matches, 생성물)

```
for each (school, entryYear) curriculum, for each rule:
  offered  = {offerings.subjectId}  (slot: required 는 확정 이수, elective 는 "선택 가능")
  per requirement:  met = |offered ∩ subjectIds| >= minCount
  result: { required: 충족/미충족, recommended: n/m,
            reachable: 학생이 선택해야만 얻는 과목, blockedBy: 같은 택n 묶음 충돌 }
```

`reachable`·`blockedBy`가 부모에게 가장 쓸모 있는 값이다. 선택 과목은 같은 묶음에서 pick 개수 제한이 있으므로 "모두 담을 수 있나"는 묶음별 pick 제약을 반영해 계산한다. 편제표는 후보이므로 모든 결과에 `candidate` 한계를 붙인다(편제표 화면이 아닌 자료실 갱신 현황에만 둔다는 사용자 결정을 따르되, 이 분석 화면은 새 화면이므로 별도 판단 필요, 열린 질문 Q3).

### 3-6. 내신·수능 버전

- `grading_rules`: `gr-2028`은 석차 5등급 상대평가, 사회·과학 융합선택 9개 과목은 석차등급 미기재·절대평가(현재 `adm-04`, 확정). 2030학년도 대입에 그대로 적용되는지는 정부 중장기 개편안(2027.3 공표 예정) 전까지 estimated.
- `csat_regimes`: `csat-2028`은 통합형 수능(국어·수학·탐구 선택과목 폐지, 통합사회·통합과학 출제, 심화수학 제외; `adm-02`·`adm-03`, 확정). 2029~2030 적용은 가정(현 `facets.csat.applicability=assumed`). 2031~2033은 `csat-2033`(미정)로 비워 두고 개편안 공표 후 채운다. 과목의 `csat[]`가 `regimeId`로 이 버전을 가리킨다.
- 시행 기본계획 공고(2030학년도분 2029.3 전후 추정) 전에는 세부 범위가 확정이 아니라는 문구를 `csat_regimes[].status`로 구조화한다.

### 3-7. 마이그레이션 (v2 -> v3)

| 단계 | 작업 | 호환 |
|---|---|---|
| 1 | `subjects-master.json` 신설: 136개 과목에 `sj-NNNN` 부여(기존 순서 고정), `legacyKey` 보존 | v2 변경 없음 |
| 2 | build-db가 offerings에 `subjectId` 추가 출력, `index.json` version 3.0.0 | v2 필드 모두 유지, 화면은 무변경 |
| 3 | events 분리: build-policy의 EVENTS·policy `events[]` -> `events.json`, policy는 `eventIds` | 화면은 한 릴리스 동안 policy.events도 읽음 |
| 4 | `rules.json`(csat_regimes, grading_rules) 생성, `facets.csat`를 여기서 파생 | facets 형태 유지 |
| 5 | admission_rules 초안(관심 대학 1~3곳) + `matches.json` | 신규 화면에서만 사용 |
| v4 | `subjectKey` 제거, policy `events[]` 제거 | 주 버전 4 변경 이력 기재 |

**CI 규칙**: 정본에서 재생성한 결과와 `portal/data`가 같은지(`--check`, 현행), JSON Schema 검증, 참조 무결성(schoolId·subjectId·eventIds·regimeId), id 중복, `subjectId` 재사용 금지(이전 목록과 비교), 제도·일정·요강 행의 `status`·`sources`·`checkedAt` 필수, `examYear = entryYear + 3`, 출생연도 패턴·개인 사진 확장자 금지(portal/ 아래 이미지는 허용 목록만).

## 4. 파일 레이아웃과 파이프라인

| 구분 | 현재 | 목표 |
|---|---|---|
| 정본(사람·세션) | `data-src/.../content/curriculum/*.json`, `content/data/schools.json`, `research/data/*-draft.json` | + `tools/subjects-master.json`, `research/data/events-draft.json`, `admission-draft.json` |
| 생성기 | `tools/build-db.mjs`, `tools/build-policy.mjs`, `db-rules.json` | + `build-events.mjs`, `build-rules.mjs`, `match-rules.mjs`, 공통 `validate.mjs`(Schema·참조) |
| 스키마 | 없음(문서 db-schema.md) | `schema/*.schema.json`, 주 버전은 `index.json`과 일치 |
| portal/data | curricula, facets, files, flags, groups, image-credits, index, offerings, policy, profiles, school-notes, schools, subject-info, subject-matrix, subjects, summary (16개) | learners(=profiles 후속), events, rules, admission-rules, matches, links, roadmap 추가. `subject-info`는 subjects에 흡수(v4) |
| 변경 로그 | db-schema.md §9 | `CHANGELOG-data.md` + `index.json.changes[]` |

**흐름**: 감시 봇(`research/tools/watch.mjs`, 13개 항목: list-titles 7·page-hash 6) -> 변경 감지 -> 조사 세션이 `*-draft.json` 수정(상태는 보도/추정, 원문 미확인 표시) -> PR -> CI(생성기 `--check` + 스키마 + 참조) -> PM 머지 -> Pages 배포. 정기 감시는 PR만 올린다(CLAUDE.md).

**쓰기 권한 경계**

| 세션 | 쓸 수 있음 | 쓸 수 없음 |
|---|---|---|
| 분석(`data/*`) | 전사본, subjects-master, db-rules, admission-draft 구조 | portal/ 화면 |
| 조사(`research/*`) | `research/data/*-draft.json`, 링크, 감시 목록 | portal/data 직접 수정 |
| 개발(`dev/*`) | portal/*.js, css, 생성기 호출 연결 | 정본 수정 |
| PM | 설계 문서, 병합 | 정본 값 임의 생성 |

`portal/data`는 어느 세션도 손으로 고치지 않는다(생성기 산출물).

## 5. 화면·메뉴와의 연결

| 화면 | 읽는 엔티티 | 하단 탭 |
|---|---|---|
| 오늘 | events(가까운 일정, D-day), roadmap(이번 시기 할 일), policies(바뀐 소식 1줄), user-local(할 일·사진) | 오늘 |
| 일정 캘린더(+ ics 구독) | events (learner·region·audience 필터). ics는 정적 `calendar-<learner>.ics`를 생성기가 만든다(서버 없이 구독 가능, 확정·보도·추정을 SUMMARY에 표기) | 일정 |
| 학교 비교 | schools, summary, offerings, groups | 학교 |
| 과목 선택 플래너 | subjects, offerings, groups + user-local 계획 | 학교 |
| 대학·학과 요건 매칭 | admission_rules, matches, rules | 학교 (또는 알아두기) |
| 알아두기·바뀐 소식 | policies, csat_regimes, grading_rules | 알아두기 |
| 문서 보관함·바로가기 | files, links, user-local | 내 보관함 |

메뉴는 단순하게 유지한다는 지시에 따라 플래너·요건 매칭은 새 메뉴를 만들지 않고 학교 탭의 필터·탭으로 푼다.

## 6. 한 명 vs 두 명 (A/B/C)

| | A (진행) | B 완전 분리 | C 한 명만 |
|---|---|---|---|
| 데이터 | `learners[]` + 행 연도 규칙 | 학습자별 데이터 복제 | 단일 |
| UI | 기본 예나 + 예은 보조 줄·토글 + 한 명만 보기 | 두 사이트 | 단순 |
| 확장 | 학습자 추가 쉬움 | 중복 유지 비용 | 불가, 재설계 |
| 비용 | 낮음(현 구조 연장) | 높음 | 가장 낮지만 예은 데이터 재작업 |

A의 근거: 제도·수능·대학 요강은 두 아이가 **공유**하는 데이터이고, 달라지는 건 학년도·학교·일정뿐이다. 예은은 지금 학교 데이터가 비어 있어(`schoolIds: []`) 분리할 이유가 없다. 마이그레이션 영향: `profiles.json` -> `learners.json`(필드 `enabled`, `primary` 추가, id A/B 유지), `portal/profile.js`의 `PROFILES`를 하드코딩에서 `learners.json` 로드로 바꾸고 `rowProfiles`는 `learnerIds`를 먼저 보게 확장(기존 연도 규칙 유지). localStorage 키 `portal.profile` 값 호환. "한 명만 보기"는 `enabled=false`와 사용자 설정으로 처리.

## 7. 구현 로드맵

| 단계 | 내용 | 담당 | 산출물 | 검증 |
|---|---|---|---|---|
| 1 | subjects-master + `subjectId`, validate.mjs(Schema·참조) CI | 분석 | subjects-master.json, 스키마, CI | `build-db --check`, 136개 매핑 100%, 중복 0 |
| 2 | events 분리 + learners.json, ics 생성 | 분석+개발 | events.json, learners.json, calendar-*.ics | 기존 일정 건수와 일치, 오늘 화면 스크린샷 |
| 3 | rules.json(수능 체제·내신 산출) | 조사 -> 분석 | rules.json, 변경 로그 | 출처·상태 필수 검사 |
| 4 | 관심 대학 1~3곳 admission_rules + matches | 조사+분석 | admission-rules.json, matches.json | 요강 원문과 사용자 대조 |
| 5 | 요건 매칭·플래너 화면 | 개발 | 학교 탭 필터·탭 | 4개교 회귀, 콘솔 오류 0 |

**위험**: (1) 정부 개편안(2027.3)으로 수능·내신 규칙이 바뀌면 규칙 버전 재작성 필요, (2) 대학 요강은 발표 시점(대교협 8월 기본사항, 대학 모집요강 이후)이 늦어 현재 입학생(2027) 대상 요강은 **아직 없다** — 선행 학년도 요강을 참고 데이터로 쓰되 `estimated`, (3) 편제표는 개설 후보라 매칭 결과를 과신하기 쉬움, (4) 과목 id 재사용·분할 오류.
**열린 질문**: Q1 관심 대학·학과 목록을 사용자가 정해 주는가? Q2 `subject-info`(교육청 안내) 231개와 136개 과목의 이름 매핑 리뷰 담당? Q3 요건 매칭 화면에 "후보 기준" 안내를 넣어도 되는가(편제표 화면에는 넣지 않는다는 결정과의 관계)? Q4 ics 구독에 추정 일정을 포함할지? Q5 예은의 중학교·학교 배정 데이터는 언제부터 채울지?

## 부록 A. 현재 -> 목표 요약

- `profiles.json`(2명) -> `learners.json`
- `policy.json`(128행, 13개 topic) -> `policy.json`(제도·로그) + `events.json` + `rules.json`
- `subjects.json`/`subject-info.json` -> `subjects.json`(sj 코드) 통합
- 신규: `admission-rules.json`, `matches.json`, `links.json`, `roadmap.json`

## 부록 B. 실제 수치 근거 (portal/data 실측)
편제표 4개교, 과목 136개, offerings 388행, groups 41개, flags 12건, 정책 128행(확정 52·보도 24·추정 11), 조사 로드맵 초안 23행(예나 15, 예은 8), 링크 초안 22개, 감시 항목 13개.
