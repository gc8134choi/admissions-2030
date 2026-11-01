// 출처 항목 {name,url,...} → 안정 id. 데이터의 `sources`(배열)·`source`(객체) 옆에 `sourceIds`·`sourceId`를 병행 필드로 붙인다.
//   기존 필드는 그대로 둔다(화면 변경 없음). 등록부는 tools/build-sources.mjs → portal/data/sources.json.
import { createHash } from "node:crypto";

export function sourceKey(s) {
  if (s.url) return "u:" + String(s.url).trim().replace(/#.*$/, "");
  return "n:" + String(s.name ?? "").trim();
}
export const sourceId = (s) => "src-" + createHash("sha1").update(sourceKey(s)).digest("hex").slice(0, 8);
const isSrc = (x) => x && typeof x === "object" && !Array.isArray(x) && typeof x.name === "string" && x.name !== "";

export function withSourceIds(v) {
  if (Array.isArray(v)) return v.map(withSourceIds);
  if (!v || typeof v !== "object") return v;
  const o = {};
  for (const [k, x] of Object.entries(v)) {
    if (k === "sourceIds" || k === "sourceId") continue; // 항상 다시 계산
    o[k] = withSourceIds(x);
    if (k === "sources" && Array.isArray(x) && x.length && x.every(isSrc)) o.sourceIds = x.map(sourceId);
    else if (k === "source" && isSrc(x)) o.sourceId = sourceId(x);
  }
  return o;
}

// 데이터 전체를 훑어 출처 항목을 모은다: [{src, path}]
export function collectSources(v, path = "", out = []) {
  if (Array.isArray(v)) v.forEach((x, i) => collectSources(x, path + "[]", out));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if (k === "sources" && Array.isArray(x)) for (const s of x) { if (isSrc(s)) out.push(s); }
      else if (k === "source" && isSrc(x)) out.push(x);
      collectSources(x, path + "." + k, out);
    }
  }
  return out;
}
