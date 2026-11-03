#!/usr/bin/env python3
"""검색 골드셋 점검(브라우저 불필요): tools/pm/searchgold.json의 질의를 portal/search.js 점수 함수로 돌려 적중률을 낸다.
  자료 있는 질의(has): 상위 3개 결과에 정답이 있으면 적중(엄격: '정확히 맞는 내용이 없을 수 있어요' 배너가 먼저 나오면 부분)
  자료 없는 질의(none): 첫 안내가 '없어요/다뤄요' 류일 때 적중
사용: python3 tools/pm/searchgold.py [--save]   (--save: 지금 값을 tools/pm/searchgold.baseline.json에 기록)
이후 수정은 적중률이 오르고 어떤 질의도 퇴보하지 않을 때만 머지한다(기준값과 비교해 퇴보 질의를 출력)."""
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
r = subprocess.run(["node", os.path.join(ROOT, "tools/pm/searchgold.mjs")], capture_output=True, text=True, cwd=ROOT)
if r.returncode != 0: print("실행 실패:", (r.stderr or r.stdout)[-400:]); sys.exit(2)
res = json.loads(r.stdout.strip().splitlines()[-1])
dev = [x for x in res if not x.get("holdout")]; hold = [x for x in res if x.get("holdout")]
has = [x for x in dev if x["kind"] == "has"]; none = [x for x in dev if x["kind"] == "none"]
pct = lambda a, k: round(100 * sum(1 for x in a if x[k]) / max(1, len(a)), 1)
print(f"자료 있는 질의 {len(has)}: 3위 안 적중 {pct(has,'ok')}% · 엄격(배너 없이) {pct(has,'strict')}%")
print(f"자료 없는 질의 {len(none)}: 안내 1위 {pct(none,'ok')}%")
print(f"합산(개발용 {len(dev)}): {pct(dev,'ok')}% · 엄격 {pct(dev,'strict')}%")
if hold: print(f"홀드아웃 {len(hold)}(수정 때 맞춰 보지 않은 새 표현): {pct(hold,'ok')}% · 엄격 {pct(hold,'strict')}%")
for tag, nm in (("dev", "r20 개발용"), ("hold", "r20 홀드아웃(고정·수정 때 보지 않음)"), ("dev21", "r21 개발용"), ("hold21", "r21 홀드아웃(고정·수정 때 보지 않음)"), ("dev22", "r22 개발용"), ("hold22", "r22 홀드아웃(고정·수정 때 보지 않음)"), ("dev23", "r23 개발용"), ("hold23", "r23 홀드아웃(고정·수정 때 보지 않음)")):
    a = [x for x in res if x.get("r20") == tag]
    if a: print(f"{nm} {len(a)}: {pct(a,'ok')}% · 엄격 {pct(a,'strict')}%")
base_path = os.path.join(ROOT, "tools/pm/searchgold.baseline.json")
if "--save" in sys.argv:
    json.dump({x["q"]: x["ok"] for x in res}, open(base_path, "w"), ensure_ascii=False, indent=0); print("기준값 기록:", base_path)
elif os.path.exists(base_path):
    base = json.load(open(base_path)); reg = [x["q"] for x in res if base.get(x["q"]) and not x["ok"]]; up = [x["q"] for x in res if base.get(x["q"]) is False and x["ok"]]
    print(f"기준값 대비: 새로 맞음 {len(up)}건, 퇴보 {len(reg)}건" + (": " + " / ".join(reg) if reg else ""))
    if reg: sys.exit(1)
miss = [x for x in res if not x["ok"] and not x.get("holdout")]  # 홀드아웃 미스는 출력하지 않는다(맞춰 고치지 않기 위해)
print(f"미스 {len(miss)}건:")
for x in miss: print(f"  [{x['kind']}] {x['q']} → {x['top'][:90]}")
