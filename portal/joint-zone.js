// 초등학교 학교군(middle.json areas)의 '공동학군' 해석 — 검색(search-extra)과 중학교 배정 화면(middle.js)이 같은 함수를 쓴다.
// 구조화 필드 areas[].from.jointZone = { type: "전체"|"일부", otherZones: [...], rangeText: null|"성남시 분당구 운중동(대장통·석운통)" }만 읽는다(note 문구 파싱 없음).
// 공동학군이 없는 학교는 jointZone 키가 없다. note에 '공동학군'이 있는데 jointZone이 없으면 type "unknown"(tools/check-joint-zones.mjs가 실패시킨다).
export const jointOf = (area) => {
  const zs = area?.zoneSchools || [], j = area?.from?.jointZone, fn = String(area?.from?.note || "");
  const home = [...new Set(zs.map((z) => /^([^\s(（]+?학군)/.exec(z.note || "")?.[1]).filter(Boolean))];
  if (j && (j.type === "일부" || j.type === "전체")) {
    const others = j.otherZones || [];
    return j.type === "일부"
      ? { type: "part", home: home[0] || "", other: others.join("·"), scope: String(j.rangeText || "").replace(/^성남시\s*/, "").trim(), groups: home }
      : { type: "all", home: home[0] || "", groups: [...new Set([...home, ...others])] };
  }
  if (j || /공동학군/.test(fn + " " + zs.map((z) => z.note || "").join(" "))) return { type: "unknown", home: home[0] || "", groups: home, raw: fn };
  return { type: "none", home: home[0] || "", groups: home };
};
// 검색 안내 조각: "<학교>는 ⟨이 문장⟩이에요" 꼴
export const zoneText = (j) => j.type === "part" ? `${j.home} 소속이고, 학구 일부(${j.scope})만 ${j.other}과 공동학군` : j.type === "all" ? `${j.groups.join("·")} 공동학군` : j.type === "unknown" ? `${j.home || "학교군"} 소속(공동학군 범위는 고시 비고 원문: ${j.raw})` : j.home;
