// 검색 안내 소스에 '포털에 없다'고 단정하는 문구가 남아 있으면 실패한다(사용자 결정 2026-11-09: 없음 단정은 약한 표현으로 통일).
// 사실 진술('목록에서 찾지 못했어요', 데이터 칸의 nullReason 사유)과 '정확히 맞는 내용이 없을 수 있어요'는 허용. nullReason 문구는 데이터(JSON)에 있고 이 검사는 소스(.js)만 본다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const FILES = ["search.js", "search-extra.js", "search-claims.js"];
const BAN = ["이 포털에 없어요", "이 포털에 아직 없어요", "포털에 아직 없어요", "아직 없어요", "없는 학교예요", "다루지 않아요", "다루지 않는 내용", "그 밖의 지역은 아직 없어요", "그 밖의 지역은 없어요", "다른 지역 학교·규정은 없어요", "찾기 어려운 내용이에요", "찾는 정보가 없어요", "포털에 없", "포털에는 없", "다루지 않", "없는 학교"];
const bad = [];
for (const f of FILES) { const lines = readFileSync(`${root}/portal/${f}`, "utf8").split("\n"); lines.forEach((l, i) => { for (const b of BAN) if (l.includes(b)) bad.push(`${f}:${i + 1} '${b}'`); }); }
if (bad.length) { for (const b of bad.slice(0, 40)) console.log("  ✗", b); console.log(`단정 문구 ${bad.length}건`); process.exit(1); }
console.log(`OK: 검색 안내 소스 ${FILES.length}개에 '없음 단정' 문구 0건(금지 ${BAN.length}종)`);
