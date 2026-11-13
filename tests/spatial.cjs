// Compare the acceleration structure against the original exhaustive projection.
const assert=require('node:assert/strict'),P=require('../src/physics.js');
function exhaustive(x,y){let best={distance:Infinity};P.track.forEach((p,index)=>{const u=Math.max(0,Math.min(1,((x-p.x)*p.dx+(y-p.y)*p.dy)/(p.len*p.len))),px=p.x+u*p.dx,py=p.y+u*p.dy,distance=Math.hypot(x-px,y-py);if(distance<best.distance)best={distance,x:px,y:py,s:p.s+p.len*u,angle:p.angle,index};});return best;}
let seed=83;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
for(let i=0;i<10000;i++){const x=random()*2300-350,y=random()*2200-350;assert.deepEqual(P.nearest(x,y),exhaustive(x,y));}
for(const p of P.track)assert.deepEqual(P.nearest(p.x,p.y),exhaustive(p.x,p.y));
for(const distance of [-P.length,-1,0,28,P.length/2,P.length,P.length*2]){const s=(distance%P.length+P.length)%P.length;let p=P.track[0];for(const q of P.track){if(q.s>s)break;p=q;}const u=(s-p.s)/p.len;assert.deepEqual(P.at(distance),{x:p.x+p.dx*u,y:p.y+p.dy*u,angle:p.angle});}
console.log('PASS: exact BVH projection at 10,000 random points and every track vertex; wrapped track lookup');
