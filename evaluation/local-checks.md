# 로컬 전체 점검 절차 (E3)

정본 데이터·화면·저장 데이터가 함께 안전한지 한 번에 확인하는 절차다. 배포 전·큰 개편 뒤에 돌린다.

## 1. 생성 데이터 검증(파일을 쓰지 않고 검사)
```bash
for f in tools/build-*.mjs; do echo "== $f"; node "$f" --check || break; done
```
(--check를 지원하지 않는 스크립트는 건너뛰어도 된다. 하나라도 실패하면 먼저 고친다.)

## 2. 화면 점검(로컬 서버: `python3 -m http.server 8000`)
```bash
python3 tools/pm/sitecheck.py http://localhost:8000/portal/     # 25화면×4폭 + 다크·라이트 강제
python3 tools/pm/layoutcheck.py http://localhost:8000/portal/   # 갇힌 줄·가로 스크롤
python3 tools/pm/density.py http://localhost:8000/portal/       # 글자 수·높이·DOM·보이는 출처
```

## 3. 저장 데이터 보존(사진·계획표·주로 보는 단계·화면 모드·허브 고정)
```bash
python3 tools/pm/preserve-check.py http://localhost:8000/portal/
```
심은 값이 새로고침, 화면 이동, 서비스 워커·캐시 초기화 뒤에도 남는지 확인한다. 저장 키: portal.focus, portal.plan.univ, portal.theme, portal.home.pins, IndexedDB portal-photos/p. 새 저장 키를 만들면 이 스크립트의 심는 값·기대값에 추가한다.

## 4. 배포 뒤(Pages)
배포 주소를 인자로 같은 스크립트를 돌리고, Lighthouse(모바일) 3회 중앙값을 기록한다(기준: 홈 63 이상, 접근성 95 이상).
