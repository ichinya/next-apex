// Test only the isolated browser launched for this game, never an existing profile.
const fs=require('node:fs'),assert=require('node:assert/strict');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const tabs=await(await fetch('http://127.0.0.1:9237/json/list')).json();
 const page=tabs.find(t=>t.type==='page'&&decodeURI(t.url).endsWith('/game--2/dist/index.html'));
 assert.ok(page,'The isolated game tab must be open');
 const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let next=0;const pending=new Map(),errors=[];
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')errors.push(message.params.entry.text);if(message.id){const p=pending.get(message.id);pending.delete(message.id);if(message.error)p.reject(new Error(message.error.message));else p.resolve(message.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
 async function wait(expression,limit=12000){const start=Date.now();while(Date.now()-start<limit){if(await evaluate(expression))return;await sleep(70);}throw new Error(`Timed out: ${expression}`);}
 async function click(selector){const p=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing control');el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});}
 async function shot(name){const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(`output/${name}.png`,Buffer.from(result.data,'base64'));}
 async function choose(throttle,steer){await click(`#throttle button[data-value="${throttle}"]`);await click(`#steering button[data-value="${steer}"]`);}
 async function turn(throttle,steer){await choose(throttle,steer);await click('#commit');await wait('!window.Apex.getState().animating');}
 try{
  await send('Runtime.enable');await send('Log.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await send('Page.reload',{ignoreCache:true});await wait('!!window.Apex?.getDiagnostics().ready');
  assert.ok(await evaluate('window.Apex.getState().menuOpen'),'The game opens in the main menu');await click('#menu-start');assert.equal(await evaluate('window.Apex.getState().menuOpen'),false);
  await shot('stack-start');const start=await evaluate('window.Apex.getDiagnostics()');
  assert.equal(start.renderer.revision,'187');assert.equal(start.renderer.cars,4);assert.ok(start.renderer.trees>0);assert.ok(start.renderer.modelURL.includes('/blender/'));assert.ok(start.renderer.postprocessing>=3&&start.renderer.ambientOcclusion);assert.equal(start.renderer.particles.systems,5);assert.equal(start.physics.version,'0.21.0');
  const idle=await evaluate('JSON.stringify(window.Apex.getRacers())');await sleep(1800);assert.equal(await evaluate('JSON.stringify(window.Apex.getRacers())'),idle);
  const idleFrames=await evaluate('window.Apex.getDiagnostics().renderer.frames');await sleep(500);assert.equal(await evaluate('window.Apex.getDiagnostics().renderer.frames'),idleFrames,'Static planning stops GPU redraws');assert.ok(start.renderer.carMeshes<=10&&start.renderer.forestChunks>1,'Batched cars and spatially culled forest are active');
  await choose(2,0);const forecast=await evaluate('window.Apex.getForecast().state');await click('#commit');assert.ok(await evaluate('window.Apex.getState().animating'));assert.ok(await evaluate('document.querySelectorAll("#throttle button:disabled").length===5'));await wait('!window.Apex.getState().animating');
  const actual=await evaluate('window.Apex.getState()');assert.equal(actual.turns,1);assert.equal(actual.v,forecast.v);assert.equal(actual.x,forecast.x);assert.equal(await evaluate('document.getElementById("turn-review").hidden'),false);
  const active=await evaluate('window.Apex.getDiagnostics()');assert.equal(active.audio.context,'running');assert.ok(active.audio.cuesPlayed>0);assert.ok(active.ui.tweens>0);assert.equal(active.physics.steps,72);
  await click('#restart');await turn(1,0);await turn(2,0);await choose(0,0);await shot('stack-high-speed');await turn(0,0);
  await choose(0,0);await click('#commit');await sleep(550);const dust=await evaluate('window.Apex.getDiagnostics().renderer.particles');await shot('stack-dust-motion');await wait('!window.Apex.getState().animating');
  const effects=await evaluate('window.Apex.getDiagnostics()');assert.ok(effects.renderer.particles.emittedFrames>0,'Quarks actually emits particles on grass');assert.ok((await evaluate('window.Apex.getReview().events')).some(e=>e.kind==='grass'));await shot('stack-grass');
  await click('#camera');await sleep(800);assert.equal(await evaluate('window.Apex.getState().overview'),true);await shot('stack-overview');await click('#camera');
  await click('#help');assert.equal(await evaluate('document.getElementById("help-dialog").open'),true);await click('#lets-race');
  await click('#sound');assert.equal(await evaluate('window.Apex.getDiagnostics().audio.enabled'),false);await click('#sound');assert.equal(await evaluate('window.Apex.getDiagnostics().audio.enabled'),true);
  await click('#restart');const actions=JSON.parse(fs.readFileSync('tests/race-replay.json','utf8'));
  for(const [throttle,steer] of actions)await turn(throttle,steer);
  assert.ok(await evaluate('window.Apex.getState().finished'));assert.equal(await evaluate('document.getElementById("finish").hidden'),false);await sleep(450);await shot('stack-finish');
  await click('#again');assert.equal(await evaluate('window.Apex.getState().turns'),0);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(700);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Mobile has no horizontal overflow');await shot('stack-mobile');
  await click('#commit');await wait('!window.Apex.getState().animating');assert.equal(await evaluate('window.Apex.getState().turns'),1,'The mobile commit control works');await click('#restart');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await evaluate('window.scrollTo(0,0)');await sleep(600);await shot('stack-ready');
  assert.deepEqual(errors,[],'No runtime or rendering errors');
  const report={passed:true,boot:start,afterInput:active,particlesDuringMotion:dust,finalDiagnostics:await evaluate('window.Apex.getDiagnostics()'),fullLapTurns:actions.length,mobile:true,planningFreeze:true,previewExact:true,buttonsAndHelp:true,allRequestedLibrariesActive:true,errors};fs.writeFileSync('output/browser-test-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,fullLapTurns:actions.length,particles:dust,mobile:true,errors}));
 }finally{socket.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
