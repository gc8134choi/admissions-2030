// 초등학교 학교군(middle.json areas)의 '공동학군' 해석 — 검색(search-extra)과 중학교 배정 화면(middle.js)이 같은 함수를 쓴다.
// 데이터 비고 문구가 바뀌어도 조용히 틀리지 않게: 구조를 못 읽으면 type "unknown"으로 돌려주고(화면은 비고 원문을 그대로 인용),
// tools/check-joint-zones.mjs가 모든 학교군이 none/all/part로 분류되는지 매번 확인한다.
const GROUP = /[가-힣]+\d?중학군/g;
const PART = /학구 중\s*(.+?)[은는]\s*([가-힣]+\d?중학군)(?:과|와)\s*공동학군/;
export const jointOf = (area) => {
  const fn = String(area?.from?.note || ""), zs = area?.zoneSchools || [], zn = String(zs.map((z) => z.note || "").join(" "));
  const home = [...new Set(zs.map((z) => /^([^\s(（]+?학군)/.exec(z.note || "")?.[1]).filter(Boolean))], whole = `${fn} ${zn}`;
  const m = PART.exec(fn);
  if (m) return { type: "part", home: home[0] || (fn.match(GROUP) || [])[0] || "", other: m[2], scope: m[1].replace(/^성남시\s*/, "").trim(), groups: home };
  if (/공동학군/.test(whole)) {
    if (/학구\s*(중|일부)|일부\s*학구/.test(fn)) return { type: "unknown", home: home[0] || "", groups: home, raw: fn };
    const groups = [...new Set([...home, ...(fn.match(GROUP) || [])])];
    return groups.length >= 2 ? { type: "all", groups, home: home[0] || groups[0] || "" } : { type: "unknown", home: home[0] || "", groups: home, raw: fn };
  }
  return { type: "none", home: home[0] || "", groups: home };
};
// 검색 안내 조각: "<학교>는 ⟨이 문장⟩이에요" 꼴
export const zoneText = (j) => j.type === "part" ? `${j.home} 소속이고, 학구 일부(${j.scope})만 ${j.other}과 공동학군` : j.type === "all" ? `${j.groups.join("·")} 공동학군` : j.type === "unknown" ? `${j.home || "학교군"} 소속(공동학군 범위는 고시 비고 원문: ${j.raw})` : j.home;
