#!/usr/bin/env bash
# 감시 봇이 watch/auto 브랜치에 올린 watch-state.json 변경을 확인하고 반영하는 수동 루틴.
# 사용: bash research/tools/watch-sync.sh          (변경 요약만 출력)
#       bash research/tools/watch-sync.sh --apply   (watch/auto의 상태 파일을 현재 브랜치에 가져옴 → 커밋·ship)
# 1) 요약에 나온 '영향 데이터' 행을 원문과 대조해 policy-draft 등을 먼저 고친다.
# 2) 확인이 끝난 뒤 --apply로 기준선을 갱신한다(확인 전에 기준선만 갱신하면 변경이 묻힌다).
set -euo pipefail
F=research/data/watch-state.json
git fetch -q origin main watch/auto
echo "== watch/auto 최근 커밋"; git log origin/watch/auto -3 --format='%h %ad %s' --date=short
echo "== 변경된 감시 항목(해시가 달라진 것)"
python3 - <<'PY'
import json,subprocess
new=json.loads(subprocess.check_output(['git','show','origin/watch/auto:research/data/watch-state.json']))
cur=json.load(open('research/data/watch-state.json'))
wl={i['id']:i for i in json.load(open('research/data/watchlist.json'))['items']}
for k,v in new.items():
    if k in cur and cur[k].get('hash')!=v.get('hash'):
        a=set(cur[k].get('lines',[])); b=set(v.get('lines',[]))
        print(f"- {k} {wl.get(k,{}).get('name','')} | 영향: {','.join(wl.get(k,{}).get('affects',[]))}")
        for l in sorted(b-a)[:4]: print('   +',l[:90])
        for l in sorted(a-b)[:4]: print('   -',l[:90])
PY
if [ "${1:-}" = "--apply" ]; then
  git checkout origin/watch/auto -- "$F"
  echo "watch-state.json을 watch/auto 기준으로 갱신했습니다. 커밋 후 python3 tools/pm/prs.py ship research/materials \"research: 감시 기준선 갱신\""
fi
