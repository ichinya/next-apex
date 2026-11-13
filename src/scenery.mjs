import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const S=.1;
export const CAR_URL=`${import.meta.env.BASE_URL}assets/blender/41bd9781-8e6b-4535-89a1-3876273f0b20/model.glb`;
function randomGenerator(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function standard(color,options={}){return new THREE.MeshStandardMaterial({color,roughness:.9,...options});}
function texture(seed,base,kind){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),random=randomGenerator(seed);
 c.fillStyle=base;c.fillRect(0,0,256,256);
 for(let i=0;i<8000;i++){c.fillStyle=random()>.5?'#ecdfb416':'#12221b20';const size=kind==='grass'?2+random()*4:1+random()*2;c.fillRect(random()*256,random()*256,size,size);}
 const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
}
function ribbon(P,width,material,height){
 const positions=[],uv=[],indices=[];
 for(let i=0;i<=P.track.length;i++){
  const p=P.track[i%P.track.length],s=i===P.track.length?P.length:p.s;
  for(const side of [1,-1]){positions.push((p.x-Math.sin(p.angle)*width/2*side)*S,height,(p.y+Math.cos(p.angle)*width/2*side)*S);uv.push(s*S/9,side===1?0:1);}
  if(i<P.track.length){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
 const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;return mesh;
}
function instances(scene,geometry,material,count){const m=new THREE.InstancedMesh(geometry,material,count);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
export async function createScenery(P,racers){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#8b9e78');
 const groundMap=texture(4451,'#647345','grass');groundMap.repeat.set(55,55);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(260,250),standard('#ffffff',{map:groundMap}));ground.rotation.x=-Math.PI/2;ground.position.set(80,-.05,75);ground.receiveShadow=true;scene.add(ground);
 const gravelMap=texture(72,'#9b967a','gravel');
 scene.add(ribbon(P,P.WIDTH+40,standard('#c3bda4',{map:gravelMap}),.005));
 scene.add(ribbon(P,P.WIDTH,standard('#ffffff',{map:texture(812,'#465052','asphalt')}),.035));
 for(const side of [-1,1]){
  const n=P.track.length,kerbs=instances(scene,new THREE.BoxGeometry(1,.12,.75),standard('#ffffff'),n),o=new THREE.Object3D();
  for(let i=0;i<n;i++){const p=P.track[i],q=P.track[(i+1)%n],offset=side*(P.WIDTH/2+3.7);o.position.set(((p.x+q.x)/2-Math.sin(p.angle)*offset)*S,.075,((p.y+q.y)/2+Math.cos(p.angle)*offset)*S);o.rotation.y=-p.angle;o.scale.set(p.len*S+.025,1,1);o.updateMatrix();kerbs.setMatrixAt(i,o.matrix);kerbs.setColorAt(i,new THREE.Color(Math.floor(p.s/22)%2?'#d2d5bf':'#b94c35'));}
  kerbs.castShadow=false;
 }
 // Guardrails and posts form two inexpensive instanced draws per side.
 for(const side of [-1,1]){
  const count=Math.ceil(P.length/27),rails=instances(scene,new THREE.BoxGeometry(1,.25,.13),standard('#9da9a0',{metalness:.6,roughness:.5}),count),posts=instances(scene,new THREE.BoxGeometry(.12,.74,.14),standard('#5c6d64',{metalness:.5}),count),o=new THREE.Object3D();
  for(let i=0;i<count;i++){const p=P.at(i*P.length/count),q=P.at((i+1)*P.length/count),offset=87*side;const x=((p.x+q.x)/2-Math.sin(p.angle)*offset)*S,z=((p.y+q.y)/2+Math.cos(p.angle)*offset)*S;o.position.set(x,.65,z);o.rotation.y=-p.angle;o.scale.set(Math.hypot(q.x-p.x,q.y-p.y)*S+.06,1,1);o.updateMatrix();rails.setMatrixAt(i,o.matrix);o.position.set((p.x-Math.sin(p.angle)*offset)*S,.37,(p.y+Math.cos(p.angle)*offset)*S);o.scale.set(1,1,1);o.updateMatrix();posts.setMatrixAt(i,o.matrix);}
 }
 const start=P.at(0),checks=instances(scene,new THREE.BoxGeometry(.6,.012,.94),standard('#ffffff'),36),o=new THREE.Object3D();
 let k=0;for(let row=0;row<3;row++)for(let col=0;col<12;col++){const x=row*.6-.9,z=col*.94-5.17;o.position.set(start.x*S+Math.cos(start.angle)*x-Math.sin(start.angle)*z,.05,start.y*S+Math.sin(start.angle)*x+Math.cos(start.angle)*z);o.rotation.y=-start.angle;o.updateMatrix();checks.setMatrixAt(k,o.matrix);checks.setColorAt(k++,new THREE.Color((row+col)%2?'#25312f':'#e0e0c8'));}checks.castShadow=false;
 // Direction arrows are painted into the road, rather than floating UI.
 const arrowShape=new THREE.Shape();arrowShape.moveTo(-.7,-.55);arrowShape.lineTo(0,0);arrowShape.lineTo(-.7,.55);arrowShape.lineTo(-.5,.7);arrowShape.lineTo(.35,0);arrowShape.lineTo(-.5,-.7);arrowShape.closePath();
 const arrowGeo=new THREE.ShapeGeometry(arrowShape);arrowGeo.rotateX(-Math.PI/2);
 for(let s=150;s<P.length;s+=310){const p=P.at(s),arrow=new THREE.Mesh(arrowGeo,new THREE.MeshBasicMaterial({color:'#c7cfb3',transparent:true,opacity:.35,depthWrite:false}));arrow.position.set(p.x*S,.052,p.y*S);arrow.rotation.y=-p.angle;scene.add(arrow);}
 // A mixed, volumetric canopy with individual trunks and three crown layers.
 const random=randomGenerator(14351),trees=[];
 for(let i=0;i<3100;i++){const x=random()*2300-350,z=random()*2200-350,r=18+random()*21;if(P.nearest(x,z).distance<105+r*.8)continue;trees.push({x:x*S,z:z*S,r:r*S,h:3.2+random()*4.5,pine:random()<.24,tint:random()});}
 const trunks=instances(scene,new THREE.CylinderGeometry(.17,.26,1,7),standard('#53432e'),trees.length),crowns=[];
 for(let layer=0;layer<3;layer++)crowns.push(instances(scene,new THREE.IcosahedronGeometry(1,1),standard('#ffffff',{flatShading:true}),trees.length));
 const greens=['#4c7138','#5e7e3e','#78934e','#3d653c','#7b8b49'];
 trees.forEach((t,i)=>{
  o.position.set(t.x,t.h*.35,t.z);o.rotation.set(0,t.tint*6,0);o.scale.set(1,t.h*.7,1);o.updateMatrix();trunks.setMatrixAt(i,o.matrix);
  crowns.forEach((c,layer)=>{const size=t.r*(1-layer*.19);o.position.set(t.x+(layer-1)*t.r*.18,t.h*.55+layer*t.h*.20,t.z+Math.sin(i)*layer*.25);o.scale.set(size,size*(t.pine?1.25:.72),size*.88);o.updateMatrix();c.setMatrixAt(i,o.matrix);c.setColorAt(i,new THREE.Color(greens[(Math.floor(t.tint*5)+layer)%greens.length]));});
 });
 const rocks=[];for(let i=0;i<110;i++){const x=150+random()*1250,z=100+random()*1250;if(P.nearest(x,z).distance<100)continue;rocks.push({x:x*S,z:z*S,scale:.3+random()*.65});}
 const rockMesh=instances(scene,new THREE.DodecahedronGeometry(1,0),standard('#8a8d76',{flatShading:true}),rocks.length);rocks.forEach((r,i)=>{o.position.set(r.x,r.scale*.35,r.z);o.scale.set(r.scale,r.scale*.65,r.scale*.8);o.rotation.set(i*.3,i*.7,0);o.updateMatrix();rockMesh.setMatrixAt(i,o.matrix);});
 const sun=new THREE.DirectionalLight('#fff1c9',2.8);sun.position.set(30,90,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=sun.shadow.camera.bottom=-65;sun.shadow.camera.right=sun.shadow.camera.top=65;sun.shadow.camera.near=1;sun.shadow.camera.far=220;sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;sun.shadow.radius=3;scene.add(sun,sun.target);
 scene.add(new THREE.HemisphereLight('#d8e8ed','#5b593d',2.5));
 const carAsset=await new GLTFLoader().loadAsync(CAR_URL),models=[];
 for(const racer of racers){
  const model=carAsset.scene.clone(true);model.name=`car-${racer.id}`;
  const materials=new Map();model.traverse(mesh=>{if(!mesh.isMesh)return;mesh.castShadow=mesh.receiveShadow=true;const original=mesh.material;if(!materials.has(original)){const m=original.clone();if(m.name==='rally_paint')m.color.set(racer.id==='player'?'#1472bc':racer.color);if(m.name==='headlights'){m.emissive.set('#e9d799');m.emissiveIntensity=.4;}materials.set(original,m);}mesh.material=materials.get(original);});
  const wheels=[];model.traverse(node=>{if(node.name.startsWith('wheel_front'))wheels.push({node,base:node.quaternion.clone()});});
  scene.add(model);models.push({model,wheels});
 }
 const marker=new THREE.Mesh(new THREE.RingGeometry(2.55,2.66,48),new THREE.MeshBasicMaterial({color:'#9cddff',transparent:true,opacity:.9,depthWrite:false,depthTest:false}));marker.rotation.x=-Math.PI/2;marker.renderOrder=12;scene.add(marker);
 const gateGroup=new THREE.Group(),gateMaterial=standard('#b9e377',{emissive:'#45531c',emissiveIntensity:.2});
 for(const side of [-1,1]){const cone=new THREE.Mesh(new THREE.ConeGeometry(.25,.65,6),gateMaterial);cone.position.set(0,.35,side*5.95);gateGroup.add(cone);}scene.add(gateGroup);
 return {scene,models,sun,marker,gateGroup,treeCount:trees.length,modelURL:CAR_URL};
}
