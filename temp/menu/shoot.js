// 시안 스크린샷: node temp/menu/shoot.js (서버: python3 -m http.server 8000)
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
const pages=['index','credit','system','middle'];
for(const v of ['A','B','C'])for(const [w,h,tag] of [[390,844,'m'],[1440,900,'d']]){
 const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1});const p=await c.newPage();
 for(const n of pages){await p.goto(`http://localhost:8000/temp/menu/${v}/${n}.html`);await p.waitForTimeout(500);
  await p.screenshot({path:`temp/menu/shots/${v}-${n}-${tag}.png`,fullPage:true});
  const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(ov)console.log('가로 넘침',v,n,tag)}
 if(v!=='B'&&tag==='m'){await p.goto(`http://localhost:8000/temp/menu/${v}/credit.html`);await p.click('[data-open]');await p.waitForTimeout(300);await p.screenshot({path:`temp/menu/shots/${v}-drawer-m.png`})}
 await c.close()}
await b.close()})()
