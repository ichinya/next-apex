/* Presentation calculations use the same simulation as the executed turn. */
(function(root){
 'use strict';
 const P=root.RacePhysics||(typeof require==='function'?require('./physics.js'):null);
 const R=root.Race||(typeof require==='function'?require('./race.js'):null);
 const kmh=v=>Math.round(v*1.08);
 function predict(state,throttle,steer){
  const first=P.simulate(state,throttle,steer);
  // The continuation is an explicit assumption, never a second queued command.
  const second=first.state.finished?null:P.simulate(first.state,0,0);
  return {first,second};
 }
 function cameraTarget(state,first,second,racers,width,height,overview=false){
  if(overview)return {x:810,y:750,z:Math.min(width/1450,height/1400)};
  const road=P.nearest(state.x,state.y),horizon=Math.max(150,state.v*P.TURN*2.3);
  const points=[state];
  for(let i=1;i<=6;i++)points.push(P.at(road.s+horizon*i/6));
  for(const path of [first,second])if(path)points.push(...path.samples);
  for(const racer of racers){const s=racer.state||racer;if(!s.finished&&Math.hypot(s.x-state.x,s.y-state.y)<150)points.push(s);}
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs)-38,right=Math.max(...xs)+38,top=Math.min(...ys)-38,bottom=Math.max(...ys)+38;
  const normalZoom=Math.min(width/650,height/570)*1.12/(1+state.v/P.MAX_SPEED*.28);
  // Leave room for the standings and the instructions above the track.
  const insetLeft=width>=500?190:Math.min(145,width*.37),insetRight=35,insetTop=width>=500?110:65,insetBottom=width>=500?65:50;
  const z=Math.min(normalZoom,Math.max(40,width-insetLeft-insetRight)/(right-left),Math.max(40,height-insetTop-insetBottom)/(bottom-top));
  const offsetX=(insetLeft-insetRight)/2,offsetY=(insetTop-insetBottom)/2;
  return {x:(left+right)/2-offsetX/z,y:(top+bottom)/2-offsetY/z,z};
 }
 function review(before,result,turn){
  const after=result.racers,player=after.find(r=>r.id==='player'),old=before.find(r=>r.id==='player');
  const position=R.standings(after).findIndex(r=>r.id==='player')+1,previousPosition=R.standings(before).findIndex(r=>r.id==='player')+1;
  const path=result.paths[after.findIndex(r=>r.id==='player')],events=[];
  if(position<previousPosition)events.push({kind:'gain',text:`Обгон · теперь ${position}-е место`});
  else if(position>previousPosition)events.push({kind:'lost',text:`Тебя обошли · теперь ${position}-е место`});
  if(path.contacts){
   const loss=kmh(path.contactLoss||0);
   events.push({kind:'contact',text:loss>0?`Контакт: потеря ${loss} км/ч`:'Контакт · траектория изменилась'});
  }
  if(path.samples.some(s=>s.offroad&&s.v>1))events.push({kind:'grass',text:'Обочина замедляла машину'});
  if(!events.length)events.push({kind:'clean',text:player.state.finished?`Финиш · ${position}-е место`:'Манёвр выполнен на асфальте'});
  const delta=kmh(player.state.v)-kmh(old.state.v);
  return {turn,position,previousPosition,delta,events,speed:`${kmh(old.state.v)} → ${kmh(player.state.v)} км/ч`,change:delta>0?`+${delta}`:String(delta)};
 }
 const api={predict,cameraTarget,review};root.RacePlanning=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
