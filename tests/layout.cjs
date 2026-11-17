const fs=require('node:fs'),assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const tabs=await(await fetch('http://127.0.0.1:9237/json/list')).json(),tab=tabs.find(t=>t.type==='page'&&decodeURI(t.url).endsWith('/game--2/dist/index.html'));
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)(m.result);pending.delete(m.id);}};
 const send=(method,params={})=>new Promise(r=>{const next=++id;pending.set(next,r);ws.send(JSON.stringify({id:next,method,params}));});
 const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
 try{
  const checks=[];
  for(const [width,height] of [[1280,800],[960,600]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await send('Page.reload',{ignoreCache:true});
   for(let n=0;n<150;n++){if(await evaluate('!!window.Apex?.getDiagnostics().ready'))break;await delay(80);}
   await evaluate('document.getElementById("menu-start").click()');
   const result=await evaluate(`(()=>{const panel=document.querySelector('.dashboard'),header=document.querySelector('.topbar').getBoundingClientRect();return {width:innerWidth,height:innerHeight,scroll:panel.scrollHeight-panel.clientHeight,header:header.bottom,top:document.getElementById('phase').getBoundingClientRect().top,button:document.getElementById('commit').getBoundingClientRect().bottom,restart:document.getElementById('restart').getBoundingClientRect().bottom,ready:window.Apex.getDiagnostics().ready};})()`);
   assert.equal(result.ready,true);assert.ok(result.top>=result.header);assert.ok(result.restart<=height,'Restart fits without scrolling');assert.ok(result.button<=height,'Commit fits without scrolling');checks.push(result);
   const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(`output/stack-layout-${width}.png`,Buffer.from(image.data,'base64'));
  }
  fs.writeFileSync('output/layout-test-report.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
