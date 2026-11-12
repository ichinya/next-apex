// Offline integration: load the real game scripts with deterministic DOM/canvas
// adapters, drive their real event handlers, and advance the animation clock.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');for(const match of html.matchAll(/(?:src|href)="(src\/[^\"]+)"/g))assert.ok(fs.existsSync(match[1]),`Missing boot resource: ${match[1]}`);
const noOp=()=>{};let longestStroke=0,currentLength=0,lastPoint=null;
const draw=new Proxy({createLinearGradient:()=>({addColorStop:noOp}),createRadialGradient:()=>({addColorStop:noOp}),beginPath(){currentLength=0;lastPoint=null},moveTo(x,y){lastPoint=[x,y]},lineTo(x,y){if(lastPoint)currentLength+=Math.hypot(x-lastPoint[0],y-lastPoint[1]);lastPoint=[x,y]},stroke(){longestStroke=Math.max(longestStroke,currentLength)}},{get:(o,k)=>k in o?o[k]:noOp});
class Element{constructor(){this.children=[];this.listeners={};this.dataset={};this.style={};this.attributes={};this.hidden=true;this.open=false;this.classList={add:noOp,toggle:noOp}}appendChild(b){this.children.push(b)}setAttribute(k,v){this.attributes[k]=String(v)}addEventListener(k,f){this.listeners[k]=f}getContext(){return draw}getBoundingClientRect(){return {width:682,height:532}}showModal(){this.open=true}close(){this.open=false}click(){if(!this.disabled)(this.listeners.click||this.onclick||noOp)()}}
const elements={};for(const match of fs.readFileSync('index.html','utf8').matchAll(/id="([^"]+)"/g))elements[match[1]]=new Element();
elements.forecast=new Element();elements.finishHeading=new Element();let keyHandler,raf,time=0;const storage=new Map();
const document={getElementById:id=>elements[id],createElement:()=>new Element(),querySelectorAll:s=>s.includes('throttle')?elements.throttle.children:elements.steering.children,querySelector:s=>s==='#finish h2'?elements.finishHeading:elements.forecast,addEventListener:(type,f)=>{if(type==='keydown')keyHandler=f}};
const env={document,console,Math,structuredClone,performance:{now:()=>time},devicePixelRatio:1,ResizeObserver:class{observe(){}},requestAnimationFrame:f=>{raf=f},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};env.window=env;env.globalThis=env;
// Run the unchanged simulation modules natively; only the DOM-facing script
// needs a VM. This avoids cross-context Math overhead in millions of samples.
env.RacePhysics=require('../src/physics.js');env.Race=require('../src/race.js');env.RacePlanning=require('../src/planning.js');
vm.createContext(env);vm.runInContext(fs.readFileSync('src/main.js','utf8'),env,{filename:'src/main.js'});
function key(value,target='BODY'){let prevented=false;keyHandler({key:value,target:{tagName:target},preventDefault(){prevented=true}});return prevented}
function tick(ms){time+=ms;raf(time)}
const A=env.Apex;
assert.equal(elements.throttle.children.length,5);assert.equal(elements.steering.children.length,5);assert.equal(A.getState().turns,0);tick(16);
const grid=JSON.stringify(A.getRacers());assert.equal(A.getRacers().length,4);tick(600);assert.equal(JSON.stringify(A.getRacers()),grid,'Bots wait during planning');assert.equal((elements.standings.innerHTML.match(/<li /g)||[]).length,4);
assert.equal(elements['turn-review'].hidden,true);assert.ok(A.getSecondForecast());assert.ok(A.getCamera().target.z>0);
elements.throttle.children[4].click();assert.equal(A.getState().throttle,2);
assert.deepEqual(A.getSecondForecast(),env.RacePhysics.simulate(A.getForecast().state,0,0));
const expected=A.getForecast().state;assert.ok(key(' ','BUTTON'),'Space prevents the focused control from swallowing the command');assert.ok(A.getState().animating);key('ArrowRight');assert.equal(A.getState().steer,0,'Steering is locked during animation');key(' ');tick(500);assert.equal(JSON.stringify(A.getRacers()),grid,'Logical state changes only on completing the turn');A.getVisuals().forEach((s,i)=>assert.ok(Math.hypot(s.x-A.getRacers()[i].state.x,s.y-A.getRacers()[i].state.y)>1,'Every car animates during the same turn'));tick(600);
assert.equal(A.getState().turns,1,'A second commit during animation cannot add a turn');assert.equal(A.getState().x,expected.x);assert.equal(A.getState().v,expected.v);assert.ok(!A.getState().animating);
assert.equal(elements['turn-review'].hidden,false);assert.equal(A.getReview().turn,1);assert.match(elements['review-speed'].textContent,/→/);const review=JSON.stringify(A.getReview());key('ArrowRight');assert.equal(JSON.stringify(A.getReview()),review,'Changing the next choice preserves the previous result');
key('r');assert.equal(A.getState().turns,0);assert.equal(JSON.stringify(A.getRacers()),grid,'Restart resets all opponents');key('m');assert.ok(A.getState().overview);key('m');assert.ok(!A.getState().overview);
assert.equal(A.getReview(),null);assert.equal(elements['turn-review'].hidden,true);
elements.help.click();assert.ok(elements['help-dialog'].open);key(' ');assert.ok(!A.getState().animating);elements['close-help'].click();
longestStroke=0;tick(16);assert.ok(longestStroke>60,'Forecast must stroke a continuous path, not restart the dash at every sample');
for(const [throttle,steer] of JSON.parse(fs.readFileSync('tests/race-replay.json','utf8'))){elements.throttle.children[throttle+2].click();elements.steering.children[steer+2].click();elements.commit.click();tick(1100)}
assert.ok(A.getState().finished);assert.equal(elements.finish.hidden,false);assert.equal(A.getState().best,A.getState().turns);assert.equal(storage.get('apex-forest-best-v1'),A.getState().turns);elements.again.click();assert.equal(A.getState().turns,0);assert.equal(elements.finish.hidden,true);assert.ok(A.getState().best>0);
assert.match(elements.finishHeading.textContent,/Победа|место/);
const report='PASS: boot, controls, keyboard, all 4 cars animate together, bots wait during planning, no double turn, exact free-road forecast, neutral second-turn continuation, camera target, visible turn feedback, feedback persists while choosing, all racers and feedback reset, standings, map, help, full-race finish, best score and replay';fs.writeFileSync('output/interface-test-report.txt',report);console.log(report);
