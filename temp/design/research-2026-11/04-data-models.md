# 참고 진학·교육 서비스의 데이터 구조 조사 (2026-11-01)

한계: 이 세션에서 open.neis.go.kr, data.go.kr, collegescorecard.ed.gov 접속이 막혀(네트워크 허용 목록 밖) 원문 명세를 못 읽었다. 검색 요약·2차 자료에 근거한 부분은 '미검증'.

## 1. 출처별 조사

**NEIS 교육정보 개방 포털** ([포털](https://open.neis.go.kr), [데이터포털 등록](https://data.go.kr/data/15139198/openapi.do))
- 엔티티: schoolInfo(학교 기본) -> classInfo(학급), 시간표(학년도·학기·학년·교시), SchoolSchedule(학사일정), 급식, 학과·계열·강의실([neispy 예제](https://github.com/SaidBySolo/neispy)).
- 식별자: ATPT_OFCDC_SC_CODE(시도교육청) + SD_SCHUL_CODE(표준학교코드), 대부분 API가 쌍으로 요구. 학교코드 단독 유일성은 미검증.
- 갱신·제공: 학교 입력 기반 상시, 인증키 REST. 필드 전체·호출 제한·이용허락은 미검증.
- 통합 후보: 학교 코드 매핑, 학사일정(빌드 시 스냅샷). 구조 참고: 학교×학년×학기 시간표.

**학교알리미** ([사이트](https://www.schoolinfo.go.kr), [메타](https://www.data.go.kr/biz/dcat/metadata/15156298.do))
- 초·중·고 약 12,000개교, 2008년부터 항목별 연 1회 이상 공시. 분류: 기본 현황, 학생·교원, 교육여건, 재정, 성과. 데이터포털에 항목별 OpenAPI 개별 등록.
- 식별자·공시기준일·필드: 미검증.
- 통합 후보: 학급수·학생수, 교육과정 편성(편제표 대조), 졸업생 진학 현황. 구조 참고: 항목 단위로 기준일을 갖는 공시.

**대학알리미·대학어디가·대교협** ([어디가 기사](https://www.dhnews.co.kr/news/view/1065581092329592), [대교협](https://kcue.or.kr/en/work/admission.php), [OpenAPI 15158684](https://www.data.go.kr/catalog/15158684/openapi.json))
- 어디가는 커리어넷·대학알리미·입학정보를 통합(일반대 약 195~198개교). 대학알리미는 신입생 충원율·경쟁률·취업률 등 약 26개 항목(2014 보도). 데이터포털 '대학정보공시 학생 현황' OpenAPI는 이용허락 제한 없음 표기.
- 시행계획의 기계 가독 제공 여부, 대학 코드 체계: 미검증(PDF·엑셀 배포가 주로 추정).
- 통합 후보: 충원율·경쟁률 시계열. 모집단위·전형은 구조만 참고.

**공공데이터포털**: 위 API의 등록처. 파일/OpenAPI 병존, 항목별 갱신주기·이용허락(공공누리 유형)이 달라 항목마다 확인 필요(미검증).

**US College Scorecard** ([문서](https://collegescorecard.ed.gov/data/documentation), [기관 PDF](https://collegescorecard.ed.gov/assets/InstitutionDataDocumentation.pdf))
- 기관 단위 + 전공(field of study) 단위 파일, 변수명·API 필드를 대응한 xlsx 데이터 사전. 키는 UNITID(IPEDS)와 OPEID(6자리는 본캠퍼스 묶음, 1:1 아님), 크로스워크 파일 제공. API `/v1/schools`, 키 필요. 라이선스 조항 미검증.
- 참고: 데이터 사전 분리, ID 크로스워크.

**IPEDS** ([NCES](https://nces.ed.gov/IPEDS/survey-components/4))
- 12~13개 조사 구성(IC, 졸업 C, 등록 E12, 비용 CST 등), 키 UNITID, 조사×연도별 CSV와 사전, 1980-81부터. 참고: 조사×연도를 파일 단위로 하는 시계열.

**UCAS / Unistats** ([OfS](https://www.officeforstudents.org.uk/media/1694/session-4-unistats-ilr-seminar-handout.pdf), [용어집](https://www.ucas.com/media/139176/download))
- UCAS 공개 API는 확인 못함(미검증). Unistats XML은 Institution -> KISCourse -> Location/Accreditation, UCASPROGID·UCASCourseID가 키. 참고: 기관과 코스(모집단위)를 별도 엔티티로 두고 요건은 코스에 부착.

**Common App / BigFuture / Niche** ([요건 안내](https://www.commonapp.org/static/b3762fa9c700b955e9b8922d5582658e/College-Rq-Worksheet_3.pdf), [BigFuture](https://highered.collegeboard.org/recruitment-admissions/management/bigfuture-college-profile/build), [Niche](https://www.niche.com/about/data/))
- Common App은 대학별 마감·수수료·시험 정책(always/sometimes/never)·에세이·추천인을 속성화하고 연도마다 대학별 문항이 롤오버되지 않는다. BigFuture 프로필은 Common Data Set 문항 체계를 따른다. Niche는 공공 데이터 + 자체 설문. 공개 API·내부 스키마는 미검증. 참고: 요건을 열거형 속성으로, 표준 문항 세트로 비교성 확보.

## 2. 우리 모델과의 비교
강점: 안정 과목 코드(sj-), status·sources·checkedAt 공통 필드, 정본/생성물 분리, 스키마·참조 CI, 시점별 규칙(rules.json), 대학 id 분리(s-9xx).
격차: 외부 표준코드 없음 / 지표 시계열 없음 / 전형·모집단위가 `track` 열거 + `unitName` 문자열로 평탄 / 출처가 행마다 인라인 복제 / 변경 이력이 `index.json.changes[]`와 policy 로그에 분산 / 최저학력기준·전형 요소 등 비교 가능 속성 약함 / 데이터 사전이 스키마 설명에만 존재.

## 3. 개선 제안 10개

| # | 제안 | 우선 | 난이도 |
|---|---|---|---|
| 1 | 학교 `externalIds`(NEIS 시도교육청코드+학교코드, 학교알리미 코드), 빌드 시 schoolInfo 조회로 검증 | 높음 | 낮음 |
| 2 | 출처를 `sources.json`(id·URL·kind·기관·확인일)으로 분리, 행은 `sourceIds` 참조 | 높음 | 중간 |
| 3 | 지표 시계열 `metrics`: {대상 id, metricKey, period, value, unit, asOf, sourceId, status} 롱 포맷 | 높음 | 중간 |
| 4 | 전형(tracks)과 모집단위(units)를 엔티티로 분리, admission_rules는 참조 | 높음 | 중간 |
| 5 | 변경 이력 `changes.json`(대상 id·필드·이전/새 값·일시·사유·PR) 자동 생성 | 중간 | 중간 |
| 6 | 대학 요건 정규화: csatMinimum을 {areas, grade, count, subjectsRule}로 구조화, 전형 요소 비중·정원 속성화 | 중간 | 높음 |
| 7 | 기계 가독 `data-dictionary.json`을 스키마에서 생성해 배포 | 중간 | 낮음 |
| 8 | offerings·rules 공통 `validFrom/validTo`·`asOf` 효력 구간 | 중간 | 중간 |
| 9 | NEIS 학사일정 스냅샷을 events 후보로 가져오는 임포터(출처 명시, 학교 지역) | 낮음 | 중간 |
| 10 | 대학 기관 코드 매핑(대학알리미 코드)과 충원율·경쟁률 시계열 연결 | 낮음 | 중간 |

우선순위 근거: 1~4는 이후 모든 통합의 전제이고 비용이 작다. 6은 가치가 크나 요강 원문 대조 인력이 필요해 후순위.

## 4. 미검증 목록
NEIS 엔드포인트별 필드·호출 제한·이용허락, 학교알리미 OpenAPI 필드·공시기준일, 대교협 시행계획의 기계 가독 제공, Scorecard API 라이선스, UCAS 공개 API 유무. 위 세 도메인을 허용하면 원문으로 재확인 가능.
