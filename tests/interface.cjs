// Offline integration: load the real game scripts with deterministic DOM/canvas
// adapters, drive their real event handlers, and advance the animation clock.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');for(const match of html.matchAll(/(?:src|href)="(src\/[^\"]+)"/g))assert.ok(fs.existsSync(match[1]),`Missing boot resource: ${match[1]}`);
const noOp=()=>{};let longestStroke=0,currentLength=0,lastPoint=null;
const draw=new Proxy({createLinearGradient:()=>({addColorStop:noOp}),createRadialGradient:()=>({addColorStop:noOp}),beginPath(){currentLength=0;lastPoint=null},moveTo(x,y){lastPoint=[x,y]},lineTo(x,y){if(lastPoint)currentLength+=Math.hypot(x-lastPoint[0],y-lastPoint[1]);lastPoint=[x,y]},stroke(){longestStroke=Math.max(longestStroke,currentLength)}},{get:(o,k)=>k in o?o[k]:noOp});
class Element{constructor(){this.children=[];this.listeners={};this.dataset={};this.style={};this.attributes={};this.hidden=true;this.open=false;this.classList={add:noOp,toggle:noOp}}appendChild(b){this.children.push(b)}setAttribute(k,v){this.attributes[k]=String(v)}addEventListener(k,f){this.listeners[k]=f}getContext(){return draw}getBoundingClientRect(){return {width:682,height:532}}showModal(){this.open=true}close(){this.open=false}click(){if(!this.disabled)(this.listeners.click||this.onclick||noOp)()}}
const elements={};for(const match of fs.readFileSync('index.html','utf8').matchAll(/id="([^"]+)"/g))elements[match[1]]=new Element();
elements.forecast=new Element();let keyHandler,raf,time=0;const storage=new Map();
const document={getElementById:id=>elements[id],createElement:()=>new Element(),querySelectorAll:s=>s.includes('throttle')?elements.throttle.children:elements.steering.children,querySelector:()=>elements.forecast,addEventListener:(type,f)=>{if(type==='keydown')keyHandler=f}};
const env={document,console,Math,structuredClone,performance:{now:()=>time},devicePixelRatio:1,ResizeObserver:class{observe(){}},requestAnimationFrame:f=>{raf=f},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};env.window=env;env.globalThis=env;
vm.createContext(env);for(const file of ['physics','main'])vm.runInContext(fs.readFileSync(`src/${file}.js`,'utf8'),env,{filename:`src/${file}.js`});
function key(value,target='BODY'){let prevented=false;keyHandler({key:value,target:{tagName:target},preventDefault(){prevented=true}});return prevented}
function tick(ms){time+=ms;raf(time)}
const A=env.Apex;
assert.equal(elements.throttle.children.length,5);assert.equal(elements.steering.children.length,5);assert.equal(A.getState().turns,0);tick(16);
elements.throttle.children[4].click();assert.equal(A.getState().throttle,2);
const expected=A.getForecast().state;assert.ok(key(' ','BUTTON'),'Space prevents the focused control from swallowing the command');assert.ok(A.getState().animating);key('ArrowRight');assert.equal(A.getState().steer,0,'Steering is locked during animation');key(' ');tick(1100);
assert.equal(A.getState().turns,1,'A second commit during animation cannot add a turn');assert.equal(A.getState().x,expected.x);assert.equal(A.getState().v,expected.v);assert.ok(!A.getState().animating);
key('r');assert.equal(A.getState().turns,0);key('m');assert.ok(A.getState().overview);key('m');assert.ok(!A.getState().overview);
elements.help.click();assert.ok(elements['help-dialog'].open);key(' ');assert.ok(!A.getState().animating);elements['close-help'].click();
longestStroke=0;tick(16);assert.ok(longestStroke>60,'Forecast must stroke a continuous path, not restart the dash at every sample');
for(const [throttle,steer] of JSON.parse(fs.readFileSync('tests/lap-replay.json','utf8'))){elements.throttle.children[throttle+2].click();elements.steering.children[steer+2].click();elements.commit.click();tick(1100)}
assert.ok(A.getState().finished);assert.equal(elements.finish.hidden,false);assert.equal(A.getState().best,A.getState().turns);assert.equal(storage.get('apex-forest-best-v1'),A.getState().turns);elements.again.click();assert.equal(A.getState().turns,0);assert.equal(elements.finish.hidden,true);assert.ok(A.getState().best>0);
console.log('PASS: boot, 10 controls, keyboard after button focus, animation locking, exact forecast, reset, map, help, continuous trajectory, full-lap finish, best score and replay');
