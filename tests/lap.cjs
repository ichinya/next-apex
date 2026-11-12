// A bounded driver checks that every corner and the ordered finish are reachable.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const P=require('../src/physics.js');
let state=P.start(),actions=[],maxOffroad=0;
for(let turn=0;turn<150&&!state.finished;turn++){
 const start=P.nearest(state.x,state.y);let best=null;
 for(let throttle=-2;throttle<=2;throttle++)for(let steer=-2;steer<=2;steer++){
  const sim=P.simulate(state,throttle,steer),end=P.nearest(sim.state.x,sim.state.y);
  let progress=end.s-start.s;if(progress<-P.length/2)progress+=P.length;if(progress>P.length/2)progress-=P.length;
  const angle=Math.abs(P.angleDiff(sim.state.motion,end.angle));
  const future=P.at(end.s+Math.max(80,sim.state.v*.8));
  const bend=Math.abs(P.angleDiff(future.angle,end.angle));
  const safe=Math.max(60,Math.min(105,Math.sqrt(80*Math.max(70,sim.state.v*.8)/Math.max(.1,bend))));
  let cost=end.distance*2+angle*100+Math.max(0,sim.state.v-safe)*1.1-progress*.7;
  for(let i=6;i<sim.samples.length;i+=6)cost+=Math.max(0,P.nearest(sim.samples[i].x,sim.samples[i].y).distance-38)*.5;
  cost-=Math.max(0,sim.state.nextGate-state.nextGate)*100;
  if(!best||cost<best.cost)best={cost,sim,throttle,steer};
 }
 actions.push([best.throttle,best.steer]);state=best.sim.state;maxOffroad=Math.max(maxOffroad,P.nearest(state.x,state.y).distance);
}
assert.ok(state.finished,`Driver stalled at gate ${state.nextGate}, position ${state.x},${state.y}`);
fs.writeFileSync('tests/lap-replay.json',JSON.stringify(actions));
console.log(`PASS: complete lap in ${actions.length} turns, 12/12 gates, maximum centre offset ${Math.round(maxOffroad)} units`);
