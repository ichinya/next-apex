// Comparable real-frame and handler timings in this game's isolated Chrome.
const fs=require('node:fs'),assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const percentile=(a,p)=>{const s=[...a].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(s.length*p))]??0;};
const summarize=a=>({count:a.length,medianMs:percentile(a,.5),p95Ms:percentile(a,.95),maxMs:Math.max(0,...a),meanMs:a.reduce((s,x)=>s+x,0)/(a.length||1)});
(async()=>{
 const label=process.argv[2]||'candidate',cpuRate=Number(process.argv[3])||1,deviceScaleFactor=Number(process.argv[4])||1,tabs=await(await fetch('http://127.0.0.1:9237/json/list')).json(),page=tabs.find(t=>t.type==='page'&&decodeURI(t.url).endsWith('/game--2/dist/index.html'));assert.ok(page);
 const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>socket.onopen=r);let id=0;const pending=new Map(),errors=[];
 socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;};
 const wait=async expression=>{for(let i=0;i<400;i++){if(await evaluate(expression))return;await sleep(50);}throw Error('Timed out '+expression);};
 const click=async selector=>{const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});};
 try{
  await send('Page.enable');await send('Runtime.enable');await send('Emulation.setCPUThrottlingRate',{rate:cpuRate});await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor,mobile:false});
  const injection=await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
   const p=window.__perf={frames:[],handlers:[],firstFrame:[],longTasks:[]};let last=0,wasMoving=false,clicked=0,start=0,control='';
   const raf=window.requestAnimationFrame;window.requestAnimationFrame=function(cb){return raf.call(window,t=>{const a=window.Apex,before=a?.getDiagnostics().renderer.frames,moving=a?.getState().animating;cb(t);const after=a?.getDiagnostics().renderer.frames;if(after>before){if(moving&&wasMoving&&last)p.frames.push(t-last);if(clicked&&moving){p.firstFrame.push(performance.now()-clicked);clicked=0;}last=t;wasMoving=moving;}});};
   document.addEventListener('click',e=>{start=performance.now();control=e.target.closest('button')?.id||e.target.closest('div')?.id||'';if(control==='commit')clicked=start;},true);
   window.addEventListener('click',()=>{if(start)p.handlers.push({control,ms:performance.now()-start});start=0;});
   new PerformanceObserver(list=>list.getEntries().forEach(e=>p.longTasks.push(e.duration))).observe({type:'longtask',buffered:true});
  })();`});
  await send('Page.reload',{ignoreCache:true});await wait('!!window.Apex?.getDiagnostics().ready');await sleep(1800);
  const idleBefore=await evaluate('Apex.getDiagnostics().renderer.frames');await sleep(2000);const idleAfter=await evaluate('Apex.getDiagnostics().renderer.frames');
  await click('#throttle button[data-value="2"]');
  for(let i=0;i<6;i++){await click('#commit');await wait('!Apex.getState().animating');await sleep(100);}
  const data=await evaluate('({timings:__perf,diagnostics:Apex.getDiagnostics(),viewport:[innerWidth,innerHeight,devicePixelRatio],userAgent:navigator.userAgent})');
  const screenshot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`output/performance-${label}.png`,Buffer.from(screenshot.data,'base64'));
  const report={label,scenario:`1280x800, DPR ${deviceScaleFactor}, CPU throttle ${cpuRate}, production build, six straight full-throttle 1.2s turns from reset`,activeFrameIntervals:summarize(data.timings.frames),activeFps:1000/(summarize(data.timings.frames).meanMs||1),commitHandler:summarize(data.timings.handlers.filter(x=>x.control==='commit').map(x=>x.ms)),controlHandler:summarize(data.timings.handlers.filter(x=>x.control!=='commit').map(x=>x.ms)),inputToFirstMovingFrame:summarize(data.timings.firstFrame),idleRenderedFramesPerSecond:(idleAfter-idleBefore)/2,longTasks:summarize(data.timings.longTasks),...data,errors};
  fs.writeFileSync(`output/performance-${label}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,timings:undefined,diagnostics:data.diagnostics}));assert.deepEqual(errors,[]);
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.identifier});
 }finally{await send('Emulation.setCPUThrottlingRate',{rate:1});socket.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

