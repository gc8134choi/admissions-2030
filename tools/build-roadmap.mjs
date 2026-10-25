// research/data/roadmap-draft.json → portal/data/roadmap.json (학습자별 학년별 시기표).
// 시기 축(stage)은 날짜와 학습자의 entryYear/examYear로 계산한다: 입학 전(중3·중2 등), 고1·고2·고3, 수능(수능 직전 11월부터).
// 사용: node tools/build-roadmap.mjs  (--check: 파일과 결과가 다르면 종료코드 1)
import { readFileSync, writeFileSync } from "node:fs";

const STATUS = { 확정: "confirmed", 보도: "reported", 추정: "estimated" };
const draft = JSON.parse(readFileSync("research/data/roadmap-draft.json", "utf8"));
const LEARNER = draft.profiles; // { A: {entryYear, examYear, span}, B: ... }

const ym = (d) => d.slice(0, 7);
// 학년도 = 3월~다음 해 2월. 입학학년도(entryYear) 대비 학년 오프셋.
const schoolYear = (d) => { const [y, m] = d.split("-").map(Number); return m >= 3 ? y : y - 1; };
const winter = (d) => [12, 1, 2].includes(Number(d.split("-")[1]));
const gradeLabel = (k) => ({ "-4": "초6", "-3": "중1", "-2": "중2", "-1": "중3", 0: "고1", 1: "고2", 2: "고3" })[k] ?? `학년도 ${k}`;

function stageOf(start, L) {
  if (start >= `${L.examYear - 1}-11`) return { key: "csat", label: "수능", order: 9 };
  const k = schoolYear(start) - L.entryYear;
  const label = gradeLabel(k) + (k < 0 && winter(start) ? " 겨울" : "");
  return { key: `${k}${k < 0 && winter(start) ? "w" : ""}`, label, order: k * 2 + (k < 0 && winter(start) ? 1 : 0) };
}

const items = draft.items.map((x) => {
  const [start, end] = x.when.split("~");
  const L = LEARNER[x.profile];
  if (!L) throw new Error(`unknown profile ${x.profile} (${x.id})`);
  const st = STATUS[x.status];
  if (!st) throw new Error(`unmapped status "${x.status}" (${x.id})`);
  const s = stageOf(start, L);
  return {
    id: x.id, learner: x.profile, when: x.when, start, ...(end ? { end } : {}),
    stage: s.label, stageKey: s.key, stageOrder: s.order,
    who: x.who.split("·").map((t) => t.trim()), what: x.what, status: st, unverified: !!x.unverified,
    ...(x.note ? { note: x.note } : {}), sourceName: x.sourceName || null, sourceUrl: x.sourceUrl || null,
    ...(x.refs?.length ? { refs: x.refs } : {}), ...(x.region ? { region: x.region } : {}), checkedAt: x.checkedAt,
  };
}).sort((a, b) => a.learner.localeCompare(b.learner) || a.stageOrder - b.stageOrder || a.start.localeCompare(b.start));

const out = { _meta: { note: "학습자별 학년별 시기표(생성물, 손으로 고치지 않는다). research/data/roadmap-draft.json에서 tools/build-roadmap.mjs가 만든다.", checkedAt: draft.checkedAt, learners: LEARNER }, items };
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/roadmap.json";
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== json) { console.error("roadmap.json is out of date"); process.exit(1); }
} else writeFileSync(target, json);
console.log(items.length, "roadmap items");
