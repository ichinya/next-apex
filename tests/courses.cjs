// Every course must be a real, completable race under the ordinary car rules.
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const {initializePhysics}=await import('../src/rapier.mjs');await initializePhysics();
 const P=require('../src/physics.js'),R=require('../src/race.js');require('../src/planning.js');
 const Session=require('../src/session.js'),reports=[];
 assert.equal(new Set(P.courses.map(c=>c.id)).size,3);
 const forest=P.track;
 assert.throws(()=>P.setCourse('missing'),/Unknown course/);assert.equal(P.track,forest);
 for(const course of P.courses){
  P.setCourse(course.id);
  assert.equal(P.WIDTH,course.width);assert.equal(P.gates.length,12);
  for(const p of P.track){assert.ok(p.len>0);assert.ok(p.x>80+P.WIDTH/2&&p.x<1490-P.WIDTH/2&&p.y>60+P.WIDTH/2&&p.y<1470-P.WIDTH/2,'Road fits inside the world');}
  const session=new Session(),initial=structuredClone(session.racers),finishTurns={},actions=[];
  assert.ok(initial.every(r=>r.state.v===0&&P.nearest(r.state.x,r.state.y).distance<P.WIDTH/2));
  for(let i=0;i<4;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(initial[i].state.x-initial[j].state.x,initial[i].state.y-initial[j].state.y)>48);
  let clock=0;
  for(let turn=0;turn<150&&!session.racers.every(r=>r.state.finished);turn++){
   const action=R.choose({...session.racers[0],pace:103,lane:0},session.racers);
   if(!session.state.finished){actions.push([action.throttle,action.steer]);session.select('throttle',action.throttle);session.select('steer',action.steer);}
   // Continue the other drivers after the player crosses the finish, too.
   if(session.state.finished){const result=R.simulate(session.racers,action);session.racers=result.racers;}
   else{assert.ok(session.commit(()=>clock));clock+=1200;assert.ok(session.advance(clock));}
   session.racers.forEach(r=>{assert.ok(Number.isFinite(r.state.x)&&Number.isFinite(r.state.v));if(r.state.finished&&!finishTurns[r.id])finishTurns[r.id]=turn+1;});
  }
  assert.ok(session.racers.every(r=>r.state.finished&&r.state.nextGate===12),`${course.id}: all four drivers finish; gates: ${session.racers.map(r=>r.state.nextGate)}`);
  const best=session.best;session.reset();assert.equal(session.best,best);assert.equal(session.turns,0);assert.deepEqual(session.racers,initial);
  const report={id:course.id,length:Math.round(P.length),width:P.WIDTH,finishTurns,actions};reports.push(report);
  console.log(`${course.name}: all 4 cars finished, player ${finishTurns.player} turns, ${Math.round(P.length)} units`);
 }
 P.setCourse('forest');assert.equal(P.track,forest,'Returning restores the compiled geometry of the original course');
 fs.writeFileSync('output/courses-test-report.json',JSON.stringify({passed:true,courses:reports},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
