// '학교 이름 + 주제' 검색 안내 문구(search.js TOPICS)가 말하는 화면과 값의 대응표.
// 문구는 도착 화면의 이름과 실제로 있는 값에 맞춘다. tools/check-topic-claims.mjs가 CLAIMS를 데이터로 대조한다(화면이 바뀌면 점검이 실패한다).
const josa = (w) => ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? "은" : "는");
// label → (place) => { href?, text }  (href가 null이면 이 포털에 없는 항목: 확인할 곳을 안내)
export const TOPIC_SAY = {
  "교육 특색": (pl) => pl.level === "middle"
    ? { href: "#select/curriculum?v=schools&lv=middle", text: "중학교 보기 비교표의 '교육 특색·노력중점' 칸에서 볼 수 있어요" }
    : { href: "#select/curriculum?v=schools&lv=high&g=%EA%B5%90%EC%9C%A1%EA%B3%BC%EC%A0%95", text: "고교 보기 비교표의 '교육과정 특징(편제표 요약)' 칸에서 볼 수 있어요(편제표를 옮긴 학교만 값이 있어요)" },
  "편제표(학교별 과목표)": (pl) => ({ href: pl.schoolId ? `#select/curriculum?s=${encodeURIComponent(pl.schoolId)}&hl=${encodeURIComponent("과목표")}` : null, text: "학교 요약 화면의 과목표에서 볼 수 있어요" }),
  "학비·비용": () => ({ href: "#select/curriculum?v=types&hl=%EB%B9%84%EC%9A%A9", text: "고교 종류 화면의 '비용' 줄에서 유형별 학비를 볼 수 있어요(학교별 금액은 이 포털에 없어요 → 학교 누리집·학교알리미)" }),
  "모집 인원": () => ({ href: "#select/curriculum?v=types&hl=%EA%B0%9C%EB%B3%84%20%ED%95%99%EA%B5%90%20%EB%AA%A8%EC%A7%91%20%ED%98%84%ED%99%A9", text: "학교별 모집 인원은 이 포털에 없어요 → 각 학교 누리집의 입학전형요항 공고·경기도교육청 고입·전학 포털에서 확인해요" }),
  "대학 진학 현황": (pl) => ({ href: pl.level === "high" ? "#select/curriculum?v=schools&lv=high&g=%EC%A7%84%ED%95%99" : null, text: "고교 보기 비교표의 '대학 진학 현황' 칸에서 볼 수 있어요" }),
  "설명회 노트": () => ({ href: null, text: "" }), // 노트가 있는 학교는 search.js가 그 문서 주소로 보낸다
  "입학·전형": (pl) => pl.level === "middle"
    ? { href: "#schedule?t=life", text: "중학교 일정 화면에서 배정·입학 일정을 볼 수 있어요" }
    : { href: "#schedule?t=hs", text: "고교 일정 화면에서 고입 전형 일정을 볼 수 있어요(학교별 입학 방식은 고교 보기 비교표의 '입학 방식' 칸)" },
  "학교군": (pl) => pl.level === "middle"
    ? { href: "#select/curriculum?v=schools&lv=middle", text: "중학교 보기 비교표의 '학교군' 칸에서 볼 수 있어요" }
    : { href: "#select/curriculum?v=schools&lv=high&g=%EC%9E%85%ED%95%99", text: "고교 보기 비교표의 '학군·구역' 칸에서 볼 수 있어요" },
};
export const sayOf = (label, pl) => { const f = TOPIC_SAY[label]; return f ? f(pl) : null; };
export const noneText = (label) => `${label}${josa(label)} 이 포털에 아직 없어요 → 학교 홈페이지·학교알리미 공시에서 확인해요`;

// 점검표: 문구가 가리키는 값이 실제 데이터에 있는지(tools/check-topic-claims.mjs)
//  kind "field": data 파일의 fields에 label이 든 항목이 있고 값이 있는 학교가 1곳 이상
//  kind "types": hs-types.json types[]에 key 값이 있음 / "absent": 이 포털에 없다고 말하므로 compare 어디에도 그 이름의 항목이 없어야 함
export const CLAIMS = [
  { label: "교육 특색", level: "high", kind: "field", data: "hs-compare", field: "curriculum", fieldLabel: "교육과정 특징" },
  { label: "교육 특색", level: "middle", kind: "field", data: "middle-compare", field: "feature", fieldLabel: "교육 특색" },
  { label: "학교군", level: "middle", kind: "field", data: "middle-compare", field: "zone", fieldLabel: "학교군" },
  { label: "학교군", level: "high", kind: "field", data: "hs-compare", field: "zone", fieldLabel: "학군·구역" },
  { label: "대학 진학 현황", level: "high", kind: "field", data: "hs-compare", field: "univStats", fieldLabel: "대학 진학 현황" },
  { label: "입학·전형", level: "high", kind: "field", data: "hs-compare", field: "admission", fieldLabel: "입학 방식" },
  { label: "학비·비용", kind: "types", key: "cost", screenText: "비용" },
  { label: "모집 인원", kind: "absent", words: /모집|정원/, data: ["hs-compare", "middle-compare"] },
];
