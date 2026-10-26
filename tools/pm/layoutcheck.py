#!/usr/bin/env python3
"""레이아웃 점검(모바일 390px·데스크톱). 사용: python3 tools/pm/layoutcheck.py [기본주소]

`.row`(목록 한 줄) 안의 본문 블록이 줄 폭의 60%에도 못 미치면 보고한다(자식이 하나뿐인데 2열 그리드의 좁은 첫 칸에 들어가는 실수 방지).
날짜 열(`.d`)은 제외한다. 이상이 없으면 OK 한 줄, 있으면 화면·폭·글자 앞부분을 한 줄씩 낸다.
"""
import json, os, subprocess, sys, tempfile

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://gc8134choi.github.io/admissions-2030/portal/").rstrip("/") + "/"
ROUTES = ["", "#schedule", "#schedule?t=life", "#schedule?t=road", "#select/types", "#select/curriculum", "#select/curriculum?v=compare",
          "#select/curriculum?v=map", "#select/curriculum?v=middle", "#planner/plan", "#life/credit", "#admission/system",
          "#changelog", "#library/links", "#library/sources", "#library/status", "#library/files", "#select/curriculum?v=univ", "#select/curriculum?v=map&lv=middle", "#mid/life"]
JS = r"""
const {chromium}=require('playwright');
(async()=>{const base=process.argv[2];const routes=JSON.parse(process.argv[3]);const out=[];const b=await chromium.launch();
for(const w of [390,1280]){const p=await b.newPage({viewport:{width:w,height:900}});
for(const r of routes){try{await p.goto(base+r,{waitUntil:'load',timeout:20000});await p.waitForTimeout(900);}catch(e){out.push({w,r,issue:'load'});continue;}
const bad=await p.evaluate(()=>[...document.querySelectorAll('li.row, .row')].filter(li=>li.offsetWidth>0).flatMap(li=>{
  const W=li.getBoundingClientRect().width;return [...li.children].filter(c=>!c.classList.contains('d')&&c.offsetWidth>0&&c.getBoundingClientRect().width<W*0.6&&(c.innerText||'').trim().length>8)
  .map(c=>({t:(c.innerText||'').trim().replace(/\s+/g,' ').slice(0,24),pct:Math.round(c.getBoundingClientRect().width/W*100)}))}));
if(bad.length)out.push({w,r,n:bad.length,first:bad[0]});}
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
        print(f"OK: {len(ROUTES)}화면 × 2폭 좁게 갇힌 .row 없음")
        return 0
    for o in out:
        print(json.dumps(o, ensure_ascii=False))
    return 1

if __name__ == "__main__":
    sys.exit(main())
