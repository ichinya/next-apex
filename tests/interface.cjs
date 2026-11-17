// Real controller and Rapier integration; browser checks exercise the DOM separately.
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const {initializePhysics}=await import('../src/rapier.mjs');await initializePhysics();require('../src/planning.js');const RaceSession=require('../src/session.js');
 const s=new RaceSession(),grid=structuredClone(s.racers),P=globalThis.RacePhysics;
 assert.equal(s.racers.length,4);assert.equal(s.select('throttle',2),true);assert.deepEqual(s.second,P.simulate(s.forecast.state,0,0));
 const prediction=structuredClone(s.forecast),now=100;
 assert.ok(s.commit(()=>now));assert.equal(s.commit(()=>now),false,'Double-commit is locked');assert.equal(s.select('steer',1),false);assert.equal(s.reset(),false);
 assert.equal(s.advance(now+600),false);assert.deepEqual(s.racers,grid,'No logical movement before the common animation finishes');
 s.visuals.forEach((r,i)=>assert.ok(Math.hypot(r.x-grid[i].state.x,r.y-grid[i].state.y)>1,'All cars animate at the same time'));
 assert.ok(s.advance(now+1200));assert.equal(s.turns,1);assert.deepEqual(s.state,prediction.state,'Free-road execution matches the preview exactly');assert.equal(s.review.turn,1);
 const review=structuredClone(s.review);s.select('steer',1);assert.deepEqual(s.review,review);s.advance(now+4000);assert.equal(s.turns,1,'Planning does not run another turn');
 assert.ok(s.reset());assert.equal(s.turns,0);assert.equal(s.review,null);assert.deepEqual(s.racers,grid);
 let clock=5000;
 for(const [throttle,steer] of JSON.parse(fs.readFileSync('tests/race-replay.json','utf8'))){s.select('throttle',throttle);s.select('steer',steer);s.commit(()=>clock);clock+=1200;s.advance(clock);}
 assert.ok(s.state.finished,'The complete lap reaches the finish');assert.equal(s.best,s.turns);assert.equal(s.commit(()=>clock),false,'Finished races cannot add another turn');assert.equal(s.review.position,globalThis.Race.standings(s.racers).findIndex(r=>r.id==='player')+1);const best=s.best;s.reset();assert.equal(s.best,best);assert.equal(s.state.finished,false);
 const report='PASS: real Rapier controller; 4 simultaneous cars; planning freeze; input and reset locks; no double turn; exact preview; neutral second continuation; turn review; full race; finish order; best result; restart';fs.writeFileSync('output/interface-test-report.txt',report);console.log(report);
})().catch(e=>{console.error(e);process.exitCode=1;});
