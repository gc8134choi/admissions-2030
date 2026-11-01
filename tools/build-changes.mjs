// 데이터 변경 이력 portal/data/changes.json (생성물, 바뀐 소식의 바탕 자료).
//   추적 대상 파일의 값(잎 단위)을 tools/state/changes-state.json(직전 기록 시점의 값)과 비교해
//   바뀐 항목을 {대상 id·필드·이전 값·새 값·일시·사유}로 changes.json 맨 앞에 붙이고 상태 파일을 갱신한다.
//   첫 실행은 기준선만 만들고 이력은 비워 둔다.
// 사용:
//   node tools/build-changes.mjs --reason "교육청 고시 반영"   # 기록(생성기를 다 돌린 뒤)
//   node tools/build-changes.mjs --pending                      # 아직 기록하지 않은 변경 목록만 본다
//   node tools/build-changes.mjs --check                        # 형식 점검(미기록 변경은 경고만, 실패시키지 않는다)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const FILES = ["policy", "events", "hs-compare", "middle-compare", "middle", "glossary", "admission-types", "hs-types", "timeline", "middle-guide", "places", "rules", "universities", "planner-rules", "admission-rules", "briefings", "schools"];
const STATE = "tools/state/changes-state.json", OUT = "portal/data/changes.json";
const IDK = ["id", "schoolId", "briefingId", "ruleId", "key"], LABK = ["name", "term", "label", "title", "unitName"];
const hash = (v) => createHash("sha1").update(JSON.stringify(v)).digest("hex").slice(0, 10);
const trunc = (v) => (typeof v === "string" && v.length > 160 ? v.slice(0, 160) + "…" : v);

function flatten(v, path, leaves, labels, ent) {
  if (Array.isArray(v)) {
    v.forEach((x, i) => {
      const id = x && typeof x === "object" ? IDK.map((k) => x[k]).find((y) => typeof y === "string") : null;
      const p = `${path}[${id ?? i}]`;
      if (id) { const lab = LABK.map((k) => x[k]).find((y) => typeof y === "string"); labels[p] = lab ?? id; }
      flatten(x, p, leaves, labels, id ? p : ent);
    });
  } else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) { if (k === "_meta" || /^sourceIds?$/.test(k)) continue; flatten(x, path ? `${path}.${k}` : k, leaves, labels, ent); }
  } else leaves[path] = [hash(v), trunc(v)];
}
function snapshot() {
  const leaves = {}, labels = {};
  for (const f of FILES) {
    const p = `portal/data/${f}.json`; if (!existsSync(p)) continue;
    const l = {}, lb = {};
    flatten(JSON.parse(readFileSync(p, "utf8")), "", l, lb, "");
    for (const [k, v] of Object.entries(l)) leaves[`${f}|${k}`] = v;
    for (const [k, v] of Object.entries(lb)) labels[`${f}|${k}`] = v;
  }
  return { leaves, labels };
}
function diff(prev, cur) {
  const out = [];
  const keys = new Set([...Object.keys(prev.leaves), ...Object.keys(cur.leaves)]);
  for (const key of [...keys].sort()) {
    const a = prev.leaves[key], b = cur.leaves[key];
    if (a && b && a[0] === b[0]) continue;
    const [file, path] = [key.slice(0, key.indexOf("|")), key.slice(key.indexOf("|") + 1)];
    const m = path.match(/^(.*\[[^\]]+\])(?:\.(.*))?$/); // 마지막으로 id가 있는 항목까지가 대상
    let target = m ? m[1] : "", field = m ? (m[2] ?? "") : path;
    // 대상은 가장 깊은 id 항목(라벨 보유)으로 정한다
    const lbls = cur.labels, plb = prev.labels;
    let t = path, found = null;
    while (t) { const cand = `${file}|${t}`; if (lbls[cand] || plb[cand]) { found = t; break; } const i = Math.max(t.lastIndexOf("."), t.lastIndexOf("[")); if (i < 0) break; t = t.slice(0, i); }
    if (found) { target = found; field = path.slice(found.length).replace(/^\./, ""); }
    out.push({ file, target, label: (lbls[`${file}|${target}`] ?? plb[`${file}|${target}`]) ?? null, field: field || null, kind: !a ? "added" : !b ? "removed" : "changed", old: a ? a[1] : null, new: b ? b[1] : null });
  }
  // 항목 하나가 통째로 생기거나 사라진 경우는 한 줄로 합친다
  const res = [], seen = new Set();
  for (const x of out) {
    if (x.kind === "changed" || !x.target) { res.push(x); continue; }
    const gk = `${x.file}|${x.target}|${x.kind}`;
    if (seen.has(gk)) continue;
    const grp = out.filter((y) => y.file === x.file && y.target === x.target && y.kind === x.kind);
    const snap = x.kind === "added" ? cur : prev, pre = `${x.file}|${x.target}`;
    const total = Object.keys(snap.leaves).filter((k) => k.startsWith(pre + ".") || k.startsWith(pre + "[")).length;
    if (grp.length === total) { seen.add(gk); res.push({ file: x.file, target: x.target, label: x.label, field: null, kind: x.kind, old: null, new: null }); } else res.push(x);
  }
  return res;
}
const argv = process.argv.slice(2);
const reason = argv.includes("--reason") ? argv[argv.indexOf("--reason") + 1] : "데이터 갱신";
const cur = snapshot();
const prev = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;
const prevOut = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { changes: [] };

if (argv.includes("--check")) {
  const errs = [];
  if (!existsSync(OUT)) errs.push("changes.json 없음");
  for (const c of prevOut.changes ?? []) {
    for (const k of ["id", "at", "file", "target", "kind", "reason"]) if (c[k] == null || c[k] === "") errs.push(`${c.id ?? "?"}: ${k} 없음`);
    if (!["added", "removed", "changed"].includes(c.kind)) errs.push(`${c.id}: kind ${c.kind}`);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(c.at ?? "")) errs.push(`${c.id}: at 형식`);
  }
  const ids = new Set(); for (const c of prevOut.changes ?? []) { if (ids.has(c.id)) errs.push(`${c.id}: id 중복`); ids.add(c.id); }
  if (errs.length) { console.error(errs.slice(0, 20).join("\n")); process.exit(1); }
  const pend = prev ? diff(prev, cur).length : 0;
  console.log(`OK: changes ${prevOut.changes?.length ?? 0}건 기록${pend ? ` (미기록 변경 ${pend}건 — 기록하려면 node tools/build-changes.mjs --reason "…")` : ""}`);
  process.exit(0);
}
if (!prev) {
  mkdirSync("tools/state", { recursive: true });
  writeFileSync(STATE, JSON.stringify(cur) + "\n");
  writeFileSync(OUT, JSON.stringify({ _meta: { note: "데이터 변경 이력(생성물). tools/build-changes.mjs가 직전 기록과 비교해 만든다. 최신이 맨 앞.", count: 0 }, changes: [] }, null, 1) + "\n");
  console.log(`기준선 생성: 값 ${Object.keys(cur.leaves).length}개`);
  process.exit(0);
}
const d = diff(prev, cur);
if (argv.includes("--pending")) { console.log(`미기록 변경 ${d.length}건`); for (const x of d.slice(0, 30)) console.log(`${x.kind} ${x.file} ${x.label ?? x.target} ${x.field ?? ""}: ${JSON.stringify(x.old)} → ${JSON.stringify(x.new)}`); process.exit(0); }
if (!d.length) { console.log("바뀐 값 없음"); process.exit(0); }
const kst = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 19) + "+09:00";
const stamp = kst.slice(0, 10).replace(/-/g, "");
let n = (prevOut.changes ?? []).filter((c) => c.id.startsWith(`chg-${stamp}-`)).length;
const rows = d.map((x) => ({ id: `chg-${stamp}-${String(++n).padStart(3, "0")}`, at: kst, ...x, reason }));
const changes = [...rows, ...(prevOut.changes ?? [])];
writeFileSync(OUT, JSON.stringify({ _meta: { note: "데이터 변경 이력(생성물). tools/build-changes.mjs가 직전 기록과 비교해 만든다. 최신이 맨 앞.", count: changes.length }, changes }, null, 1) + "\n");
writeFileSync(STATE, JSON.stringify(cur) + "\n");
console.log(`변경 ${rows.length}건 기록(${reason}), 누적 ${changes.length}건`);
