import {ZZFX} from 'zzfx';
export class RaceSound{
 constructor(){this.enabled=true;this.cuesPlayed=0;this.active=new Set();ZZFX.volume=.25;this.samples=new Map();}
 unlock(){return this.enabled?ZZFX.audioContext.resume().catch(()=>{}):Promise.resolve();}
 play(kind,speed=0){
  if(!this.enabled)return;
  if(ZZFX.audioContext.state!=='running'){this.unlock().then(()=>{if(ZZFX.audioContext.state==='running')this.play(kind,speed);});return;}
  const presets={select:[.06,0,450,.002,.006,.035],turn:[.15,.02,55+speed*.22,.035,.7,.2,2,1.4,14],contact:[.22,.08,65,.002,.035,.16,4,1.8,-22],grass:[.08,.08,100,.01,.12,.15,4,1.3],done:[.11,0,620,.005,.025,.1,1],finish:[.16,0,523,.02,.15,.28,1,1,0,0,262,.13]};
  const key=kind==='turn'?`${kind}-${Math.round(speed/20)*20}`:kind;
  if(!this.samples.has(key))this.samples.set(key,ZZFX.buildSamples(...presets[kind]));
  const source=ZZFX.playSamples([this.samples.get(key)]);this.active.add(source);source.onended=()=>this.active.delete(source);this.cuesPlayed++;
 }
 toggle(){this.enabled=!this.enabled;if(!this.enabled)this.stop();else{this.unlock();}return this.enabled;}
 stop(){for(const source of this.active){try{source.stop();}catch{}}this.active.clear();}
 get stats(){return {library:'ZzFX',enabled:this.enabled,context:ZZFX.audioContext.state,cuesPlayed:this.cuesPlayed};}
}
