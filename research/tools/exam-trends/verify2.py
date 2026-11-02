#!/usr/bin/env python3
"""독립 검증: exam-trends-draft.json의 평가 비율 행을 compute.py·extract_strict와 '다른 방식'으로 원문에서 다시 읽어 대조한다.
방식: ① 학년은 파서가 아니라 파일 자체(첨부 순서=학년, 파일명의 'N학년')로만 정한다. ② 과목은 '<과목>과 평가 세부 계획' 제목에서 읽는다.
③ 비율은 '평가의 종류와 반영 비율' 표에서 열 이름('정기시험'/'수행평가'/'합계')을 먼저 읽고, 열 수만큼 뒤따르는 N% 값을 대응시킨다
   (정기시험 열이 없으면 지필 0 = 수행 100). 논술형 비율은 수행평가 안의 하위 항목이라 쓰지 않는다.
결과: 초안 행 중 (학년, 과목)이 독립 읽기에서 같은 학년 파일에 없거나 값이 다른 것을 출력, 있으면 종료 코드 1.
독립 읽기가 못 읽는 서식의 행은 'unread'로 따로 센다(못 읽은 행은 통과가 아니다).
사용: python3 research/tools/exam-trends/verify2.py --cache <내려받은 폴더>
"""
import sys, os, re, json, glob, argparse
sys.path.insert(0, os.path.dirname(__file__))
from exam_parse import file_text, norm
from compute import SEQ_GRADE

def N(s):
    x = norm(re.sub(r'\s+', '', s or '')).replace('II', 'Ⅱ')
    x = re.sub(r'^(공통국어|공통수학|공통영어|통합사회|통합과학|한국사|과학탐구실험|과탐실)[12]$', r'\1', x)
    return x

def read_sections(text):
    """[(과목, 지필, 수행)] — 표를 못 읽으면 지필/수행 None."""
    out = []
    text = text.replace('％', '%')
    anchors = [m for m in re.finditer(r'평가의\s*종류\s*(?:와|및)\s*반영\s*비율', text)]
    heads = [(m.start(), m.group(1)) for m in re.finditer(r'([^\n]{1,40}?)\s*(?:과\s*)?(?:평가\s*세부\s*계획|교수[·ㆍ‧･․\s]*학습[^\n]{0,12}운영\s*계획)', text)]
    gmarks = [(m.start(), int(m.group(1))) for m in re.finditer(r'(?<!\d)([123])\s*학년(?!도)', text)]
    tmarks = [(m.start(), int(m.group(1))) for m in re.finditer(r'학년\s*\n\s*학기\s*\n\s*학급\s*\n(?:\s*지도교사\s*\n)?\s*([123])\s*\n', text)]
    for m in anchors:
        h = [x for x in heads if x[0] < m.start()]
        if not h: continue
        name = re.sub(r'^[\d\s.]+', '', h[-1][1].strip().strip('| '))
        name = re.sub(r'[^0-9A-Za-z가-힣ⅠⅡⅢ·ㆍ,\s()]', '', name)
        name = re.sub(r'\d{4}\s*학년도\s*\d\s*학기', '', name).strip()
        name = re.sub(r'^(?:[123]\s*학년\s*)', '', name)
        name = re.sub(r'^[\s(]+|[\s)]+$', '', name)
        name = re.sub(r'\s*\)?\s*과목$', '', name)
        name = re.sub(r'\s*\)$', '', name)
        d = re.match(r'\s*\d{4}학년도\s*\(\s*([123])\s*\)\s*학년\s*\(\s*\d\s*\)\s*학기\s*\(([^)\n]{1,30})\)', text[m.end():m.end() + 200])
        if d: name = d.group(2).strip()
        tt = [x for x in tmarks if h[-1][0] - 200 < x[0] < m.start()]
        g = [x for x in gmarks if x[0] < h[-1][0]]
        tg = tt[-1][1] if tt else (g[-1][1] if g else None)
        blk = text[m.end():m.end() + 600]
        t2 = re.match(r'\s*\(1\)\s*평가\s*총괄표\s*학년\s*([123])\s*평\s*가\s*방\s*법\s*합계\s*정기\s*시험\s*\((\d+)%\)\s*수행\s*평가\s*\((\d+)%\)\s*교과\s*(.+?)\s*[12]차', blk, re.S)
        if t2:
            w, pf = int(t2.group(2)), int(t2.group(3))
            nm = re.sub(r'\s+', '', t2.group(4))
            out.append((nm, int(t2.group(1)), w, pf) if w + pf == 100 else (nm, int(t2.group(1)), None, None)); continue
        r = re.search(r'반영\s*비율', blk)
        if not r: out.append((name, tg, None, None)); continue
        labels = re.sub(r'\s+', '', blk[:r.start()])
        iw = min([labels.find(k) for k in ('정기', '지필') if k in labels] or [-1])
        ip = labels.find('수행')
        vals = [int(x) for x in re.findall(r'(\d+)\s*\)?\s*%', blk[r.end():r.end() + 200])]
        has_w, has_p = iw >= 0, ip >= 0
        ncol = int(has_w) + int(has_p)
        has_sum = '합계' in labels
        if not ncol or len(vals) < ncol + int(has_sum) or (has_w and has_p and iw > ip): out.append((name, tg, None, None)); continue
        w = vals[0] if has_w else 0
        pf = vals[int(has_w)] if has_p else 0
        if w + pf != 100 or (has_sum and vals[ncol] != 100): out.append((name, tg, None, None)); continue
        out.append((name, tg, w, pf))
    return out

def file_list(cache):
    fl = []
    for f in sorted(glob.glob(cache + '/dl/*') + glob.glob(cache + '/zx/*/*')):
        if f.endswith('.zip'): continue
        base = os.path.basename(f)
        if '/dl/' in f:
            pid, rest = base.split('_', 1); seq = rest.split('.')[0]; g = SEQ_GRADE.get(pid, {}).get(seq)
        else:
            d = f.split('/')[-2]; pid, seq = d.split('_'); g = SEQ_GRADE.get(pid, {}).get(seq)
            m = re.search(r'(?<!\d)([123])학년', base)
            if m: g = int(m.group(1))
        fl.append((pid, g, f))
    for g in (1, 2, 3):
        f = f'{cache}/hc_g{g}.hwp'
        if os.path.exists(f): fl.append(('pl-014', g, f))
    return fl

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--cache', required=True); ap.add_argument('--draft', default='research/data/exam-trends-draft.json')
    a = ap.parse_args()
    D = json.load(open(a.draft, encoding='utf-8'))
    ind = {}  # (pid, grade, 과목) -> set of (w, p) / None
    unread_files = {}
    for pid, g, f in file_list(a.cache):
        try: t = file_text(f)
        except Exception as e: unread_files[f] = str(e); continue
        secs = read_sections(t)
        if not secs: unread_files[os.path.basename(f)] = '독립 읽기가 표를 못 찾음'
        for name, tg, w, p in secs:
            gg = g if g else tg
            ind.setdefault((pid, gg, N(name)), set()).add((w, p))
    bad, ok, unread = [], 0, []
    for s in D['schools']:
        pid = s['placeId']
        for pl in s['assessmentPlan']:
            for r in pl['rows']:
                k = (pid, pl['grade'], N(r['subject']))
                v = ind.get(k)
                if v is None:
                    others = sorted({kk[1] for kk in ind if kk[0] == pid and kk[2] == k[2]})
                    if others: bad.append((s['name'], pl['grade'], r['subject'], f'초안 학년과 다른 학년 파일에만 있음 {others}'))
                    else: unread.append((s['name'], pl['grade'], r['subject']))
                    continue
                if (r['writtenPct'], r['performancePct']) in v and len(v - {(None, None)}) == 1: ok += 1
                elif v == {(None, None)}: unread.append((s['name'], pl['grade'], r['subject']))
                else: bad.append((s['name'], pl['grade'], r['subject'], f"독립 읽기 {sorted(v)} ≠ 초안 {(r['writtenPct'], r['performancePct'])}"))
    have = {(s['placeId'], pl['grade'], N(r['subject'])) for s in D['schools'] for pl in s['assessmentPlan'] for r in pl['rows']}
    miss = sorted((k for k, v in ind.items() if k not in have and v != {(None, None)} and k[1]), key=str)
    print(f'원문에서 읽혔으나 초안에 없는 (학교, 학년, 과목) {len(miss)}건(누락 후보, 참고용):')
    for k in (miss if os.environ.get('LIST_MISSING') else []): print('   missing', *k, sorted(ind[k]))
    n = sum(len(pl['rows']) for s in D['schools'] for pl in s['assessmentPlan'])
    print(f'초안 행 {n}건: 독립 일치 {ok}, 불일치 {len(bad)}, 독립 읽기 못함 {len(unread)}')
    for b in bad: print(' - 불일치', *b)
    by = {}
    for u in unread: by.setdefault(u[0], 0); by[u[0]] += 1
    print(' - 독립 읽기 못한 행(학교별):', by)
    if os.environ.get('LIST_UNREAD'):
        for u in unread: print('   unread', *u)
    sys.exit(1 if bad else 0)
