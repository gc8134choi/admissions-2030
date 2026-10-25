// content/ (비공개 원본) → vault/ (암호화본, 저장소에 올림)
// 사용: DAEIP_PASSWORD='비밀번호' node build.mjs
import { createCipheriv, createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

const ITERATIONS = 250000; // assets/crypto.js 와 동일해야 함
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const CONTENT = process.env.CONTENT_DIR || join(ROOT, "content");
const VAULT = process.env.VAULT_DIR || join(ROOT, "vault");
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf" };

function encrypt(key, plain) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]); // WebCrypto 형식: 태그가 끝에 붙음
}

let password = process.env.DAEIP_PASSWORD;
if (!password) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("비밀번호: ");
  rl.close();
}
if (!password || password.length < 8) {
  console.error("비밀번호는 8자 이상이어야 합니다.");
  process.exit(1);
}
if (!existsSync(join(CONTENT, "site.json"))) {
  console.error(`${CONTENT}/site.json 이 없습니다. content.example/ 을 content/ 로 복사해서 시작하세요.`);
  process.exit(1);
}

const fileKey = randomBytes(32);
const files = {}; // id -> mime
rmSync(VAULT, { recursive: true, force: true });
mkdirSync(join(VAULT, "files"), { recursive: true });

function addFile(rel) {
  const buf = readFileSync(join(CONTENT, rel));
  const id = createHash("sha256").update(buf).digest("hex").slice(0, 20);
  if (!files[id]) {
    files[id] = MIME[extname(rel).toLowerCase()] || "application/octet-stream";
    writeFileSync(join(VAULT, "files", `${id}.enc`), encrypt(fileKey, buf));
  }
  return id;
}

// image / images 값(콘텐츠 기준 상대경로)을 암호화된 파일 id 로 치환
function walk(node) {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (k === "image" && typeof v === "string") node[k] = addFile(v);
    else if (k === "images" && Array.isArray(v)) node[k] = v.map((p) => (typeof p === "string" ? addFile(p) : p));
    else walk(v);
  }
}

const site = JSON.parse(readFileSync(join(CONTENT, "site.json"), "utf8"));
const sections = site.sections.map((s) => {
  const data = JSON.parse(readFileSync(join(CONTENT, s.data), "utf8"));
  walk(data);
  return { id: s.id, title: s.title, type: s.type, data };
});

const payload = { title: site.title, updated: new Date().toISOString().slice(0, 10), fileKey: fileKey.toString("base64"), files, sections };
const salt = randomBytes(16);
const key = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
writeFileSync(join(VAULT, "manifest.enc"), Buffer.concat([salt, encrypt(key, Buffer.from(JSON.stringify(payload)))]));

console.log(`완료: 섹션 ${sections.length}개, 파일 ${Object.keys(files).length}개 → ${VAULT}`);
