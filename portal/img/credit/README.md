# 고교학점제 이해 화면의 공식 이미지 슬롯

섹션마다 이미지 한 장을 `figure`(이미지 + 캡션 + 출처)로 넣을 수 있다. 파일이 없으면 슬롯은 보이지 않는다.

사용법: 이미지 파일을 이 폴더에 넣고 `manifest.json`의 해당 슬롯에 `file`, `caption`, `source`를 적는다.

```json
"credit-02-structure": { "file": "credit-02-structure.png", "caption": "졸업 학점 구성", "source": "교육부(2026) 자료명" }
```

| 슬롯 | 섹션 | 권장 파일명 |
|---|---|---|
| credit-00-hero | 상단 배너(자체 일러스트 대신 표시) | credit-00-hero.png |
| credit-01-overview | 한눈에 | credit-01-overview.png |
| credit-02-structure | 졸업 학점 구성 | credit-02-structure.png |
| credit-03-journey | 학년별 여정 | credit-03-journey.png |
| credit-04-requirements | 과목 이수 요건 | credit-04-requirements.png |
| credit-05-common | 공통과목 필수학점 | credit-05-common.png |
| credit-06-types | 과목 유형 | credit-06-types.png |
| credit-07-grading | 성적 산출 | credit-07-grading.png |
| credit-08-process | 과목 선택 절차 | credit-08-process.png |
| credit-09-university | 대학 권장이수과목과 학교 교육과정 | credit-09-university.png |
| credit-10-schools | 우리 4개교 | credit-10-schools.png |

`file`은 영문·숫자·`.-_`만 허용한다(경로 불가). 출처와 이용 조건을 확인한 이미지만 넣는다.
