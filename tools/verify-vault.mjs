// vault/ 를 비밀번호로 복호화해 내용을 점검한다. (로컬 확인용)
// 사용: node tools/verify-vault.mjs [--deny files/xxx.jpg ...]  (비밀번호는 숨김 입력)
//  자동 점검(옵션 없이도 항상):
//   - content/files/inbox/ 의 모든 원본 사진이 vault 에 들어 있으면 실패
//   - content/files/display/·masked/ 의 허용 목록에 없는 파일이 vault 에 있으면 실패
//  --deny: content/ 기준 경로를 더 지정(그 파일의 내용이 vault 에 있으면 실패)
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { askHidden } from "./lib/ask-password.mjs";
import { decrypt, decryptJson, importFileKey, openManifest } from "../assets/crypto.js";

// 허용 이미지: 없음. vault 에 이미지가 하나라도 있으면 실패한다(편제표 사진은 대시보드에서 쓰지 않음).
// 사진 기능을 다시 쓸 때만 true 로 바꾼다(그러면 files/display·masked 허용 목록 점검이 적용된다).
const ALLOWED_IMAGES = false;

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VAULT = process.env.VAULT_DIR || join(ROOT, "vault");
const CONTENT = process.env.CONTENT_DIR || join(ROOT, "content");
const args = process.argv.slice(2);
const deny = args.flatMap((a, i) => (args[i - 1] === "--deny" ? [a] : []));

let password = process.env.DAEIP_PASSWORD || (await askHidden("비밀번호(입력은 보이지 않음): "));

let manifest;
try {
  manifest = await openManifest(password, readFileSync(join(VAULT, "manifest.enc")));
} catch {
  console.error("vault를 열지 못했습니다. 비밀번호가 틀렸거나 vault가 손상되었습니다.");
  process.exit(1);
}
const fileKey = await importFileKey(manifest.fileKey);
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

// 지연 로딩 표식({ "$lazy": id, bytes })을 복호화해 펼친다. 크기가 표식과 맞는지도 확인한다.
let lazyCount = 0, lazyBad = 0;
async function expand(v) {
  if (!v || typeof v !== "object") return v;
  if (typeof v.$lazy === "string") {
    const data = await decryptJson(fileKey, readFileSync(join(VAULT, "data", `${v.$lazy}.enc`)));
    lazyCount++;
    if (Buffer.byteLength(JSON.stringify(data)) !== v.bytes) lazyBad++;
    return data;
  }
  for (const k of Object.keys(v)) v[k] = await expand(v[k]);
  return v;
}

const flat = (list) => list.flatMap((x) => (x.children ? flat(x.children) : [x])); // 그룹 메뉴를 펼친 섹션 목록
const leaves = flat(manifest.sections);
console.log(`제목: ${manifest.title} / 갱신: ${manifest.updated}`);
console.log(`메뉴 그룹 ${manifest.sections.filter((x) => x.children).length}개 · 섹션 ${leaves.length}개`);
for (const s of leaves) {
  s.data = await expand(s.data);
  const d = s.data || {};
  const shape = Array.isArray(d.items) ? `items ${d.items.length}건` : `키 ${Object.keys(d).length}개: ${Object.keys(d).slice(0, 8).join(", ")}`;
  console.log(`  - ${s.id} (${s.type}) [${s.lazy ? "lazy" : "inline"}] ${shape}`);
}
console.log(`지연 로딩 데이터 파일 ${lazyCount}개 복호화${lazyBad ? ` ✗ 크기 불일치 ${lazyBad}건` : " (크기 일치)"}`);

const decrypted = {};
for (const [id, mime] of Object.entries(manifest.files)) {
  const plain = Buffer.from(await decrypt(fileKey, readFileSync(join(VAULT, "files", `${id}.enc`))));
  decrypted[id] = sha(plain);
  console.log(`  파일 ${id}  ${mime}  ${plain.length}B`);
}

const filesUnder = (dir) => {
  const root = join(CONTENT, dir);
  if (!existsSync(root)) return [];
  const out = [];
  const walk = (d) => readdirSync(d).forEach((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : out.push(join(d, n))));
  walk(root);
  return out;
};
const hashOf = (f) => sha(readFileSync(f));
const inboxHashes = new Map(filesUnder("files/inbox").map((f) => [hashOf(f), f.slice(CONTENT.length + 1)]));
const allowedHashes = new Set([...filesUnder("files/display"), ...filesUnder("files/masked")].map(hashOf));

let bad = 0;
if (!ALLOWED_IMAGES) {
  const onDisk = existsSync(join(VAULT, "files")) ? readdirSync(join(VAULT, "files")).length : 0;
  const inManifest = Object.keys(decrypted).length;
  if (inManifest || onDisk) { console.log(`✗ vault 에 이미지가 있습니다(manifest ${inManifest}개, files/ 폴더 ${onDisk}개). 이미지는 vault 에 넣지 않는 정책입니다.`); bad++; }
  else console.log("✓ vault 에 이미지 없음 (정책: 이미지 0개)");
}
console.log(`자동 점검: 원본(inbox) ${inboxHashes.size}개 · 허용된 화면용 파일 ${allowedHashes.size}개`);
for (const [id, h] of Object.entries(decrypted)) {
  if (inboxHashes.has(h)) { console.log(`✗ 원본이 vault 에 있음: ${inboxHashes.get(h)} (vault 파일 ${id})`); bad++; }
  else if (ALLOWED_IMAGES && !allowedHashes.has(h)) { console.log(`✗ 허용 목록(files/display, files/masked)에 없는 파일이 vault 에 있음: ${id}`); bad++; }
}
if (!bad && ALLOWED_IMAGES) console.log(`✓ vault 이미지 ${Object.keys(decrypted).length}개 모두 허용된 화면용 파일이고 원본(inbox)은 없음`);
for (const rel of deny) {
  const h = hashOf(join(CONTENT, rel));
  const hit = Object.entries(decrypted).find(([, v]) => v === h);
  console.log(`${hit ? "✗ 포함됨" : "✓ 없음"}  ${rel}`);
  if (hit) bad++;
}
const leaks = JSON.stringify(manifest.sections).match(/sourceImage|files\/inbox\//g);
console.log(leaks ? `✗ 원본 경로 문자열이 데이터에 남아 있음 (${leaks.length}건)` : "✓ 데이터에 sourceImage·inbox 경로 없음");
process.exit(bad || leaks || lazyBad ? 1 : 0);
