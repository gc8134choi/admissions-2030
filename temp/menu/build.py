#!/usr/bin/env python3
"""메뉴 시안 생성기(temp/menu/A·B·C). 실행: python3 temp/menu/build.py — 각 안의 index.html(홈)과 대표 화면 3개를 만든다.
항목 이름·날짜는 실제 portal 데이터(policy.json)에서 가져온 값을 손으로 옮긴 것이고, 링크는 실제 주소(#...)와 같은 이름의 시안 파일로 이어진다."""
import os, html
ROOT = os.path.dirname(os.path.abspath(__file__))
CSS = ["../../../portal/style.css", "../../../portal/theme.css", "../../../portal/scrap.css", "../mock.css"]

# ---- 메뉴 트리: 최상위 5, 2단계까지. (이름, 새 이름 8자 안팎, 옛 주소 해시, 시안 파일)
TREE = [
  ("지금 할 일", "마감·D-day부터", [
    ("오늘 할 일", "#home", None), ("전체 일정", "#schedule", None), ("바뀐 소식", "#changelog", None), ("캘린더에 담기", "#schedule (캘린더 구역)", None)]),
  ("중학교", "배정·학교·생활", [
    ("중학교 배정", "#select/curriculum?v=middle", "middle.html"), ("중학교 지도", "#select/curriculum?v=map&lv=middle", None),
    ("중학교 생활", "#mid/life", None), ("중입 일정", "#schedule?t=life", None)]),
  ("고등학교", "고르기·과목·학점제", [
    ("고교 종류", "#select/curriculum?v=hs&ty=1", None), ("고입 일정", "#schedule?t=hs", None), ("학교 비교", "#select/curriculum?v=hs", None), ("고교 지도", "#select/curriculum?v=map", None),
    ("학점제 쉬운 설명", "#life/credit", "credit.html"), ("내 과목 계획", "#planner/plan", None), ("학년별 할 일", "#schedule?t=road", None)]),
  ("대학 입시", "수능·내신·대학", [
    ("수능과 내신", "#admission/system", "system.html"), ("대학별 조건", "#select/curriculum?v=univ", None), ("입시 일정", "#schedule?t=univ", None)]),
  ("자료", "바로가기·출처", [
    ("바로가기 모음", "#library", None), ("출처 목록", "#library/sources", None), ("갱신 기록", "#library/status", None), ("원본 사진", "#library/files", None)]),
]
NUM = "①②③④⑤"
def href(h, f): return f or "#"

# ---- 대표 화면 3개: 같은 내용을 세 안에 똑같이 넣는다(메뉴 틀만 다르다).
SCREENS = {
 "credit.html": dict(group=1+1, item="학점제 쉬운 설명", title="고교학점제, 이렇게 이해하면 돼요", crumb=["고등학교", "학점제 쉬운 설명"],
   lead="학교가 정해 준 시간표 대신, 정해진 학점만 채우면 졸업하는 방식이에요. 아래 세 가지만 먼저 기억하세요.",
   toc=[("graduate", "졸업하려면"), ("pass", "과목을 인정받으려면"), ("term", "학기별로는"), ("tip", "챙길 것")],
   body="""
<div class="key"><div><b>192</b><span>졸업에 필요한 학점</span></div><div><b>2/3</b><span>모든 과목 출석률</span></div><div><b>40%</b><span>공통과목 학업성취율</span></div></div>
<h2 id="graduate"><em>1</em>졸업하려면</h2>
<p>3년 동안 <b>192학점</b>을 채워요. 교과 174학점과 창의적 체험활동(창체) 18학점으로 나뉘어요.</p>
<h3>교과 174학점 안에서</h3>
<p>필수로 들어야 하는 과목이 84학점이고, 나머지 90학점은 내가 골라서 채울 수 있어요.</p>
<h2 id="pass"><em>2</em>과목을 인정받으려면</h2>
<ul><li><b>선택과목</b>: 출석률이 3분의 2 이상이면 돼요.</li><li><b>공통과목</b>: 출석률 3분의 2 이상에 학업성취율 40% 이상이 더 필요해요.</li></ul>
<p class="tag">경기도에서 어떻게 적용되는지는 따로 확인이 필요해요.</p>
<h2 id="term"><em>3</em>학기별로는</h2>
<p>아래 표는 한눈에 보이도록 화면 전체 너비를 써요(표는 읽기 폭 제한의 예외).</p>
<div class="wide"><table><thead><tr><th>구분</th><th>학점</th><th>쉬운 설명</th></tr></thead><tbody>
<tr><td>교과 필수</td><td class="date">84</td><td>모두가 듣는 과목</td></tr><tr><td>교과 선택</td><td class="date">90</td><td>내가 고르는 과목</td></tr><tr><td>창의적 체험활동</td><td class="date">18</td><td>동아리·봉사·진로 활동</td></tr><tr><td><b>합계</b></td><td class="date">192</td><td>3년 동안 채울 학점</td></tr></tbody></table></div>
<h2 id="tip"><em>4</em>챙길 것</h2>
<div class="memo">학교마다 열리는 선택과목이 달라요. 학교를 비교할 때는 <a href="#">학교 비교</a>에서 과목표를 확인하세요.</div>
"""),
 "system.html": dict(group=3, item="수능과 내신", title="수능과 내신, 어떻게 되나요", crumb=["대학 입시", "수능과 내신"],
   lead="수능은 2028학년도부터 통합형으로 바뀌고, 내신은 5등급 상대평가예요. 우리 아이가 보는 2030학년도 세부는 아직 정해지지 않았어요.",
   toc=[("csat", "수능"), ("grade", "내신"), ("when", "언제 정해져요"), ],
   body="""
<div class="key"><div><b>2029.11.15</b><span>2030학년도 수능(잠정)</span></div><div><b>5등급</b><span>내신 상대평가</span></div></div>
<h2 id="csat"><em>1</em>수능</h2>
<p>2028학년도 수능은 2027.11.18(목)에 보고, 성적은 2027.12.10(금)에 나와요. 이때부터 국어·수학·탐구에서 선택과목 없이 모두 같은 내용을 봐요.</p>
<div class="memo"><span class="tag">추정</span> 우리 아이의 2030학년도 수능은 <b>2029.11.15(목)</b>로 예상돼요. 공식 공고가 나오기 전이라 확정이 아니에요.</div>
<h2 id="grade"><em>2</em>내신</h2>
<p>내신은 성취도 A~E와 석차 5등급을 함께 적어요. 일부 과목(체육·예술 등)은 등급 없이 성취도만 적어요.</p>
<div class="wide"><table><thead><tr><th>과목 종류</th><th>성적 표기</th></tr></thead><tbody><tr><td>일반 교과(공통·일반선택)</td><td>성취도 A~E + 5등급</td></tr><tr><td>사회·과학 융합선택</td><td>성취도만</td></tr><tr><td>체육·예술·과학탐구실험</td><td>성취도만</td></tr></tbody></table></div>
<h2 id="when"><em>3</em>언제 정해져요</h2>
<p>정부의 중장기 대입 개편안은 2027년 3월 공표 예정이에요. 그 전까지 2030학년도 세부는 확정이 아니에요.</p>
"""),
 "middle.html": dict(group=1, item="중학교 배정", title="중학교 배정, 이 순서로 해요", crumb=["중학교", "중학교 배정"],
   lead="초등학교 6학년 겨울에 원서를 쓰고, 추첨으로 정해져요. 날짜만 순서대로 챙기면 돼요.",
   toc=[("apply", "원서 쓰기"), ("result", "발표와 등록"), ("move", "이사 가면")],
   body="""
<div class="key"><div><b>11.2~6</b><span>배정원서 작성</span></div><div><b>12.31</b><span>배정학교 발표</span></div><div><b>1.4~7</b><span>신입생 등록</span></div></div>
<h2 id="apply"><em>1</em>원서 쓰기</h2>
<p>2027학년도 용인 중학교 배정원서는 <b>2026.11.2(월)~11.6(금)</b>에 출신 초등학교에서 작성해요. 학교군 안의 모든 중학교를 가고 싶은 순서대로 써요.</p>
<h2 id="result"><em>2</em>발표와 등록</h2>
<div class="wide"><table><thead><tr><th>날짜</th><th>할 일</th><th>어디서</th></tr></thead><tbody>
<tr><td class="date">2026.11.2~11.6</td><td>배정원서 작성</td><td>출신 초등학교</td></tr><tr><td class="date">2026.12.31(목)</td><td>배정학교 발표</td><td>출신 초등학교</td></tr><tr><td class="date">2027.1.4~1.7</td><td>신입생 등록</td><td>배정받은 중학교</td></tr></tbody></table></div>
<h2 id="move"><em>3</em>이사 가면</h2>
<p>이사나 전입이 있으면 배정 뒤 변경 절차가 따로 있어요. 자세한 날짜는 아래 소식에서 확인하세요.</p>
<div class="memo">이사 계획이 있다면 <a href="#">이사·전입과 배정</a>을 먼저 보세요.</div>
"""),
}

def svg_menu(): return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
def head(title, extra=""):
    css = "".join(f'<link rel="stylesheet" href="{c}">' for c in CSS)
    return f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)} · 스쿨 라이프</title>{css}{extra}</head><body>'
WM = '<a class="wm" href="index.html">스쿨 <i>라이프</i></a>'
SEARCH = '<div class="search" role="search"><svg width="20" height="20" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.8"/></svg><span>검색 (예: 배정 발표일)</span></div>'

def tree_html(cur_item=None):
    out = []
    for gi, (g, sub, items) in enumerate(TREE):
        li = "".join(f'<li><a href="{f or "#"}"{" aria-current=page" if n == cur_item else ""}>{html.escape(n)}</a></li>' for n, h, f in items)
        out.append(f'<h2>{NUM[gi]} {html.escape(g)}</h2><ul>{li}</ul>')
    return "".join(out)

def article(s, crumb_html):
    toc = "".join(f'<li><a href="#{a}">{html.escape(t)}</a></li>' for a, t in s["toc"])
    return f'''<div class="page toc"><article class="read">{crumb_html}<h1>{html.escape(s["title"])}</h1><p class="lead">{html.escape(s["lead"])}</p>
<details class="toc-m"><summary>이 화면에서 ▾</summary><ol>{toc}</ol></details>{s["body"]}</article>
<aside class="toc-box" aria-label="이 화면에서"><h2>이 화면에서</h2><ol>{toc}</ol></aside></div>'''

DRAWER_JS = '<script>document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>document.getElementById("dr").classList.add("open"));document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>document.getElementById("dr").classList.remove("open"));</script>'

def page_A(fname, s):
    crumb = f'<p class="crumb">{" › ".join(html.escape(c) for c in s["crumb"])}</p>'
    topbar = f'<header class="top"><button class="btn menubtn" data-open aria-label="메뉴 열기">{svg_menu()}메뉴</button>{WM}<span class="sp"></span>{SEARCH}</header>'
    drawer = f'<div class="drawer" id="dr"><div class="sheet"><div class="x"><b class="wm">메뉴</b><button class="btn" data-close>닫기 ✕</button></div><nav class="tree">{tree_html(s["item"])}</nav></div></div>'
    return head(s["title"]) + topbar + f'<div class="shell"><nav class="side tree" aria-label="전체 메뉴">{tree_html(s["item"])}</nav><main class="main">{article(s, crumb)}</main></div>' + drawer + DRAWER_JS + "</body></html>"

def home_A():
    topbar = f'<header class="top"><button class="btn menubtn" data-open aria-label="메뉴 열기">{svg_menu()}메뉴</button>{WM}<span class="sp"></span>{SEARCH}</header>'
    drawer = f'<div class="drawer" id="dr"><div class="sheet"><div class="x"><b class="wm">메뉴</b><button class="btn" data-close>닫기 ✕</button></div><nav class="tree">{tree_html("오늘 할 일")}</nav></div></div>'
    main = '''<div class="page"><section class="read"><p class="crumb">지금 할 일</p><h1>오늘 할 일</h1><p class="lead">가장 가까운 마감부터 보여 드려요.</p>
<div class="next-box"><div class="big">D-9</div><p><b>중학교 배정원서 작성</b><br>2026.11.2(월)~11.6(금) · 출신 초등학교</p></div>
<div class="key"><div><b>12.31</b><span>배정학교 발표</span></div><div><b>1.4~7</b><span>신입생 등록</span></div></div>
<h2><em>1</em>이번 달 일정</h2><p>왼쪽(또는 ‘메뉴’)에서 단계를 고르면 그 단계 화면으로 가요.</p></section></div>'''
    return head("오늘 할 일") + topbar + f'<div class="shell"><nav class="side tree" aria-label="전체 메뉴">{tree_html("오늘 할 일")}</nav><main class="main">{main}</main></div>' + drawer + DRAWER_JS + "</body></html>"

def mindmap(wide=True):
    br = []
    for gi, (g, sub, items) in enumerate(TREE):
        li = "".join(f'<li><a href="{f or "#"}">{html.escape(n)}</a></li>' for n, h, f in items)
        br.append(f'<details class="br"{" open" if gi == 2 else ""}><summary><span class="n">{gi+1}</span><b>{html.escape(g)}<small>{html.escape(sub)}</small></b></summary><ul>{li}</ul></details>')
    return f'''<main class="mm"><div class="hub"><b>스쿨 <i>라이프</i></b><p>궁금한 가지를 눌러 보세요</p></div>
<div class="next-box"><div class="big">D-9</div><p><b>가장 가까운 마감 · 중학교 배정원서</b><br>2026.11.2(월)~11.6(금)</p></div>
<div class="branches">{"".join(br)}</div></main>'''

def home_B():
    return head("스쿨 라이프") + f'<header class="top">{WM}<span class="sp"></span>{SEARCH}</header>' + mindmap() + "</body></html>"

def page_B(fname, s):
    cr = [("처음", "index.html")] + [(s["crumb"][0], "index.html"), (s["crumb"][1], None)]
    crumb = " › ".join(f'<a href="{u}">{html.escape(t)}</a>' if u else f"<b>{html.escape(t)}</b>" for t, u in cr)
    inner = f'<div class="inner-top"><a class="btn" href="index.html">← 처음으로</a><p class="crumb">{crumb}</p>{SEARCH}</div>'
    return head(s["title"]) + inner + f'<main class="main">{article(s, "")}</main></body></html>'

def page_C(fname, s):  # 안쪽 = A
    return page_A(fname, s)
def home_C(): return home_B()

OUT = {"A": (home_A, page_A), "B": (home_B, page_B), "C": (home_C, page_C)}
for v, (h, p) in OUT.items():
    d = os.path.join(ROOT, v); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(h())
    for f, s in SCREENS.items(): open(os.path.join(d, f), "w", encoding="utf-8").write(p(f, s))
print("만든 파일:", sum(len(os.listdir(os.path.join(ROOT, v))) for v in OUT))
