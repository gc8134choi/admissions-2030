#!/usr/bin/env python3
"""저장 데이터 보존 점검(E3): 사진(IndexedDB)·계획표·주로 보는 단계·화면 모드를 심고, 새로고침·다른 화면 이동·서비스 워커 갱신 뒤에도 남는지 확인한다.
사용: python3 tools/pm/preserve-check.py [기본주소]"""
import os, subprocess, sys, tempfile
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/portal/").rstrip("/") + "/"
JS = r"""
const {chromium}=require('playwright');
(async()=>{const base=process.argv[2];const b=await chromium.launch();const c=await b.newContext({viewport:{width:1280,height:900}});const p=await c.newPage();const fails=[];
await p.goto(base);await p.waitForTimeout(1500);
await p.evaluate(async()=>{localStorage.setItem('portal.focus',JSON.stringify(['고입']));localStorage.setItem('portal.plan.univ','"u-test"');localStorage.setItem('portal.theme','dark');localStorage.setItem('portal.home.pins',JSON.stringify(['hs-enter']));
 await new Promise((res,rej)=>{const q=indexedDB.open('portal-photos',1);q.onupgradeneeded=()=>q.result.createObjectStore('p');q.onsuccess=()=>{const tx=q.result.transaction('p','readwrite');tx.objectStore('p').put(new Blob(['x'],{type:'image/jpeg'}),'life:test');tx.oncomplete=()=>res();tx.onerror=rej};q.onerror=rej})});
async function check(label){const r=await p.evaluate(async()=>{const o={};for(const k of ['portal.focus','portal.plan.univ','portal.theme','portal.home.pins'])o[k]=localStorage.getItem(k);
 o.photo=await new Promise((res)=>{const q=indexedDB.open('portal-photos',1);q.onsuccess=()=>{const g=q.result.transaction('p').objectStore('p').get('life:test');g.onsuccess=()=>res(!!g.result);g.onerror=()=>res(false)};q.onerror=()=>res(false)});return o});
 const want={'portal.focus':'["고입"]','portal.plan.univ':'"u-test"','portal.theme':'dark','portal.home.pins':'["hs-enter"]'};
 for(const k in want)if(r[k]!==want[k])fails.push(label+': '+k+' 사라짐/변경 '+r[k]);if(!r.photo)fails.push(label+': 사진(IndexedDB) 사라짐')}
await check('심은 직후');
await p.reload();await p.waitForTimeout(1500);await check('새로고침');
for(const h of ['#schedule','#select/curriculum?v=hs','#planner/plan','#changelog','']){await p.goto(base+h);await p.waitForTimeout(900)}
await check('화면 이동');
// 서비스 워커 갱신: 등록 해제 후 다시 열기(캐시 교체와 같은 경로)
await p.evaluate(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();for(const k of await caches.keys())await caches.delete(k)});
await p.goto(base);await p.waitForTimeout(2000);await check('서비스 워커·캐시 초기화');
await b.close();console.log(JSON.stringify(fails));})();
"""
def main():
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(JS); path = f.name
    env = dict(os.environ); env["NODE_PATH"] = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
    r = subprocess.run(["node", path, BASE], capture_output=True, text=True, env=env); os.unlink(path)
    if r.returncode: print("실패:", (r.stderr or r.stdout)[-300:]); return 2
    import json; fails = json.loads(r.stdout.strip().splitlines()[-1])
    if not fails: print("OK: 저장 데이터(사진·계획표·주로 보는 단계·화면 모드·허브 고정) 보존"); return 0
    print("\n".join(fails)); return 1
sys.exit(main())
