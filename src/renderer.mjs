import * as THREE from 'three';
import {EffectComposer,RenderPass,EffectPass,ToneMappingEffect,ToneMappingMode,SMAAEffect,SMAAPreset,BloomEffect,VignetteEffect} from 'postprocessing';
import {N8AOPostPass} from 'n8ao';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {createScenery} from './scenery.mjs';
import {RaceEffects} from './effects.mjs';
const S=.1;
export class RaceRenderer{
 static async create(canvas,P,racers){const view=new RaceRenderer(canvas,P);Object.assign(view,await createScenery(P,racers));view.finishSetup(racers);return view;}
 constructor(canvas,P){
  this.P=P;this.canvas=canvas;this.width=1;this.height=1;this.frames=0;this.renderMilliseconds=0;
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',stencil:false});this.pixelRatio=Math.min(devicePixelRatio||1,1);this.renderer.setPixelRatio(this.pixelRatio);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NoToneMapping;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.info.autoReset=false;this.dirty=true;this.cameraMoving=true;this.slowFrames=0;
  this.camera=new THREE.OrthographicCamera(-40,40,30,-30,.1,350);this.target={x:40,y:82,z:1};this.predictions=new THREE.Group();this.labels=[];
 }
 finishSetup(racers){
  this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.autoUpdate=false;this.sun.shadow.needsUpdate=true;
  this.scene.add(this.predictions);this.composer=new EffectComposer(this.renderer,{frameBufferType:THREE.HalfFloatType,multisampling:0});this.composer.addPass(new RenderPass(this.scene,this.camera));
  this.ao=new N8AOPostPass(this.scene,this.camera,960,600);this.ao.setQualityMode('Low');this.ao.configuration.aoRadius=.9;this.ao.configuration.intensity=1.65;this.ao.configuration.distanceFalloff=1;this.ao.configuration.halfRes=true;this.ao.configuration.gammaCorrection=false;this.composer.addPass(this.ao);
  this.composer.addPass(new EffectPass(this.camera,new BloomEffect({intensity:.12,luminanceThreshold:1.2,mipmapBlur:true}),new ToneMappingEffect({mode:ToneMappingMode.ACES_FILMIC}),new VignetteEffect({darkness:.22,offset:.35}),new SMAAEffect({preset:SMAAPreset.MEDIUM})));
  this.effects=new RaceEffects(this.scene,racers.length);
  this.layer=document.createElement('div');this.layer.className='racer-label-layer';this.canvas.parentElement.appendChild(this.layer);
  racers.forEach(r=>{const label=document.createElement('span');label.className='racer-label';label.textContent=r.name;label.style.color=r.color;this.layer.appendChild(label);this.labels.push(label);});
  this.badges=[1,2].map(n=>{const label=document.createElement('span');label.className='prediction-badge';label.textContent=n;this.layer.appendChild(label);return label;});
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.canvas);this.resize();
 }
 resize(){const box=this.canvas.getBoundingClientRect();this.width=Math.max(1,box.width);this.height=Math.max(1,box.height);this.renderer.setSize(this.width,this.height,false);this.composer.setSize(this.width,this.height);this.predictions.traverse(o=>{if(o.material?.resolution)o.material.resolution.set(this.width,this.height);});this.invalidate();}
 invalidate(){this.dirty=true;this.cameraMoving=true;}
 needsDraw(session){return !!session.animation||this.dirty||this.cameraMoving||this.effects.stats.particles>0;}
 setForecast(first,second){
  if(this.first===first&&this.second===second)return;
  this.invalidate();
  this.first=first;this.second=second;
  this.predictions.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.predictions.clear();
  [first,second].forEach((path,index)=>{
   if(!path)return;
   const draw=(samples,offroad)=>{
    if(samples.length<2)return;
    const material=new LineMaterial({color:offroad?'#f5b76f':index?'#b7e4ed':'#d7ff85',transparent:true,opacity:index?.43:.95,linewidth:index?2:2.8,dashed:true,dashSize:index?.28:.8,gapSize:index?.5:.55,depthTest:false,depthWrite:false});material.resolution.set(this.width,this.height);
    const line=new Line2(new LineGeometry().setPositions(samples.flatMap(s=>[s.x*S,.18,s.y*S])),material);line.computeLineDistances();line.renderOrder=10;this.predictions.add(line);
   };
   let run=[path.samples[0]],offroad=path.samples[0].offroad;
   for(let i=1;i<path.samples.length;i++){const s=path.samples[i];if(s.offroad!==offroad){run.push(s);draw(run,offroad);run=[s];offroad=s.offroad;}else run.push(s);}draw(run,offroad);
   const end=path.state,points=[[-2.1,.15,-1.0],[2.1,.15,-1.0],[2.1,.15,1.0],[-2.1,.15,1.0]].map(p=>new THREE.Vector3(...p));
   const ghost=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:path.offroad?'#efbb7d':index?'#b7e4ed':'#d7ff85',transparent:true,opacity:index?.3:.7,depthTest:false}));ghost.position.set(end.x*S,0,end.y*S);ghost.rotation.y=-end.heading;ghost.renderOrder=11;this.predictions.add(ghost);
  });
 }
 project(x,y,z){return new THREE.Vector3(x,y,z).project(this.camera);}
 labelAt(label,x,y,z,dx=0,dy=0){const p=this.project(x,y,z);label.style.transform=`translate(${(p.x*.5+.5)*this.width+dx}px,${(-p.y*.5+.5)*this.height+dy}px) translate(-50%,-100%)`;label.hidden=p.x<-1.1||p.x>1.1||p.y<-1.1||p.y>1.1;}
 draw(session,delta){
  const visual=session.visuals[0],a=session.animation,first=a?a.result.paths[0]:session.forecast,second=a?a.continuation:session.second;
  const aim=globalThis.RacePlanning.cameraTarget(visual,first,second,session.racers,this.width,this.height,session.overview),smooth=1-Math.exp(-delta*5);
  if(!this.started){this.target={x:aim.x*S,y:aim.y*S,z:aim.z};this.started=true;}
  this.target.x+=(aim.x*S-this.target.x)*smooth;this.target.y+=(aim.y*S-this.target.y)*smooth;this.target.z+=(aim.z-this.target.z)*smooth;
  this.cameraMoving=Math.abs(aim.x*S-this.target.x)+Math.abs(aim.y*S-this.target.y)>.002||Math.abs(aim.z-this.target.z)>.0001;
  if(!this.cameraMoving){this.target.x=aim.x*S;this.target.y=aim.y*S;this.target.z=aim.z;}
  const c=this.camera,z=this.target.z;c.left=-this.width*S/(2*z);c.right=-c.left;c.top=this.height*S/(2*z);c.bottom=-c.top;c.updateProjectionMatrix();c.position.set(this.target.x,95,this.target.y+62);c.lookAt(this.target.x,0,this.target.y);c.updateMatrixWorld();
  this.sun.position.set(this.target.x-36,90,this.target.y-25);this.sun.target.position.set(this.target.x,0,this.target.y);
  this.sun.shadow.needsUpdate=!!a||this.cameraMoving||this.dirty;
  session.visuals.forEach((s,i)=>{const {model,wheels}=this.models[i];model.position.set(s.x*S,.035,s.y*S);model.rotation.y=-s.heading;for(const wheel of wheels)wheel.node.quaternion.copy(wheel.base).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),a?-(a.result.racers[i].action.steer)*.16:0));this.labelAt(this.labels[i],s.x*S,2.1,s.y*S,0,-2);});
  this.marker.position.set(visual.x*S,.1,visual.y*S);this.marker.material.opacity=session.overview?.95:.55;
  const gate=this.P.gates[Math.min(session.state.nextGate,11)];this.gateGroup.visible=!session.state.finished;this.gateGroup.position.set(gate.x*S,0,gate.y*S);this.gateGroup.rotation.y=-gate.angle;
  this.predictions.visible=!a&&!session.state.finished;
  this.badges.forEach((badge,i)=>{const path=i?this.second:this.first;if(!path||!this.predictions.visible){badge.hidden=true;return;}badge.style.color=path.offroad?'#efbb7d':i?'#b7e4ed':'#d7ff85';this.labelAt(badge,path.state.x*S,.3,path.state.y*S,i?32:15,-8);});
  this.effects.update(delta,session.visuals,!!a);this.renderer.info.reset();const start=performance.now();this.composer.render(delta);this.renderMilliseconds=performance.now()-start;this.frames++;this.dirty=false;
  // Sustained missed frames lower only the render resolution, never simulation
  // time or turn duration. Keep AO and the full 3D scene on every device.
  if(a&&delta>.028)this.slowFrames++;else this.slowFrames=Math.max(0,this.slowFrames-2);
  if(this.slowFrames>=24&&this.pixelRatio>.65){this.pixelRatio=Math.max(.65,this.pixelRatio*.8);this.renderer.setPixelRatio(this.pixelRatio);this.resize();this.slowFrames=0;}
  return {aim,playerScreenX:(this.project(visual.x*S,0,visual.y*S).x*.5+.5)*this.width};
 }
 get stats(){return {engine:'Three.js',revision:THREE.REVISION,modelURL:this.modelURL,cars:this.models.length,trees:this.treeCount,forestChunks:this.forestChunks,carMeshes:this.carMeshes,pixelRatio:this.pixelRatio,postprocessing:this.composer.passes.length,ambientOcclusion:this.ao.enabled,particles:this.effects.stats,frames:this.frames,renderMilliseconds:Math.round(this.renderMilliseconds*10)/10,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles};}
}
