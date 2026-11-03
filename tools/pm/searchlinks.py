#!/usr/bin/env python3
"""검색 결과 링크 점검: 정책 행(제목)을 검색해 나온 결과 링크를 따라가 그 화면에 해당 행이 실제 있는지 확인한다.
사용: python3 tools/pm/searchlinks.py [기본주소=http://localhost:8000/portal/] [--limit N]
(Playwright 필요. 서버를 먼저 띄운다: python3 -m http.server 8000)"""
import json, os, subprocess, sys, tempfile
args = [a for a in sys.argv[1:] if not a.startswith("--") and not (sys.argv[sys.argv.index(a) - 1] in ("--only", "--limit"))]
BASE = (args[0] if args else "http://localhost:8000/portal/").rstrip("/") + "/"
# 로컬 주소인데 서버가 꺼져 있으면 직접 띄운다(검사가 도중에 서버가 죽어 '오류'로 쏟아지지 않게)
import atexit, time, urllib.request
if BASE.startswith("http://localhost"):
    try: urllib.request.urlopen(BASE, timeout=3)
    except Exception:
        _root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        _port = BASE.split(":")[2].split("/")[0]
        _srv = subprocess.Popen([sys.executable, "-m", "http.server", _port], cwd=_root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        atexit.register(_srv.terminate); time.sleep(1.5)
LIMIT = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 0
JS = r"""
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const base=process.argv[2],limit=+process.argv[3]||0;const rows=JSON.parse(fs.readFileSync('portal/data/policy.json','utf8'));
const only=process.argv[4];const sel=only?rows.filter(r=>r.id.startsWith(only)):limit?rows.slice(0,limit):rows;const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
await p.goto(base);await p.waitForTimeout(1500);await p.keyboard.press('/');await p.waitForSelector('.srch input');await p.waitForTimeout(1800);
const norm=s=>String(s||'').replace(/[^0-9A-Za-z가-힣]/g,'');const bad=[],skipped=[];let ok=0;
for(const r of rows.length?sel:[]){const title=r.title;await p.fill('.srch input',title.replace(/^\d{4}-\d{2}(-\d{2})?\s*/,''));await p.waitForTimeout(250);
 const hit=await p.evaluate((t)=>{const k=t.replace(/\s+/g,'').slice(0,10);let grp='';for(const el of document.querySelectorAll('.sr-out .sr-h, .sr-out li')){if(el.classList.contains('sr-h')){grp=el.textContent;continue}if(!(grp.startsWith('일정·제도')||grp.startsWith('바로 안내')))continue;const a=el.querySelector('a'),b=a&&a.querySelector('b');if(b&&b.textContent.replace(/\s+/g,'').includes(k))return {href:a.getAttribute('href'),ext:a.target==='_blank'}}return null},title.replace(/^\d{4}-\d{2}(-\d{2})?\s*/,''));
 if(!hit){skipped.push(r.id+' 검색 결과에 제목 없음');continue}
 if(hit.ext)continue;
 const page=await p.context().newPage();await page.goto(base+hit.href);await page.waitForTimeout(1200);
 await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));await page.waitForTimeout(700);
 const EQ={'hs-11':['192학점']};const keys=[...(EQ[r.id]||[]).map(norm),norm(title.replace(/^\d{4}-\d{2}(-\d{2})?\s*/,'')).slice(0,12),norm(r.body).slice(0,14),...(r.events||[]).map(e=>norm(e.label||e.title).slice(0,12))].filter(x=>x.length>=4);
 const found=await page.evaluate((ks)=>{const t=document.body.textContent.replace(/[^0-9A-Za-z가-힣]/g,'');return ks.some(k=>t.includes(k))},keys);
 if(found)ok++;else bad.push(r.id+' '+title.slice(0,24)+' → '+hit.href);await page.close()}
console.log(JSON.stringify({ok,bad,skipped:skipped.length,sk:skipped}));await b.close()})();
"""
# --hl: 검색 결과의 ?hl= 이동 주소 전수 도착 검사(행이 보이고 머리에 안 가리며, 3초 뒤 더 밀리지 않는지) — 모바일 390px
if "--hl" in sys.argv:
    ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    items = json.loads(subprocess.run(["node", os.path.join(ROOT, "tools/pm/searchhl.mjs")], capture_output=True, text=True, cwd=ROOT).stdout.strip().splitlines()[-1])
    if "--hl-slice" in sys.argv:  # --hl-slice k/n: 전체 항목을 n조각으로 나눠 k번째만(긴 검사를 나눠 돌릴 때)
        k, n = map(int, sys.argv[sys.argv.index("--hl-slice") + 1].split("/")); items = items[k::n]
    HJS = r"""
const {chromium}=require('playwright');
const hlKey=(href,txt)=>{try{const v=decodeURIComponent(href.split(/[?&]hl=/)[1]||'').split('&')[0].replace(/ⓘ|\s+/g,'');const v2=v.replace(/^\d{4}[-.]\d{1,2}([-.]\d{1,2})?/,'');return !v||txt.includes(v.slice(0,6))||txt.includes(v2.slice(0,6))}catch(e){return true}};
(async()=>{const base=process.argv[2];const items=JSON.parse(require('fs').readFileSync(process.argv[3],'utf8'));const b=await chromium.launch();const bad=[];let ok=0;const W=4;
await Promise.all(Array.from({length:W},async(_,wi)=>{const p=await (await b.newContext({viewport:{width:390,height:844},hasTouch:true})).newPage();
for(const it of items.filter((_,i)=>i%W===wi)){try{await p.goto(base);await p.waitForTimeout(250);await p.evaluate(h=>{location.hash=h.replace(/^#/,'')},it.href);await p.waitForTimeout(2600);
 let y0=-1,st=0;for(let i=0;i<30&&st<5;i++){const y=await p.evaluate(()=>Math.round(scrollY));if(Math.abs(y-y0)<=1)st++;else{st=0;y0=y}await p.waitForTimeout(300)}
 const a=await p.evaluate((it)=>{if(/[?&]u=/.test(it.href)&&!/[?&]hl=/.test(it.href)){const nm=(it.t||'').split(' ·')[0];const on=[...document.querySelectorAll('.uv-chips [aria-pressed=true], .uv-chips .on, .uv-chips [aria-current]')].map(e=>e.textContent).join('|');return on.includes(nm)?{ok:1}:{wrongu:on}}const r=document.querySelector('.hl-row');if(!r)return {miss:1};const q=r.getBoundingClientRect();const hd=[...document.querySelectorAll('header, #chipbar')].filter(e=>{const c=getComputedStyle(e);return (c.position==='sticky'||c.position==='fixed')&&e.getBoundingClientRect().top<=1}).reduce((m,e)=>Math.max(m,e.getBoundingClientRect().bottom),0);return {top:Math.round(q.top),bottom:Math.round(q.bottom),hd:Math.round(hd),y:Math.round(scrollY),vis:r.checkVisibility(),txt:r.textContent.replace(/ⓘ|\s+/g,'')}},it);
 await p.waitForTimeout(1500);const y2=await p.evaluate(()=>Math.round(scrollY));
 if(a.ok){ok++;continue}if(a.wrongu!==undefined)bad.push(it.href+' 대학 칩이 다름('+a.wrongu+')');else if(a.miss)bad.push(it.href+' 행 못 찾음');else if(!hlKey(it.href,a.txt))bad.push(it.href+' 강조된 행이 대상과 다름: '+a.txt.slice(0,30));else if(!a.vis)bad.push(it.href+' 안 보임');else if(a.top<a.hd-2)bad.push(it.href+' 머리에 가림 top='+a.top+' hd='+a.hd);else if(Math.abs(y2-a.y)>8)bad.push(it.href+' 도착 뒤 추가 스크롤 '+(y2-a.y));else ok++}catch(e){bad.push(it.href+' 오류')}}
}));
console.log(JSON.stringify({ok,bad}));await b.close()})();
"""
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(HJS); hp = f.name
    env = dict(os.environ)
    try: env["NODE_PATH"] = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
    except Exception: pass
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as jf: json.dump(items, jf, ensure_ascii=False); jp = jf.name  # 항목이 많아 인자로 못 넘긴다
    r = subprocess.run(["node", hp, BASE, jp], capture_output=True, text=True, env=env); os.unlink(hp); os.unlink(jp)
    out = json.loads(r.stdout.strip().splitlines()[-1]) if r.stdout.strip() else {"ok": 0, "bad": ["실행 실패 " + r.stderr[-200:]]}
    print(f"?hl= 도착 {out['ok']}/{len(items)}건 통과, 실패 {len(out['bad'])}건")
    for b in out["bad"]: print(" ✗", b)
    sys.exit(1 if out["bad"] else 0)

# --terms: 용어 검색 결과(용어 54건)를 누르면 그 용어의 풀이 창이 열리는지(예전엔 전부 중학교 배정 화면으로 갔다)
if "--terms" in sys.argv:
    TJS = r"""
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const base=process.argv[2];const terms=JSON.parse(fs.readFileSync('portal/data/glossary.json','utf8')).terms;const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844},hasTouch:true})).newPage();const bad=[];let ok=0;
await p.goto(base);await p.waitForTimeout(1500);
for(const t of terms){try{await p.keyboard.press('Escape');
 await p.keyboard.press('/');await p.waitForSelector('.srch input',{timeout:4000});await p.fill('.srch input',t.term);await p.waitForTimeout(350);
 const a=await p.$(`.srch a[data-term="${t.id}"]`);if(!a){bad.push(t.term+' 결과에 용어 항목 없음');continue}
 await a.click();await p.waitForTimeout(500);
 const got=await p.evaluate(()=>{const s=document.querySelector('.sip');return s&&s.getBoundingClientRect().height>0?s.querySelector('b')?.textContent:null});
 if(got===t.term)ok++;else bad.push(t.term+' 풀이 창 안 열림('+got+')');await p.keyboard.press('Escape')}catch(e){bad.push(t.term+' 오류')}}
console.log(JSON.stringify({ok,bad,n:terms.length}));await b.close()})();
"""
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(TJS); tp = f.name
    env = dict(os.environ)
    try: env["NODE_PATH"] = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
    except Exception: pass
    r = subprocess.run(["node", tp, BASE], capture_output=True, text=True, env=env, cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))); os.unlink(tp)
    out = json.loads(r.stdout.strip().splitlines()[-1]) if r.stdout.strip() else {"ok": 0, "bad": ["실행 실패 " + r.stderr[-200:]], "n": 0}
    print(f"용어 결과 {out['ok']}/{out['n']}건 풀이 창 열림, 실패 {len(out['bad'])}건")
    for b in out["bad"]: print(" ✗", b)
    sys.exit(1 if out["bad"] else 0)

env = dict(os.environ)
try: env["NODE_PATH"] = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
except Exception: pass
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f: f.write(JS); path = f.name
r = subprocess.run(["node", path, BASE, str(LIMIT)] + ([sys.argv[sys.argv.index("--only") + 1]] if "--only" in sys.argv else []), capture_output=True, text=True, env=env); os.unlink(path)
if r.returncode != 0: print("점검 실행 실패:", (r.stderr or r.stdout)[-300:]); sys.exit(2)
out = json.loads(r.stdout.strip().splitlines()[-1])
print(f"링크 확인 {out['ok']}건 통과, 잘못된 링크 {len(out['bad'])}건, 검색에 제목이 안 나온 행 {out['skipped']}건")
for b in out["bad"]: print(" ✗", b)
for b in out.get("sk", []): print(" ·", b)
sys.exit(1 if out["bad"] else 0)

