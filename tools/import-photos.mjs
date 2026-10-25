// 구글 포토 Picker → content/files/inbox/ 로 사진을 가져오고 content/curriculum.json 에 미확인 항목으로 등록
// 사용: node tools/import-photos.mjs   (내 컴퓨터에서만 실행. 토큰은 .secrets/ 에 저장)
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SECRETS = join(ROOT, ".secrets");
const CONTENT = join(ROOT, "content");
const INBOX = join(CONTENT, "files", "inbox");
const SECTION_FILE = join(CONTENT, "curriculum.json");
const STATE_FILE = join(CONTENT, ".import-state.json");
const TOKEN_FILE = join(SECRETS, "token.json");
const SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
const MAX_SIZE = "w2400-h2400"; // 표 글자가 읽히는 정도로 축소해서 받음
const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/heic": ".heic" };

const client = JSON.parse(readFileSync(join(SECRETS, "google_client.json"), "utf8")).installed;
const b64url = (buf) => buf.toString("base64url");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);

async function tokenRequest(params) {
  const r = await fetch(client.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret, ...params }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`토큰 요청 실패: ${data.error_description || data.error}`);
  return data;
}

async function loginViaBrowser() {
  const verifier = b64url(randomBytes(32));
  const state = b64url(randomBytes(16));
  let redirect;
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, "http://127.0.0.1");
      if (u.searchParams.get("state") !== state) return res.writeHead(400).end("state mismatch");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<p>로그인 완료. 이 창은 닫아도 됩니다.</p>");
      server.close();
      u.searchParams.get("code") ? resolve(u.searchParams.get("code")) : reject(new Error(u.searchParams.get("error") || "no code"));
    });
    server.listen(0, "127.0.0.1", () => {
      redirect = `http://127.0.0.1:${server.address().port}`;
      const url = new URL(client.auth_uri);
      url.search = new URLSearchParams({
        client_id: client.client_id, redirect_uri: redirect, response_type: "code", scope: SCOPE, state,
        code_challenge: b64url(createHash("sha256").update(verifier).digest()), code_challenge_method: "S256",
        access_type: "offline", prompt: "consent",
      });
      console.log("브라우저에서 구글 로그인 창이 열립니다…");
      spawn("open", [url.toString()], { stdio: "ignore" }).unref();
    });
    setTimeout(() => reject(new Error("로그인 시간 초과")), 5 * 60_000).unref();
  });
  const tokens = await tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirect });
  mkdirSync(SECRETS, { recursive: true });
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens), { mode: 0o600 });
  return tokens.access_token;
}

async function getAccessToken() {
  const saved = readJson(TOKEN_FILE, null);
  if (saved?.refresh_token) {
    try {
      return (await tokenRequest({ grant_type: "refresh_token", refresh_token: saved.refresh_token })).access_token;
    } catch {
      console.log("저장된 로그인이 만료되어 다시 로그인합니다.");
    }
  }
  return loginViaBrowser();
}

const token = await getAccessToken();
const api = async (path, opts = {}) => {
  const r = await fetch(`https://photospicker.googleapis.com/v1${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`Picker API ${r.status}: ${await r.text()}`);
  return r.json();
}

const session = await api("/sessions", { method: "POST", body: JSON.stringify({ pickingConfig: { maxItemCount: "200" } }) });
console.log("구글 포토 선택 화면을 엽니다. 편제표 사진을 고르고 '완료'를 누르세요.");
spawn("open", [`${session.pickerUri}/autoclose`], { stdio: "ignore" }).unref();

let cur = session;
const deadline = Date.now() + 15 * 60_000;
while (!cur.mediaItemsSet) {
  if (Date.now() > deadline) throw new Error("선택 시간 초과");
  await sleep((parseFloat(session.pollingConfig?.pollInterval) || 3) * 1000);
  cur = await api(`/sessions/${session.id}`);
}

const items = [];
let pageToken = "";
do {
  const q = new URLSearchParams({ sessionId: session.id, pageSize: "100", ...(pageToken && { pageToken }) });
  const page = await api(`/mediaItems?${q}`);
  items.push(...(page.mediaItems || []));
  pageToken = page.nextPageToken || "";
} while (pageToken);

if (!existsSync(CONTENT)) cpSync(join(ROOT, "content.example"), CONTENT, { recursive: true });
mkdirSync(INBOX, { recursive: true });
const state = readJson(STATE_FILE, { ids: [] });
const section = readJson(SECTION_FILE, { items: [] });

let added = 0;
for (const m of items) {
  if (m.type !== "PHOTO" || state.ids.includes(m.id)) continue;
  const r = await fetch(`${m.mediaFile.baseUrl}=${MAX_SIZE}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) { console.warn(`건너뜀 ${m.mediaFile.filename}: ${r.status}`); continue; }
  const name = `${m.id.replace(/[^\w-]/g, "").slice(0, 16)}${EXT[m.mediaFile.mimeType] || ".jpg"}`;
  writeFileSync(join(INBOX, name), Buffer.from(await r.arrayBuffer()));
  section.items.push({
    image: `files/inbox/${name}`, school: "", year: "", title: "", status: "unreviewed",
    importedFrom: m.mediaFile.filename, takenAt: m.createTime,
  });
  state.ids.push(m.id);
  added++;
  console.log(`저장: ${name}`);
}
writeFileSync(SECTION_FILE, JSON.stringify(section, null, 2) + "\n");
writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
await api(`/sessions/${session.id}`, { method: "DELETE" }).catch(() => {});
console.log(`완료: ${added}장 가져옴 (전체 ${section.items.length}장) → content/files/inbox/`);
