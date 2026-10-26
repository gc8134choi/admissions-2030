#!/usr/bin/env python3
"""배포 화면 점검(토큰 절약용 일괄 점검). 사용: python3 tools/pm/sitecheck.py [기본주소]

Node Playwright를 한 번 실행해 화면별 콘솔 오류·가로 스크롤·금지 문구를 JSON 한 줄씩 낸다.
금지 문구: 사람 이름, 단독 '확정' 배지, '현고3'(소스에는 이름을 쓰지 않으려고 유니코드 이스케이프로 적었다). 이상이 없으면 OK 한 줄만 낸다.
"""
import json, os, subprocess, sys, tempfile

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://gc8134choi.github.io/admissions-2030/portal/").rstrip("/") + "/"
ROUTES = ["", "#schedule", "#select/types", "#select/curriculum", "#select/curriculum?v=compare",
          "#life/credit", "#admission/system", "#changelog", "#library/links", "#library/sources", "#library/status",
          "#select/curriculum?v=map", "#select/curriculum?v=middle", "#select/curriculum?v=univ", "#planner/plan"]
JS = r"""
const {chromium}=require('playwright');
(async()=>{const base=process.argv[2];const routes=JSON.parse(process.argv[3]);
const bad=new RegExp(['\uc608\ub098','\uc608\uc740','\ud604\s?\uace03'].join('|'));const out=[];const b=await chromium.launch();
for(const w of [390,1280]){const p=await b.newPage({viewport:{width:w,height:900}});const errs=[];
p.on('pageerror',e=>errs.push(String(e).slice(0,120)));p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,120)));
for(const r of routes){errs.length=0;try{await p.goto(base+r,{waitUntil:'load',timeout:20000});await p.waitForTimeout(700);}catch(e){out.push({w,r,err:'load '+String(e).slice(0,80)});continue}
const d=await p.evaluate(()=>({sx:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,t:document.body.innerText,badge:[...document.querySelectorAll('body *')].some(e=>e.children.length===0&&e.textContent.trim()==='\ud655\uc815')}));
const issues=[];if(errs.length)issues.push('console:'+errs[0]);if(d.sx)issues.push('가로스크롤');const m=d.t.match(bad);if(m)issues.push('금지문구:'+m[0]);
if(d.badge)issues.push('확정배지');if(issues.length)out.push({w,r,issues});}
await p.close()}
await b.close();console.log(JSON.stringify(out));})();
"""

def main():
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(JS)
        path = f.name
    env = dict(os.environ)
    try:
        env["NODE_PATH"] = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
    except Exception:
        pass
    r = subprocess.run(["node", path, BASE, json.dumps(ROUTES)], capture_output=True, text=True, env=env)
    os.unlink(path)
    if r.returncode != 0:
        print("점검 실행 실패:", (r.stderr or r.stdout)[-300:])
        return 2
    out = json.loads(r.stdout.strip().splitlines()[-1])
    if not out:
        print(f"OK: {len(ROUTES)}화면 × 2폭 이상 없음")
        return 0
    for o in out:
        print(json.dumps(o, ensure_ascii=False))
    return 1

if __name__ == "__main__":
    sys.exit(main())
