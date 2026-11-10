// 감시 봇이 감지한 변경(watch-state.json changedAt)이 기한(기본 3일) 안에 원문 대조 결론(watch-reviews.json)을 받았는지 알려 준다.
// 기본은 경고만 출력(종료 코드 0). --strict면 기한을 넘긴 미대조 건이 있을 때 1로 끝낸다. CI에는 넣지 않는다(봇이 새로 감지할 때마다 깨지므로).
import { readFileSync } from "node:fs";
const rd = (p) => JSON.parse(readFileSync(new URL(`../research/data/${p}`, import.meta.url), "utf8"));
const state = rd("watch-state.json"), reviews = rd("watch-reviews.json").reviews || {}, wl = rd("watchlist.json").items || [];
const LIMIT_DAYS = 3, now = Date.now(), late = [];
for (const [id, v] of Object.entries(state)) {
  if (!v.changedAt) continue;
  const r = reviews[id], days = (now - new Date(v.changedAt)) / 86400000;
  if (r && r.changedAt === v.changedAt) continue;
  if (days >= LIMIT_DAYS) late.push(`${id} ${(wl.find((x) => x.id === id) || {}).name || ""}: 감지 ${v.changedAt.slice(0, 10)}(${Math.floor(days)}일 경과) 대조 결론 없음`);
}
if (late.length) { console.log(`감시 감지 ${late.length}건이 ${LIMIT_DAYS}일 넘게 원문 대조 결론 없음:\n- ` + late.join("\n- ")); if (process.argv.includes("--strict")) process.exit(1); }
else console.log("OK: 감시 감지 건이 모두 기한 안에 대조되었거나 결론이 기록되어 있어요");
