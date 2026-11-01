// 날짜 문구 공용: "2026-11-02~2026-11-06" → "2026.11.2~11.6", "2026-09" → "2026.9". 월/일만 있는 값도 받는다.
export function fmtWhen(w) {
  if (!w) return "";
  const p = (s) => { const [y, m, d] = s.split("-"); return { y, m: +m, d: d ? +d : null }; };
  const [a, b] = String(w).split("~").map(p);
  const one = (x, withY) => `${withY ? `${x.y}.` : ""}${x.m}${x.d != null ? `.${x.d}` : ""}`;
  return b ? `${one(a, true)}~${one(b, a.y !== b.y)}` : one(a, true);
}
