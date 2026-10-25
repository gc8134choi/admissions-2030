# 2028학년도 대입 대시보드

비밀번호로 보호되는 정적 웹 대시보드(GitHub Pages). 저장소는 공개지만 **자료는 암호화**되어 올라갑니다.

## 구조

```
content/            # 비공개 원본 (.gitignore, 절대 커밋하지 않음)
  site.json         # 메뉴 목록: { title, sections: [{ id, title, type, data }] }
  <섹션>.json        # 섹션별 데이터
  files/            # 이미지 등 원본 파일
content.example/    # content/ 시작용 템플릿
build.mjs           # content/ → vault/ 암호화
vault/              # 암호화 결과 (커밋 대상)
index.html, assets/ # 비밀번호 화면 + 렌더러
```

메뉴는 `site.json`의 `sections`로 정해지며, 내용이 바뀌면 항목만 추가/삭제하면 됩니다.

## 섹션 유형 (`type`)

| type | 데이터 형식 |
|---|---|
| `gallery` | `{ "items": [{ "school", "year", "title?", "note?", "source?", "image" 또는 "images": [...] }] }` — `image`는 `content/` 기준 상대경로 |
| `table` | `{ "columns": [{ "key", "label" }], "rows": [{...}] }` |
| `cards` | `{ "items": [{ "title", "date?", "summary?", "note?", "source?" }] }` |

새 유형은 `assets/app.js`의 `renderers`에 추가합니다.

## 사용법

```bash
cp -R content.example content          # 최초 1회
# content/ 에 자료 추가 후
DAEIP_PASSWORD='비밀번호(8자 이상)' node build.mjs
python3 -m http.server 8000            # http://localhost:8000 에서 확인
git add -A && git commit -m "update" && git push
```

## 보안 참고

- 암호화: PBKDF2-SHA256(25만 회) + AES-256-GCM. 비밀번호가 약하면 오프라인 대입 공격에 취약하니 길게 정하세요.
- 비밀번호를 바꾸면 `build.mjs`를 다시 실행해 vault를 갱신해야 합니다. 이미 공개된 이전 vault는 git 기록에 남습니다.
- `content/`와 비밀번호는 저장소에 올리지 마세요.

## 배포

저장소 Settings → Pages → Branch `main` / root.
