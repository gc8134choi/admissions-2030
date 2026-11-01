#!/usr/bin/env python3
"""화면 밀도 점검: 본문 글자 수·페이지 높이·DOM 수를 390/1440에서 잰다. 사용: python3 tools/pm/density.py [기본주소] [--md 파일]"""
import json, os, subprocess, sys, tempfile
BASE = "http://localhost:8000/portal/"
args = [a for a in sys.argv[1:] if not a.startswith("--")]
if args: BASE = args[0].rstrip("/") + "/"
MD = sys.argv[sys.argv.index("--md") + 1] if "--md" in sys.argv else None
ROUTES = ["", "#schedule", "#schedule?t=road", "#select/curriculum?v=hs", "#select/curriculum?v=compare", "#select/curriculum?v=map",
          "#select/curriculum?v=middle", "#select/curriculum?v=map&lv=middle", "#mid/life", "#life/credit", "#planner/plan", "#admission/system",
          "#select/curriculum?v=univ", "#changelog", "#library/links", "#library/sources", "#library/status", "#library/files"]
JS = r"""
const {chromium}=require('playwright');
async function ev(p,f){for(let i=0;i<4;i++){try{return await p.evaluate(f)}catch(e){await p.waitForTimeout(900)}}return await p.evaluate(f)}
(async()=>{const base=process.argv[2];const routes=JSON.parse(process.argv[3]);const out=[];const b=await chromium.launch();
for(const w of [390,1440]){const p=await b.newPage({viewport:{width:w,height:w==390?844:900}});
for(const r of routes){try{await p.goto(base+r,{waitUntil:'load',timeout:20000});await p.waitForSelector('#main *',{timeout:8000}).catch(()=>{});await p.waitForTimeout(1800);}catch(e){continue}
const d=await ev(p,()=>{const m=document.querySelector('#main');const t=(m.innerText||'').replace(/\s+/g,' ').trim();
 const fold=innerHeight;let first=0;for(const e of m.querySelectorAll('*')){const r=e.getBoundingClientRect();if(r.top<fold&&r.bottom>0&&e.children.length===0)first+=(e.textContent||'').trim().length}
 const vis=(e)=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
 const links=[...m.querySelectorAll('a[target=_blank]')].filter(vis).length;
 const labels=[...m.querySelectorAll('*')].filter(e=>e.children.length===0&&vis(e)&&!e.classList.contains('srcb')&&/^\s*출처/.test(e.textContent||'')).length;
 return {chars:t.length,h:document.documentElement.scrollHeight,dom:m.querySelectorAll('*').length,first,src:links+labels,btn:m.querySelectorAll('.srcb').length}});
out.push({w,r:r||'#home',...d});}
await p.close()}
await b.close();console.log(JSON.stringify(out));})();
"""
def main():
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(JS); path = f.name
    env = dict(os.environ)
    env["NODE_PATH"] = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
    r = subprocess.run(["node", path, BASE, json.dumps(ROUTES)], capture_output=True, text=True, env=env); os.unlink(path)
    if r.returncode: print("실패:", (r.stderr or r.stdout)[-300:]); return 2
    rows = json.loads(r.stdout.strip().splitlines()[-1])
    rows.sort(key=lambda x: -x["chars"])
    lines = ["| 폭 | 화면 | 본문 글자 | 첫 화면 글자 | 높이(px) | DOM | 보이는 출처 | 출처 버튼 |", "|---|---|---:|---:|---:|---:|---:|---:|"] + [f"| {x['w']} | `{x['r']}` | {x['chars']:,} | {x['first']:,} | {x['h']:,} | {x['dom']:,} | {x.get('src',0)} | {x.get('btn',0)} |" for x in rows]
    txt = "\n".join(lines)
    print(txt)
    if MD:
        open(MD, "w").write(txt + "\n")
main()
