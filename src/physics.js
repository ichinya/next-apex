/* The preview and the executed turn use this same deterministic simulation. */
(function(root){
 'use strict';
 const DT=1/60, TURN=1.2, WIDTH=116, MAX_SPEED=215;
 const anchors=[[400,850],[380,570],[410,320],[630,200],[940,200],[1180,340],[1200,550],[1040,690],[820,610],[700,750],[870,930],[1110,980],[1260,1140],[1100,1300],[780,1310],[520,1190],[410,1030]];
 const track=[];
 for(let i=0;i<anchors.length;i++)for(let j=0;j<28;j++){
  const t=j/28,t2=t*t,t3=t2*t,p0=anchors[(i-1+anchors.length)%anchors.length],p1=anchors[i],p2=anchors[(i+1)%anchors.length],p3=anchors[(i+2)%anchors.length];
  const axis=k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3);
  track.push({x:axis(0),y:axis(1),s:0});
 }
 let length=0;
 track.forEach((p,i)=>{p.s=length;const q=track[(i+1)%track.length];p.dx=q.x-p.x;p.dy=q.y-p.y;p.len=Math.hypot(p.dx,p.dy);length+=p.len;p.angle=Math.atan2(p.dy,p.dx)});
 function nearest(x,y){let best={distance:Infinity};for(let i=0;i<track.length;i++){const p=track[i],u=Math.max(0,Math.min(1,((x-p.x)*p.dx+(y-p.y)*p.dy)/(p.len*p.len))),px=p.x+u*p.dx,py=p.y+u*p.dy,d=Math.hypot(x-px,y-py);if(d<best.distance)best={distance:d,x:px,y:py,s:p.s+p.len*u,angle:p.angle,index:i}}return best}
 function at(s){s=(s%length+length)%length;let p=track[0];for(let i=0;i<track.length;i++){if(track[i].s>s)break;p=track[i]}const u=(s-p.s)/p.len;return {x:p.x+p.dx*u,y:p.y+p.dy*u,angle:p.angle}}
 const gates=Array.from({length:12},(_,i)=>at(length*(i+1)/12));
 function start(){const p=at(28);return {x:p.x,y:p.y,heading:p.angle,motion:p.angle,v:70,nextGate:0,finished:false,elapsed:0}}
 function angleDiff(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b))}
 function step(prev,throttle,steer,dt=DT){
  const s={...prev};if(s.finished)return s;
  const road=nearest(s.x,s.y).distance<=WIDTH/2;
  const accel=[-95,-42,0,34,68][throttle+2];
  s.v=Math.max(0,Math.min(MAX_SPEED,s.v+(accel*(road||throttle<0?1:.55)-(road?0:s.v*.55+4))*dt));
  const desired=s.v/58*Math.tan(steer*.255),limit=(road?115:43)/Math.max(s.v,16);
  const yaw=Math.max(-limit,Math.min(limit,desired));
  s.heading+=yaw*dt;
  s.motion+=angleDiff(s.heading,s.motion)*Math.min(1,dt*(road?9:3));
  const oldX=s.x,oldY=s.y;
  s.x+=Math.cos(s.motion)*s.v*dt;s.y+=Math.sin(s.motion)*s.v*dt;
  if(s.x<80||s.x>1490||s.y<60||s.y>1470){s.x=Math.max(80,Math.min(1490,s.x));s.y=Math.max(60,Math.min(1470,s.y));s.v*=.5}
  const gate=gates[s.nextGate];
  if(gate){const tx=Math.cos(gate.angle),ty=Math.sin(gate.angle),before=(oldX-gate.x)*tx+(oldY-gate.y)*ty,after=(s.x-gate.x)*tx+(s.y-gate.y)*ty,cross=Math.abs((s.x-gate.x)*-ty+(s.y-gate.y)*tx);if(before<=0&&after>0&&cross<WIDTH*.72){s.nextGate++;if(s.nextGate===gates.length)s.finished=true}}
  s.elapsed+=dt;
  return s;
 }
 function simulate(state,throttle,steer){let s={...state};const samples=[{...s,offroad:nearest(s.x,s.y).distance>WIDTH/2}],count=Math.round(TURN/DT);let distance=0;for(let i=0;i<count;i++){const next=step(s,throttle,steer);distance+=Math.hypot(next.x-s.x,next.y-s.y);s=next;samples.push({...s,offroad:nearest(s.x,s.y).distance>WIDTH/2})}return {state:s,samples,distance,offroad:samples.some(p=>p.offroad)}}
 const api={DT,TURN,WIDTH,MAX_SPEED,track,length,gates,nearest,at,start,step,simulate,angleDiff};
 root.RacePhysics=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
