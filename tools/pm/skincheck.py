#!/usr/bin/env python3
"""스킨별 대비·가로 스크롤 점검(+ 스크린샷). 스킨 × 라이트/다크 × 주요 화면에서 글자 대비 4.5(큰 글자 3) 미달 요소 수와 상위 사례를 보여 준다.
사용: python3 tools/pm/skincheck.py [기본주소] [--shots 폴더]"""
import json, os, subprocess, sys, tempfile
args = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE = (args[0] if args else "http://localhost:8000/portal/").rstrip("/") + "/"
SHOTS = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else ""
JS = r"""
const {chromium}=require('playwright');
(async()=>{const base=process.argv[2],shots=process.argv[3];const out=[];const b=await chromium.launch();
const ROUTES=[['home',''],['hs','#select/curriculum?v=hs'],['sched','#schedule']];
for(const skin of ['','paper','tool'])for(const mode of ['light','dark'])for(const w of [1440,390]){
 const c=await b.newContext({viewport:{width:w,height:w==390?844:900},colorScheme:mode});
 await c.addInitScript(([s,m])=>{try{if(s)localStorage.setItem('portal.skin',s);localStorage.setItem('portal.theme',m)}catch(e){}},[skin,mode]);
 const p=await c.newPage();
 for(const [nm,r] of ROUTES){await p.goto(base+r);await p.waitForTimeout(2200);
  const d=await p.evaluate(()=>{
   const parse=(s)=>{const m=s.match(/[\d.]+/g)||[0,0,0,0];const k=s.startsWith('color(')?255:1;return {r:+m[0]*k,g:+m[1]*k,b:+m[2]*k,a:m[3]===undefined?1:+m[3]}};
   const blend=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
   const L=(c)=>{const f=(v)=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
   const bgOf=(e)=>{const chain=[];for(let n=e;n;n=n.parentElement)chain.push(getComputedStyle(n).backgroundColor);let c={r:0,g:0,b:0,a:1};const base=parse(getComputedStyle(document.body).backgroundColor);c=base.a<1?blend(base,{r:128,g:128,b:128,a:1}):base;for(let i=chain.length-1;i>=0;i--){const p=parse(chain[i]);if(p.a>0)c=blend(p,c)}return c};
   const bad=[];let n=0;
   for(const e of document.querySelectorAll('#main *, .hdr *, .legend *, #topnav a, .tabs a')){
    if(!e.getClientRects().length)continue;const own=[...e.childNodes].some(x=>x.nodeType===3&&x.textContent.trim());if(!own)continue;
    const cs=getComputedStyle(e);if(cs.visibility==='hidden'||+cs.opacity===0||parseFloat(cs.fontSize)<1||cs.color==='rgba(0, 0, 0, 0)')continue;const fs=parseFloat(cs.fontSize),bold=+cs.fontWeight>=700;
    const fg=parse(cs.color),bg=bgOf(e),f=blend(fg,bg);const a=L(f),bb=L(bg);const cr=(Math.max(a,bb)+.05)/(Math.min(a,bb)+.05);n++;
    const need=(fs>=24||(fs>=18.66&&bold))?3:4.5;if(cr<need)bad.push([+cr.toFixed(2),(e.className||e.tagName)+'',(e.textContent||'').trim().slice(0,14)])}
   bad.sort((x,y)=>x[0]-y[0]);return {n,bad:bad.length,top:bad.slice(0,3),sx:document.documentElement.scrollWidth>innerWidth+2}});
  out.push({skin:skin||'default',mode,w,r:nm,n:d.n,bad:d.bad,sx:d.sx,top:d.top});
  if(shots&&(nm==='home'||nm==='hs'))await p.screenshot({path:`${shots}/${skin||'default'}-${nm}-${mode}-${w}.png`})}
 await c.close()}
await b.close();console.log(JSON.stringify(out))})();
"""
f = tempfile.NamedTemporaryFile("w", suffix=".js", delete=False); f.write(JS); f.close()
env = dict(os.environ); env["NODE_PATH"] = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
r = subprocess.run(["node", f.name, BASE, SHOTS], capture_output=True, text=True, env=env); os.unlink(f.name)
if r.returncode: print("실패:", (r.stderr or r.stdout)[-300:]); sys.exit(2)
rows = json.loads(r.stdout.strip().splitlines()[-1])
bad = [x for x in rows if x["bad"] or x["sx"]]
print(f"{len(rows)}조합 점검, 문제 {len(bad)}건")
for x in bad: print(f"{x['skin']:8} {x['mode']:5} {x['w']:4} {x['r']:5} 대비미달 {x['bad']}/{x['n']} 가로스크롤={x['sx']} {x['top']}")
sys.exit(1 if bad else 0)
