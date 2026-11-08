// 일정(events.json)의 start/end 날짜가 본문(body·label·title)에 적힌 날짜와 일치하는지 검사한다(같은 계열 날짜 복사 오류 방지).
// 이어서 같은 날짜의 손 사본(hs-types 달력·timeline·roadmap·middle-guide)이 정본과 어긋나지 않는지도 본다(tools/lib/date-copies.mjs).
// 사용: node tools/check-event-dates.mjs  (불일치가 있으면 목록을 출력하고 종료 코드 1). CI에서는 tools/build-policy.mjs가 앞의 검사를 한다.
import { readFileSync } from "node:fs";
import { checkEventDates } from "./build-events.mjs";
import { checkDateCopies } from "./lib/date-copies.mjs";
const events = JSON.parse(readFileSync("portal/data/events.json", "utf8"));
const bad = checkEventDates(events);
console.log(`일정 ${events.length}건 검사, 불일치 ${bad.length}건`);
for (const b of bad) console.log(" -", b);
const cp = checkDateCopies(".");
const copyBad = [...cp.errs, ...cp.unmapped.map((u) => `${u}: 날짜가 든 사본인데 research/data/date-copies.json 에 연결이 없음(정본 행 id 또는 skip을 적어 주세요)`)];
console.log(`날짜 사본 ${cp.checked}건 검사, 불일치 ${copyBad.length}건`);
for (const b of copyBad) console.log(" -", b);
process.exit(bad.length || copyBad.length ? 1 : 0);
