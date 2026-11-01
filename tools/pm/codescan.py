#!/usr/bin/env python3
"""내부 코드·개발자 표현 노출 점검(C2): 모든 접이식·출처 팝오버를 연 상태에서 GS_CD·sb-/log-/gg-/adm-/cur- 코드, .json, undefined 등이 글자·title에 있는지 찾는다.
사용: python3 tools/pm/codescan.py [기본주소]  (없으면 "{}"가 나온다)"""
import os, subprocess, sys, tempfile
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/portal/").rstrip("/") + "/"
JS = r"""
const {chromium}=require('playwright');
(async()=>{const routes=["","#schedule","#schedule?t=univ","#schedule?t=life","#schedule?t=road","#select/curriculum?v=hs&ty=1","#select/curriculum?v=compare","#select/curriculum?v=middle","#select/curriculum?v=map","#select/curriculum?v=univ","#admission/system","#life/credit","#planner/plan","#mid/life","#changelog","#library","#library/sources","#library/status","#library/files"];
const re=/(GS_CD|\bsb-\d+|\blog-\d+|\bgg-\d+|\bsch-\d+|\badm-\d+|\bcur-\d+|\bmg-\d+|\bht-[a-z]+|\bhc-\d+|\bhd-\d+|\brm-[a-z]-\d+|\bgl-\d+|\bpolicy\b|draft\.json|\.json\b|research\/|\bundefined\b|\bnull\b|\[object|NaN)/g;
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});const found={};
for(const r of routes){await p.goto(process.argv[2]+r);await p.waitForTimeout(1800);
await p.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);document.querySelectorAll('.srcp').forEach(e=>e.hidden=false)});await p.waitForTimeout(500);
const t=await p.evaluate(()=>{const o=[];document.querySelectorAll('#main *, #legend').forEach(e=>{if(e.children.length===0){o.push(e.textContent+' '+(e.title||'')+' '+(e.getAttribute('aria-label')||''))}});document.querySelectorAll('#main [title]').forEach(e=>o.push(e.title));return o.join('\n')});
const m=[...t.matchAll(re)].map(x=>x[0]);if(m.length)found[r||'home']=[...new Set(m)].slice(0,8)}
console.log(JSON.stringify(found,null,1));await b.close()})();

"""
f = tempfile.NamedTemporaryFile("w", suffix=".js", delete=False); f.write(JS.replace("process.argv[2]+r", "process.argv[2]+r")); f.close()
env = dict(os.environ); env["NODE_PATH"] = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
r = subprocess.run(["node", f.name, BASE], capture_output=True, text=True, env=env); os.unlink(f.name)
print(r.stdout.strip() or r.stderr[-300:]); sys.exit(0 if r.stdout.strip().endswith("{}") else 1)
