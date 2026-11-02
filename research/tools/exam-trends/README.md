# 내신 평가 비율 추출·검증

학교알리미 4-가 "교과별(학년별) 교수·학습 및 평가계획" 공시 첨부 파일(hwp·hwpx·pdf·zip)에서 과목별 정기시험·수행평가 반영 비율을 읽어 `research/data/exam-trends-draft.json`에 넣는다.

- `exam_parse.py` 파일 → 텍스트, 과목명·비율 추출(`extract_strict`).
- `compute.py` 캐시 폴더에서 학교별 행 계산. 같은 과목에 비율이 둘이거나 과목명을 원문의 표 제목·머리표에서 확인하지 못하면 제외.
- `verify.py` 초안의 모든 행을 원문 재계산과 전수 대조(과목명·학년·지필·수행, 합 100, 중복, 영어 영역). 불일치 0이면 종료 코드 0.

캐시 구조: `<cache>/dl/<placeId>_<seq>.<ext>`, `<cache>/zx/<placeId>_<seq>/<파일>`(zip을 푼 것), `<cache>/hc_g1.hwp`~`hc_g3.hwp`(홍천). 파일은 학교알리미 학교 페이지의 일반 다운로드 링크로 내려받는다(자동입력 방지가 있는 항목은 받지 않는다).

```
pip install olefile pymupdf
python3 research/tools/exam-trends/verify.py --cache <캐시 폴더>
```

## 독립 검증 (verify2.py, 2026-11-02 추가)
`verify.py`는 초안을 만든 파서와 같은 코드로 다시 계산하므로 파서의 오류(학년·과목명·비율 오독)를 잡지 못한다.
`verify2.py`는 파서를 쓰지 않고 원문을 다시 읽는다: 학년은 파일(첨부 순서·파일명·표지 표)로만 정하고, 과목은 '평가 세부 계획' 제목 또는 총괄표 교과 칸, 비율은 표의 열 이름을 먼저 읽어 그 열 수만큼 뒤따르는 %를 대응시킨다.
`python3 research/tools/exam-trends/verify2.py --cache <폴더>` — 불일치가 있으면 종료 코드 1. 독립 읽기가 못 읽은 행은 통과가 아니므로 `LIST_UNREAD=1`로 목록을 보고 원문과 직접 대조한다. 사람이 원문으로 바로잡은 행은 `tools/exam-trends-manual.json`의 `parserCorrections`에 이유와 함께 적는다(verify.py가 이 행만 불일치를 허용).
