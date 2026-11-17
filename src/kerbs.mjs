import * as THREE from 'three';

// Adjacent tiles use exactly the same cross-section. Independent overlapping
// boxes put two differently coloured top faces at the same depth on bends.
export function createKerbGeometry(P,side){
 const center=P.track.map((p,i)=>{
  const previous=P.track[(i+P.track.length-1)%P.track.length];
  const nx=-Math.sin(previous.angle)-Math.sin(p.angle),nz=Math.cos(previous.angle)+Math.cos(p.angle),length=Math.hypot(nx,nz);
  const x=nx/length,z=nz/length,miter=1/(x*-Math.sin(p.angle)+z*Math.cos(p.angle));
  const offset=side*(P.WIDTH/2+3.7)*.1*miter;return {x:p.x*.1+x*offset,z:p.y*.1+z*offset,s:p.s};
 });
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const sections=()=>center.map((p,i)=>{
  const previous=center[(i+center.length-1)%center.length],next=center[(i+1)%center.length];
  const before=Math.atan2(p.z-previous.z,p.x-previous.x),after=Math.atan2(next.z-p.z,next.x-p.x);
  const nx=-Math.sin(before)-Math.sin(after),nz=Math.cos(before)+Math.cos(after),length=Math.hypot(nx,nz);
  const x=nx/length,z=nz/length,miter=Math.min(2,1/(x*-Math.sin(after)+z*Math.cos(after)));
  return [-.375,.375].map(offset=>[p.x+x*offset*miter,p.z+z*offset*miter]);
 });
 // The inside offset of a tight bend can briefly double back. Join across
 // those tiny folds rather than drawing overlapping tiles at the apex.
 let edges;
 for(let pass=0;pass<P.track.length;pass++){
  edges=sections();let folded=-1;
  for(let i=0;i<edges.length;i++){
   const [a,b]=edges[i],[c,d]=edges[(i+1)%edges.length],[e]=edges[(i+2)%edges.length];
   if(cross(a,b,d)>=-1e-7||cross(a,d,c)>=-1e-7||cross(c,d,a)*cross(c,d,e)>1e-8){folded=(i+1)%edges.length;break;}
  }
  if(folded<0)break;
  center.splice(folded,1);
 }
 const positions=[],colors=[],indices=[];
 function face(points,color){const base=positions.length/3;for(const p of points){positions.push(...p);colors.push(color.r,color.g,color.b);}indices.push(base,base+1,base+2,base,base+2,base+3);}
 for(let i=0;i<edges.length;i++){
  const [a,b]=edges[i],[c,d]=edges[(i+1)%edges.length],color=new THREE.Color(Math.floor(center[i].s/22)%2?'#d2d5bf':'#b94c35');
  face([[a[0],.135,a[1]],[b[0],.135,b[1]],[d[0],.135,d[1]],[c[0],.135,c[1]]],color);
  face([[a[0],.015,a[1]],[a[0],.135,a[1]],[c[0],.135,c[1]],[c[0],.015,c[1]]],color);
  face([[b[0],.135,b[1]],[b[0],.015,b[1]],[d[0],.015,d[1]],[d[0],.135,d[1]]],color);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
