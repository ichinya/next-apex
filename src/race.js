/* Local opponents share the player's physics and the same 72-step turn clock. */
(function(root){
 'use strict';
 const P=root.RacePhysics||(typeof require==='function'?require('./physics.js'):null);
 const profiles=[
  {id:'ember',name:'Искра',color:'#f59a67',paint:['#a74329','#ffbc84','#e67a47','#813220'],lane:-14,pace:108},
  {id:'mint',name:'Вектор',color:'#84d9bc',paint:['#216652','#acedd6','#50b293','#194d40'],lane:14,pace:100},
  {id:'violet',name:'Тень',color:'#c4a2f4',paint:['#654391','#dac2ff','#a07bce','#493068'],lane:0,pace:94}
 ];
 function grid(){
  const racers=[{id:'player',name:'Ты',color:'#7bc4f7',state:P.start(),action:{throttle:1,steer:0}}];
  profiles.forEach((profile,i)=>{
   const p=P.at(i<2?-32:-92),lane=i===0?-27:i===1?27:0;
   racers.push({...profile,state:{...P.start(),x:p.x-Math.sin(p.angle)*lane,y:p.y+Math.cos(p.angle)*lane,heading:p.angle,motion:p.angle},action:{throttle:0,steer:0}});
  });
  return racers;
 }
 function progress(s){
  if(s.finished)return P.length;
  let position=P.nearest(s.x,s.y).s;
  if(s.nextGate===0&&position>P.length/2)position-=P.length;
  const previous=s.nextGate*P.length/12;
  return Math.max(previous-P.length/12,Math.min(previous+P.length/12,position));
 }
 function standings(racers){return [...racers].sort((a,b)=>{
  if(a.state.finished!==b.state.finished)return a.state.finished?-1:1;
  if(a.state.finished)return (a.state.finishTime??a.state.elapsed)-(b.state.finishTime??b.state.elapsed);
  return progress(b.state)-progress(a.state);
 });}
 function choose(racer,racers=[]){
  const state=racer.state;
  if(state.finished)return {throttle:0,steer:0};
  const start=P.nearest(state.x,state.y),others=racers.filter(r=>r.id!==racer.id&&!r.state.finished&&Math.hypot(r.state.x-state.x,r.state.y-state.y)<330).map(r=>P.simulate(r.state,0,0).samples);
  let best;
  for(let throttle=-2;throttle<=2;throttle++)for(let steer=-2;steer<=2;steer++){
   // At walking pace a stationary choice cannot turn the wheels into a route
   // back to the road. Crawl forward so recovery remains an ordinary manoeuvre.
   if(state.v<12&&throttle<=0)continue;
   const sim=P.simulate(state,throttle,steer),end=P.nearest(sim.state.x,sim.state.y);
   let advance=end.s-start.s;if(advance<-P.length/2)advance+=P.length;if(advance>P.length/2)advance-=P.length;
   const future=P.at(end.s+Math.max(80,sim.state.v*.8)),bend=Math.abs(P.angleDiff(future.angle,end.angle));
   const safe=Math.max(60,Math.min(racer.pace||100,Math.sqrt(80*Math.max(70,sim.state.v*.8)/Math.max(.1,bend))));
   const lateral=(sim.state.x-end.x)*-Math.sin(end.angle)+(sim.state.y-end.y)*Math.cos(end.angle);
   let cost=end.distance*1.6+Math.abs(lateral-(racer.lane||0))*.4+Math.abs(P.angleDiff(sim.state.motion,end.angle))*100+Math.max(0,sim.state.v-safe)*1.1-advance*.7;
   for(let i=6;i<sim.samples.length;i+=6){
    const s=sim.samples[i];cost+=Math.max(0,P.nearest(s.x,s.y).distance-38)*.5;
    for(const path of others){const q=path[i];cost+=Math.max(0,48-Math.hypot(s.x-q.x,s.y-q.y))*.8;}
   }
   cost-=Math.max(0,sim.state.nextGate-state.nextGate)*100;
   if(!best||cost<best.cost)best={cost,throttle,steer};
  }
  return {throttle:best.throttle,steer:best.steer};
 }
 let contactFactory=null;
 function setContactEngine(factory){contactFactory=factory;}
 function simulate(racers,playerAction){
  const actions=racers.map(r=>r.id==='player'?{...playerAction}:choose(r,racers));
  let states=racers.map(r=>({...r.state}));
  const sample=s=>({...s,offroad:P.nearest(s.x,s.y).distance>P.WIDTH/2});
  const paths=states.map(s=>({samples:[sample(s)],contacts:0,contactLoss:0,distance:0}));
  if(!contactFactory)throw new Error('Rapier must be initialized before racing');
  const contactEngine=contactFactory(states);
  try{for(let tick=0;tick<Math.round(P.TURN/P.DT);tick++){
   const previous=states;
   states=states.map((s,i)=>P.step(s,actions[i].throttle,actions[i].steer));
   const speedsBeforeContact=states.map(s=>s.v),touched=contactEngine.resolve(previous,states);
   states.forEach((s,i)=>{
    if(s.finished&&s.finishTime===undefined)s.finishTime=s.elapsed;
    paths[i].distance+=Math.hypot(s.x-previous[i].x,s.y-previous[i].y);
    if(touched.has(i)){paths[i].contacts++;paths[i].contactLoss+=Math.max(0,speedsBeforeContact[i]-s.v);}
    paths[i].samples.push({...sample(s),contact:touched.has(i)});
   });
  }
  }finally{contactEngine.dispose();}
  paths.forEach((p,i)=>{p.state=states[i];p.offroad=p.samples.some(s=>s.offroad)});
  return {racers:racers.map((r,i)=>({...r,state:states[i],action:actions[i]})),paths};
 }
 const api={grid,choose,simulate,standings,progress,setContactEngine};root.Race=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
