import RAPIER from '@dimforge/rapier3d-compat';
import './physics.js';
import './race.js';

const P=globalThis.RacePhysics,S=.1;
export const physicsStats={engine:'Rapier',version:null,steps:0,worlds:0,contacts:0};
let ready;
export function initializePhysics(){
 return ready??=(async()=>{await RAPIER.init();physicsStats.version=RAPIER.version();globalThis.Race.setContactEngine(states=>new ContactWorld(states));return physicsStats;})();
}
class ContactWorld{
 constructor(states){
  this.world=new RAPIER.World({x:0,y:0,z:0});this.world.timestep=P.DT;this.world.numSolverIterations=8;
  this.events=new RAPIER.EventQueue(true);this.lookup=new Map();
  this.bodies=states.map((s,i)=>{
   const desc=RAPIER.RigidBodyDesc.dynamic().setTranslation(s.x*S,.55,s.y*S).enabledTranslations(true,false,true).lockRotations().setCanSleep(false).setCcdEnabled(true);
   const body=this.world.createRigidBody(desc);
   const collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(2.08,.5,1.02).setFriction(.15).setRestitution(.02).setDensity(1).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
   this.lookup.set(collider.handle,i);return {body,collider};
  });physicsStats.worlds++;
 }
 resolve(previous,proposed){
  this.bodies.forEach(({body,collider},i)=>{
   const before=previous[i],next=proposed[i];collider.setEnabled(!before.finished);
   body.setTranslation({x:before.x*S,y:.55,z:before.y*S},true);
   body.setRotation({x:0,y:Math.sin(-next.heading/2),z:0,w:Math.cos(next.heading/2)},true);
   body.setLinvel({x:(next.x-before.x)*S/P.DT,y:0,z:(next.y-before.y)*S/P.DT},true);
  });
  this.world.step(this.events);physicsStats.steps++;
  const touched=new Set();
  this.events.drainCollisionEvents((a,b,started)=>{if(started){touched.add(this.lookup.get(a));touched.add(this.lookup.get(b));}});
  this.bodies.forEach(({collider},i)=>this.world.contactPairsWith(collider,other=>{touched.add(i);touched.add(this.lookup.get(other.handle));}));
  touched.delete(undefined);
  for(const i of touched){
   const {body}=this.bodies[i],s=proposed[i];if(previous[i].finished)continue;
   const point=body.translation(),velocity=body.linvel();s.x=point.x/S;s.y=point.z/S;
   s.v=Math.min(P.MAX_SPEED,Math.hypot(velocity.x,velocity.z)/S);
   if(s.v>.1)s.motion=Math.atan2(velocity.z,velocity.x);
   P.advanceGates(previous[i],s);
  }
  physicsStats.contacts+=touched.size;return touched;
 }
 dispose(){this.events.free();this.world.free();physicsStats.worlds--;}
}
