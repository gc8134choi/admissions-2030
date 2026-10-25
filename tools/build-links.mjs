// research/data/links-draft.json(조사 세션 산출) → portal/data/links.json. 접속이 확인된 링크만 내보낸다.
// 사용: node tools/build-links.mjs  (--check: 파일과 결과가 다르면 종료코드 1)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const src = JSON.parse(readFileSync("research/data/links-draft.json", "utf8"));
const bad = src.items.filter((i) => !(i.httpStatus >= 200 && i.httpStatus < 400)); // 죽은 링크 제외
const items = src.items.filter((i) => i.httpStatus >= 200 && i.httpStatus < 400)
  .map(({ id, category, org, name, url, purpose, kind, checkedAt, note }) => ({ id, category, org, name, url, purpose, kind, checkedAt, ...(note ? { note } : {}) }));
for (const i of items) if (!/^https:\/\//.test(i.url)) throw new Error(`https가 아닌 링크: ${i.id}`);
const cats = src.categories.filter((c) => items.some((i) => i.category === c));
const out = { _meta: { note: "공식·공공 사이트 바로가기. 접속이 확인된 링크만 담는다(조사 세션 links-draft.json에서 생성, 손으로 고치지 않는다).", checkedAt: src.checkedAt, dropped: bad.map((i) => i.id) }, categories: cats, items };
const text = JSON.stringify(out, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (!existsSync("portal/data/links.json") || readFileSync("portal/data/links.json", "utf8") !== text) { console.error("portal/data/links.json이 links-draft.json과 다릅니다. node tools/build-links.mjs 를 실행하세요."); process.exit(1); }
  console.log(`links: ${items.length}건 일치`);
} else { writeFileSync("portal/data/links.json", text); console.log(`links: ${items.length}건 (${cats.length}개 분류)`); }
