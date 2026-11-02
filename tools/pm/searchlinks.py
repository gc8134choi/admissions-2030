#!/usr/bin/env python3
"""검색 결과 링크 점검: 정책 행(제목)을 검색해 나온 결과 링크를 따라가 그 화면에 해당 행이 실제 있는지 확인한다.
사용: python3 tools/pm/searchlinks.py [기본주소=http://localhost:8000/portal/] [--limit N]
(Playwright 필요. 서버를 먼저 띄운다: python3 -m http.server 8000)"""
import json, os, subprocess, sys, tempfile
args = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE = (args[0] if args else "http://localhost:8000/portal/").rstrip("/") + "/"
LIMIT = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 0
JS = r"""
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const base=process.argv[2],limit=+process.argv[3]||0;const rows=JSON.parse(fs.readFileSync('portal/data/policy.json','utf8'));
const sel=limit?rows.slice(0,limit):rows;const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
await p.goto(base);await p.waitForTimeout(1500);await p.keyboard.press('/');await p.waitForSelector('.srch input');await p.waitForTimeout(1800);
const norm=s=>String(s||'').replace(/[^0-9A-Za-z가-힣]/g,'');const bad=[],skipped=[];let ok=0;
for(const r of rows.length?sel:[]){const title=r.title;await p.fill('.srch input',title.replace(/^\d{4}-\d{2}(-\d{2})?\s*/,''));await p.waitForTimeout(250);
 const hit=await p.evaluate((t)=>{const k=t.replace(/\s+/g,'').slice(0,10);let grp='';for(const el of document.querySelectorAll('.sr-out .sr-h, .sr-out li')){if(el.classList.contains('sr-h')){grp=el.textContent;continue}if(!grp.startsWith('일정·제도'))continue;const a=el.querySelector('a'),b=a&&a.querySelector('b');if(b&&b.textContent.replace(/\s+/g,'').includes(k))return {href:a.getAttribute('href'),ext:a.target==='_blank'}}return null},title.replace(/^\d{4}-\d{2}(-\d{2})?\s*/,''));
 if(!hit){skipped.push(r.id+' 검색 결과에 제목 없음');continue}
 if(hit.ext)continue;
 const page=await p.context().newPage();await page.goto(base+hit.href);await page.waitForTimeout(1200);
 await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));await page.waitForTimeout(700);
 const keys=[norm(title.replace(/^\d{4}-\d{2}(-\d{2})?\s*/,'')).slice(0,12),norm(r.body).slice(0,14),...(r.events||[]).map(e=>norm(e.label||e.title).slice(0,12))].filter(x=>x.length>=4);
 const found=await page.evaluate((ks)=>{const t=document.body.textContent.replace(/[^0-9A-Za-z가-힣]/g,'');return ks.some(k=>t.includes(k))},keys);
 if(found)ok++;else bad.push(r.id+' '+title.slice(0,24)+' → '+hit.href);await page.close()}
console.log(JSON.stringify({ok,bad,skipped:skipped.length}));await b.close()})();
"""
env = dict(os.environ)
try: env["NODE_PATH"] = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
except Exception: pass
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f: f.write(JS); path = f.name
r = subprocess.run(["node", path, BASE, str(LIMIT)], capture_output=True, text=True, env=env); os.unlink(path)
if r.returncode != 0: print("점검 실행 실패:", (r.stderr or r.stdout)[-300:]); sys.exit(2)
out = json.loads(r.stdout.strip().splitlines()[-1])
print(f"링크 확인 {out['ok']}건 통과, 잘못된 링크 {len(out['bad'])}건, 검색에 제목이 안 나온 행 {out['skipped']}건")
for b in out["bad"]: print(" ✗", b)
sys.exit(1 if out["bad"] else 0)
