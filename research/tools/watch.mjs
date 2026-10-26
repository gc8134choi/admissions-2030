// 사용: node research/tools/watch.mjs   (프록시 환경에서는 NODE_USE_ENV_PROXY=1 필요: node 22.21+)
//   node research/tools/watch.mjs [--list research/data/watchlist.json] [--state research/data/watch-state.json]
//        [--only id1,id2] [--json] [--no-write] [--fail-after 3]
// watchlist의 URL을 받아 본문 텍스트를 정규화해 해시하고 이전 상태와 비교해 변경 목록을 출력한다. 외부 의존성 없음(node 18+).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def; };
const flag = (name) => args.includes(name);
const LIST = opt("--list", "research/data/watchlist.json");
const STATE = opt("--state", "research/data/watch-state.json");
const ONLY = opt("--only", "") ? opt("--only", "").split(",") : null;
const FAIL_AFTER = Number(opt("--fail-after", "3"));
const MAX_LINES = 300;
const UA = "Mozilla/5.0 (compatible; admissions-watch/1.0)";

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

function normalize(html, item) {
  let t = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, " ");
  t = t.replace(/<\/(p|div|li|tr|h\d|a|br)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
  let lines = t.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  let text = lines.join("\n");
  if (item.startMarker) { const i = text.indexOf(item.startMarker); if (i >= 0) text = text.slice(i); }
  if (item.endMarker) { const i = text.indexOf(item.endMarker); if (i > 0) text = text.slice(0, i); }
  // 휘발성 값(조회수, 오늘 날짜, 공감수 등)은 해시에서 제외
  const ignore = [/조회수?\s*:?\s*\d[\d,]*/g, /조회\s*\d[\d,]*/g, /공감수\s*\d+/g, /댓글수[^\n]*/g, /\d{4}[-.]\d{2}[-.]\d{2}\s+\d{2}:\d{2}(:\d{2})?/g, ...(item.ignore || []).map((p) => new RegExp(p, "g"))];
  for (const re of ignore) text = text.replace(re, "");
  lines = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  // 목록(list-titles)은 조회수·번호 같은 숫자 줄과 날짜만 있는 줄을 빼고, 한글이 든 6자 이상 줄(제목)만 비교한다.
  if (item.method === "list-titles") lines = lines.filter((l) => /[가-힣]/.test(l) && l.length >= 6 && !/^[\d.\-\s:]+$/.test(l));
  return lines;
}

async function fetchText(url) {
  let lastErr;
  for (let n = 1; n <= 3; n++) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 30000);
      const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "ko" }, redirect: "follow", signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 1500 * n)); }
  }
  throw lastErr;
}

const list = JSON.parse(readFileSync(LIST, "utf-8")).items;
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf-8")) : {};
const now = new Date().toISOString();
const report = { checkedAt: now, changed: [], failed: [], warnings: [], new: [], unchanged: 0, skipped: [] };

for (const item of list) {
  if (ONLY && !ONLY.includes(item.id)) continue;
  if (item.enabled === false) { report.skipped.push({ id: item.id, reason: item.disabledReason || "disabled" }); continue; }
  const prev = state[item.id] || {};
  try {
    const html = await fetchText(item.url);
    const lines = normalize(html, item);
    if (lines.length < 3) throw new Error("본문 텍스트가 너무 짧음(셸 페이지 가능성)");
    const hash = sha(lines.join("\n"));
    const cur = { hash, lineCount: lines.length, checkedAt: now, status: "ok", failCount: 0, lastChange: prev.lastChange || null, changedAt: prev.changedAt || null, lines: lines.slice(0, MAX_LINES).map((l) => l.slice(0, 160)) };
    if (!prev.hash) { report.new.push({ id: item.id, name: item.name }); cur.lastChange = now; }
    else if (prev.hash !== hash) {
      const before = new Set(prev.lines || []), after = new Set(cur.lines);
      report.changed.push({ id: item.id, name: item.name, url: item.url, importance: item.importance, affects: item.affects, added: cur.lines.filter((l) => !before.has(l)).slice(0, 12), removed: (prev.lines || []).filter((l) => !after.has(l)).slice(0, 12) });
      cur.lastChange = now;
      cur.changedAt = now; // 첫 기록이 아니라 실제로 바뀐 때만(화면의 "바뀐 소식"이 읽는다)
    } else report.unchanged++;
    state[item.id] = cur;
  } catch (e) {
    // 실패는 상태에 기록하고, 연속 실패가 기준을 넘을 때만 보고(오탐 감소). 해시는 유지한다.
    const failCount = (prev.failCount || 0) + 1;
    const why = [e.message, e.cause && (e.cause.code || e.cause.message)].filter(Boolean).join(": ");
    state[item.id] = { ...prev, status: "fail", failCount, lastError: String(why).slice(0, 120), checkedAt: now };
    const entry = { id: item.id, name: item.name, failCount, error: state[item.id].lastError };
    if (failCount >= FAIL_AFTER) report.failed.push(entry); else report.warnings.push(entry);
  }
}

if (!flag("--no-write")) writeFileSync(STATE, JSON.stringify(state, null, 1) + "\n");

if (flag("--json")) console.log(JSON.stringify(report, null, 2));
else {
  const md = [`# 감시 결과 ${now}`, ``, `- 변경 ${report.changed.length}건, 신규 기록 ${report.new.length}건, 변화 없음 ${report.unchanged}건, 연속 실패 ${report.failed.length}건, 제외 ${report.skipped.length}건`];
  for (const c of report.changed) {
    md.push(``, `## 변경: ${c.name} (${c.id}, 중요도 ${c.importance})`, c.url, `영향 데이터: ${(c.affects || []).join(", ") || "-"}`);
    if (c.added.length) md.push(`추가된 줄:`, ...c.added.map((l) => `- ${l}`));
    if (c.removed.length) md.push(`사라진 줄:`, ...c.removed.map((l) => `- ${l}`));
  }
  if (report.new.length) md.push(``, `## 첫 기록`, ...report.new.map((n) => `- ${n.name} (${n.id})`));
  if (report.warnings.length) md.push(``, `## 일시 실패(알림 제외, ${FAIL_AFTER}회 연속 시 실패로 보고)`, ...report.warnings.map((f) => `- ${f.name} (${f.id}) ${f.failCount}회: ${f.error}`));
  if (report.failed.length) md.push(``, `## 연속 실패`, ...report.failed.map((f) => `- ${f.name} (${f.id}) ${f.failCount}회: ${f.error}`));
  console.log(md.join("\n"));
}
process.exit(report.changed.length || report.failed.length ? 2 : 0);
