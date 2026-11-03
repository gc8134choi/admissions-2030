#!/usr/bin/env python3
"""문구-데이터 개수 일치 점검: 화면 문구에 박힌 '○곳·○개교·○건' 같은 개수가 실제 데이터 개수와 같은지 대조한다.
사용: python3 research/tools/check-counts/check_counts.py   (위반이 있으면 종료 코드 1)
점검 규칙(데이터에서 개수를 세는 것만 등록한다. 제도 사실(예: 수지1중학군 9개교, 수능 제2외국어 9과목)은 대상이 아니다):
 R1 '학교 N곳'·'고교 N곳' = 고교 비교표 학교 수
 R2 '중학교 N곳'(고교 N곳과 함께 쓴 문구) = 중학교 비교표 학교 수
 R3 '초·중·고 N곳' = 지도(장소) 수
 R4 '교육과정 정보를 모은 N개교만' = 고교 비교표에서 교육과정 값이 있는 학교 수, '학교알리미 값을 N개교만' = 학생수 값이 있는 학교 수
 R5 '편제표 N개교'·'우리 N개교'·'일반고 N개교는 편제표' = 편제표 학교(schools.json) 수
 R6 'N개교 … (A·B·C…)'처럼 개수 뒤에 명단이 붙은 문구는 명단 수와 같아야 한다
 R7 '고교·중학교 N곳 … 링크 N건' 등 links.json 항목 수 = 문구의 건수
"""
import json, re, glob, sys, os
os.chdir(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
J = lambda p: json.load(open(p, encoding='utf-8'))
n_hs = len(J('portal/data/hs-compare.json')['schools'])
n_mid = len(J('portal/data/middle-compare.json')['schools'])
places = J('portal/data/places.json'); n_places = len(places['places'] if isinstance(places, dict) and 'places' in places else places)
hs = J('portal/data/hs-compare.json')
n_cur = sum(1 for s in hs['schools'] if s['values'].get('curriculum', {}).get('value') is not None)
n_stu = sum(1 for s in hs['schools'] if s['values'].get('students', {}).get('value') is not None)
sch = J('portal/data/schools.json'); n_sch = len(sch['schools'] if isinstance(sch, dict) and 'schools' in sch else sch)

def texts():
    """(출처, 문구) — 화면 코드와 화면 데이터의 문구. 출처 목록·변경 이력·코드표는 제외."""
    for f in sorted(glob.glob('portal/*.js') + glob.glob('portal/*.html')):
        yield f, open(f, encoding='utf-8').read()
    skip = {'changes', 'matches', 'school-codes', 'sources', 'middle', 'admission-rules', 'data-dictionary', 'places', 'places-nearby', 'subject-info', 'subject-master', 'files', 'schools', 'hs-compare-fields'}
    def walk(o, p=''):
        if isinstance(o, str): yield p, o
        elif isinstance(o, list):
            for i, x in enumerate(o): yield from walk(x, f'{p}[{i}]')
        elif isinstance(o, dict):
            for k, v in o.items():
                if k in ('sources', 'sourceName', 'source', 'sourceUrl', 'extraSources', 'unverified'): continue
                yield from walk(v, f'{p}.{k}')
    for f in sorted(glob.glob('portal/data/*.json')):
        name = os.path.basename(f)[:-5]
        if name in skip: continue
        try: d = J(f)
        except Exception: continue
        for p, s in walk(d): yield f'{f}{p}', s

bad = []; checked = 0
def chk(src, label, said, actual):
    global checked
    checked += 1
    if int(said) != actual: bad.append(f'{src}: "{label}" 문구 {said} ≠ 데이터 {actual}')

for src, t in texts():
    for m in re.finditer(r'(?:학교|고교)\s?(\d+)곳', t):
        ctx = t[max(0, m.start() - 12):m.end() + 12]
        if '비교' in ctx or '기본 정보 표' in ctx or '고교 ' + m.group(1) + '곳·중학교' in ctx or '학교 ' + m.group(1) + '곳 기본' in ctx or '고교 비교(학교' in ctx: chk(src, m.group(0), m.group(1), n_hs)
    for m in re.finditer(r'고교\s?(\d+)곳·중학교\s?(\d+)곳', t): chk(src, m.group(0), m.group(1), n_hs); chk(src, m.group(0), m.group(2), n_mid)
    for m in re.finditer(r'초·중·고\s?(\d+)곳', t): chk(src, m.group(0), m.group(1), n_places)
    for m in re.finditer(r'교육과정 정보를 모은 (\d+)개교만', t): chk(src, m.group(0), m.group(1), n_cur)
    for m in re.finditer(r'학교알리미 값을 (\d+)개교만', t): chk(src, m.group(0), m.group(1), n_stu)
    for m in re.finditer(r'(?:편제표\s?(\d+)개교|우리\s?(\d+)개교|일반고\s?(\d+)개교는 편제표)', t): chk(src, m.group(0), next(g for g in m.groups() if g), n_sch)
    for m in re.finditer(r'(\d+)개교[^()\n]{0,14}\(([^()]*[·,][^()]*)\)', t):
        names = [x for x in re.split(r'[·,]\s*', m.group(2)) if x.strip()]
        if all(re.search(r'(고|중|초)$', x.strip().replace('등', '')) or len(x.strip()) <= 6 for x in names) and len(names) >= 2: chk(src, m.group(0)[:40], m.group(1), len(names))
links = J('portal/data/links.json'); n_links = len(links.get('items') or links.get('links'))
for src, t in texts():
    for m in re.finditer(r'링크\s?(\d+)건|외부 링크[^\d]{0,6}(\d+)건', t): chk(src, m.group(0), next(g for g in m.groups() if g), n_links)
if '--selftest' in sys.argv:  # 규칙이 실제로 틀린 문구를 잡는지 확인
    probe = '교육과정 정보를 모은 99개교만 값이 있어요 · 학교 99곳 기본 정보 표 · 고교 99곳·중학교 98곳 · 초·중·고 97곳 · 편제표 96개교 · 8개교 게시(서원·수지·신갈)'
    n0 = len(bad); 
    for m in re.finditer(r'교육과정 정보를 모은 (\d+)개교만', probe): chk('selftest', m.group(0), m.group(1), n_cur)
    for m in re.finditer(r'고교\s?(\d+)곳·중학교\s?(\d+)곳', probe): chk('selftest', m.group(0), m.group(1), n_hs); chk('selftest', m.group(0), m.group(2), n_mid)
    for m in re.finditer(r'초·중·고\s?(\d+)곳', probe): chk('selftest', m.group(0), m.group(1), n_places)
    for m in re.finditer(r'편제표\s?(\d+)개교', probe): chk('selftest', m.group(0), m.group(1), n_sch)
    for m in re.finditer(r'(\d+)개교[^()\n]{0,14}\(([^()]*[·,][^()]*)\)', probe):
        names = [x for x in re.split(r'[·,]\s*', m.group(2)) if x.strip()]; chk('selftest', m.group(0), m.group(1), len(names))
    print('selftest: 잡아낸 위반', len(bad) - n0, '(기대 6)'); sys.exit(0 if len(bad) - n0 == 6 else 1)
print(f'점검한 개수 문구 {checked}건, 위반 {len(bad)}건')
for b in bad: print(' -', b)
sys.exit(1 if bad else 0)
