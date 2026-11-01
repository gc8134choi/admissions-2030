// 학교 외부 코드(NEIS 시도교육청코드+표준학교코드, 학교알리미 학교코드) 조회.
//   원본: research/data/school-codes-draft.json (조사 세션). 점검·생성: tools/build-school-codes.mjs → portal/data/school-codes.json
import { readFileSync, existsSync } from "node:fs";

const SRC = "research/data/school-codes-draft.json";
let cache;
function load() {
  if (cache) return cache;
  const items = existsSync(SRC) ? JSON.parse(readFileSync(SRC, "utf8")).items ?? [] : [];
  cache = new Map(items.map((it) => [it.placeId, it]));
  return cache;
}
// 코드를 알아낸 것만 행에 붙인다(못 구한 것과 사유는 school-codes.json에 남는다).
export function externalIdsFor(placeId) {
  const it = load().get(placeId);
  if (!it) return undefined;
  const ids = (it.ids ?? []).filter((x) => x.code).map((x) => ({ system: x.system, ...(x.atptCode ? { atptCode: x.atptCode } : {}), code: x.code, asOf: x.asOf }));
  return ids.length ? ids : undefined;
}
