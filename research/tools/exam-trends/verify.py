#!/usr/bin/env python3
"""exam-trends-draft.json의 평가 비율 행을 원문(캐시된 공시 파일)과 전수 대조한다.
확인 항목: ① 초안의 모든 행이 원문 재계산 결과(과목명·학년·지필·수행)와 같다 ② 지필+수행=100 ③ 같은 과목 중복 없음
④ 영어 계열(영어 독해와 작문 등)이 영어 영역이다. 불일치가 있으면 목록을 출력하고 종료 코드 1.
사용: python3 research/tools/exam-trends/verify.py --cache <내려받은 폴더>
"""
import sys, os, re, json, argparse
sys.path.insert(0, os.path.dirname(__file__))
from compute import compute
from exam_parse import norm, area_of2

ap = argparse.ArgumentParser(); ap.add_argument('--cache', required=True); ap.add_argument('--draft', default='research/data/exam-trends-draft.json')
a = ap.parse_args()
D = json.load(open(a.draft, encoding='utf-8'))
calc = compute(a.cache)
bad = []; n = 0
for s in D['schools']:
    pid = s['placeId']
    ref = {(r['grade'], norm(r['subject'])): (r['written'], r['performance']) for r in calc.get(pid, {}).get('keep', [])}
    seen = set()
    for p in s['assessmentPlan']:
        for r in p['rows']:
            n += 1
            k = (p['grade'], norm(r['subject']))
            if r['writtenPct'] + r['performancePct'] != 100: bad.append((s['name'], k, '합이 100이 아님'))
            if k in seen: bad.append((s['name'], k, '중복'))
            seen.add(k)
            if ref.get(k) != (r['writtenPct'], r['performancePct']): bad.append((s['name'], k, f"원문 재계산 {ref.get(k)} ≠ 초안 {(r['writtenPct'], r['performancePct'])}"))
            if re.search(r'영어|영미', r['subject']) and r['area'] != '영어': bad.append((s['name'], k, '영어 영역이어야 함'))
            if area_of2(r['subject']) != r['area'] and not (r['subject'] in ('인문학과 윤리',) ): bad.append((s['name'], k, f"영역 불일치 {area_of2(r['subject'])} vs {r['area']}"))
print(f'대조 행 {n}건, 불일치 {len(bad)}건')
for b in bad[:60]: print(' -', *b)
sys.exit(1 if bad else 0)
