// schema/*.schema.json → portal/data/data-dictionary.json (기계 가독 데이터 사전, 생성물).
//   파일별로 필드 경로·형식·필수 여부·허용값·설명을 평탄화한다. 화면에는 쓰지 않는다.
//   공통 규칙(status·sources·단위·표기)은 rules[]에 둔다.
// 사용: node tools/build-data-dictionary.mjs [--check]
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const typeOf = (s) => s.enum ? "enum" : Array.isArray(s.type) ? s.type.join("|") : s.type ?? (s.anyOf ? "anyOf" : s.oneOf ? "oneOf" : s.$ref ? "ref" : "any");
const fields = [];
function walk(s, path, required) {
  if (!s || typeof s !== "object") return;
  if (path) {
    const f = { path, type: typeOf(s), required: !!required };
    if (s.enum) f.enum = s.enum;
    if (s.pattern) f.pattern = s.pattern;
    if (s.format) f.format = s.format;
    if (s.minimum != null) f.minimum = s.minimum;
    if (s.maximum != null) f.maximum = s.maximum;
    if (s.description) f.description = s.description;
    fields.push(f);
  }
  if (s.properties) for (const [k, v] of Object.entries(s.properties)) walk(v, path ? `${path}.${k}` : k, (s.required || []).includes(k));
  if (s.items && typeof s.items === "object") walk(s.items, path ? `${path}[]` : "[]", false);
  if (s.additionalProperties && typeof s.additionalProperties === "object") walk(s.additionalProperties, `${path}.*`, false);
  for (const alt of s.anyOf || s.oneOf || []) walk(alt, path, false);
}
const files = readdirSync("schema").filter((f) => f.endsWith(".schema.json")).sort();
const datasets = [];
for (const f of files) {
  const s = JSON.parse(readFileSync(`schema/${f}`, "utf8"));
  fields.length = 0;
  walk(s, "", true);
  const seen = new Set(), uniq = fields.filter((x) => (seen.has(x.path) ? false : seen.add(x.path)));
  const name = f.replace(".schema.json", "");
  datasets.push({ id: name, schema: `schema/${f}`, data: existsSync(`portal/data/${name}.json`) ? `portal/data/${name}.json` : null, title: s.title ?? null, description: s.description ?? null, fieldCount: uniq.length, fields: uniq });
}
const out = {
  _meta: { note: "데이터 사전(생성물, 손으로 고치지 않는다). schema/*.schema.json에서 tools/build-data-dictionary.mjs가 만든다.", count: datasets.length },
  rules: [
    { key: "status", text: "제도·일정 정보의 상태: confirmed(확정)·reported(보도)·estimated(추정). 화면에는 확정을 표시하지 않고 보도·추정만 표시한다." },
    { key: "sources", text: "제도·일정 정보에는 출처 URL과 공식(교육부·평가원·대교협·교육청)/매체 구분을 붙인다." },
    { key: "ids", text: "id는 한 번 정하면 바꾸지 않는다. 학교는 schoolId, 과목은 sj-NNNN, 학교 신규는 s-NNN." },
    { key: "years", text: "entryYear=입학학년도, examYear=대입학년도=entryYear+3. 섞어 쓰지 않는다." },
    { key: "display", text: "내부 식별자·파일명·사람 이름은 화면 문구에 쓰지 않는다(tools/check-exposed.mjs)." },
  ],
  datasets,
};
const json = JSON.stringify(out, null, 1) + "\n";
const target = "portal/data/data-dictionary.json";
if (process.argv.includes("--check")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== json) { console.error("data-dictionary.json이 스키마와 다르다 — node tools/build-data-dictionary.mjs"); process.exit(1); }
  console.log(`OK: data-dictionary ${datasets.length}개 데이터셋`);
} else { writeFileSync(target, json); console.log(`data-dictionary ${datasets.length}개 데이터셋, ${datasets.reduce((a, d) => a + d.fieldCount, 0)}개 필드`); }
