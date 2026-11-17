import * as THREE from 'three';
import {BatchedRenderer,ParticleSystem,ConstantValue,IntervalValue,ConstantColor,ConeEmitter,SphereEmitter,RenderMode,ColorOverLife,Gradient,SizeOverLife,PiecewiseBezier,Bezier} from 'three.quarks';

function particleTexture(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),radial=g.createRadialGradient(32,32,0,32,32,32);radial.addColorStop(0,'#fff');radial.addColorStop(.35,'#ffffffe0');radial.addColorStop(1,'#ffffff00');g.fillStyle=radial;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
export class RaceEffects{
 constructor(scene,count){
  this.batch=new BatchedRenderer();scene.add(this.batch);this.dust=[];this.texture=particleTexture();this.emittedFrames=0;
  for(let i=0;i<count;i++){
   const rate=new ConstantValue(0),system=new ParticleSystem({duration:2,looping:true,worldSpace:true,startLife:new IntervalValue(.7,1.3),startSpeed:new IntervalValue(.4,1.4),startSize:new IntervalValue(.25,.65),startColor:new ConstantColor(new THREE.Vector4(.8,.7,.5,.3)),emissionOverTime:rate,shape:new ConeEmitter({radius:.4,angle:.7}),material:new THREE.MeshBasicMaterial({map:this.texture,transparent:true,depthWrite:false}),renderMode:RenderMode.BillBoard,behaviors:[new ColorOverLife(new Gradient([[new THREE.Vector3(.75,.66,.45),0],[new THREE.Vector3(.85,.77,.59),1]],[[0,0],[.3,.1],[0,1]])),new SizeOverLife(new PiecewiseBezier([[new Bezier(.5,.8,1.2,1.5),0]]))]});
   system.emitter.rotation.x=-Math.PI/2;scene.add(system.emitter);this.batch.addSystem(system);this.dust.push({rate,system});
  }
  this.sparkRate=new ConstantValue(0);this.sparks=new ParticleSystem({duration:1,looping:true,worldSpace:true,startLife:new IntervalValue(.12,.4),startSpeed:new IntervalValue(2,5),startSize:new IntervalValue(.035,.12),emissionOverTime:this.sparkRate,shape:new SphereEmitter({radius:.25}),material:new THREE.MeshBasicMaterial({map:this.texture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),renderMode:RenderMode.BillBoard,behaviors:[new ColorOverLife(new Gradient([[new THREE.Vector3(1,.68,.16),0],[new THREE.Vector3(1,.2,.02),1]],[[.9,0],[0,1]]))]});scene.add(this.sparks.emitter);this.batch.addSystem(this.sparks);
 }
 update(delta,states,moving){
  let collision=null;
  states.forEach((s,i)=>{const {rate,system}=this.dust[i];rate.value=moving&&s.offroad&&s.v>5?Math.min(40,s.v*.25):0;if(rate.value)this.emittedFrames++;system.emitter.position.set(s.x*.1-Math.cos(s.heading)*1.7,.25,s.y*.1-Math.sin(s.heading)*1.7);if(moving&&s.contact)collision=s;});
  this.sparkRate.value=collision?65:0;if(collision){this.sparks.emitter.position.set(collision.x*.1,.45,collision.y*.1);this.emittedFrames++;}
  this.batch.update(delta);
 }
 get stats(){return {library:'three.quarks',systems:this.dust.length+1,particles:this.dust.reduce((sum,d)=>sum+d.system.particleNum,0)+this.sparks.particleNum,emittedFrames:this.emittedFrames};}
 dispose(){for(const system of [...this.dust.map(d=>d.system),this.sparks]){system.material.dispose();system.dispose();}this.texture.dispose();}
}
