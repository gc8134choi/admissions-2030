#!/usr/bin/env python3
"""글자 크기 전수 점검(D2): 본문급 글이 14~14.99px로 남은 요소를 화면별로 센다. 0건이어야 통과.
규칙: 문장형·값 셀은 본문 15px, 라벨·출처·상태는 13px. 이 점검은 14~14.99px(어중간한 크기)만 센다. 버튼·칩·탭·표시 라벨 같은 조작 글자는 센 대상이 아니다(문장·값 글자만).
사용: python3 tools/pm/fontscan.py [기본주소=http://localhost:8000/portal/]  (Playwright, 서버를 먼저 띄운다)"""
import json, os, subprocess, sys, tempfile
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/portal/").rstrip("/") + "/"
import socket, time
_srv = None
if "localhost:8000" in BASE:  # 로컬 주소인데 서버가 없으면 스스로 띄운다
    try: socket.create_connection(("localhost", 8000), timeout=1).close()
    except OSError:
        _srv = subprocess.Popen([sys.executable, "-m", "http.server", "8000"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        time.sleep(1.5)
ROUTES = ["", "#schedule", "#schedule?t=hs", "#select/types", "#select/curriculum?v=hs", "#select/curriculum?v=compare", "#select/curriculum?v=middle", "#select/curriculum?v=univ",
          "#select/curriculum?v=map", "#life/credit", "#life/checklist", "#admission/system", "#admission/univ", "#planner/plan", "#changelog", "#library/links", "#library/sources", "#library/status"]
JS = r"""
const {chromium}=require('playwright');
(async()=>{const base=process.argv[2],routes=JSON.parse(process.argv[3]);const b=await chromium.launch();const out=[];
for(const w of [390,1440]){const p=await (await b.newContext({viewport:{width:w,height:900}})).newPage();
 for(const r of routes){try{await p.goto(base+r,{waitUntil:'load',timeout:20000});await p.waitForTimeout(2500);
  await p.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=800){scrollTo(0,y);await new Promise(x=>setTimeout(x,80))}scrollTo(0,0)});await p.waitForTimeout(1200);
  await p.evaluate(()=>document.querySelectorAll('details:not(.cmp-add)').forEach(d=>d.open=true));await p.waitForTimeout(1500);
  const o=await p.evaluate(()=>{const m={};let n=0;for(const e of document.querySelectorAll('#main *')){if(!e.checkVisibility||!e.checkVisibility()){continue}const own=[...e.childNodes].filter(x=>x.nodeType==3).map(x=>x.nodeValue).join('').trim();if(own.length<2)continue;const fs=parseFloat(getComputedStyle(e).fontSize);if(fs>=14&&fs<15&&!/^(BUTTON|LABEL|CAPTION|SUMMARY|INPUT|SELECT)$/.test(e.tagName)&&!e.closest('.subnav,.chips,.chipbar,.fgroup,.ed-filter,.vtog,.cmp-bar2,.srcw,.srcp,.cmp-gj,.skin-opts,header,nav,[role=tablist]')&&!/(^| )(flabel|pst|es|ed-unv|ed-meta|nm|chip|fchip|unv-i|stg|badge|aux-d|tag)( |$)/.test(String(e.className))){n++;const k=e.tagName+'.'+String(e.className).split(' ')[0]+'@'+String(e.parentElement.className).split(' ')[0];m[k]=(m[k]||0)+1}}return {n,m}});
  if(o.n)out.push({w,r:r||'(홈)',n:o.n,top:Object.entries(o.m).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>k+'×'+v).join(' ')})}catch(e){out.push({w,r,err:String(e).slice(0,80)})}}}
console.log(JSON.stringify(out));await b.close()})();
"""
env = dict(os.environ)
try: env["NODE_PATH"] = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
except Exception: pass
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f: f.write(JS); path = f.name
r = subprocess.run(["node", path, BASE, json.dumps(ROUTES)], capture_output=True, text=True, env=env); os.unlink(path)
if _srv: _srv.terminate()
if r.returncode != 0: print("점검 실행 실패:", (r.stderr or r.stdout)[-300:]); sys.exit(2)
out = json.loads(r.stdout.strip().splitlines()[-1])
if not out: print(f"OK: {len(ROUTES)}화면 × 2폭에서 14~14.99px 본문급 글 0건"); sys.exit(0)
tot = sum(x.get("n", 0) for x in out); print(f"14~14.99px 글 {tot}건 ({len(out)}곳)")
for x in out: print(f"  {x['w']}px {x['r']}: {x.get('n', x.get('err'))}  {x.get('top', '')}")
sys.exit(1)
