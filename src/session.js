(function(root){
 'use strict';
 const P=root.RacePhysics,R=root.Race,T=root.RacePlanning;
 class RaceSession{
  constructor(best=null){this.best=best;this.reset();}
  get state(){return this.racers[0].state;}
  predict(){const p=T.predict(this.state,this.throttle,this.steer);this.forecast=p.first;this.second=p.second;}
  select(type,value){if(this.animation||this.state.finished||!['throttle','steer'].includes(type)||!Number.isInteger(value)||Math.abs(value)>2)return false;this[type]=value;this.predict();return true;}
  commit(clock=()=>0){
   if(this.animation||this.state.finished)return false;
   const result=R.simulate(this.racers,{throttle:this.throttle,steer:this.steer});
   this.animation={result,start:clock(),duration:P.TURN*1000,continuation:result.paths[0].state.finished?null:P.simulate(result.paths[0].state,0,0)};return true;
  }
  advance(now){
   if(!this.animation)return false;
   const a=this.animation,t=Math.min(1,Math.max(0,(now-a.start)/a.duration));
   this.visuals=a.result.paths.map(path=>{const f=t*(path.samples.length-1),i=Math.min(path.samples.length-2,Math.floor(f)),u=f-i,p=path.samples[i],q=path.samples[i+1];return {...p,x:p.x+(q.x-p.x)*u,y:p.y+(q.y-p.y)*u,v:p.v+(q.v-p.v)*u,heading:p.heading+P.angleDiff(q.heading,p.heading)*u};});
   if(t<1)return false;
   this.review=T.review(this.racers,a.result,++this.turns);this.racers=a.result.racers;this.visuals=this.racers.map(r=>({...r.state}));this.animation=null;
   if(this.state.finished&&(!this.best||this.turns<this.best))this.best=this.turns;
   this.predict();return true;
  }
  reset(){if(this.animation)return false;this.racers=R.grid();this.visuals=this.racers.map(r=>({...r.state}));this.throttle=1;this.steer=0;this.turns=0;this.review=null;this.animation=null;this.overview=false;this.predict();return true;}
 }
 root.RaceSession=RaceSession;if(typeof module!=='undefined')module.exports=RaceSession;
})(typeof window!=='undefined'?window:globalThis);
