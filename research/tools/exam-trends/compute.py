"""캐시 폴더(내려받은 공시 파일)에서 학교별 과목 비율 행을 계산한다.
캐시 구조: <cache>/dl/<placeId>_<seq>.<ext>, <cache>/zx/<placeId>_<seq>/<파일>, <cache>/hc_g1.hwp ~ hc_g3.hwp(홍천)
"""
import sys, os, re, glob
from collections import defaultdict
sys.path.insert(0, os.path.dirname(__file__))
from exam_parse import *

SEQ_GRADE = {'pl-011': {'0': 1, '1': 2, '2': 3}, 'pl-013': {'1': 1, '2': 2, '3': 3}, 'pl-022': {'7': 1, '8': 2, '9': 3},
             'pl-023': {'0': 1, '1': 2, '2': 3}, 'pl-024': {'0': 1, '1': 2, '2': 3}, 'pl-012': {'0': 1, '1': 2, '2': 3}, 'pl-025': {'7': 1, '8': 2, '9': 3}}

def compute(cache):
    rows = defaultdict(list)
    files = [(f, None) for f in sorted(glob.glob(cache + '/dl/*') + glob.glob(cache + '/zx/*/*')) if not f.endswith('.zip')]
    for g in (1, 2, 3):
        f = f'{cache}/hc_g{g}.hwp'
        if os.path.exists(f): files.append((f, g))
    for f, hcg in files:
        base = os.path.basename(f)
        if hcg: pid, hint, gh = 'pl-014', None, hcg
        elif '/dl/' in f:
            pid, rest = base.split('_', 1); seq = rest.split('.')[0]; hint = None; gh = SEQ_GRADE.get(pid, {}).get(seq)
        else:
            d = f.split('/')[-2]; pid, seq = d.split('_'); hint = hint2(base); gh = SEQ_GRADE.get(pid, {}).get(seq)
            if hint and not gh:
                m = re.search(r'(\d)학년', base); gh = int(m.group(1)) if m else None
        for r in extract_strict(f, hint):
            n = r['subject']
            if not n: continue
            a = area_of2(n)
            if not a: continue
            fh = {norm(clean_name(x)) for x in r.get('fileHeaders', [])}
            ok = (norm(n) in fh) or bool(hint and norm(hint) == norm(n)) or bool(hcg)
            ok = ok and r['written'] + r['performance'] == 100 and not r.get('shared')
            g = r.get('grade') if r.get('grade') in (1, 2, 3) else gh
            rows[pid].append({'subject': n, 'area': a, 'grade': g, 'written': r['written'], 'performance': r['performance'], 'ok': ok, 'file': base})
    out = {}
    for pid, rs in rows.items():
        byk = defaultdict(list)
        for r in rs: byk[(r['grade'], norm(r['subject']))].append(r)
        keep, excl = [], []
        for k, v in byk.items():
            vals = {(x['written'], x['performance']) for x in v}
            if len(vals) > 1: excl.append({'grade': k[0], 'subject': v[0]['subject'], 'reason': '같은 과목에 서로 다른 비율이 있어 제외', 'values': sorted(vals)}); continue
            if not v[0]['ok']: excl.append({'grade': k[0], 'subject': v[0]['subject'], 'reason': '과목명을 원문의 머리표·표 제목에서 확인하지 못해 제외'}); continue
            keep.append(v[0])
        out[pid] = {'keep': keep, 'excl': excl}
    return out
