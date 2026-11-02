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
