// 일정(events.json)의 start/end 날짜가 본문(body·label·title)에 적힌 날짜와 일치하는지 검사한다(같은 계열 날짜 복사 오류 방지).
// 사용: node tools/check-event-dates.mjs  (불일치가 있으면 목록을 출력하고 종료 코드 1). CI에서는 tools/build-policy.mjs가 같은 검사를 한다.
import { readFileSync } from "node:fs";
import { checkEventDates } from "./build-events.mjs";
const events = JSON.parse(readFileSync("portal/data/events.json", "utf8"));
const bad = checkEventDates(events);
console.log(`일정 ${events.length}건 검사, 불일치 ${bad.length}건`);
for (const b of bad) console.log(" -", b);
process.exit(bad.length ? 1 : 0);
