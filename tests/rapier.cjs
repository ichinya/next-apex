const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const {initializePhysics,physicsStats}=await import('../src/rapier.mjs');await initializePhysics();
 const P=globalThis.RacePhysics,R=globalThis.Race;
 const initial=R.grid(),free=R.simulate(initial,{throttle:1,steer:0});assert.deepEqual(free.racers[0].state,P.simulate(initial[0].state,1,0).state);
 assert.equal(free.paths[0].samples.length,73);assert.equal(physicsStats.worlds,0);
 const p=P.at(150),q=P.at(230),headOn=[{...initial[0],state:{...P.start(),...p,heading:p.angle,motion:p.angle,v:160}},{...initial[1],state:{...P.start(),...q,heading:q.angle+Math.PI,motion:q.angle+Math.PI,v:160}}];
 const hit=R.simulate(headOn,{throttle:0,steer:0});assert.ok(hit.paths[0].contacts>0,'Rapier detects a contact in the middle of the turn');assert.ok(hit.paths[0].contactLoss>0,'Rapier impulse reduces speed');assert.ok(hit.racers[0].state.v<160);
 assert.deepEqual(hit,R.simulate(headOn,{throttle:0,steer:0}),'Same snapshots and commands produce the same collision result');
 for(const r of hit.racers)assert.ok(Number.isFinite(r.state.x)&&Number.isFinite(r.state.y)&&r.state.v>=0);
 const grass=[{...initial[0],state:{...P.start(),x:200,y:800,v:70}}];assert.ok(R.simulate(grass,{throttle:0,steer:1}).racers[0].state.v<70);
 assert.equal(physicsStats.worlds,0,'Every temporary physics world is released');assert.ok(physicsStats.steps>=288);assert.ok(physicsStats.contacts>0);
 const report={passed:true,version:physicsStats.version,fixedStep:P.DT,turn:P.TURN,freeRoadPredictionExact:true,midTurnContact:true,impulseSpeedLoss:true,deterministic:true,grass:true,unreleasedWorlds:physicsStats.worlds};fs.writeFileSync('output/rapier-test-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
