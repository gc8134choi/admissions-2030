// '학교 이름 + 주제' 검색 안내 문구(search.js TOPICS)가 말하는 화면과 값의 대응표.
// 문구는 도착 화면의 이름과 실제로 있는 값에 맞춘다. tools/check-topic-claims.mjs가 CLAIMS를 데이터로 대조한다(화면이 바뀌면 점검이 실패한다).
const josa = (w) => ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? "은" : "는");
// 학교급(level)마다 문구와 확인처가 다르다. SAY[label] = { level: "both"|"high"|"middle", high: (place) => {href,text}|null, middle: ... }
//  href가 없거나 항목이 null이면 정확히 맞는 내용이 없을 수 있는 항목: noneText(또는 none)로 확인할 곳을 안내한다. 초등학교 등 다른 학교급은 항상 없음 안내.
const HS = "#select/curriculum?v=schools&lv=high", MS = "#select/curriculum?v=schools&lv=middle";
export const SAY = {
  "교육 특색": { level: "both", elementary: null,
    high: () => ({ href: `${HS}&g=%EA%B5%90%EC%9C%A1%EA%B3%BC%EC%A0%95`, text: "고교 보기 비교표의 '교육과정 특징(편제표 요약)' 칸에서 볼 수 있어요(편제표를 옮긴 학교만 값이 있어요)" }),
    middle: () => ({ href: `${MS}&g=%EA%B5%90%EC%9C%A1`, text: "중학교 보기 비교표의 '교육 특색·노력중점' 칸에서 볼 수 있어요" }) },
  "방과후학교": { level: "both", elementary: null,
    high: () => ({ href: null, none: "방과후학교 칸은 비교표에 없어요 → 학교 홈페이지·학교알리미 공시에서 확인해요" }),
    middle: () => ({ href: null, none: "방과후학교 칸은 비교표에 없어요 → 학교 홈페이지·학교알리미 공시에서 확인해요" }) },
  "편제표(학교별 과목표)": { level: "high", elementary: null,
    high: (pl) => pl.schoolId ? { href: `#select/curriculum?s=${encodeURIComponent(pl.schoolId)}&hl=${encodeURIComponent("과목표")}`, text: "학교 요약 화면의 과목표에서 볼 수 있어요" } : { href: null, none: "이 학교의 과목표(편제표)는 포털에서 찾지 못했어요. 편제표를 요약한 '교육과정 특징'은 고교 보기 비교표에 값이 있는 학교만 있어요 → 학교 홈페이지·학교알리미 공시에서 확인해요" }, middle: null },
  "학비·비용": { level: "high", elementary: null,
    high: () => ({ href: "#select/curriculum?v=types&hl=%EB%B9%84%EC%9A%A9", text: "고교 종류 화면의 '비용' 줄에서 유형별 학비를 볼 수 있어요(학교별 금액 칸은 비교표에 없어요 → 학교 누리집·학교알리미)" }), middle: null },
  "모집 인원": { level: "all", elementary: () => ({ href: "#select/curriculum?v=middle&hl=%EB%B0%B0%EC%A0%95%EB%B6%80%ED%84%B0%20%EB%93%B1%EB%A1%9D%EA%B9%8C%EC%A7%80", text: "초등학교 졸업 뒤 중학교는 입학 전형이 아니라 배정이에요. 배정·입학 준비 화면의 '배정부터 등록까지'에서 일정·절차를 볼 수 있어요(학교별 배정 인원은 포털에서 찾지 못했어요 → 용인교육지원청 배정 공지)" }),
    high: () => ({ href: "#select/curriculum?v=types&hl=%EA%B0%9C%EB%B3%84%20%ED%95%99%EA%B5%90%20%EB%AA%A8%EC%A7%91%20%ED%98%84%ED%99%A9", text: "학교별 모집 인원은 포털에서 찾지 못했어요 → 각 학교 누리집의 입학전형요항 공고·경기도교육청 고입·전학 포털에서 확인해요" }),
    middle: () => ({ href: "#select/curriculum?v=middle&hl=%EB%B0%B0%EC%A0%95%EB%B6%80%ED%84%B0%20%EB%93%B1%EB%A1%9D%EA%B9%8C%EC%A7%80", text: "중학교는 입학 전형이 아니라 배정이에요. 배정·입학 준비 화면의 '배정부터 등록까지'에서 일정·절차를 볼 수 있어요(학교별 배정 인원은 포털에서 찾지 못했어요 → 용인교육지원청 배정 공지)" }) },
  "대학 진학 현황": { level: "high", elementary: null, high: () => ({ href: `${HS}&g=%EC%A7%84%ED%95%99`, text: "고교 보기 비교표의 '대학 진학 현황' 칸에서 볼 수 있어요" }), middle: null },
  "설명회 노트": { level: "high", elementary: null, high: () => ({ href: null, text: "" }), middle: null }, // 노트가 있는 학교는 search.js가 그 문서 주소로 보낸다
  "입학·전형": { level: "all", elementary: () => ({ href: "#schedule?t=life", text: "초등학교 다음은 중학교 배정이에요. 중학교 일정 화면에서 배정·입학 일정을 볼 수 있어요" }),
    high: () => ({ href: "#schedule?t=hs", text: "고교 일정 화면에서 고입 전형 일정을 볼 수 있어요(학교별 입학 방식은 고교 보기 비교표의 '입학 방식' 칸)" }),
    middle: () => ({ href: "#schedule?t=life", text: "중학교 일정 화면에서 배정·입학 일정을 볼 수 있어요" }) },
  "학교군": { level: "all", elementary: (pl) => ({ href: `#select/curriculum?v=middle&from=${encodeURIComponent(pl.id || "")}`, text: "배정·입학 준비 화면에서 이 초등학교를 고르면 학교군과 갈 수 있는 중학교를 볼 수 있어요" }),
    high: () => ({ href: `${HS}&g=%EC%9E%85%ED%95%99`, text: "고교 보기 비교표의 '학군·구역' 칸에서 볼 수 있어요" }),
    middle: () => ({ href: `${MS}&g=%EB%B0%B0%EC%A0%95`, text: "중학교 보기 비교표의 '학교군' 칸에서 볼 수 있어요" }) },
};
// 호환용: 예전 이름(TOPIC_SAY)을 쓰던 도구를 위해 (label)->(place) 형태도 둔다
export const TOPIC_SAY = Object.fromEntries(Object.entries(SAY).map(([k, e]) => [k, (pl) => { const f = e[pl.level === "middle" ? "middle" : pl.level === "high" ? "high" : pl.level === "elementary" ? "elementary" : null]; return f ? f(pl) : null; }]));
export const sayOf = (label, pl) => { const f = TOPIC_SAY[label]; return f ? f(pl) : null; };
export const noneText = (label, level) => { const w = label.replace(/\(.*\)$/, ""); return level === "elementary" ? `초등학교의 ${w}${josa(w)} 정확히 맞는 내용이 없을 수 있어요 → 학교 홈페이지·학교알리미 공시에서 확인해요` : `${w}${josa(w)} 정확히 맞는 내용이 없을 수 있어요 → 학교 홈페이지·학교알리미 공시에서 확인해요`; };

// 점검표: 문구가 가리키는 값이 실제 데이터에 있는지(tools/check-topic-claims.mjs)
//  kind "field": data 파일의 fields에 label이 든 항목이 있고 값이 있는 학교가 1곳 이상
//  kind "types": hs-types.json types[]에 key 값이 있음 / "absent": 비교 화면에 칸이 없다고 말하므로 compare 어디에도 그 이름의 항목이 없어야 함
export const CLAIMS = [
  { label: "교육 특색", level: "high", elementary: null, kind: "field", data: "hs-compare", field: "curriculum", fieldLabel: "교육과정 특징" },
  { label: "교육 특색", level: "middle", elementary: null, kind: "field", data: "middle-compare", field: "feature", fieldLabel: "교육 특색" },
  { label: "학교군", level: "middle", elementary: null, kind: "field", data: "middle-compare", field: "zone", fieldLabel: "학교군" },
  { label: "학교군", level: "high", elementary: null, kind: "field", data: "hs-compare", field: "zone", fieldLabel: "학군·구역" },
  { label: "대학 진학 현황", level: "high", elementary: null, kind: "field", data: "hs-compare", field: "univStats", fieldLabel: "대학 진학 현황" },
  { label: "입학·전형", level: "high", elementary: null, kind: "field", data: "hs-compare", field: "admission", fieldLabel: "입학 방식" },
  { label: "학비·비용", kind: "types", key: "cost", screenText: "비용" },
  { label: "모집 인원", level: "high", elementary: null, kind: "absent", words: /모집|정원/, data: ["hs-compare"] },
  { label: "모집 인원", level: "middle", elementary: null, kind: "absent", words: /모집|정원|배정 ?인원/, data: ["middle-compare"] },
  { label: "모집 인원", level: "middle", elementary: null, kind: "section", data: "middle-guide", title: "배정부터 등록까지" },
  { label: "학비·비용", level: "middle", elementary: null, kind: "absent", words: /학비|수업료|등록금|비용/, data: ["middle-compare"] },
  { label: "방과후학교", level: "both", elementary: null, kind: "absent", words: /방과후/, data: ["hs-compare", "middle-compare"] },
];

// 다른 지역 안내(search-extra other-region): 질의의 지역 낱말이 포털 데이터에 있으면 '없어요'라고 하지 않는다. 데이터에 없는 지역만 선언한다.
export const REGION_WORDS = ["분당", "성남", "수원", "화성", "안양", "평택", "판교", "일산", "고양", "부천", "인천", "하남", "동탄", "광교", "강남", "서초", "송파", "의정부", "파주", "김포", "시흥", "안산", "대구", "부산", "대전", "울산", "세종", "제주", "충북", "충남", "전북", "전남", "경북", "경남", "강원"];
export const REGION_ALIAS = { 강남: "서울", 서초: "서울", 송파: "서울" }; // 서울 구 이름은 서울 데이터로 확인한다
// 지역 낱말이 질의에서 '다룬 지역'으로 인정되는 경우: 서울(구 이름 포함)은 서울 데이터가 있으면, 그 밖의 지역은 외고·국제고·자사고 질의에서 그 지역 학교 이름(수원외고·동탄국제고 등)이 데이터에 있을 때만.
// 지역 이름이 데이터에 한 번 나온다는 것만으로는 인정하지 않는다(분당신문·인천시교육청 게시본·화성 연수원 등은 그 지역 고입 자료가 아니다).
export const regionKnown = (w, hay, q = "") => (REGION_ALIAS[w] === "서울" ? hay.includes("서울") : /외고|외국어고|국제고|자사고|특목|외대부고/.test(q) && new RegExp(w + "(외국어고|외고|국제고|자사고|외대부고)").test(hay));
export const GG_WORDS = ["분당", "성남", "수원", "화성", "안양", "평택", "판교", "일산", "고양", "부천", "하남", "동탄", "광교", "의정부", "파주", "김포", "시흥", "안산"]; // 경기도 지역 낱말: 경기 전체 일정이 적용되므로 '다른 지역은 없어요'로 선언하지 않고 경기 일정으로 연결

// 경기 지역 낱말 → 평준화 9학군 소속 여부(근거: 정책 행 gg-25, 기본계획 PDF 5·6·8쪽). 비평준화 시·군 이름 목록은 원문에 없어(gg-26은 추정) 사실처럼 말하지 않는다.
export const CITY_OF = { 분당: "성남", 판교: "성남", 일산: "고양", 동탄: "화성", 광교: "수원" };
export const pyeongCities = (policy) => { const b = (policy.find((r) => r.id === "gg-25")?.body || ""), m = /평준화지역은 (.+?) 9개 학군/.exec(b); return m ? new Set(m[1].replace(/\(([^)]*)\)/g, "·$1").split("·").map((x) => x.replace(/권$/, "").trim()).filter(Boolean)) : null; };
export const gyeonggiNote = (w, policy) => {
  const set = pyeongCities(policy), city = CITY_OF[w] || w;
  if (!set) return `${w}도 경기도라 경기 고입 전기·후기 전형 일정(후기 원서접수 12.4~12.10)은 같이 적용돼요. 평준화 배정은 평준화지역에만 해당해요 → ${w} 지역 교육지원청에서 확인`;
  const base = "경기 고입 전기·후기 전형 일정(후기 원서접수 12.4~12.10)은 같이 적용돼요. ";
  return set.has(city)
    ? `${w}은 평준화지역 9학군에 속해요. ${base}평준화 배정 일정(배정 대상자 발표 2027.1.6, 배정 학교 발표 1.22)이 적용돼요(안산 대부고·고양 백송고·용인 백암고는 교육감 배정을 적용하지 않아요). 학교 목록·학교별 모집 안내는 정확히 맞는 내용이 없을 수 있어요(${w} 지역 교육지원청·학교 누리집에서 확인)`
    : `${w}은 평준화지역 9학군이 아니라 일반고는 학교별 전형이에요(원서접수 12.4~12.10, 합격자 발표 12.14). ${base}시·군별 구분은 원문에 목록이 없어요 → ${w} 지역 교육지원청에서 확인`;
};
