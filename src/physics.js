/* The preview and the executed turn use this same deterministic simulation. */
(function(root){
 'use strict';
 const DT=1/60, TURN=1.2, MAX_SPEED=215;
 const courses=root.RaceCourses||(typeof require==='function'?require('./courses.js'):null),cache=new Map();
 let course,track,length,spatial,gates,bounds,WIDTH;
 function setCourse(id){
  const selected=courses.find(c=>c.id===id);if(!selected)throw new Error(`Unknown course: ${id}`);
  if(course===selected)return;
  course=selected;WIDTH=course.width;
  if(cache.has(id)){({track,length,spatial,gates,bounds}=cache.get(id));return;}
  const anchors=course.anchors;track=[];
 for(let i=0;i<anchors.length;i++)for(let j=0;j<28;j++){
  const t=j/28,t2=t*t,t3=t2*t,p0=anchors[(i-1+anchors.length)%anchors.length],p1=anchors[i],p2=anchors[(i+1)%anchors.length],p3=anchors[(i+2)%anchors.length];
  const axis=k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3);
  track.push({x:axis(0),y:axis(1),s:0});
 }
 length=0;
 track.forEach((p,i)=>{p.s=length;const q=track[(i+1)%track.length];p.dx=q.x-p.x;p.dy=q.y-p.y;p.len=Math.hypot(p.dx,p.dy);length+=p.len;p.angle=Math.atan2(p.dy,p.dx)});
 // Static segment BVH: exact projections, but only nearby segments are visited.
 // Keep original segment indices to preserve the tie at shared endpoints.
 function node(indices){
  const b={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(const i of indices){const p=track[i],q=track[(i+1)%track.length];b.minX=Math.min(b.minX,p.x,q.x);b.minY=Math.min(b.minY,p.y,q.y);b.maxX=Math.max(b.maxX,p.x,q.x);b.maxY=Math.max(b.maxY,p.y,q.y);}
  if(indices.length<=8)b.indices=indices;
  else{const axis=b.maxX-b.minX>b.maxY-b.minY?'x':'y';indices.sort((i,j)=>track[i][axis]-track[j][axis]);const middle=indices.length>>1;b.left=node(indices.slice(0,middle));b.right=node(indices.slice(middle));}
  return b;
 }
 spatial=node(track.map((_,i)=>i));
 gates=Array.from({length:12},(_,i)=>at(length*(i+1)/12));
 bounds={minX:Math.min(...track.map(p=>p.x))-WIDTH,maxX:Math.max(...track.map(p=>p.x))+WIDTH,minY:Math.min(...track.map(p=>p.y))-WIDTH,maxY:Math.max(...track.map(p=>p.y))+WIDTH};
 cache.set(id,{track,length,spatial,gates,bounds});
 }
 function nearest(x,y){
  let distance=Infinity,index=Infinity,bx=0,by=0,bu=0;
  const bound=b=>{const dx=Math.max(b.minX-x,0,x-b.maxX),dy=Math.max(b.minY-y,0,y-b.maxY);return dx*dx+dy*dy;};
  function visit(b){
   if(bound(b)>distance*distance+1e-9)return;
   if(b.indices){for(const i of b.indices){const p=track[i],u=Math.max(0,Math.min(1,((x-p.x)*p.dx+(y-p.y)*p.dy)/(p.len*p.len))),px=p.x+u*p.dx,py=p.y+u*p.dy,d=Math.hypot(x-px,y-py);if(d<distance||(d===distance&&i<index)){distance=d;index=i;bx=px;by=py;bu=u;}}}
   else if(bound(b.left)<bound(b.right)){visit(b.left);visit(b.right);}else{visit(b.right);visit(b.left);}
  }
  visit(spatial);const p=track[index];return {distance,x:bx,y:by,s:p.s+p.len*bu,angle:p.angle,index};
 }
 function at(s){s=(s%length+length)%length;let low=0,high=track.length;while(low+1<high){const mid=(low+high)>>1;if(track[mid].s<=s)low=mid;else high=mid;}const p=track[low],u=(s-p.s)/p.len;return {x:p.x+p.dx*u,y:p.y+p.dy*u,angle:p.angle}}
 function start(){const p=at(28);return {x:p.x,y:p.y,heading:p.angle,motion:p.angle,v:0,nextGate:0,finished:false,elapsed:0}}
 function angleDiff(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b))}
 function advanceGates(prev,s){
  s.nextGate=prev.nextGate;s.finished=prev.finished;
  const gate=gates[s.nextGate];
  if(gate){const tx=Math.cos(gate.angle),ty=Math.sin(gate.angle),before=(prev.x-gate.x)*tx+(prev.y-gate.y)*ty,after=(s.x-gate.x)*tx+(s.y-gate.y)*ty,cross=Math.abs((s.x-gate.x)*-ty+(s.y-gate.y)*tx);if(before<=0&&after>0&&cross<WIDTH*.72){s.nextGate++;if(s.nextGate===gates.length)s.finished=true}}
  return s;
 }
 function step(prev,throttle,steer,dt=DT){
  const s={...prev};if(s.finished)return s;
  const road=nearest(s.x,s.y).distance<=WIDTH/2;
  const accel=[-95,-42,0,34,68][throttle+2];
  s.v=Math.max(0,Math.min(MAX_SPEED,s.v+(accel*(road||throttle<0?1:.55)-(road?0:s.v*.55+4))*dt));
  const desired=s.v/58*Math.tan(steer*.255),limit=(road?115:43)/Math.max(s.v,16);
  const yaw=Math.max(-limit,Math.min(limit,desired));
  s.heading+=yaw*dt;
  s.motion+=angleDiff(s.heading,s.motion)*Math.min(1,dt*(road?9:3));
  s.x+=Math.cos(s.motion)*s.v*dt;s.y+=Math.sin(s.motion)*s.v*dt;
  if(s.x<80||s.x>1490||s.y<60||s.y>1470){s.x=Math.max(80,Math.min(1490,s.x));s.y=Math.max(60,Math.min(1470,s.y));s.v*=.5}
  advanceGates(prev,s);
  s.elapsed+=dt;
  return s;
 }
 function simulate(state,throttle,steer){let s={...state};const samples=[{...s,offroad:nearest(s.x,s.y).distance>WIDTH/2}],count=Math.round(TURN/DT);let distance=0;for(let i=0;i<count;i++){const next=step(s,throttle,steer);distance+=Math.hypot(next.x-s.x,next.y-s.y);s=next;samples.push({...s,offroad:nearest(s.x,s.y).distance>WIDTH/2})}return {state:s,samples,distance,offroad:samples.some(p=>p.offroad)}}
 setCourse('forest');
 const api={DT,TURN,MAX_SPEED,courses,setCourse,get course(){return course;},get WIDTH(){return WIDTH;},get track(){return track;},get length(){return length;},get gates(){return gates;},get bounds(){return bounds;},nearest,at,start,step,simulate,angleDiff,advanceGates};
 root.RacePhysics=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
