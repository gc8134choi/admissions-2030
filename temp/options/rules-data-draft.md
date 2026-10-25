# rules.json 설계 초안 (수능 체제·내신 산출 시점별 버전) — 개발 서브 세션 작성, 조사 세션이 값 채움

ARCHITECTURE.md 로드맵 3단계. 목표: "2028 체제가 예나(2030)·예은(2033)에게도 이어지는가"를 **버전 데이터와 적용 상태**로 분리해 둔다. 값이 없으면 `null`로 두고 만들어 넣지 않는다.

## 원칙
1. 체제는 **버전**이다. 한 번 만든 버전은 고치지 않고, 개편이 공표되면 새 버전을 추가한다(`csat-2028` 옆에 `csat-2033` 등).
2. 버전과 학습자의 관계는 버전 안의 `appliesTo[]`가 말한다. 학습자 B의 2033이 "2028 체제 그대로"인지 "새 체제"인지는 `status`로 구분한다(확정/보도/추정).
3. 모든 버전·규칙에 `status`, `sources[]`(name·url·kind=official|media), `checkedAt`. 원문을 못 봤으면 `unverified:true`와 `unverifiedReason`.
4. 숫자·범위는 원문 값만. 문항 수·시간·점수는 현재 `policy.json`의 cur-08(수능 체제), cur-15(석차 비율)에 이미 있는 값에서 옮긴다.

## 파일 형태 (portal/data/rules.json, 생성물)
```json
{
  "_meta": { "version": "1.0.0", "note": "정본은 research/data/rules-draft.json" },
  "csatRegimes": [
    {
      "id": "csat-2028",
      "label": "통합형 수능(2028학년도~)",
      "status": "confirmed",
      "effectiveFromExamYear": 2028,
      "areas": [
        { "area": "국어", "items": 45, "points": 100, "minutes": 80, "scope": ["화법과 언어", "독서와 작문", "문학"], "elective": false },
        { "area": "수학", "items": 30, "points": 100, "minutes": 100, "scope": ["대수", "미적분Ⅰ", "확률과 통계"], "elective": false, "shortAnswerPercent": 30 },
        { "area": "영어", "items": 45, "points": 100, "minutes": 70, "scope": ["영어Ⅰ", "영어Ⅱ"], "listeningItems": 17, "elective": false },
        { "area": "한국사", "items": 20, "points": 50, "minutes": 30, "required": true },
        { "area": "탐구", "scope": ["통합사회", "통합과학"], "items": 25, "points": 50, "minutes": 40, "note": "사회·과학 각각 응시, 점수 분리 산출" },
        { "area": "직업", "items": 25, "points": 50, "minutes": 40, "scope": ["성공적인 직업생활"] },
        { "area": "제2외국어·한문", "points": 50, "minutes": 30, "pickOne": 9 }
      ],
      "excluded": ["심화수학"],
      "sources": [{ "name": "교육부 2028 대입 개편 확정안(2023.12.27)", "url": "https://www.korea.kr/briefing/policyBriefingView.do?newsId=156607888", "kind": "official" }],
      "appliesTo": [
        { "learner": "A", "examYear": 2030, "status": "estimated", "note": "2027.3 정부 중장기 개편안 공표 전까지 확정 아님" },
        { "learner": "B", "examYear": 2033, "status": "estimated", "note": "절대평가·서논술형 도입이 유력하게 검토되는 단계(보도)" }
      ],
      "detailRange": { "status": "estimated", "note": "시행 기본계획(2030학년도분 2029.3 전후 추정) 공고 전까지 세부 범위 미확정" },
      "checkedAt": "2026-10-25"
    },
    { "id": "csat-2033", "label": "2033학년도 수능(미정)", "status": "estimated", "effectiveFromExamYear": 2033, "areas": null, "note": "개편 검토 중. 값은 공표 후에 채운다.", "sources": [], "appliesTo": [{ "learner": "B", "examYear": 2033, "status": "estimated" }] }
  ],
  "gradingRules": [
    {
      "id": "gr-2028",
      "label": "고교 내신 5등급 상대평가(2028학년도 대입~)",
      "status": "confirmed",
      "rankGrades": { "cumulativePercent": [10, 34, 66, 90, 100], "bandPercent": [10, 24, 32, 24, 10] },
      "achievementLevels": { "common": "A~E 5단계", "pe_art_science_experiment": "A~C 3단계", "liberal": "P" },
      "noRank": ["사회·과학 융합선택", "체육·예술·과학탐구실험", "교양", "공동교육과정·온라인학교 개설 과목"],
      "completion": { "common": { "attendance": "2/3", "achievementPercent": 40 }, "elective": { "attendance": "2/3" }, "note": "2026.1.28 완화(선택과목은 출석률만), 2027학년도 전 학년 적용 예정" },
      "sources": [],
      "appliesTo": [
        { "learner": "A", "entryYear": 2027, "status": "estimated", "note": "2030학년도 내신 석차등급 폐지 초안은 확정 아님(보도)" },
        { "learner": "B", "entryYear": 2030, "status": "estimated" }
      ],
      "checkedAt": "2026-10-25"
    }
  ]
}
```

## 연결
- `appliesTo[].learner`는 learners.json의 id(A/B). 화면은 선택된 학습자의 `appliesTo`만 읽고, 상태가 `estimated`면 "아직 확정이 아니에요"를 조용히 표시한다.
- `policy.json` 행(adm-02 수능 체제, adm-04 내신, cur-08, cur-15)은 근거 서술로 남기고, 수치는 rules.json이 정본이 된다. 이관 후 policy 쪽 본문은 한 줄 요약+링크로 줄인다.
- 생성기: `tools/build-rules.mjs`(draft → portal/data/rules.json, 스키마·출처·status 검사, `--check`).

## 조사 세션에 요청할 것(값 채우기)
1. `research/data/rules-draft.json`을 위 형태로 작성: csat-2028(확정 값은 원문 확인 행만), csat-2033(미정 자리), gr-2028.
2. 2030·2033 적용 상태는 현재 알려진 보도·계획 기준으로 `estimated`/`reported`로만 표기(근거 URL 필수).
3. 모르는 값은 `null`. 출처를 못 열면 `unverified:true`와 사유.
4. 2027.3 개편안 공표 후에는 기존 버전을 고치지 말고 `csat-2030`처럼 새 버전을 추가하고 `appliesTo`만 옮긴다.

## 열린 질문
- 탐구 영역의 "사회·과학 각각 응시" 표현을 `areas[]` 한 행으로 둘지 두 행으로 나눌지(현 초안은 한 행+note).
- `appliesTo[].status`가 버전 `status`와 다를 때 화면이 어느 쪽을 우선해 보여 줄지(제안: appliesTo 우선).
