// 한 명령 릴리스: 검증 → 암호화 빌드(임시 폴더) → vault 점검 → 통과했을 때만 vault/ 교체
// 사용: node tools/release.mjs   (비밀번호는 숨김 입력. 명령어에 적지 마세요)
//
// 1) tools/validate-curriculum.mjs   전사본 학점 합계 검증
// 2) tools/build-db.mjs --check      통합 DB 검증(파일을 쓰지 않음)
// 3) build.mjs                       임시 폴더(.vault-staging)에 암호화 빌드
// 4) tools/verify-vault.mjs          임시 vault 복호화·원본 유출 점검(--deny 는 가림 처리한 학교의 원본 사진)
// 5) 모두 통과하면 .vault-staging → vault/ 교체. 한 단계라도 실패하면 vault/ 는 그대로 둔다.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { askNewPassword } from "./lib/ask-password.mjs";
import { swapDir } from "./lib/swap-dir.mjs";
import { MIN_PASSWORD, PASSWORD_HINT } from "./lib/policy.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONTENT = process.env.CONTENT_DIR || join(ROOT, "content");
const VAULT = process.env.VAULT_DIR || join(ROOT, "vault");
const STAGING = join(dirname(VAULT), ".vault-staging"); // vault 와 같은 폴더 안(같은 파일시스템이라 이름 바꾸기로 교체 가능)

const step = (title) => console.log(`\n=== ${title} ===`);
function stop(msg) {
  console.error(`\n✗ ${msg}\nvault/ 는 바뀌지 않았습니다.`);
  rmSync(STAGING, { recursive: true, force: true });
  process.exit(1);
}
function run(title, args, env = {}) {
  step(title);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) stop(`${title} 단계가 실패했습니다.`);
}

// 가림 처리한 학교(display-images.json 에 마스킹 경로가 있는 학교)의 원본 사진은 vault 에 들어가면 안 된다.
function denyList() {
  const cfg = join(CONTENT, "data", "display-images.json");
  const curDir = join(CONTENT, "curriculum");
  if (!existsSync(cfg) || !existsSync(curDir)) return [];
  const images = JSON.parse(readFileSync(cfg, "utf8"));
  const deny = [];
  for (const f of readdirSync(curDir).filter((n) => n.endsWith(".json"))) {
    const cur = JSON.parse(readFileSync(join(curDir, f), "utf8"));
    const shown = images[cur.schoolId];
    if (shown && shown !== "$sourceImage" && cur.sourceImage && cur.sourceImage !== shown) deny.push(cur.sourceImage);
  }
  return deny;
}

let password = process.env.DAEIP_PASSWORD;
if (!password) {
  try {
    password = await askNewPassword();
  } catch (e) {
    stop(e.message);
  }
}
if ([...password].length < MIN_PASSWORD) stop(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다. (${PASSWORD_HINT})`);

const env = { DAEIP_PASSWORD: password }; // 비밀번호는 환경 변수로만 자식 프로세스에 전달한다(명령줄에 노출되지 않음)
rmSync(STAGING, { recursive: true, force: true });

run("1/4 전사본 검증", ["tools/validate-curriculum.mjs"]);
run("2/4 통합 DB 검증", ["tools/build-db.mjs", "--check"]);
run("3/4 암호화 빌드(임시 폴더)", ["build.mjs"], { ...env, VAULT_DIR: STAGING });
const deny = denyList();
console.log(`  원본 유출 점검 대상: ${deny.length ? deny.join(", ") : "(없음)"}`);
run("4/4 vault 점검(복호화·유출)", ["tools/verify-vault.mjs", ...deny.flatMap((d) => ["--deny", d])], { ...env, VAULT_DIR: STAGING });

step("vault/ 교체");
try {
  swapDir(STAGING, VAULT);
} catch (e) {
  stop(`vault/ 교체 실패: ${e.message}`);
}
console.log(`\n✓ 릴리스 완료: ${VAULT} 가 새로 만든 vault 로 바뀌었습니다.`);
console.log("다음: git add vault/ 후 커밋·푸시 (git add -A 는 쓰지 마세요)");
