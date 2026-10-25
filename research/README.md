# research
- `research/data/policy-draft.json` 필드 `region`: seoul | gyeonggi | national (시·도 단위 일정·규칙은 seoul/gyeonggi, 전국 제도는 national; 홈 다음 일정은 gyeonggi 우선 정렬).
- `entryYear`·`examYear`: 프로필 전용 행에만 값(현 중3=2027/2030, 현 초6=2030/2033), 전국 공통·참고 행은 null. 현 고3 일정은 examYear 2027 + audience grade3.
- 일정 행 필드: `learners`(['A']=예나, ['B']=예은, 생략=공통), `stage`(초졸·중입·중졸·고입·고교·대입), `region`. 참고 학년도(2028학년도 등)와 현 고3(2027) 행은 examYear를 채워 기본 화면에서 숨기고 현 고3 칩에서만 쓴다.
