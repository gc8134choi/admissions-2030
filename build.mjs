// content/ (비공개 원본) → vault/ (암호화본, 저장소에 올림)
// 사용: node build.mjs  (비밀번호는 화면에 보이지 않게 입력. 명령어에 비밀번호를 적지 마세요 — README 참고)
//
// - 결과는 임시 폴더에 만들고, 끝까지 성공했을 때만 vault/ 로 바꿔 넣는다(실패하면 기존 vault/ 는 그대로).
// - 파일 암호화 키(.secrets/vault-file.key)는 고정이고, IV·파일 id 는 내용의 HMAC 으로 만든다.
//   내용이 같으면 암호문도 같은 바이트라서 git 기록이 빌드마다 불어나지 않는다.
import { createCipheriv, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { chmodSync, existsSync, globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { askNewPassword } from "./tools/lib/ask-password.mjs";
import { swapDir } from "./tools/lib/swap-dir.mjs";
import { MIN_PASSWORD, PASSWORD_HINT } from "./tools/lib/policy.mjs";

const ITERATIONS = 1_000_000; // assets/crypto.js 와 동일해야 함
// 이미지는 vault 에 넣지 않는다(편제표 사진은 대시보드에서 쓰지 않음). 사진 기능을 다시 쓸 때만 true 로 바꾸고,
// tools/verify-vault.mjs 의 ALLOWED_IMAGES 와 index.html 의 CSP(img-src blob:)도 함께 바꿔야 한다.
const IMAGES_ENABLED = false;
const SUPPORTED_DB_MAJOR = "2"; // content/db/index.json 의 version 주 버전
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const CONTENT = process.env.CONTENT_DIR || join(ROOT, "content");
const VAULT = process.env.VAULT_DIR || join(ROOT, "vault");
const SECRETS = process.env.SECRETS_DIR || join(ROOT, ".secrets");
const STAGE = `${VAULT}.build-${process.pid}`;
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf" };

const cleanup = () => rmSync(STAGE, { recursive: true, force: true });
const fail = (msg) => {
  console.error(msg);
  cleanup();
  console.error("vault 는 바뀌지 않았습니다.");
  process.exit(1);
};

// ---- 고정 파일 키(.secrets, 권한 0600). 없으면 처음 한 번만 만든다.
function loadFileKey() {
  const path = join(SECRETS, "vault-file.key");
  if (existsSync(path)) {
    const key = Buffer.from(readFileSync(path, "utf8").trim(), "base64");
    if (key.length !== 32) throw new Error(`${path} 의 키 길이가 올바르지 않습니다(32바이트여야 함).`);
    chmodSync(path, 0o600);
    return key;
  }
  mkdirSync(SECRETS, { recursive: true, mode: 0o700 });
  const key = randomBytes(32);
  writeFileSync(path, key.toString("base64") + "\n", { mode: 0o600 });
  console.log(`새 파일 키를 만들었습니다: ${path} (git 에 올리지 말고 백업하세요)`);
  return key;
}

let password = process.env.DAEIP_PASSWORD;
if (!password) {
  try {
    password = await askNewPassword(); // 입력이 화면에 보이지 않고, 두 번 입력해 오타를 막는다
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
if (!password || [...password].length < MIN_PASSWORD) {
  console.error(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다. (${PASSWORD_HINT})`);
  process.exit(1);
}
if (!existsSync(join(CONTENT, "site.json"))) {
  console.error(`${CONTENT}/site.json 이 없습니다. content.example/ 을 content/ 로 복사해서 시작하세요.`);
  process.exit(1);
}

try {
  const fileKey = loadFileKey();
  const sub = (label) => createHmac("sha256", fileKey).update(label).digest();
  const ivKey = sub("daeip/iv/v1"), idKey = sub("daeip/id/v1"), saltKey = sub("daeip/manifest-salt/v1");
  const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

  // 합성 IV: IV = HMAC(ivKey, 평문)의 앞 12바이트. 같은 평문이면 같은 암호문, 다른 평문이면 다른 IV.
  function encrypt(key, plain) {
    const iv = hmac(ivKey, plain).subarray(0, 12);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([c.update(plain), c.final()]);
    return Buffer.concat([iv, ct, c.getAuthTag()]); // WebCrypto 형식: 태그가 끝에 붙음
  }

  rmSync(STAGE, { recursive: true, force: true });
  mkdirSync(STAGE, { recursive: true });
  if (IMAGES_ENABLED) mkdirSync(join(STAGE, "files"), { recursive: true });
  const files = {}; // id -> mime

  // 화면에 쓸 수 있는 이미지는 files/display/(생성본)와 files/masked/(가림본)뿐이다. 원본(files/inbox)은 거부한다.
  const ALLOWED_IMAGE_DIRS = ["files/display/", "files/masked/"];
  function addFile(rel) {
    const norm = rel.replace(/^\.?\//, "");
    if (norm.split("/").includes("..") || isAbsolute(norm) || !ALLOWED_IMAGE_DIRS.some((d) => norm.startsWith(d))) {
      throw new Error(`허용되지 않은 이미지 경로입니다: ${rel} (화면용 이미지는 ${ALLOWED_IMAGE_DIRS.join(" 또는 ")} 아래 생성본만 쓸 수 있고, 원본 files/inbox/ 는 vault 에 넣을 수 없습니다)`);
    }
    const buf = readFileSync(join(CONTENT, norm));
    const id = hmac(idKey, buf).toString("hex").slice(0, 20);
    if (!files[id]) {
      files[id] = MIME[extname(rel).toLowerCase()] || "application/octet-stream";
      writeFileSync(join(STAGE, "files", `${id}.enc`), encrypt(fileKey, buf));
    }
    return id;
  }

  // image / displayImage / images: IMAGES_ENABLED 가 꺼져 있으면 값을 지우고 아무 파일도 싣지 않는다.
  // 켜져 있으면 content/ 기준 경로를 암호화된 파일 id 로 치환한다.
  // sourceImage 는 비공개 원본 경로라 항상 vault 에 넣지 않고 지운다. files/inbox/ 로 시작하는 문자열도 지운다.
  const IMAGE_KEYS = new Set(["image", "displayImage", "images"]);
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (k === "sourceImage") delete node[k];
      else if (IMAGE_KEYS.has(k) && !IMAGES_ENABLED) delete node[k];
      else if ((k === "image" || k === "displayImage") && typeof v === "string") node[k] = addFile(v);
      else if (k === "images" && Array.isArray(v)) node[k] = v.map((p) => (typeof p === "string" ? addFile(p) : p));
      else if (typeof v === "string" && v.startsWith("files/inbox/")) delete node[k]; // 원본 경로가 남지 않게
      else walk(v);
    }
  }

  const readJson = (rel) => JSON.parse(readFileSync(join(CONTENT, rel), "utf8"));

  // data: "a.json"(파일 하나) | "db/*.json" 또는 ["a.json", "db/**/*.json"](글롭·목록).
  // 글롭·목록이면 { "<상대경로, .json 제외>": 내용 } 형태로 묶어 넣는다.
  function loadData(spec) {
    if (typeof spec === "string" && !/[*?{}[\]]/.test(spec)) return readJson(spec);
    const out = {};
    for (const pattern of Array.isArray(spec) ? spec : [spec]) {
      if (typeof pattern !== "string" || isAbsolute(pattern) || pattern.split("/").includes("..")) {
        throw new Error(`data 경로가 올바르지 않습니다(content/ 안의 상대경로만 허용): ${pattern}`);
      }
      const matches = globSync(pattern, { cwd: CONTENT }).filter((p) => p.endsWith(".json")).sort();
      if (!matches.length) throw new Error(`data 패턴과 일치하는 .json 파일이 없습니다: ${pattern}`);
      for (const m of matches) out[m.replace(/\.json$/, "")] = readJson(m);
    }
    return out;
  }

  // 통합 DB(content/db/index.json) 계약 확인: version 주 버전이 맞고, files[] 에 적힌 파일이 모두 실려 있어야 한다.
  function checkDbContract(sectionId, data) {
    for (const [key, idx] of Object.entries(data)) {
      if (!/(^|\/)index$/.test(key) || !idx || typeof idx !== "object" || !Array.isArray(idx.files) || typeof idx.version !== "string") continue;
      if (idx.version.split(".")[0] !== SUPPORTED_DB_MAJOR) {
        throw new Error(`섹션 ${sectionId}: DB version ${idx.version} 은 이 빌드가 지원하는 ${SUPPORTED_DB_MAJOR}.x 가 아닙니다. docs/db-schema.md 변경 이력을 확인하세요.`);
      }
      const prefix = dirname(key) === "." ? "" : `${dirname(key)}/`;
      const missing = idx.files.map((f) => f.name).filter((name) => !(`${prefix}${name.replace(/\.json$/, "")}` in data));
      if (missing.length) throw new Error(`섹션 ${sectionId}: index.json 의 files[] 에 있는 ${missing.join(", ")} 이(가) 데이터에 없습니다.`);
      console.log(`  섹션 ${sectionId}: DB v${idx.version} 계약 확인 (파일 ${idx.files.length}개)`);
    }
  }

  // 데이터 싣는 방식(섹션의 load): "inline" = manifest 안에 그대로(로그인 때 한 번 복호화),
  // "lazy" = 파일별로 따로 암호화해 vault/data/<id>.enc 에 두고 manifest 에는 { "$lazy": id, bytes } 표식만 둔다,
  // "auto"(기본) = 섹션 데이터 합계가 inlineMaxBytes(기본 512KB) 이하면 inline, 넘으면 lazy.
  const INLINE_MAX = 512 * 1024;
  const dataFiles = {}; // id -> bytes (lazy 로 저장한 데이터 파일)

  function packLazy(value) {
    const json = JSON.stringify(value);
    const id = hmac(idKey, json).toString("hex").slice(0, 20);
    mkdirSync(join(STAGE, "data"), { recursive: true });
    writeFileSync(join(STAGE, "data", `${id}.enc`), encrypt(fileKey, Buffer.from(json)));
    dataFiles[id] = Buffer.byteLength(json);
    return { $lazy: id, bytes: dataFiles[id] };
  }

  // 메뉴: site.json 의 sections 는 섹션이거나 그룹({ id, icon, title, children: [섹션…] })이다.
  // 섹션은 { id, title, type, data?, load?, icon?, pri?, message? }. data 가 없으면 빈 데이터(다른 섹션의 DB 를 화면이 직접 읽음).
  // 화면에 쓰는 문구(message 등)는 암호화된 manifest 안에만 들어가므로 공개 코드에는 적지 않는다.
  const site = readJson("site.json");
  const seenIds = new Set();
  function buildSection(s) {
    if (s.hidden) return null;
    if (seenIds.has(s.id)) throw new Error(`섹션 id 가 중복입니다: ${s.id}`);
    seenIds.add(s.id);
    if (Array.isArray(s.children)) {
      const children = s.children.map(buildSection).filter(Boolean);
      if (!children.length) { console.log(`  그룹 ${s.id}: 비어 있어 숨김`); return null; }
      return { id: s.id, title: s.title, icon: s.icon, children };
    }
    const meta = { id: s.id, title: s.title, type: s.type, icon: s.icon, pri: s.pri, message: s.message };
    for (const k of Object.keys(meta)) if (meta[k] === undefined) delete meta[k];
    if (s.data === undefined) {
      console.log(`  섹션 ${s.id}: 데이터 없음(화면이 DB 를 직접 읽음)`);
      return { ...meta, data: {} };
    }
    const multi = !(typeof s.data === "string" && !/[*?{}[\]]/.test(s.data));
    const data = loadData(s.data);
    if (multi) checkDbContract(s.id, data);
    walk(data);
    const mode = s.load || "auto";
    if (!["inline", "lazy", "auto"].includes(mode)) throw new Error(`섹션 ${s.id}: load 는 inline|lazy|auto 중 하나여야 합니다 (${mode})`);
    const bytes = Buffer.byteLength(JSON.stringify(data));
    const lazy = mode === "lazy" || (mode === "auto" && bytes > (s.inlineMaxBytes ?? INLINE_MAX));
    console.log(`  섹션 ${s.id}: ${(bytes / 1024).toFixed(1)}KB → ${lazy ? "lazy(파일별 암호화)" : "inline"}`);
    if (!lazy) return { ...meta, data };
    const packed = multi ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, packLazy(v)])) : packLazy(data);
    return { ...meta, lazy: true, data: packed };
  }
  const sections = site.sections.map(buildSection).filter(Boolean);
  const countLeaves = (list) => list.reduce((n, x) => n + (x.children ? countLeaves(x.children) : 1), 0);

  const payload = { title: site.title, updated: new Date().toISOString().slice(0, 10), fileKey: fileKey.toString("base64"), files, dataFiles, sections };
  const salt = hmac(saltKey, "manifest").subarray(0, 16); // 고정 키에서 만든 salt(같은 비밀번호·내용이면 같은 manifest)
  const key = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  writeFileSync(join(STAGE, "manifest.enc"), Buffer.concat([salt, encrypt(key, Buffer.from(JSON.stringify(payload)))]));

  swapDir(STAGE, VAULT); // 여기까지 성공했을 때만 vault/ 를 교체한다
  console.log(`완료: 섹션 ${countLeaves(sections)}개, 이미지 ${Object.keys(files).length}개, 지연 로딩 데이터 ${Object.keys(dataFiles).length}개 → ${VAULT}`);
} catch (e) {
  fail(`빌드 실패: ${e.message}`);
}
