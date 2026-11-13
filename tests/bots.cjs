(async()=>{const {initializePhysics}=await import('../src/rapier.mjs');await initializePhysics();
const assert=require('node:assert/strict');
const fs=require('node:fs');
const P=require('../src/physics.js'),R=require('../src/race.js');
const initial=R.grid(),copy=structuredClone(initial);
assert.equal(initial.length,4);
for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(Math.hypot(initial[i].state.x-initial[j].state.x,initial[i].state.y-initial[j].state.y)>48);
let racers=initial,actions=[],brakes=new Set(),offroad=new Set(),finishTurns={};
for(let turn=0;turn<100&&!racers.every(r=>r.state.finished);turn++){
 const action=R.choose({...racers[0],pace:103,lane:0},racers);actions.push([action.throttle,action.steer]);
 const result=R.simulate(racers,action);
 result.racers.forEach((r,i)=>{
  assert.equal(result.paths[i].samples.length,73,'Every racer uses the same clock');
  assert.ok(Number.isFinite(r.state.x)&&Number.isFinite(r.state.v));
  assert.ok(r.state.nextGate>=racers[i].state.nextGate);
  if(r.action.throttle<0)brakes.add(r.id);
  if(result.paths[i].offroad)offroad.add(r.id);
  if(r.state.finished&&!finishTurns[r.id])finishTurns[r.id]=turn+1;
 });
 racers=result.racers;
}
assert.deepEqual(initial,copy,'Planning and turn simulation do not change the input snapshot');
assert.ok(racers.every(r=>r.state.finished),`All racers must complete the ordered lap: ${JSON.stringify(racers.map(r=>[r.name,r.state.nextGate]))}`);
assert.ok(brakes.size>=3,'Drivers must brake, rather than follow a scripted path at constant speed');
assert.ok(new Set(Object.values(finishTurns)).size>1,'Opponents have distinct lap performances');
for(const r of racers){assert.equal(r.state.nextGate,12);assert.ok(r.state.finishTime>0);}
const order=R.standings(racers);for(let i=1;i<order.length;i++)assert.ok(order[i-1].state.finishTime<=order[i].state.finishTime);
const shoulder=P.at(180);let recovering={...initial[1],state:{...P.start(),x:shoulder.x-Math.sin(shoulder.angle)*85,y:shoulder.y+Math.cos(shoulder.angle)*85,heading:shoulder.angle,motion:shoulder.angle,v:45}};
for(let i=0;i<12;i++){const a=R.choose(recovering);recovering.state=P.simulate(recovering.state,a.throttle,a.steer).state;}
assert.ok(P.nearest(recovering.state.x,recovering.state.y).distance<P.WIDTH/2,'A bot can steer back from grass with ordinary controls');
const p=P.at(150),q=P.at(230);
const headOn=R.simulate([{...initial[0],state:{...P.start(),...p,heading:p.angle,motion:p.angle,v:160}},{...initial[1],state:{...P.start(),...q,heading:q.angle+Math.PI,motion:q.angle+Math.PI,v:160}}],{throttle:0,steer:0});
assert.ok(headOn.paths[0].contacts>0,'Mid-turn contact must be detected even when endpoints would pass');
assert.ok(headOn.paths[0].contactLoss>0,'The turn report measures actual speed lost to contact');
assert.ok(headOn.racers[0].state.v<160,'Contact costs speed');
const finish=P.gates[11],crossing={...P.start(),x:finish.x-Math.cos(finish.angle)*20,y:finish.y-Math.sin(finish.angle)*20,heading:finish.angle,motion:finish.angle,v:100,nextGate:11};
const tied=[{id:'player',state:{...crossing}},{...initial[1],state:{...crossing,x:crossing.x-Math.sin(finish.angle)*45,y:crossing.y+Math.cos(finish.angle)*45}}];
const simultaneous=R.simulate(tied,{throttle:0,steer:0});
assert.ok(simultaneous.racers.every(r=>r.state.finished),'Finishes in the same turn are both processed');
const earlier={id:'first',state:{...crossing,finished:true,finishTime:40}},later={id:'second',state:{...crossing,finished:true,finishTime:40.1}};
assert.equal(R.standings([later,earlier])[0].id,'first','Sub-turn finish time decides order');
fs.writeFileSync('tests/race-replay.json',JSON.stringify(actions.slice(0,finishTurns.player)));
const report={passed:true,finishTurns,order:order.map(r=>r.name),brakingDrivers:[...brakes],offroadDrivers:[...offroad],midTurnContact:true,sameTurnFinish:true,grassRecovery:true,checks:'same physics and clock; ordered gates; all four finish; input immutability; braking; contacts; finish timing; grass recovery'};
fs.mkdirSync('output',{recursive:true});fs.writeFileSync('output/bots-test-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

})().catch(e=>{console.error(e);process.exitCode=1;});
