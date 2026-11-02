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
CMP = ["#select/curriculum?v=hs", "#select/curriculum?v=univ", "#admission/system?t=types", "#select/curriculum?v=middle"]
STICKY = ["#select/curriculum?v=compare", "#schedule", "#schedule?t=hs"]  # 표 구조가 다른 상세 비교(.tw): 스크롤 후 대상 줄 고정만 점검
JS = r"""
const {chromium}=require('playwright');
async function ev(p,f){for(let i=0;i<4;i++){try{return await p.evaluate(f)}catch(e){await p.waitForTimeout(900)}}return await p.evaluate(f)}
(async()=>{const base=process.argv[2];const routes=JSON.parse(process.argv[3]);const CMP=JSON.parse(process.argv[4]);const STICKY=JSON.parse(process.argv[5]||'[]');const out=[];const b=await chromium.launch();
for(const w of [390,1280,1440,1920]){const p=await b.newPage({viewport:{width:w,height:900}});
for(const r of routes){try{await p.goto(base+r,{waitUntil:'load',timeout:20000});await p.waitForTimeout(900);}catch(e){out.push({w,r,issue:'load'});continue;}
const bad=await ev(p,()=>[...document.querySelectorAll('li.row, .row')].filter(li=>li.offsetWidth>0).flatMap(li=>{
  const W=li.getBoundingClientRect().width;return [...li.children].filter(c=>!c.classList.contains('d')&&c.offsetWidth>0&&c.getBoundingClientRect().width<W*0.6&&(c.innerText||'').trim().length>8)
  .map(c=>({t:(c.innerText||'').trim().replace(/\s+/g,' ').slice(0,24),pct:Math.round(c.getBoundingClientRect().width/W*100)}))}));
if(bad.length)out.push({w,r,n:bad.length,first:bad[0]});
const ov=await ev(p,()=>{const W=document.documentElement.clientWidth;const e=[...document.querySelectorAll('#main *')].find(x=>x.getBoundingClientRect().right>W+2&&x.offsetWidth>0&&!x.closest('.tw,.hsc,.pl-tbw,.schoolgrid,.mss,.ed-toc,.chips,[style*=overflow]'));return {sx:document.documentElement.scrollWidth>W+2,el:e?(e.tagName+'.'+e.className):''}});
if(ov.sx)out.push({w,r,issue:'가로 스크롤',el:ov.el});}
await p.close()}
// 비교 표 점검(COMPARE-TABLE.md): 대상=열(thead th.cmp-s 2개 이상), 항목 열·대상 줄 sticky, 모든 th에 scope, 캡션, 페이지 가로 스크롤 0
for(const w of [390,1440]){const p=await b.newPage({viewport:{width:w,height:900}});
for(const r of CMP.concat(STICKY)){try{await p.goto(base+r,{waitUntil:'load',timeout:20000});await p.waitForTimeout(1200);}catch(e){out.push({w,r,issue:'비교표 load'});continue;}
await ev(p,()=>document.querySelectorAll('details').forEach(d=>{d.open=true;d.dispatchEvent(new Event('toggle'))}));await p.waitForTimeout(900);if(r.includes('v=hs')){await ev(p,()=>{const f=document.querySelector('.wide-fold');if(f){f.open=true;f.dispatchEvent(new Event('toggle'))}});await p.waitForSelector('.cmp-tbl',{timeout:5000}).catch(()=>{});await p.waitForTimeout(600);} // 31교 표는 기본 접힘이라 열고 불러올 때까지 기다린다
const c=await ev(p,()=>{const t=document.querySelector('.cmp-tbl');if(!t)return {none:1};const cs=(e,k)=>getComputedStyle(e)[k];const bad=[];
 if(t.querySelectorAll('thead th.cmp-s').length<2)bad.push('대상 열 2개 미만');
 if(cs(t.querySelector('tbody .cmp-f')||t.querySelector('.cmp-f'),'position')!=='sticky')bad.push('항목 열 sticky 아님');
 if(cs(t.querySelector('thead th'),'position')!=='sticky')bad.push('대상 줄 sticky 아님');
 if([...t.querySelectorAll('th')].some(h=>!h.hasAttribute('scope')))bad.push('th scope 없음');
 if(!t.querySelector('caption'))bad.push('캡션 없음');
 if(document.documentElement.scrollWidth>document.documentElement.clientWidth+2)bad.push('페이지 가로 스크롤');
 return {bad}});
if(c.none){if(!STICKY.includes(r))out.push({w,r,issue:'비교표 없음'});}else if(c.bad.length)out.push({w,r,issue:'비교표',bad:c.bad});}
 // 스크롤 후 대상 줄이 머리글 바로 아래에 고정되는지(sticky-head.js 사본)
 {const s=await ev(p,async()=>{const wrs=[...document.querySelectorAll('.w-table,.tw')];const hh=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hh'))||0;let tested=0;
  for(const wr of wrs){const th0=wr.querySelector('thead th');const shown=th0&&th0.getBoundingClientRect().width>1;const hgt=wr.getBoundingClientRect().height;
   const y=window.scrollY+wr.getBoundingClientRect().top;window.scrollTo(0,y+(hgt>300?160:Math.max(10,hgt/2-40)));await new Promise(r=>setTimeout(r,600));
   const bxs=[...document.querySelectorAll('.sh-fixed:not([hidden])')];
   if(!shown){if(bxs.length)return {bad:'원본 머리줄이 안 보이는데(카드형) 사본이 떠 있음'};continue}
   if(hgt<120||wr.getBoundingClientRect().top>hh)continue; // 화면 아래 한계로 못 올라오는 짧은 표는 건너뜀
   const bx=bxs[0];if(!bx)return {bad:'스크롤 후 대상 줄이 사라짐'};const top=bx.getBoundingClientRect().top;if(top<hh-2||top>hh+60)return {bad:'대상 줄 위치 '+Math.round(top)+' (머리글 '+hh+')'};
   const diffAt=async(end)=>{wr.scrollLeft=end?99999:0;await new Promise(r=>setTimeout(r,500));const O=[...wr.querySelectorAll('thead th')].map(x=>x.getBoundingClientRect()),C=[...bx.querySelectorAll('th')].map(x=>x.getBoundingClientRect());let m=O.length===C.length?0:999;O.forEach((o,i)=>{if(C[i])m=Math.max(m,Math.abs(o.left-C[i].left),Math.abs(o.width-C[i].width))});return m};
   const d0=await diffAt(false),d1=await diffAt(true);wr.scrollLeft=0;tested++;if(Math.max(d0,d1)>1.5)return {bad:'사본 열이 원본과 어긋남 '+Math.round(Math.max(d0,d1)*10)/10+'px'}}
  return {ok:1,tested}});
 if(s&&s.bad)out.push({w,r,issue:'스크롤 후 대상 줄',bad:[s.bad]});}
// 상세 비교(v=compare): 가로 스크롤 시 고정되는 열은 과목명(.l) 하나뿐이고, 그 폭이 래퍼의 절반 이하이며 배경이 불투명한지(다른 학교 값과 겹쳐 보이지 않게), 1440에서는 안쪽 가로 스크롤이 없는지
{try{await p.goto(base+'#select/curriculum?v=compare',{waitUntil:'load',timeout:20000});await p.waitForTimeout(3500);}catch(e){out.push({w,r:'v=compare',issue:'고정 열 load'})}
 const f=await ev(p,async()=>{const wr=document.querySelector('.tw'),t=document.querySelector('#tbl');if(!wr||!t)return {bad:'표 없음'};const st=[...t.querySelectorAll('tbody th,tbody td')].filter(c=>getComputedStyle(c).position==='sticky');if(st.some(c=>!c.classList.contains('l')))return {bad:'과목명 열 말고도 고정되는 칸이 있음(교과군·학교 칸)'};
  const l=t.querySelector('tbody td.l');if(!l)return {bad:'과목명 칸 없음'};const bg=getComputedStyle(l).backgroundColor;if(/rgba\(.*,\s*0\)$/.test(bg)||bg==='transparent')return {bad:'고정 열 배경이 투명(스크롤 시 겹쳐 보임)'};
  if(l.getBoundingClientRect().width>wr.clientWidth*0.5)return {bad:'고정 열이 래퍼의 절반을 넘음 '+Math.round(l.getBoundingClientRect().width)+'/'+wr.clientWidth};
  if(innerWidth>=1100&&wr.scrollWidth>wr.clientWidth+1)return {bad:'1440에서 표가 래퍼보다 넓어 안쪽 가로 스크롤 '+(wr.scrollWidth-wr.clientWidth)+'px'};
  return {ok:1}});
 if(f&&f.bad)out.push({w,r:'v=compare',issue:'상세 비교 고정 열',bad:[f.bad]});}
// ⓘ 겹침(기준 확정): 24px 터치 상자는 이웃과 겹쳐도 되지만, ⓘ 글자 중앙 14px가 이웃 링크·버튼·접이식 제목의 '보이는 글자 영역'과 겹치면 안 된다(화면 맨 위에 보이는 경우만 셈, 열어 둔 학교 추가 목록은 제외)
for(const r of ['#select/curriculum?v=hs','#life/credit']){try{await p.goto(base+r,{waitUntil:'load',timeout:20000});await p.waitForTimeout(3000);}catch(e){out.push({w,r,issue:'ⓘ 겹침 load'});continue}
 await ev(p,async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=700){scrollTo(0,y);await new Promise(x=>setTimeout(x,100))}scrollTo(0,0)});await p.waitForTimeout(1800);await ev(p,()=>document.querySelectorAll('details:not(.cmp-add)').forEach(d=>d.open=true));await p.waitForTimeout(1200);
 const o=await ev(p,()=>{const ink=(e)=>{const rg=document.createRange();rg.selectNodeContents(e);return [...rg.getClientRects()].filter(q=>q.width>0&&q.height>0)};
  const gl=[...document.querySelectorAll('#main .gl-i')].filter(b=>b.getClientRects().length&&!b.closest('[hidden]'));const tg=[...document.querySelectorAll('#main a[href],#main button,#main summary,#main input,#main select')].filter(e=>e.getClientRects().length&&!e.hidden&&!e.classList.contains('gl-i')&&!e.closest('.cmp-add'));
  const bad=[];for(const g of gl){g.scrollIntoView({block:'center'});const a=g.getBoundingClientRect();if(!a.width)continue;const k={left:a.left+5,right:a.right-5,top:a.top+5,bottom:a.bottom-5};
   for(const t of tg){if(t.contains(g)||g.contains(t))continue;const rs=t.matches('input,select')?[t.getBoundingClientRect()]:ink(t);let hit=false;for(const c of rs){const ox=Math.min(k.right,c.right)-Math.max(k.left,c.left),oy=Math.min(k.bottom,c.bottom)-Math.max(k.top,c.top);if(ox>1&&oy>2){const e=document.elementFromPoint((Math.max(k.left,c.left)+Math.min(k.right,c.right))/2,(Math.max(k.top,c.top)+Math.min(k.bottom,c.bottom))/2);if(e&&(t===e||t.contains(e))){hit=true;break}}}if(hit){bad.push(g.parentElement.textContent.slice(0,18)+' ↔ '+t.tagName+':'+t.textContent.trim().slice(0,10));break}}}
  return {n:gl.length,bad:bad.length,s:bad.slice(0,4)}});
 if(o&&o.bad)out.push({w,r,issue:'ⓘ 겹침',bad:[o.bad+'건 '+o.s.join(' | ')]});}
// 주소로 늦게 그려지는 구역을 찾아가는 경우(?bf= 설명회 노트): 화면 안에 도달해 열렸는지
for(const r of ['#select/curriculum?v=hs&bf=1','#select/curriculum?v=hs&bf=school-yonginheungcheon']){try{await p.goto(base,{waitUntil:'load',timeout:20000});await p.waitForTimeout(1500);await p.evaluate((h)=>{location.hash=h},r);await p.waitForTimeout(3500);}catch(e){out.push({w,r,issue:'앵커 load'});continue} // 앱 안에서 링크를 눌러 들어오는 경우(앱이 주소를 다시 쓰므로 새로 고침은 쓰지 않는다)
 const bfv=r.split('bf=')[1];const a=await p.evaluate((bf)=>{const t=bf==='1'?document.querySelector('[id^="bf-"]'):document.querySelector('#bf-'+CSS.escape(bf));if(!t)return {bad:'대상 구역이 없음'};const top=t.getBoundingClientRect().top;if(top<0||top>innerHeight-100)return {bad:'대상이 화면 밖(top '+Math.round(top)+', scrollY '+Math.round(scrollY)+')'};return {ok:1}},bfv);
 if(a&&a.bad)out.push({w,r,issue:'앵커 도달',bad:[a.bad]});}
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
    r = subprocess.run(["node", path, BASE, json.dumps(ROUTES), json.dumps(CMP), json.dumps(STICKY)], capture_output=True, text=True, env=env)
    os.unlink(path)
    if r.returncode != 0:
        print("점검 실행 실패:", (r.stderr or r.stdout)[-300:])
        return 2
    out = json.loads(r.stdout.strip().splitlines()[-1])
    if not out:
        print(f"OK: {len(ROUTES)}화면 × 4폭 좁게 갇힌 .row·가로 스크롤 없음, 비교 표 {len(CMP)}곳 점검 통과")
        return 0
    for o in out:
        print(json.dumps(o, ensure_ascii=False))
    return 1

if __name__ == "__main__":
    sys.exit(main())
