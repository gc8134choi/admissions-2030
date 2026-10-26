# 편제표 통합 DB 스키마

대상: 대시보드 개발자([하위1]). 이 문서만 보고 조회·필터·검색·비교 화면과 암호화 빌드 연동을 만들 수 있도록 작성했습니다.
스키마 버전 **`2.1.0`** · 기준일 2026-10-25 · 생성기 `tools/build-db.mjs` · 규칙 `tools/db-rules.json`, 이미지 `content/data/display-images.json`

> v1.0.0(첫 공유본)에서 필드 이름이 바뀌었습니다(§9 변경 이력). `db.json` 통합본과 `derived/` 폴더는 없어졌습니다.

---

## 1. 출력 계약

```
content/curriculum/*.json   원본(전사본, 읽기 전용)  ─┐
content/data/schools.json   학교 엔티티               ├─ node tools/build-db.mjs ─▶ content/db/
tools/db-rules.json         분류 규칙                ─┤
content/data/display-images.json  화면용 이미지(비공개) ─┘
```

```bash
node tools/build-db.mjs            # content/db/ 재생성 (검증 오류가 있으면 파일은 쓰고 종료코드 1)
node tools/build-db.mjs --check    # 파일을 쓰지 않고 검증만
```

- `content/db/`는 **전부 생성물**입니다. 직접 고치지 마세요(고칠 곳은 전사본·`schools.json`·`tools/db-rules.json`).
- **쓰기 방식(원자적 교체)**: 빌드는 임시 폴더(`content/.db-build-*`)에 전부 만들고 **오류가 하나도 없을 때만** `content/db/`를 통째로 교체합니다. **오류가 있으면 `content/db/`를 건드리지 않고(이전 DB 유지) 종료코드 1**입니다. `--check`는 어떤 경우에도 쓰지 않습니다. 경고(warn)는 교체를 막지 않습니다.
- **정규화 엔티티**(schools, subjects, groups, curricula, flags)가 기준 데이터이고, 화면용 평탄화 표 **`offerings`는 항상 거기서 파생**됩니다(어긋날 수 없음).
- 파일은 모두 `content/db/` **바로 아래** `*.json`입니다(빌드의 `db/*.json` 글롭 대상). 빌드·검증용 파일은 하위 폴더 `_internal/`에 있어 글롭에 포함되지 않습니다.
- **`index.json`이 계약입니다**: `{ version, generatedAt, entryYears, counts, files[], totalBytes, coreBytes }`. **대시보드 빌드(`build.mjs`)는 이 계약을 확인합니다**: `index.json`의 `version` 주 버전이 지원하는 값(현재 `2`)이 아니면 빌드를 중단하고, `files[]`에 적힌 파일이 데이터에 모두 실려 있지 않으면 중단합니다. 데이터는 섹션 설정(`site.json`: `type:"db", data:["db/*.json"], load:"auto"`)의 글롭으로 `content/db/*.json`을 모두 읽어 `{"db/index", "db/offerings", …}` 형태로 묶습니다(합계 512KB 이하면 inline, 넘으면 파일별 lazy). 즉 **읽는 파일 범위는 글롭이 정하고, `files[]`는 누락 검사에 쓰입니다**(`files[]`에 없는 파일이 `db/` 바로 아래에 있어도 실리므로 `_internal/` 같은 하위 폴더에만 두세요). 주 버전이 바뀌는 변경(필드 이름 변경 등)은 `docs/db-schema.md` §9 변경 이력에 적습니다.
- JSON은 **줄바꿈·들여쓰기 없는 압축 형식**이고, 값이 `null`인 키는 **생략**됩니다(없으면 null로 간주).
- 통합본(`db.json`)은 없습니다. 같은 내용을 두 번 싣지 않으려고 제거했습니다.

### 파일 목록 (현재 4개교 · 합계 약 470KB)

`use`: `core`=먼저 읽기(작음) / `lazy`=화면에서 필요할 때 / `optional`=검수·분석 화면에서만.

| 파일 | use | 용도 | 행 | 크기 |
|---|---|---|---|---|
| `summary.json` | core | 학교(편제표) 1행 비교표. 학기·영역·구분 요약 포함 | 4 | 7KB |
| `schools.json` | core | 학교 엔티티 | 4 | 5KB |
| `curricula.json` | core | 편제표 헤더(선언 학점, 창체; `displayImage`는 현재 없음) | 4 | 6KB |
| `facets.json` | core | 필터 UI용 값 목록·개수 | 1(객체) | 1KB |
| `subjects.json` | lazy | 정규화된 과목 마스터 | 136 | 35KB |
| `groups.json` | lazy | 택n 묶음 | 41 | 20KB |
| `flags.json` | lazy | 판독 확인 필요(refs로 연결) | 12 | 4KB |
| `offerings.json` | lazy | **핵심 사실 표**: 학교×학기×과목 1행 | 388 | 184KB |
| `subject-matrix.json` | lazy | 과목×학교 비교 매트릭스 | 136 | 64KB |
| `search-index.json` | lazy | 과목 검색 인덱스 | 136 | 35KB |
| `area-by-term.json` | optional | 학교×학기×교과군 지정 학점·후보 수 | – | 28KB |
| `review-queue.json` | optional | 사람이 확인할 항목 모음 | – | 14KB |
| `events.json` | core | 일정(고입·대입·수능), 홈 "지금 할 일"·타임라인(§11) | 10 | 5KB |
| `sources.json` | core | 출처 목록·오래된 데이터 경고(§11) | 9 | 4KB |
| `policy.json` | lazy | 제도 변경 로그(§11) | 6 | 3KB |
| `high-school-types.json` | lazy | 고교 유형별 전형 시기·방식(§11) | 6 | 3KB |
| `admission-system.json` | lazy | 대입 제도 요약 표(§11) | 5 | 3KB |
| `index.json` | – | 계약(위 목록과 크기) | – | 3KB |
| `_internal/validation.json`, `_internal/build-report.json` | 제외 | 검증 결과, 입력 해시·개수 | – | 글롭 제외 |

학교가 30곳이 되면 `offerings`는 대략 1.3MB 정도로 예상됩니다(행당 약 470바이트). 필요하면 `index.json`의 `files[]`에 파일이 추가·분할되어도 같은 방식으로 읽으면 됩니다(이름을 하드코딩하지 말고 `files[]`를 순회).

**권장 로딩 순서**: `summary`(학교 비교표) → `schools`, `curricula`, `facets` → 화면 진입 시 `offerings`, `groups`, `subjects`, `flags` → 검색 화면에서 `search-index` → 매트릭스 화면에서 `subject-matrix`.

---

## 2. 용어·ID 규칙

| 용어 | 뜻 |
|---|---|
| `entryYear` | **입학학년도**(고1 입학 해). 현 중3 = 2027 |
| `examYear` | 대입학년도 = `entryYear + 3` (현 중3 = 2030). DB에 저장하지 않고 화면에서 계산 |
| `term` | `"1-1"` ~ `"3-2"`. `grade`(1~3), `semester`(1~2)도 제공 |
| `slot` | 이수 방식: `required`(학교 지정) / `elective`(택n 묶음의 후보) / `outside`(학교 밖 과목, **교내 합계에 불포함**) |
| 택n 묶음 | 학기마다 후보 중 `pick`개를 학생이 고르는 묶음(`groups`) |

| ID | 형식 | 예 |
|---|---|---|
| `schoolId` | **기존**: `school-<로마자slug>`(유지) / **새 학교**: `s-NNN`(3자리 이상 연번) | `school-suji`, `s-001` |
| curriculum `id` | `curriculum-<slug>-<entryYear>` | `curriculum-suji-2027` |
| group `id` | `<curriculumId>#<묶음라벨>` | `curriculum-suji-2027#2-1-A` |
| offering `id` | `<curriculumId>#<term>#<r\|e\|o><nn>` | `curriculum-suji-2027#2-1#e03` |
| `subjectKey` | 과목명에서 **모든 공백 제거**. 복합 과목은 구성 과목 키를 가나다순으로 `\|`로 연결 | `스포츠생활1`, `미술\|음악` |
| flag `id` | `flag-<curriculumId>-<nn>` | `flag-curriculum-suji-2027-01` |

**학교 id 규칙(연결 키)**:
- **학교는 id(`schoolId`)로만 연결합니다.** `schools.json`, 편제표 전사본(`curriculum/*.json`), 갤러리 항목(`curriculum.json`의 `items[]`), 이후 일정·전형·입결 레코드가 모두 같은 `schoolId`를 가집니다. 학교 이름 문자열로 연결하지 않습니다.
- **기존 4개교 id는 그대로 유지**합니다(결정 완료).
- **새 학교는 비식별 id `s-NNN`**(예: `s-001`, 등록 순서 연번, 3자리 이상, 재사용 금지)을 씁니다. 이름·지역·약어를 id에 넣지 않습니다. id는 파일 이름·로그·코드에 나오므로 이름이 바뀌어도 깨지지 않게 하기 위함입니다(학교 이름 공개는 루트 CLAUDE.md 기준 허용). id↔이름 대응은 `schools.json`에 둡니다.
- 형식 정규식: `^(school-[a-z0-9]+(-[a-z0-9]+)*|s-\d{3,})$`(기존 slug형은 호환용으로만 허용).
- **빌드가 강제**(`build-db.mjs`): 편제표의 `schoolId`가 `schools.json`에 없으면 **오류**, 같은 id인데 이름이 다르면 **오류**, 갤러리 항목의 `schoolId`가 없는 학교를 가리키면 **오류**, 갤러리 항목에 `schoolId`가 없고 이름만 있으면 **경고**(이름이 `schools.json`과 정확히 같을 때만 임시 허용; 다르면 오류). 갤러리 `items[]`에는 `schoolId`를 추가해야 합니다(형식 변경은 [하위1] 영역 — 마스터 경유).

**id 불변 규칙**: `schoolId`·파일 이름(slug)은 한 번 정하면 **학교 이름이 바뀌어도 바꾸지 않습니다**(다른 파일·vault 참조가 깨지는 것을 막기 위함). 예: 학교 이름은 **용인홍천고등학교**이지만 id는 옛 오타 표기에서 유래한 `school-yonginheungcheon`, 파일은 `yonginheungcheon.json`을 유지합니다. **표시 이름은 항상 `schools[].name`(또는 `summary.schoolName`)을 쓰세요.** 편제표 원본의 `school` 문자열은 DB에 싣지 않습니다.

---

## 3. 표 정의

타입의 `?`는 값이 없으면 키가 생략됨을 뜻합니다.

### 3-1. `summary.json` — 학교(편제표) 1행

대시보드 학교 비교표용. `id`는 curriculumId(학교당 1행, 같은 학교의 다른 입학학년도가 생기면 행이 늘어남).

| 필드 | 타입 | 설명 |
|---|---|---|
| `id`, `curriculumId`, `schoolId`, `schoolName`, `entryYear` | | |
| `schoolType?`, `founding?`, `region?`, `assignment?`, `gender?` | string | `schools.json`에서 가져온 값(미확인이면 "미확인") |
| `displayImage?` | string | 화면용 편제표 사진 경로(§6). **현재 없음**(이미지 꺼짐) |
| `creditsSubject` | number | **교과 학점 합계(계산)** = 지정 + Σ(pick×creditsEach), 학교 밖 제외 |
| `creditsCreative?`, `creditsTotal` | number | 창체 학점(선언), 총 이수학점(선언, 없으면 교과+창체) |
| `creditsRequired`, `creditsElective`, `creditsOutside` | number | 지정 / 선택 / 학교 밖 학점 |
| `requiredCount` | int | **지정 과목 수**(`slot=required` 행 수; 복합 과목은 1개) |
| `groupCount`, `pickTotal` | int | 택n 묶음 수, 선택해야 하는 과목 수의 합 |
| `candidateSubjects` | int | 선택 후보 과목 수(**중복 제거**) |
| `breadth?` | number | **선택 폭** = `candidateSubjects ÷ pickTotal` (클수록 선택지가 넓음) |
| `firstElectiveTerm?` | string | 택n이 처음 나오는 학기 |
| `creativeHours` | int | 창체 시간(학기 합) |
| `confidence` | enum | `unverified`/`reported`/`verified` |
| `flagsTotal`, `flagsOpen`, `flagsChecked`, `flagsUnlinked`, `kindMissingRows`, `validationErrors` | int | 품질 지표(`flagsOpen`/`flagsChecked`/`flagsUnlinked`은 §5-1 적용 후 값) |
| **`reviewCount`** | int | **확인 필요 건수** = `flagsOpen`(열린 flag) + 검증 오류 + 검증 경고(연결 안 된 flag 경고는 중복이라 제외) |
| `byTerm{term}` | object | `{required, elective, total, outside, groupCount}` 학점 |
| `byArea{교과군}` | object | `{required(지정 학점), candidates(선택 후보 과목 종류 수)}` |
| `byCsat{수능영역}` | object | 수능 영역별 `{requiredIn, requiredBase, requiredOut(학교지정 학점을 범위별로), candidatesIn(출제 범위 선택 후보 과목 수), candidatesAll(그 교과의 선택 후보 전체)}`. 키: `국어/수학/영어/한국사/통사/통과/제2외` |
| `byKind{구분}` | object | 지정 과목 학점. 키: `공통/일반/진로/융합/미표기/추정:일반` 등 |
| `electivePools` | object | `poolType`별 묶음 수 |

### 3-2. `schools.json`

`content/data/schools.json`의 학교 레코드 + `curriculumIds[]`.

| 필드 | 설명 |
|---|---|
| `id`, `name`, `schoolType`, `founding`, `region`, `address?`, `gender?`, `assignment?` | 값을 모르면 `"미확인"` |
| `curriculumIds` | 이 학교의 편제표 id |
| `_meta.source[]` | `{name, url?, kind(official/media/self), retrieved}` |
| `_meta.confidence` | 항목 **전체**의 신뢰도 |
| **`_meta.fieldConfidence?`** | `{필드명: 신뢰도}` — **필드 단위 신뢰도**. 있으면 해당 필드는 이 값을 우선(예: `{name:"verified", founding:"verified"}` = 이름·설립은 사용자 확인, 나머지는 `_meta.confidence`) |
| `_meta.updated`, `_meta.note` | |

### 3-3. `curricula.json`

| 필드 | 설명 |
|---|---|
| `id`, `schoolId`, `entryYear`, `document?` | |
| `displayImage?` | 화면용 편제표 사진(§6). **현재 꺼짐 — 값 없음**, 켜면 선택 필드로 생김. 원본 경로(`sourceImage`)는 DB에 없음 |
| `kindScheme` | `"printed"` / `"fusion-only"` — 표에 구분 기호를 어디까지 인쇄했는지. `fusion-only`는 융합(♥)만 표시되어 일반/진로 구분 불가 |
| `legend?` | 원본 기호 설명 |
| `declared` | **표에 인쇄된 선언 값**(아래) |
| `creative` | `perTerm[term][활동명]`(시간), `totalHours`, `standardHours?`, `operatedHours?` |
| `validation` | `{errors, warnings}` |
| `confidence`, `_meta` | 편제표 신뢰도(`_meta.source[]`에서 파일 경로는 제거됨) |

`declared`(없으면 null): `subjectCredits`, `creativeCredits`, `totalCredits`, `requiredCredits`, `termCredits{term}`, `fixed{total, core, other, byTerm{term}, byArea{교과군}}`, `elective{total, byTerm{term}}`, `requiredByArea[]`(§5-3). `fixed.byArea`는 **지정 과목**의 교과군별 학점입니다(선택 과목 제외).

### 3-4. `offerings.json` — 평탄화 사실 표

| 필드 | 타입 | 설명 |
|---|---|---|
| `id`, `curriculumId`, `schoolId`, `entryYear` | | |
| `term`, `grade`, `semester` | | |
| **`slot`** | enum | `required` / `elective` / `outside` |
| **`selection`** | enum | **이수 방식(학교지정/학생선택)**: `school`(학교지정) / `student`(학생선택, 택n 묶음의 후보) / `outside`(학교 밖). `slot`과 1:1이며 화면 라벨용(`facets.selection`에 한글 라벨). 학교지정 칸이어도 한 칸에서 둘 중 고르는 복합 과목(음악↔미술 등)은 `subjects[].isComposite`로 구분 |
| `seq` | int | 원본 내 순서 |
| **`subject`** | string | **표에 인쇄된 표기 그대로** |
| `subjectKey` | string | `subjects`와 조인하는 정규화 키 |
| **`area`** | enum | 교과군 10종(§4-3). 요청의 `area/domain`은 `area`로 통일 |
| `subArea?` | string | 세부 분류 |
| **`csatArea?`**, **`csatScope`**, **`csatConfidence?`** | enum | **수능 영역 매핑**(§5-4). `csatArea`: `국어/수학/영어/한국사/통사/통과/제2외`(없으면 생략). `csatScope`: `in`/`base`/`out`/`none`. `csatConfidence`: `confirmed`/`reported`/`unconfirmed`(`none`이면 생략) |
| **`kind`** | string[] | 인쇄된 구분 **전체**(`["진로","융합"]` 혼합 가능, 미표기면 `[]`) |
| **`primaryKind?`** | enum | 대표 구분: 공통 > 일반 > 진로 > 융합 순으로 우선 |
| `kindStatus` | enum | `printed` / `color`(글자색 판독, §5-2) / `inferred` / `unmarked` / `missing`(§5) |
| `kindSource?` | string | 구분 출처(`"글자색"` 등, 없으면 인쇄 기호) |
| `kindGuess?` | enum | `inferred`일 때 다른 학교 기준 추정값 |
| `credits` | number | 운영학점(택n은 묶음의 `creditsEach`) |
| `basicCredits?` | number | 기본학점(`credits`와 다를 수 있음) |
| **`groupId?`** | string | `elective`일 때 소속 묶음 id(`groups[].id`) |
| **`pick?`**, **`groupSize?`** | int | 묶음에서 고를 개수, 후보 수 |
| `extra?`, `graded?` | | 원본 passthrough |
| **`flagIds`**, `openFlagIds` | string[] | 연결된 flag 전체 / 아직 열린(미확인) flag |
| `readConfidence` | enum | `ok`/`medium`/`low` — **열린** flag 중 가장 낮은 판독 신뢰도(확인 처리된 flag는 제외) |
| **`confidence`** | enum | **행 단위 신뢰도**: `unverified` → `checked` → `verified`(§5-1) |

### 3-5. `groups.json`

| 필드 | 설명 |
|---|---|
| `id`, `label`(`"2-1-A"`), `curriculumId`, `schoolId`, `entryYear`, `term`, `grade`, `semester` | |
| `pick`, `creditsEach`, `creditsTotal`, `size`(후보 수) | |
| `poolType` | `cross`(교과(군) 간 선택) / `basic`(기초교과) / `life`(기술·가정/정보/제2외국어/한문/교양) / `in-area`(한 교과 안) |
| `poolLabelRaw?` | 원본의 선택군 표기(교과군이 아니라 표기용) |
| `areasInPool`, `sameArea` | 후보가 걸친 교과군 |
| `kind` | 후보에 인쇄된 구분 |
| `subjectKeys` | 후보 과목 키 |

### 3-6. `subjects.json`

`subjectKey`, `name`(대표 표기), `area`, `subArea?`, `csatArea?`, `csatScope`, `csatConfidence?`, `csatNote?`(예외·불확실 사유), `aliases[]`, `isComposite`, `components?`(복합 과목의 구성 과목), `areasAll?`(여러 교과군에 걸칠 때), `kindsPrinted[]`, `offeredBy[]`(학교 id), `schoolCount`, `ambiguous?`(분류가 애매한 과목이면 사유).

### 3-7. `flags.json`

| 필드 | 설명 |
|---|---|
| `id`, `curriculumId`, `schoolId`, `ref`, `note`, `confidence`(`low`/`medium`), `term?` | |
| **`refs`** | `[{type:"offering"\|"group"\|"curriculum", id}]` — 연결 대상. 과목에 못 붙는 표 전체 메모는 `curriculum` 하나 |
| `scope`, `linkMethod?` | `row`(과목/묶음에 연결) / `general`(표 전체 메모) |
| `status`, `checked?`, `checkedDate?`, `checkedBy?`, `resolution?` | 확인 처리 이력(§5-1). `confidence`(low/medium)는 원래 판독 신뢰도로 유지 |

### 3-8. 그 밖의 파일
- `subject-matrix.json`: `{subjectKey, name, area, subArea?, schoolCount, cells:{schoolId:{slots[], terms[], kind[], credits[], groupIds[]}}}` — 과목이 없는 학교는 `cells`에 키가 없음.
- `search-index.json`: `{subjectKey, name, aliases, area, subArea?, schools[], text(소문자), initials(초성)}`.
- `facets.json`: `selection{school,student,outside → 한글}`, `csat{areas[{key,label}], scopes{}, basisExamYear, appliesToExamYear, applicability, notice, sources[], confidenceLevels{}, rowsByScope{}, rowsByConfidence{}, basis, confidence, asOf, retrieved}`, 그 밖에 `{schools[], entryYears[], terms[], areas[], subAreas{값:개수}, kinds[], modes{}, poolTypes{}, kindStatus{}, rowsByArea{}}` (`modes`는 slot별 행 수).
- `area-by-term.json`: `{curriculumId, schoolId, term, area, required, candidates}`.
- `review-queue.json`: `unlinkedFlags`, `lowConfidenceFlags`, `kindMissing`, `unmappedSubjects`, `ambiguousSubjects`, `areaRuleConflicts`, `declaredMismatches`.

---

## 4. 정규화 규칙

### 4-1. 과목명 통일
1. `subjectKey` = 공백 제거. `언어생활탐구`/`언어생활 탐구`, `융합과학탐구`/`융합과학 탐구`, `세계문화와 영어`/`세계 문화와 영어`, `기후변화와 지속 가능한 세계`/`…지속가능한…`이 한 과목으로 합쳐집니다. 화면에는 `subjects[].name`을 쓰세요.
2. **복합 과목**(한 슬롯에서 택1): `음악/미술`·`음악↔미술`·`미술↔음악` → `미술↔음악`, `기술·가정/정보`·`기술·가정↔정보` → 하나, `기술가정/한문` → `기술·가정↔한문`, `미술 창작/음악 연주와 창작`, `음악 감상과 비평↔미술 창작`. 구성 과목을 가나다순으로 정렬해 키를 만들므로 표기 순서와 무관합니다. 대상은 `tools/db-rules.json`의 `composites`에 열거된 표기뿐입니다.
3. 별칭: `기술가정` → `기술·가정`. 숫자·로마숫자(`영어Ⅰ`, `공통국어1`)는 그대로.

### 4-2. 구분(kind)
- 값: `공통`, `일반`, `진로`, `융합`(전문교과·특목고·고시외는 `extra`).
- **풍덕고**는 표에 융합(♥)만 인쇄해 일반/진로를 구분할 수 없습니다(`kindScheme:"fusion-only"`). 그런 행은 `primaryKind`가 없고, 다른 학교에서 구분이 **한 가지로만** 인쇄된 과목이면 `kindGuess`+`kindStatus:"inferred"`, 아니면 `"unmarked"`입니다. 추정은 "추정"으로 표시하세요.

### 4-3. 교과군(area)과 세부(subArea)
- `area`(10개): `국어`, `수학`, `영어`, `한국사`, `사회`, `과학`, `체육`, `예술`, `기술·가정/정보`, `제2외국어/한문/교양`.
- `subArea`: 과학(물리·화학·생명·지구·과학융합), 사회(역사·지리·윤리·일반사회), 기술·가정/정보(정보·기술·가정), 제2외국어/한문(제2외국어·한문), 예술(음악·미술).
- 과목명 → 교과군 규칙은 `tools/db-rules.json`(`areaBySubject`). **수지·홍천 원본의 영역별 지정 학점(`areaTotals`)과 규칙 계산이 전부 일치**하고 원본 `area`와도 충돌이 없습니다.
- 분류가 애매한 15개는 `subjects[].ambiguous`/`review-queue.ambiguousSubjects`에 사유를 적었습니다.
- **`groups[].poolLabelRaw`는 교과군이 아닙니다**(표기용). 후보 과목의 교과군은 각 행의 `area`입니다.

### 4-4. 학점 합계 규칙
```
학기 교내 합계 = Σ slot=required 의 credits + Σ 택n 묶음의 (pick × creditsEach)
교과 합계      = Σ 학기 합계            (declared.subjectCredits 와 대조)
총 이수학점    = 교과 + 창체 학점        (declared.totalCredits 와 대조)
slot=outside(학교 밖)는 합계에서 제외
영역별 지정 학점 = Σ required 중 area == 해당 교과군  (declared.fixed.byArea 와 대조)
```
**택n 후보의 `credits`를 모두 더하면 안 됩니다**(학생은 `pick`개만 이수).

---

## 5. 신뢰도 표기

| 필드 | 값 | 표시 권장 |
|---|---|---|
| `confidence`(편제표·학교·행) | `unverified` | AI가 사진에서 전사, 사람 검수 전 → "미확인" |
| | `checked` | 사진과 대조해 확인(§5-1) → "사진 대조 완료" |
| | `reported` | 위키·보도 등 2차 자료 |
| | `verified` | 사람이 원본과 대조 완료 → "확인됨" |
| `_meta.fieldConfidence`(학교) | 필드별 | 해당 필드는 항목 전체 값보다 이 값을 우선 |
| `readConfidence`(행) | `ok`/`medium`/`low` | flag에 연결되면 ⚠️(low 빨강, medium 주황) |
| `kindStatus`(행) | `printed` / `color` / `inferred` / `unmarked` / `missing` | 인쇄됨 / 글자색 판독 / "추정" / "구분 미표기" / 전사 확인 필요 |
| 검증 `level`(`_internal/validation.json`) | `error`/`warn`/`info` | `summary.validationErrors`, `reviewCount`에 반영 |

**검수 흐름 → 배지**: 전사본의 `_meta.confidence`를 `unverified` → `verified`로 올리고 `node tools/build-db.mjs`를 다시 실행하면 모든 행의 `confidence`가 갱신됩니다. 대시보드는 `confidence` 값만 보고 배지(미확인/확인됨)를 바꾸고, flag가 남은 행에는 ⚠️를 유지합니다. 학교 정보는 필드 단위로 `fieldConfidence`가 우선합니다.

### 5-1. 확인 처리(checked)와 신뢰도 사다리 *(다음 `build-db` 실행부터 적용)*

원본 flag에 `checked: true`, `checkedDate`, `checkedBy`, `resolution`이 붙으면 DB가 다음과 같이 처리합니다. **기존 필드 이름은 바꾸지 않고 필드만 추가**합니다(값의 의미가 달라지는 곳은 ※).

| 대상 | 처리 |
|---|---|
| `flags.json` | `status`(`open`/`checked`), `checked`(true일 때만), `checkedDate`, `checkedBy`, `resolution` 추가. 원래의 `confidence`(low/medium)는 **이력으로 그대로 유지** |
| `review-queue.json` | 확인 처리된 flag는 `unlinkedFlags`/`lowConfidenceFlags`에서 빠지고 **`resolvedFlags`**(원래 신뢰도·확인일·확인자·결과 포함)로 이동 |
| `_internal/validation.json` | 확인 처리된 flag는 `flag-unlinked` 경고를 내지 않음. `resolution`이 없으면 info |
| `offerings` 행 `readConfidence` ※ | **열려 있는(미확인) flag만** 반영. 연결된 flag가 모두 확인 처리되면 `ok` |
| `offerings` 행 `openFlagIds` | 신규. `flagIds` 중 아직 열린 것만(`flagIds`는 확인 처리된 것 포함 전체) |
| `offerings` 행 `confidence` | **신뢰도 사다리**: `unverified`(AI 전사) → **`checked`**(사진과 대조해 확인) → `verified`(공식 원본 확인). 확인 처리된 flag에 연결되고 열린 flag가 없는 행은 `checked`로 올라감. 편제표 단위 값(`_meta.confidence`)이 이미 더 높으면 유지. `reported`(2차 자료)는 `checked`와 같은 높이 |
| `summary` ※ | `flagsTotal`(전체) 외에 `flagsOpen`, `flagsChecked` 추가. **`reviewCount`는 열린 flag 기준**(확인 처리 건은 제외) |

배지 권장: `unverified` 회색 "미확인" · `checked` 파랑 "사진 대조 완료" · `verified` 초록 "확인됨" · 열린 flag가 있는 행은 ⚠️ 유지.

### 5-2. 구분 출처 `kindStatus: "color"` *(다음 실행부터)*

원본 과목/후보에 `kindSource: "글자색"`이 있으면(글자색 기준 검정=일반, 빨강=진로, 파랑=융합으로 읽은 값):

- `offerings.kindStatus` = **`color`**(구분이 값으로 채워졌고 출처가 글자색), `offerings.kindSource` = `"글자색"` 추가. `kind`/`primaryKind`는 평소처럼 채워집니다.
- `facets.kindSource{}`에 출처별 개수 추가. `color`는 구분이 **있는** 값이므로 `printed`와 마찬가지로 필터·집계에 포함하면 됩니다. 화면에서는 "글자색 판독"으로 작게 표시하세요.
- 다른 학교 기준 추정(`kindGuess`)은 `color`/`printed` 행이 늘면 근거 데이터가 늘어 **추정 가능 행 수가 바뀔 수 있습니다**(만장일치 조건).

**구분별 집계·필터가 어떻게 달라지는가**(현재 선택 후보 행 기준, 반영 전): 수지고 65행 중 **41행이 혼합**(진로·융합 37, 일반·진로 4), 용인홍천고 66행 중 **47행이 혼합**(일반·진로·융합 21, 진로·융합 18, 일반·진로 8). 혼합 행은 현재 `primaryKind`가 우선순위(일반 > 진로 > 융합)로 정해져 "일반"/"진로" 필터 집계가 과대 계상됩니다. 색 판독이 반영되면 혼합 행이 단일 구분으로 바뀌어 구분별 필터와 비교가 분명해집니다. 실제 전후 비교표는 재실행 뒤 보고합니다.

### 5-3. 필수이수학점(`declared`) 처리

`declared`에는 서로 다른 개념이 있습니다. 혼동하지 마세요.

| 필드 | 개념 |
|---|---|
| `requiredCredits` | 총 필수이수학점(예: 84) |
| `fixed.byArea{교과군}` | **학교 지정 과목**의 교과군별 학점(규칙 계산과 대조해 검증하는 값) |
| `requiredByArea[]` *(신규, 선택)* | **영역별 필수이수학점**(최소 이수 기준). 병합 셀은 `{areas:[…], credits}`처럼 여러 교과군을 한 항목으로 표현 |

예: 수지고 병합 셀 "예술+기술·가정/정보 합쳐서 10, 체육 10 별도" → `requiredByArea: [{"areas":["예술","기술·가정/정보"],"credits":10}, {"areas":["체육"],"credits":10}]`. 용인홍천고 "기술·가정/정보/제2외국어/한문/교양 필수 16" → `{"areas":["기술·가정/정보","제2외국어/한문/교양"],"credits":16}`("2학년 필수"는 오독이었고 학년 구분이 아님).
**실제 값(2026-10-25 생성)**: 위치는 `curricula.json`의 `declared.requiredByArea`뿐이며 `summary.json`에는 없습니다(풍덕·성복은 원본에 없어 생략). 수지고는 8·8·8·6·8·10·10 + `{예술, 기술·가정/정보}` 10 + `{기술·가정/정보, 제2외국어/한문/교양}` 16 = 84, 용인홍천고는 8·8·8·6·8·10·10·10 + `{기술·가정/정보, 제2외국어/한문/교양}` 16 = 84입니다. **같은 교과군이 둘 이상의 항목에 나올 수 있으므로**(수지: 기술·가정/정보가 두 항목에) 항목별 `credits`를 교과군 하나의 값으로 쪼개 쓰지 마세요. 표시할 때는 `areas`를 "예술 + 기술·가정/정보 합 10학점"처럼 묶음 그대로 보여주세요.

이 값은 지정 학점 검증(`fixed.byArea`)과 **독립**입니다. 검증은 하나: 항목의 `credits` 합이 `requiredCredits`(총 필수, 예: 홍천 8+8+8+6+8+10+10+10+16=84)와 같아야 하며 다르면 오류(`required-by-area-sum`)입니다. 교과군 이름이 규칙 목록에 없으면 경고합니다. 원본 JSON의 키는 `declared.requiredByArea`(객체 `{교과군: 학점}`도 허용)로 맞춰 주세요.

### 5-4. 이수 방식과 수능 영역 매핑

**① 학교지정 / 학생선택** — `offerings.selection`: `school`(학교지정, 모든 학생이 이수) / `student`(학생선택: 택n 묶음에서 `pick`개 고름. `pick`, `groupSize`, `groupId` 참조) / `outside`(학교 밖 과목). 한 칸에서 둘 중 하나를 고르는 학교지정 복합 과목은 `selection: school` + `subjects[].isComposite: true`입니다.

**② 수능 영역** — `csatArea`(2028학년도 통합형 수능 영역 7종, 사용자 표기와 동일)와 `csatScope`:

| `csatArea` | 영역 | `in`(출제 범위) 과목 |
|---|---|---|
| `국어` | 국어 | 화법과 언어, 독서와 작문, 문학 |
| `수학` | 수학 | 대수, 미적분Ⅰ, 확률과 통계 |
| `영어` | 영어 | 영어Ⅰ, 영어Ⅱ *(과목명은 보도 미확인, 추정)* |
| `한국사` | 한국사 | 한국사1·2 |
| `통사` | 통합사회 | 통합사회1·2 |
| `통과` | 통합과학 | 통합과학1·2 |
| `제2외` | 제2외국어/한문 | 중국어, 일본어, 스페인어 *(학교 과목명과 수능 과목의 대응은 추정)* |

| `csatScope` | 뜻 |
|---|---|
| `in` | 수능 출제 범위 과목 |
| `base` | 그 영역의 **공통·기초 과목**(공통국어1·2, 공통수학1·2, 공통영어1·2, 과학탐구실험1·2). 직접 출제 여부는 시행 기본계획 확정 전이거나 간접적으로 필요(보도) |
| `out` | 수능 영역과 같은 교과이지만 **출제 제외**(예: 미적분Ⅱ·기하는 확정안에서 제외, 물리학·세계사 등 탐구 선택과목, 심화·회화 과목) |
| `none` | 수능 영역이 없는 교과(체육, 예술, 기술·가정/정보, 교양 등) |

- **적용 학년도(화면 문구용 필드)**: `facets.csat.basisExamYear` = 2028(기준 개편안), `appliesToExamYear` = 2030(이 프로젝트의 대입 학년도), `applicability` = `"assumed"`(2030에도 같은 체제가 적용된다는 것은 **가정**). 화면에는 `facets.csat.notice`("2028학년도 수능 확정안 기준입니다. 2030학년도(현 중3) 적용은 아직 확정되지 않았습니다(가정).")를 그대로 표시하세요.
- **근거 목록**: `facets.csat.sources[]`(`id`, `name`, `url`, `kind`, `retrieved`(조회일 2026-10-25), `supports`). 요약:

| 근거 | 확인한 내용 | 종류 |
|---|---|---|
| [교육부 2028 확정안 보도자료(2023.12.27)](https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=97551&lev=0&searchType=null&statusYN=W&page=1&s=moe&m=020402&opType=N) | 통합형(국어·수학·사회·과학 선택과목 폐지), 수학 심화(미적분Ⅱ·기하) 출제 제외, 사회·과학은 공통범위 | 1차(공식) |
| [인천투데이: 교육부·평가원 2028 수능 체제 발표(2025.1.20) 보도](https://www.incheontoday.com/news/articleView.html?idxno=261614) | 통합사회·통합과학 출제, 영어 현행 유지, 제2외국어/한문 영역 유지(과목 목록 없음), 세부는 2025 상반기 안내 예정 | 보도 |
| [지역내일: 교육부 2028 안내사항 공개(2025.6)](https://www.localnaeil.com/News/View/652739) | 국어·수학 선택 폐지, 통합사회·통합과학 | 보도 |
| [나무위키 2028학년도 수능](https://namu.wiki/w/2028%ED%95%99%EB%85%84%EB%8F%84%20%EB%8C%80%ED%95%99%EC%88%98%ED%95%99%EB%8A%A5%EB%A0%A5%EC%8B%9C%ED%97%98) | 영역별 과목명(국어 3과목, 수학 3과목, 영어Ⅰ·Ⅱ, 한국사1·2, 통합사회1·2, 통합과학1·2) | 2차 |
| [시행일 보도(2025.6)](https://www.dhnews.co.kr/news/view/1065578177989020) | 2027.11.18 시행, 성적 통지 2027.12.10 | 보도 |
| 한국교육과정평가원 시행 기본계획(2027.3 공고 예정) | 아직 공고 전 — **확정 근거로 쓸 1차 자료, 미열람** | 1차 |

- **확정과 미확인 구분(`csatConfidence`)**: `confirmed` = 교육부 확정안에서 확인(현재 `미적분Ⅱ`, `기하`의 출제 제외 2과목뿐). `reported` = 보도·2차 자료에서 확인(국어·수학 출제 과목, 한국사, 통합사회·통합과학과 그 밖의 `out` 판정). **`unconfirmed` = 근거 없음·추정**(영어Ⅰ·Ⅱ와 영어 `out`, 제2외국어 대응과 그 `out`, 공통과목 `base`). 미확인은 "해당 없음"이 아니라 **"미확인"**으로 표시하세요(`none`이 해당 없음). `scope`는 가장 그럴듯한 값을 담고, 신뢰도가 단정 정도를 나타냅니다. `summary.byCsat[영역].unconfirmed`는 그 영역에 미확인 행이 하나라도 있으면 true(`base` 공통과목 포함).
- 예외·불확실 사유는 `subjects[].csatNote`.
- 직업탐구 영역은 일반고 지원 대상이 아니라 매핑하지 않았습니다.
- 규칙은 `tools/db-rules.json`의 `csat`에서 관리합니다(출제 범위가 확정·변경되면 이 목록만 고치고 재생성).
- 활용 예와 **해석 주의**(`summary.byCsat`): 풍덕고 수학 — 지정 과목은 대수(2-1), 미적분Ⅰ(2-2), 확률과 통계(3-1)로 **수능 수학 출제 3과목을 모두 학교지정으로 이수**(`requiredIn` 12학점)하고, 3-2 지정 `실용 통계`(4학점)는 `out`입니다. 학생선택 후보 5개(인공지능 수학, 기하, 미적분Ⅱ, 경제 수학, 수학과제 탐구)는 모두 출제 범위 밖이라 `candidatesIn` = 0입니다. 판정 근거: 수능 수학 출제 과목이 대수·미적분Ⅰ·확률과 통계로 한정(나무위키·보도, `reported`)되고, 기하·미적분Ⅱ는 확정안에서 제외(교육부, `confirmed`). 따라서 **"수학 선택 후보가 출제 범위에 0개"는 수능 대비가 부족하다는 뜻이 아니라, 필수 3과목은 이미 지정으로 들어 있고 선택은 심화·진로용이라는 뜻**입니다. `candidatesIn`만 단독으로 보여주지 말고 `requiredIn`과 함께 표시하세요.

### 5-5. 요약 표시 규칙 (대시보드가 지켜야 할 것)

1. **`candidatesIn`은 단독으로 보여주지 않습니다.** 항상 같은 영역의 `requiredIn`(학교지정 중 출제 범위 학점), `requiredBase`와 함께 표시합니다. 예: "수학 — 지정 12학점(출제 범위) + 공통 8학점 / 선택 후보 5개 중 출제 범위 0개". 후보 0개를 "수능 대비 부족"으로 읽히게 하면 안 됩니다(풍덕고 수학: 출제 3과목은 이미 지정).
2. **`out`은 "불필요"가 아니라 "수능 출제 제외"**입니다. 라벨은 `facets.csat.scopes`를 쓰세요. 심화·진로 과목도 대학 전형(학생부)에서는 의미가 있을 수 있습니다.
3. **`csatConfidence: unconfirmed`는 "미확인"**으로 표시하고(`none`처럼 "해당 없음"으로 보이면 안 됨), `summary.byCsat[영역].unconfirmed`가 true인 영역에는 요약 옆에 주의 표시를 붙입니다.
4. **`facets.csat.notice`("…2030학년도 적용은 아직 확정되지 않았습니다(가정)")를 수능 영역 정보가 나오는 모든 화면 상단에 표시**합니다. 근거 링크는 `facets.csat.sources[]`.
5. **구분(kind) 표시**: `kindStatus`가 `color`면 "글자색 판독", `inferred`면 "추정(다른 학교 기준)", `unmarked`면 "구분 미표기"로 구분해 표시합니다. `inferred`·`unmarked`는 구분별 집계에 섞지 말고 별도 항목으로 셉니다.
6. **확인 필요 건수는 `reviewCount`(열린 flag 기준)**, 신뢰도 배지는 `confidence`(`unverified`/`checked`/`verified`)를 그대로 사용하고, 열린 flag가 있는 행은 ⚠️를 유지합니다.
7. 학교 비교표의 합계 열은 **지정+선택 학점**과 **학교 밖**을 섞지 않습니다(`creditsOutside`는 별도).

---

## 6. 개인정보·이미지 규칙 (빌드가 강제)

- DB에는 **`sourceImage` 키와 `_meta.source[].file` 경로를 넣지 않습니다.** 원본 전사 메모(`notes`)와 비공개 메모도 싣지 않습니다.
- **현재 DB에는 이미지를 싣지 않습니다**(사용자 결정: 편제표 사진을 대시보드에서 쓰지 않음). `tools/db-rules.json`의 `images.enabled`가 `false`이며, 이때 `displayImage`는 만들지 않고 `content/data/display-images.json`도 읽지 않습니다. `curricula.json`과 `summary.json`에 이미지 경로가 하나도 없습니다.
- **필요하면 나중에 다시 켤 수 있습니다**: `images.enabled`를 `true`로 바꾸고 `content/data/display-images.json`에 `{schoolId: 경로}`를 두면 `displayImage`가 선택 필드로 다시 생깁니다(경로는 화면용 사본 `files/display/<이름>.jpg`만 허용; 원본 `files/inbox/…`·가린 임시본 `files/masked/…`는 쓰지 않음; 값 `"$sourceImage"`는 지원하지만 쓰지 않음). 목록에 없는 학교는 `displayImage`를 넣지 않고 경고합니다. 소비자는 `displayImage`가 **없을 수 있음**을 전제로 만드세요(§3 표에서도 선택 필드).
- **자동 검사**(생성 직후, 실패 시 종료코드 1):
  1. `sourceImage` 키가 어떤 DB 파일에도 있으면 실패
  2. **이미지가 꺼져 있으면(현재)** `displayImage` 키와 `files/inbox`·`files/display`·`files/masked` 경로가 어디에도 있으면 실패. 켜져 있으면 `files/inbox` 문자열은 `displayImage` 값으로만 허용
  3. 원본 사진 경로(전체 또는 파일명)는 어떤 경우에도 DB에 있으면 실패(수지고 원본 `ABrJyp7gyYj5L8a5.jpg` 포함)
  4. 켜져 있을 때 `displayImage` 파일이 `content/` 아래에 없으면 경고(파일 내용은 읽지 않음)
- 현재 검사 결과: 위반 0건. `content/db/` 전체에 `files/inbox`, `files/display`, `files/masked`, `sourceImage`, `displayImage`, 수지고 원본 파일명이 모두 0건(grep 확인).

---

## 7. 대시보드 화면별 사용법

| 화면 | 사용 데이터 | 방법 |
|---|---|---|
| **학교 비교표** | `summary` | 행=학교. 요청 열은 모두 있음(학교명·유형·설립·지역·배정방식·총 이수학점·지정 과목 수·선택 묶음 수·후보 과목 수·선택 폭·창체 시간·신뢰도·확인 필요 건수). 정렬·필터는 이 파일만으로 가능 |
| **과목 검색** | `search-index` + `subject-matrix`/`offerings` | `text.includes(q.toLowerCase())` 또는 `initials.includes(q)` → `schools[]`로 어느 학교에 있는지, `offerings`에서 `subjectKey`로 학기·모드 확인 |
| **과목×학교 매트릭스** | `subject-matrix` | `cells[schoolId]`의 `slots`(지정/택n/학교 밖), `terms`, `kind`로 셀 표시. 행 필터는 `area`/`subArea`, 열은 `schools` |
| **학교 상세** | `curricula`, `offerings`, `groups`, `flags` | `schoolId`로 필터 → `term`별 그룹, `slot`별로 지정/택n(`groupId`로 묶어 "택{pick} · 각 {creditsEach}학점")/학교 밖. (사진은 현재 DB에 없음, 켜면 `displayImage`) |
| **비교 모드(2~4개교)** | `summary`, `area-by-term`, `subject-matrix` | `summary.byArea`/`byTerm`/`byKind`를 나란히, 과목 차이는 매트릭스에서 `cells` 키 집합 비교 |
| **희망 과목 이수 가능 여부(확장)** | `offerings`, `groups` | §7-1 |

### 7-1. 이수 가능 여부 판정 (확장 화면)
입력: `schoolId`, 희망 과목 집합 `W`(subjectKey). 규칙:
1. `slot=required` 행에 이미 있는 과목은 충족(묶음 칸을 쓰지 않음).
2. 나머지 `W`는 `slot=elective` 행에서 찾습니다. 한 과목이 **여러 학기·여러 묶음에 후보로** 나올 수 있으므로 `과목 → (학기,묶음)` 간선, `묶음 → 용량 pick`으로 **이분 매칭(최대 유량)**을 풉니다(과목당 1번만 이수).
3. 매칭되지 않은 과목 = 충돌. 같은 묶음에 과목이 `pick`개를 넘으면 "이 묶음에서 최대 n개" 안내.
4. 해당 학교에 후보가 없으면 "미개설(편제표에 없음)".

DB가 제공하지 못하는 판정 조건: **선수·연계 과목**(예: 미적분Ⅱ는 미적분Ⅰ 이수 후), **실제 학기별 개설 여부**(편제표는 후보일 뿐, 수요조사로 확정), 공동교육과정, 학점 상한(묶음 구조로만 간접 반영). 이 부분은 별도 규칙/엔티티가 필요합니다(제안서 §4-1b `offering`).

---

## 8. 통합 중 발견한 원본 불일치와 처리

| # | 내용 | 처리 |
|---|---|---|
| 1 | `declared` 키 체계가 두 가지(풍덕·성복 vs 수지·홍천) | `declared`로 통일(§3-3). 없는 값은 생략 |
| 2 | 풍덕·성복 원본에 `area`·`areaTotals` 없음 | 규칙으로 교과군 부여, 수지·홍천에서 규칙이 선언값과 일치함을 검증 |
| 3 | 풍덕은 일반/진로 구분이 표에 없음(♥만) → 구분 누락 72행 | `kindStatus`: 추정 46, 미표기 26. **전사로는 복구 불가**(표에 없는 정보) |
| 4 | 선택군 표기 변형, 풍덕·성복은 표기 없음 | `poolType`으로 통일, 원본은 `poolLabelRaw` |
| 5 | 과목 표기 변형(공백, 복합 과목 표기 3종 등) | `subjectKey`로 통합(§4-1) |
| 6 | 창체 활동명 `자율·자치활동`/`자율자치활동` | `자율·자치활동`으로 통일 |
| 7 | 수지고 학교 밖 과목 2학점 | 교내 합계 제외(1-2학기 29학점이 맞음) |
| 8 | 원본 학교명 `용인흥천고등학교`(오타) | DB는 `schools.json` 이름 사용(`용인홍천고등학교`). id는 불변 규칙으로 유지 |
| 9 | flags의 `ref`가 자유 텍스트 | 학기·묶음·과목명 매칭으로 행에 연결. 12건 중 9건 연결, **3건은 표 전체 메모(`refs`=curriculum)** |
| 10 | 수지 flag "영역 필수이수학점(체육·예술·기술 합산 표기)" | 영역별 지정 학점 검증은 통과. 합산 표기를 풀어 읽은 부분이라 사람 확인 권장 |

현재 검증 결과: **오류 0, 경고 4**(연결 안 된 flag 3, 풍덕 구분 미표기 1), 정보 3.

---

## 9. 변경 이력

**v2.1.0**(추가만, 이름 변경 없음): 편제표 밖 데이터 5개 파일(`events`, `policy`, `high-school-types`, `admission-system`, `sources`) 추가, `facets.portal` 추가(§11). 주 버전은 2 그대로입니다.

### v1.0.0 → v2.0.0 (이름이 바뀐 필드)

| v1.0.0 | v2.0.0 |
|---|---|
| `offerings.mode` | `slot` (v1의 `slot`(순번)은 `seq`) |
| `offerings.subjectName` | `subject` |
| `offerings.kinds` / `kind`(대표) | `kind`(배열) / `primaryKind` |
| `groupKey` | `groupId`(offerings), `groups[].id`; 묶음 라벨은 `label` |
| `elective-groups.json` | `groups.json` |
| `derived/school-summary.json` | `summary.json` (행에 학교 정보·품질 열 추가) |
| `derived/compare-subjects.json` | `subject-matrix.json` |
| `derived/*`, `db.json`, `manifest.json`, `validation.json` | 제거/이동(`_internal/`) , `index.json` 추가 |
| `curricula.sourceImage` 등 | 제거, `displayImage` 추가 |
| `flags.linkedRowIds…` | `refs[{type,id}]` |

## 10. 공통 레코드 필드 (편제표 밖 엔티티 확장용)

일정(`event`), 고입 전형(`admission_route_hs`), 대학 전형(`route_univ`), 입결(`result`), 제도 변경(`policy_change`), 학교(`school`) 등 **편제표 밖 데이터도 같은 규칙으로** 들어올 수 있도록, 모든 엔티티(한 행)가 갖는 공통 필드를 정합니다. 편제표 계열은 이미 `confidence`, `_meta.source[]` 등으로 이 규칙을 따릅니다. (코드는 아직 없음 — 규약만.)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | string | ✔ | 엔티티 내 고유·불변. 학교 참조는 `schoolId` |
| `source` | `[{ name, url?, kind, retrieved, ref? }]` | ✔(1개 이상) | 출처. `kind`: `official`(공식) / `media`(보도·2차) / `self`(사용자 제공). `retrieved`: 조회일(YYYY-MM-DD), `ref`: 문서 내 위치(쪽·행) 또는 포털 데이터셋 id. **원본 이미지·파일 경로는 넣지 않음**(사용자 제공은 `{name:"사용자 제공, 설명회", kind:"self", retrieved}`) |
| `confidence` | enum | ✔ | `unverified` → `checked`(사진·원문 대조) / `reported`(2차 자료) → `verified`(공식 원문 확인). 필드 단위로 다르면 `fieldConfidence{필드: 값}`가 우선 |
| `status` | enum | ✔ | 수명 주기: `candidate`(수집·추출 후보, 검수 전) / `active`(화면 노출) / `superseded`(새 값으로 대체, 이력 보존) / `rejected`(반려). 대시보드는 `active`만 보여줌 |
| `updated` | date | ✔ | 마지막으로 값이 바뀌었거나 다시 확인된 날(YYYY-MM-DD) |
| `appliesTo` | `{ entryYear?, examYear? }` | 권장 | 적용 학년도. 제도·일정은 `examYear`(배열 가능), 학교·편제표는 `entryYear`. 둘의 관계는 `examYear = entryYear + 3` |
| `note` | string | 선택 | 공개해도 되는 짧은 메모 |
| `checked` | `{ date, by, resolution }` | 선택 | 확인 처리 이력(flag 확인 처리와 같은 형식) |

규칙
- **저장 위치는 항상 `content/`(비공개)**이고, 대시보드에는 암호화된 `content/db/` 파생 파일로만 올라갑니다.
- 값이 바뀌면 기존 행을 덮어쓰지 말고 새 행을 만들어 이전 행을 `superseded`로 돌립니다(제도 변경 이력 보존).
- 신뢰도는 **가장 낮은 출처**를 따릅니다(공식+보도가 섞이면 `reported`). 충돌하는 값은 자동 병합하지 않고 둘 다 `candidate`로 두어 사람이 고릅니다.
- 엔티티별 고유 필드(예: 일정의 `date_start/date_end`, 입결의 `year/route/metric`)는 제안서 §4-1을 따르고, 위 공통 필드를 모든 엔티티 JSON에 같은 이름으로 둡니다. 파일 단위 `index.json`의 `files[]`에는 엔티티별 파일로 추가합니다(§11 사례, 분할은 §13).
- 학교와 연결되는 모든 엔티티는 `schoolId`를 가집니다(§2).

## 11. 포털 데이터: 일정·제도·고교 유형·출처 (v2.1.0)

대시보드의 편제표 밖 화면(홈, 일정, 고교 선택, 대입 제도, 제도 변경 로그, 자료실)이 쓰는 데이터입니다. 모두 **§10 공통 레코드 필드**(`id`, `source[]`, `confidence`, `status`, `updated`, `appliesTo`)를 갖고, 원본은 손으로 관리하는 `content/data/<이름>.json`(`{ "items": [...] }`, 비공개)이며 `build-db`가 검증·정렬해 `content/db/<이름>.json`(배열)로 내보냅니다. 학교 이름은 루트 CLAUDE.md 기준으로 공개가 허용되어 넣을 수 있고, 접속 정보(토큰·비밀번호)만 넣지 않습니다. 사진은 쓰지 않습니다.

- `status`가 `active`·`superseded`인 행만 내보냅니다(`candidate`, `rejected`는 제외). `superseded`는 이력으로 남은 이전 값입니다.
- 날짜는 ISO 문자열 `YYYY-MM-DD`(KST 날짜). 학년도는 `appliesTo`의 **`entryYear`**(입학 해)/**`examYear`**(대입 해) 중 자연스러운 쪽으로 적고(둘 다 있으면 `examYear = entryYear + 3`을 빌드가 검사), 값은 정수 또는 정수 배열입니다.
- **검증**(오류면 DB를 갱신하지 않음): `id` 필수·고유, 필수 필드, 열거값, 날짜 형식, `dateEnd ≥ dateStart`, `source[]` 1개 이상(각 항목 `name`, `kind`(`official`/`media`/`self`), `retrieved`), `confidence`·`status` 열거, `updated` 날짜, `appliesTo` 존재. 경고: 공식·보도 출처에 `url` 없음, 미확인인데 `dateStatus`가 `tentative`가 아님.
- **대상 학년도(현 중3)**: `facets.portal.targetCohort = { entryYear: 2027, examYear: 2030 }`. 행이 현 대상에 해당하는 조건: `appliesTo.entryYear`에 2027이 있거나 `appliesTo.examYear`에 2030이 있음. 그 밖의 행(예: 2028 수능)은 "참고(다른 학년도)"로 보여줍니다.

### 11-1. `events.json` — 일정

| 필드 | 설명 |
|---|---|
| `id`, `title`, `category`(`고입`/`대입`/`수능`/`모평`/`기타`), `scope`(`전국`/`서울` 등) | |
| `dateStart`, `dateEnd?` | 시작일, 종료일(기간일 때만). 정렬은 `dateStart` 오름차순 |
| **`dateStatus`** | `fixed`(공식 확정 일정) / `expected`(기본계획·보도 기준 예정) / `tentative`(임시값, 미확인). `facets.portal.dateStatus`에 라벨 |
| `note?` | 예: "3월 기본계획엔 외·국제고 접수 12/3~17로 다르게 기재 → 교육청 공고 확인" |
| `appliesTo`, `source[]`, `confidence`, `status`, `updated` | 공통 필드 |

### 11-2. `policy.json` — 제도 변경 로그

`date`(발표/변경일), `title`, `summary`, **`phase`**(`confirmed`확정 / `proposed`제안 / `under-review`검토 중 / `reported`보도 기준; 라벨은 `facets.portal.phase`) + 공통 필드. 파일은 **`date` 내림차순(최신 먼저)**으로 정렬되어 나옵니다. 값이 바뀌면 이전 행을 `superseded`로 남기고 새 행을 추가합니다.

### 11-3. `high-school-types.json` — 고교 유형

`type`, `timing`(전기/후기와 접수 시기), `method`(선발 방식), `scopeNote`(어느 지역 기준 보도인지) + 공통 필드(`appliesTo.entryYear`). 시기는 지역마다 다르므로 `scopeNote`를 항상 함께 보여주고 시도교육청 공고로 재확인하라는 안내를 붙이세요.

### 11-4. `admission-system.json` — 대입 제도 요약 표

`topic`(수능·내신·일정 등), `content`, `phase`(§11-2와 같은 값), `note?` + 공통 필드. 수능 영역 매핑과 근거는 `facets.csat`(§5-4)이므로 이 표에서는 요약만 보여줍니다. **2030학년도 적용은 가정**이라는 `facets.csat.notice`를 이 화면 상단에도 표시하세요.

### 11-5. `sources.json` — 출처 목록

`name`, `url`, `kind`(`official`/`media`/`self`), **`lastChecked`**(실제로 열어 확인한 날짜, 열람하지 못했으면 `null`), **`termsStatus`**(`ok` 이용조건 확인 / `partial` 일부 / `unknown` 미확인 / `n/a` 보도), `note?` + 공통 필드. 공식 소스인데 아직 열람하지 못한 항목(학교알리미 등)도 `confidence: unverified`, `lastChecked: null`로 들어 있습니다.

### 11-6. 화면별 사용법

| 화면 | 데이터 | 규칙 |
|---|---|---|
| **홈 "지금 할 일"** | `events`, `sources` | ① 현 대상 학년도 행만 사용 ② `end = dateEnd ?? dateStart`가 오늘 이후인 행을 `dateStart` 오름차순으로 **다음 마감 3건**. D-day는 시작 전이면 `dateStart`까지, 진행 중이면 `dateEnd`까지 ③ `dateStatus`/`confidence`를 배지로(예정·임시 구분), `note` 표시 ④ **오래된 데이터 경고**: `sources`에서 `lastChecked`가 `null`이거나 오늘 −`facets.portal.staleAfterDays`(90일)보다 이전인 건수 |
| **일정 타임라인** | `events` | 필터: 범위(`scope`), `category`, "다른 학년도(참고) 포함" 체크(기본 해제). 지난 일정은 흐리게. 정렬 `dateStart` 오름차순 |
| **고교 선택 → 고교 유형·전형** | `high-school-types` | 표로. `scopeNote`·재확인 안내 필수 표시 |
| **대입 → 대입 제도** | `admission-system`, `facets.csat` | 표 + `phase` 배지 + 수능 notice |
| **제도 변경 로그** | `policy` | 이미 `date` 내림차순. `phase` 배지, `appliesTo` 학년도, 출처 링크. `superseded` 행은 흐리게 |
| **자료실 → 출처·갱신 현황** | `sources` | 이름(링크), `lastChecked`(없으면 "미열람"), `confidence`, `termsStatus`. 오래된/미열람은 ⚠️ |

공통: 모든 행의 `source[]`는 이름+링크로 표시하고, 신뢰도 배지는 §5 규칙을 따릅니다. `updated`는 행 단위 "마지막 확인"으로 보여줄 수 있습니다.

## 12. 새 학교 추가 절차

1. 전사본을 `content/curriculum/<slug>.json`에 추가(`id`, `schoolId`, `entryYear`, `courses`, `electiveGroups` …).
2. `content/data/schools.json`에 학교 레코드 추가(새 학교 id는 `s-NNN`, §2). 갤러리(`curriculum.json`) 항목에도 같은 `schoolId`를 넣습니다.
3. (이미지를 켠 경우만) 화면용 사진 사본을 `content/files/display/`에 만들고 `content/data/display-images.json`에 `schoolId`와 그 경로를 추가. 지금은 이미지가 꺼져 있어 필요 없음.
4. `node tools/build-db.mjs` 실행. 경고 `subject-unmapped`가 나오면 `areaBySubject`에 과목을 추가(애매하면 `ambiguousSubjects`에 사유).
5. 오류가 나오면 전사 오류이거나 선언값 불일치입니다. `_internal/validation.json`의 `expected`/`actual`로 위치를 확인합니다.
6. 대시보드 빌드를 다시 실행(암호화 후 vault 반영).

## 13. 규모 추정과 파일 분할 계획

**현재(학교 4곳·입학학년도 1개) 측정값**: 파일 12개 합계 454KB. 학교당 대략: `offerings` 46KB(행 약 97개 × 470바이트), `summary` 1.8KB, `schools` 1.3KB, `curricula` 1.5KB, `groups` 5KB, `flags` 약 1KB, `area-by-term` 7KB, `review-queue` 약 3KB → **학교 수에 비례하는 부분이 약 67KB/학교**. `subjects`·`search-index`는 과목이 겹쳐 학교 수보다 느리게 늘고, `subject-matrix`는 과목×학교라 학교당 약 12~16KB.

| 학교 수(입학학년도 1개) | offerings | 그 밖의 비례 파일 | subject-matrix | subjects+search-index | **합계(JSON)** |
|---|---|---|---|---|---|
| 4(현재) | 0.18MB | 0.09MB | 0.06MB | 0.07MB | **0.45MB** |
| 10 | 0.46MB | 0.21MB | 0.16MB | 0.09MB | 약 **0.9MB** |
| 20 | 0.92MB | 0.42MB | 0.32MB | 0.10MB | 약 **1.8MB** |
| 30 | 1.38MB | 0.63MB | 0.48MB | 0.11MB | 약 **2.6MB** |

입학학년도가 늘면 학교×학년도 수만큼 비례(예: 30학교×3개 학년도 ≈ 학교-학년도 90개 → `offerings` 약 4MB). 암호화(AES-GCM) 후 파일 크기는 거의 같고, manifest 안에서 inline이면 base64로 약 1.37배가 됩니다. 현재 대시보드 빌드는 합계 512KB를 넘으면 파일별 lazy로 전환하므로 **10곳 이상부터는 어차피 lazy**이고, 문제는 "한 파일이 너무 큰 것"(`offerings` 약 0.5MB 이상)입니다.

**분할 계획(구현은 필요할 때)**
- 분할 단위: **`schoolId` × `entryYear`**(편제표 1건). 분할 대상 데이터셋: `offerings`, `groups`, `flags`, `area-by-term`. 항상 단일 파일 유지: `summary`, `schools`, `curricula`, `facets`, `subjects`, `index`. `subject-matrix`는 `offerings`가 분할되면 **파일에서 제거하고 클라이언트가 `offerings`에서 만들기**를 권장(분할 시 학교 수에 비례해 가장 빨리 커지는 파생 파일).
- 분할 기준(권장): 학교-학년도 **9개 이상** 또는 `offerings.json` **400KB 초과**. 한 번 분할하면 모든 학교를 분할 파일로 통일(단일 파일과 혼용 금지).
- 파일 이름: `offerings-<schoolId>-<entryYear>.json`(예: `offerings-s-001-2027.json`). 학교 id는 비식별 `s-NNN`이라 이름이 새지 않습니다.
- **`index.json` 계약 변경**: 분할 전후 모두 `files[]`를 순회해 읽는 소비자가 동작하도록, 항목에 `dataset`과 `scope`를 둡니다.

```json
{ "version": "2.2.0",
  "datasets": { "offerings": { "partitionedBy": ["schoolId", "entryYear"], "files": ["offerings-s-001-2027.json", "offerings-s-002-2027.json"] } },
  "files": [
    { "name": "summary.json", "dataset": "summary", "use": "core", "rows": 12, "bytes": 21000 },
    { "name": "offerings-s-001-2027.json", "dataset": "offerings", "use": "lazy",
      "scope": { "schoolId": "s-001", "entryYear": 2027 }, "rows": 97, "bytes": 46000 }
  ] }
```
  - 소비자 규칙: `dataset`이 같은 파일을 **이어 붙이면** 단일 파일과 같은 배열이 됩니다. 학교 상세 화면은 `scope.schoolId`로 필요한 파일만 읽습니다(비교 모드 2~4개교는 해당 파일 2~4개).
  - 분할을 도입하는 빌드는 `index.version` **마이너를 올립니다**(2.1.0 → 2.2.0). 단일 파일(2.1.0)과 분할(2.2.0)을 모두 읽는 소비자가 `files[]`를 쓰도록 하면 코드 변경이 없습니다.
  - 지금 `build.mjs`의 `db/*.json` 글롭은 분할 파일도 그대로 포함하므로 빌드 쪽 필수 변경은 없습니다(lazy 처리는 파일 단위로 이미 동작).

## 14. 알려진 한계
- 현재는 입학학년도 2027 한 해만 있습니다. 추가되면 `entryYear`로 구분됩니다(`subjectKey`·`area`는 그대로 비교 가능).
- `kindGuess`는 다른 학교 기반 추정이라 틀릴 수 있습니다(구분은 학교마다 다름).
- 교과군 규칙은 공식 교육과정 문서가 아니라 과목명 기준 수작업 분류입니다.
- 선수·연계 과목과 학기별 실제 개설 여부는 DB에 없습니다(§7-1).

**프로토타입 렌더 구조(참고)**: `docs/prototype/index.html`의 편제표 화면은 `cStats`(통계·불일치 계산) → `vTerm`/`vSum`/`vCmp`(HTML 생성) → `drawCurr`(상태: 선택 학교·보기)입니다. 본 코드에서는 `cStats` 대신 `summary.json`의 값을 쓰면 됩니다.
