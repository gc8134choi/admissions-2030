// 빈칸 안내 공용: "왜 비었는지 + 다음 행동(어디서 확인하는지)"을 한 줄로 적는다. 내부 사정(점검 방식, 파일 이름)은 쓰지 않는다.
//   import { nextLink, emptyLine } from "./empty.js";
//   emptyLine(esc, { why: "모집요강을 아직 정리하지 못했어요", next: { label: "입학처에서 확인", url } })
const esc0 = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// 자주 쓰는 확인처(공식 사이트). 주소는 저장소 자료(links·출처)에서 이미 쓰는 것만 둔다.
export const WHERE = {
  schoolinfo: { label: "학교알리미에서 확인", url: "https://www.schoolinfo.go.kr/" },
  goePortal: { label: "경기도 고입·전학 포털에서 확인", url: "https://satp.goe.go.kr/main.do" },
};
export const nextLink = (n, esc = esc0) => (n && n.url ? ` <a class="gap-next" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.label)} ↗</a>` : n && n.label ? ` <span class="gap-next">${esc(n.label)}</span>` : "");
export const emptyLine = (esc, { why, next } = {}) => `<p class="muted gap">${esc(why || "아직 정리 중이에요")}${nextLink(next, esc)}</p>`;
