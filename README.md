# 2030학년도 대입 대시보드

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

메뉴는 `site.json`의 `sections`로 정해집니다. 항목은 **그룹**(`{ "id", "icon", "title", "children": [섹션…] }`)이거나 **섹션**(`{ "id", "title", "type", "pri?", "icon?", "message?", "data?", "load?" }`)이며, 화면에서는 왼쪽 메뉴(접이식 그룹)로 그려집니다(좁은 화면에서는 ☰ 메뉴로 접힘). 자식이 없는 그룹은 빌드가 숨깁니다. `data`가 없는 섹션은 통합 DB(`db` 섹션의 데이터)를 화면이 직접 읽습니다. `message` 같은 화면 문구는 암호화된 vault 안에만 들어갑니다.

## 섹션 유형 (`type`)

| type | 데이터 형식 |
|---|---|
| `gallery` *(현재 미사용)* | `{ "items": [{ "school", "year", "schoolId?", "title?", "note?", "source?", "image" 또는 "images": [...] }] }` — `image`는 `content/` 기준 상대경로 |
| `table` | `{ "columns": [{ "key", "label" }], "rows": [{...}] }` |
| `cards` | `{ "items": [{ "title", "date?", "summary?", "note?", "source?" }] }` |
| `home` · `timeline` · `hstypes` · `system` · `policy` · `sources` | 포털 화면(지금 할 일 · 일정 타임라인 · 고교 유형·전형 · 대입 제도 · 제도 변경 로그 · 출처·갱신 현황). 데이터는 DB의 `events` · `high-school-types` · `admission-system` · `policy` · `sources`(docs/db-schema.md §11)에서 읽습니다. 코드는 `assets/pages.js` |
| `soon` | "준비 중" 안내. 문구는 섹션의 `message` |
| `db` | 통합 DB(`content/db/`, `docs/db-schema.md`). 화면 5개: 학교 비교표 · 과목 검색 · 학교 상세 · 과목 매트릭스 · 학교 간 비교(2~4곳). 코드는 `assets/db-views.js` |

새 유형은 `assets/app.js`의 `renderers`에 추가합니다.

### 데이터 지정 (`data`)과 이미지 규칙

- `data`는 파일 하나(`"curriculum.json"`), 글롭(`"db/*.json"`, `**` 가능), 또는 목록(`["a.json", "db/*.json"]`)입니다. 글롭·목록이면 섹션 데이터가 `{ "<상대경로, .json 제외>": 내용 }` 형태가 됩니다(예: `db/index`, `db/offerings`). 경로는 `content/` 안의 상대경로만 허용하고, 일치하는 파일이 없으면 빌드가 실패합니다.
- **DB 계약 확인**: 글롭·목록 데이터에 `…/index.json`(통합 DB 색인)이 있으면 `version`의 주 버전이 빌드가 지원하는 값(현재 `2`)인지, `files[]`에 적힌 파일이 모두 실려 있는지 확인하고, 어긋나면 빌드를 중단합니다(vault는 그대로).
- 싣는 방식 `load`(섹션별): `"inline"`은 암호화된 manifest 안에 그대로 넣어 로그인할 때 한 번에 복호화하고, `"lazy"`는 파일별로 따로 암호화해 `vault/data/<id>.enc`에 두고 manifest에는 `{ "$lazy": id, bytes }` 표식만 남깁니다. 기본값 `"auto"`는 섹션 데이터 합계가 512KB 이하면 inline, 넘으면 lazy입니다(`inlineMaxBytes`로 기준 변경). 화면은 표식을 만나면 `vault/data/<id>.enc`를 받아 `assets/crypto.js`의 `decryptJson(fileKey, buf)`로 복호화합니다.
- **이미지는 vault에 넣지 않습니다(현재 정책).** 편제표 사진은 대시보드에서 쓰지 않습니다. `build.mjs`는 `IMAGES_ENABLED = false`라서 데이터의 `image`·`displayImage`·`images` 값을 지우고 이미지 파일을 하나도 싣지 않으며, `sourceImage`와 `files/inbox/`로 시작하는 문자열도 지웁니다. `content/files/`의 사진(원본·생성본)은 로컬에만 두고 vault에는 들어가지 않습니다.
- 사진 기능을 다시 쓰려면(코드는 비활성 상태로 남겨 둠): `build.mjs`의 `IMAGES_ENABLED`, `tools/verify-vault.mjs`의 `ALLOWED_IMAGES`, `assets/db-views.js`의 `SHOW_IMAGES`를 켜고, `index.html` CSP의 `img-src`에 `blob:`을 다시 넣고, `site.json`에 `gallery` 섹션을 추가합니다. 그때도 허용 이미지는 `files/display/`·`files/masked/` 아래 생성본뿐이고 원본(`files/inbox/`)은 빌드가 거부합니다.
- 점검: `node tools/verify-vault.mjs` (비밀번호는 숨김 입력) — 섹션·데이터 파일 목록을 보여주고, **vault에 이미지가 하나라도 있으면 실패**하며, `content/files/inbox/`의 원본 사진이 vault에 없는지(해시)와 원본 경로 문자열이 남지 않았는지 자동으로 확인합니다. `--deny <경로>`로 점검할 파일을 더 지정할 수 있습니다.

## 사용법

```bash
cp -R content.example content          # 최초 1회
# content/ 에 자료 추가 후, 한 명령으로 검증 → 빌드 → 점검 → vault 교체
node tools/release.mjs                 # 비밀번호(12자 이상)를 화면에 보이지 않게 두 번 입력
python3 -m http.server 8765 --bind 127.0.0.1   # http://localhost:8765 에서 확인(내 컴퓨터에서만 접속)
git add vault/ && git commit -m "update vault" && git push   # 데이터만 갱신할 때. git add -A 는 쓰지 마세요
```

- `tools/release.mjs`: ① `validate-curriculum` ② `build-db --check` ③ 임시 폴더에 암호화 빌드 ④ `verify-vault`로 복호화·원본 유출 점검 ⑤ 모두 통과했을 때만 `vault/`를 교체합니다. 한 단계라도 실패하면 `vault/`는 그대로입니다. 비밀번호는 자식 프로세스에 환경 변수로만 전달해 명령줄에 나타나지 않습니다.
- `node build.mjs`만 단독으로 쓸 수도 있습니다. 이 경우도 임시 폴더에 만들고 성공했을 때만 `vault/`를 교체합니다.
- **암호 설정**: PBKDF2-SHA256 100만 회 → AES-256-GCM. 비밀번호는 12자 이상이어야 합니다(최소 길이는 `tools/lib/policy.mjs` 한 곳에서 정하며, 무작위 단어 여러 개로 만든 긴 문장형 암호를 권장합니다).
- **고정 파일 키**: `.secrets/vault-file.key`(권한 0600, gitignore)에 파일 암호화 키를 두고 IV·파일 id를 내용의 HMAC으로 만듭니다. 내용이 같으면 암호문도 같은 바이트라서 빌드할 때마다 git 기록이 불어나지 않습니다. 이 키 파일을 잃으면 같은 암호문을 다시 만들 수 없으니(새 키로 새로 빌드는 가능) 백업해 두세요.

`http.server`는 프로젝트 폴더 전체를 보여 주므로 **반드시 `--bind 127.0.0.1`을 붙이세요**(안 붙이면 같은 네트워크의 다른 기기가 `content/`와 `.secrets/`를 받을 수 있습니다).

## 보안 참고

- **비밀번호를 명령어에 직접 적지 마세요.** 명령어는 터미널 화면과 셸 기록(history)에 그대로 남습니다. `node build.mjs`와 `node tools/verify-vault.mjs`는 비밀번호를 **숨김 입력**(글자가 화면에 나오지 않음)으로 묻습니다. `build.mjs`는 오타를 막으려고 두 번 입력받습니다.
- 환경 변수 `DAEIP_PASSWORD`로도 받을 수 있습니다(자동화용). 이때도 명령어에 적지 말고 숨김 입력으로 설정하세요.

  ```bash
  read -s "DAEIP_PASSWORD?비밀번호: "; echo; export DAEIP_PASSWORD   # zsh (macOS 기본). bash는 read -s -p "비밀번호: " DAEIP_PASSWORD
  node build.mjs
  unset DAEIP_PASSWORD                                                # 끝나면 지우기
  ```

- 암호화: PBKDF2-SHA256(25만 회) + AES-256-GCM. 비밀번호가 약하면 오프라인 대입 공격에 취약하니 길게 정하세요.
- 비밀번호를 바꾸면 `build.mjs`를 다시 실행해 vault를 갱신해야 합니다. 이미 공개된 이전 vault는 git 기록에 남습니다.
- `content/`와 비밀번호는 저장소에 올리지 마세요.

## 배포

저장소 Settings → Pages → Branch `main` / root.
