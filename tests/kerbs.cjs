const assert=require('node:assert/strict'),P=require('../src/physics.js');
(async()=>{
 const {createKerbGeometry}=await import('../src/kerbs.mjs');
 for(const course of P.courses){P.setCourse(course.id);
 for(const side of [-1,1]){
  const geometry=createKerbGeometry(P,side),position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),color=geometry.getAttribute('color');
  const tileCount=position.count/12;assert.ok(tileCount>P.track.length*.9&&tileCount<=P.track.length);
  const point=i=>[position.getX(i),position.getY(i),position.getZ(i)];
  for(let i=0;i<tileCount;i++){
   const current=i*12,next=((i+1)%tileCount)*12;
   assert.deepEqual(point(current+2),point(next+1),'Outer tile edges meet exactly, including the closing seam');
   assert.deepEqual(point(current+3),point(next),'Inner tile edges meet exactly');
   for(let j=0;j<4;j++){assert.ok(normal.getY(current+j)>.999,'Top faces point upwards');assert.ok(Number.isFinite(color.getX(current+j)));}
   const a=point(current),b=point(current+1),c=point(current+2),d=point(current+3);
   const area=(a,b,c)=>(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
   assert.ok(area(a,b,c)>0&&area(a,c,d)>0,'Every tile has two non-degenerate upward triangles');
   // A convex tile lies entirely on its own side of each shared end edge.
   const end=point(next+2);
   const turn=(u,v,w)=>(v[0]-u[0])*(w[2]-u[2])-(v[2]-u[2])*(w[0]-u[0]);
   assert.ok(turn(c,d,a)*turn(c,d,end)<=0,'Adjacent top surfaces do not overlap');
  }
  const tiles=Array.from({length:tileCount},(_,i)=>[0,1,2,3].map(j=>{const p=point(i*12+j);return [p[0],p[2]];}));
  function overlaps(a,b){
   for(const polygon of [a,b])for(let i=0;i<4;i++){
    const u=polygon[i],v=polygon[(i+1)%4],x=u[1]-v[1],z=v[0]-u[0],project=p=>p[0]*x+p[1]*z;
    const aa=a.map(project),bb=b.map(project);
    if(Math.min(...aa)>=Math.max(...bb)-1e-6||Math.min(...bb)>=Math.max(...aa)-1e-6)return false;
   }
   return true;
  }
  for(let i=0;i<tileCount;i++)for(let j=i+2;j<tileCount;j++)if(!(i===0&&j===tileCount-1))assert.equal(overlaps(tiles[i],tiles[j]),false,'Non-adjacent tiles do not fold over each other');
  geometry.dispose();
 }
 }
 P.setCourse('forest');
 console.log('PASS: all three courses have closed kerb seams, upward faces and no overlapping kerb tiles');
})().catch(error=>{console.error(error);process.exitCode=1;});
