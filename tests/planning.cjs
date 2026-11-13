(async()=>{const {initializePhysics}=await import('../src/rapier.mjs');await initializePhysics();
const assert=require('node:assert/strict'),fs=require('node:fs');
const P=require('../src/physics.js'),R=require('../src/race.js'),T=require('../src/planning.js');
const initial=P.start(),snapshot=structuredClone(initial);
for(const throttle of [-2,0,2])for(const steer of [-2,0,2]){
 const {first,second}=T.predict(initial,throttle,steer);
 assert.deepEqual(second,P.simulate(first.state,0,0),'Second line is coasting with a straight wheel, not repeating the first command');
 assert.deepEqual(first.samples.at(-1),second.samples[0],'Both paths join without a jump');
}
assert.deepEqual(initial,snapshot,'Changing the preview never moves the car');
const gate=P.gates[11],finish={...initial,x:gate.x-Math.cos(gate.angle)*10,y:gate.y-Math.sin(gate.angle)*10,heading:gate.angle,motion:gate.angle,nextGate:11};
assert.equal(T.predict(finish,0,0).second,null,'No prediction of a second lap after finishing');
let checkedFrames=0;
for(const [width,height] of [[682,532],[390,300],[1280,720]])for(const v of [0,70,210])for(const steer of [-2,0,2]){
 const state={...initial,v},p=T.predict(state,1,steer),c=T.cameraTarget(state,p.first,p.second,R.grid(),width,height);
 assert.ok(Number.isFinite(c.z)&&c.z>0);
 for(const point of [state,...p.first.samples,...(p.second?.samples||[])]){
  assert.ok(Math.abs((point.x-c.x)*c.z)<width/2-20,'Preview fits horizontally');
  assert.ok(Math.abs((point.y-c.y)*c.z)<height/2-20,'Preview fits vertically');
 }
 checkedFrames++;
}
function view(v){const s={...initial,v},p=T.predict(s,0,0);return T.cameraTarget(s,p.first,p.second,[],682,532)}
const slow=view(40),fast=view(200),ahead=c=>(c.x-initial.x)*Math.cos(initial.heading)+(c.y-initial.y)*Math.sin(initial.heading);
assert.ok(ahead(fast)>ahead(slow)+70,'Higher speed reveals more road ahead');assert.ok(fast.z<slow.z,'Higher speed widens the view');
const before=R.grid();let after=structuredClone(before);[after[0].state,after[1].state]=[after[1].state,after[0].state];
const emptyPaths=after.map(r=>({samples:[{...r.state,offroad:false}],contacts:0,contactLoss:0}));
let result=T.review(before,{racers:after,paths:emptyPaths},1);assert.equal(result.position,2);assert.equal(result.events[0].kind,'lost');
result=T.review(after,{racers:before,paths:emptyPaths},2);assert.equal(result.position,1);assert.equal(result.events[0].kind,'gain');
const contactPaths=structuredClone(emptyPaths);contactPaths[0].contacts=3;contactPaths[0].contactLoss=17;
result=T.review(before,{racers:before,paths:contactPaths},3);assert.match(result.events[0].text,/18 км\/ч/);
contactPaths[0].contactLoss=0;result=T.review(before,{racers:before,paths:contactPaths},3);assert.match(result.events[0].text,/траектория/,'A contact without speed loss does not claim a loss');
const grassBefore=[{...before[0],state:{...initial,x:200,y:800}}],grassResult=R.simulate(grassBefore,{throttle:0,steer:0});
const grassReview=T.review(grassBefore,grassResult,1);assert.ok(grassReview.events.some(e=>e.kind==='grass'));assert.ok(grassReview.delta<0);
const roadTurn=R.simulate(before,{throttle:1,steer:0});assert.equal(roadTurn.paths[0].contactLoss,0);assert.deepEqual(roadTurn.racers[0].state,P.simulate(before[0].state,1,0).state,'Presentation telemetry leaves physics unchanged');
const report={passed:true,cameraScenarios:checkedFrames,secondTurn:'coasting and straight steering; continuous join; no mutation or extra executed turn',camera:'both paths fit portrait and landscape; faster speed reveals more road',feedback:'gained/lost places; measured contact loss; non-braking contact; grass slowdown; unchanged physics'};
fs.writeFileSync('output/planning-test-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

})().catch(e=>{console.error(e);process.exitCode=1;});
