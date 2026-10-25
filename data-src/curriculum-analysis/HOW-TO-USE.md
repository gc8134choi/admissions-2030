# 사용 방법

이 폴더는 편제표 분석을 다른 프로젝트로 옮기기 위한 묶음입니다. 구조는 원래 프로젝트와 같아서 그대로 풀어서 실행할 수 있습니다.

```
README.md                 분석 정리(결론, 학교별 비교, 수능 영역 매핑, 규칙, 교훈) ← 먼저 읽기
HOW-TO-USE.md             이 파일
content/curriculum/*.json 전사본 원본(정본, 학교 4개)
content/data/schools.json 학교 엔티티(id가 연결 키)
tools/build-db.mjs        DB 생성기(Node 18+, 외부 패키지 없음)
tools/db-rules.json       교과군·수능 영역 분류 규칙, 근거 URL
docs/db-schema.md         DB 스키마 상세
docs/school-lookup.md     학교 기본정보 조사와 출처
```

## 실행
```bash
node tools/build-db.mjs --check   # 검증만 (오류 0이어야 정상, 경고 1은 풍덕 구분 미표기)
node tools/build-db.mjs           # content/db/ 생성 (오류가 없을 때만 교체)
```

## 새 프로젝트에 합칠 때
- 기존 `content/`, `tools/`가 있는 프로젝트라면 위 폴더를 같은 경로에 복사하세요(`content/curriculum`, `content/data/schools.json`, `tools/build-db.mjs`, `tools/db-rules.json`).
- 새 학교를 추가하면 전사본을 `content/curriculum/`에 넣고 `schools.json`에 등록한 뒤 실행합니다. 과목이 규칙에 없으면 경고가 나오고 `tools/db-rules.json`의 `areaBySubject`에 추가하면 됩니다.
- 화면용 사진(`displayImage`)은 꺼져 있습니다(`db-rules.json`의 `images.enabled: false`). 원본 사진은 이 묶음에 넣지 않았습니다.

## 주의
- **학교 이름이 들어 있습니다. 공개 저장소에 올리지 마세요.**
- 편제표 값은 AI가 사진에서 옮긴 것이며 일부(flag 달린 22행)만 사진과 대조했습니다.
- 학교 id `school-yonginheungcheon`은 옛 오타 표기에서 유래했지만(학교 이름은 용인홍천고) 연결 키라 바꾸지 않았습니다.
