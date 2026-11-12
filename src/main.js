(() => {
 'use strict';
 const P=window.RacePhysics,$=id=>document.getElementById(id),canvas=$('race'),ctx=canvas.getContext('2d'),mini=$('minimap'),mc=mini.getContext('2d');
 const throttleNames=['Сильно тормозить','Немного тормозить','Сохранить скорость','Немного разогнаться','Сильно разогнаться'];
 const steerNames=['Резко влево','Немного влево','Прямо','Немного вправо','Резко вправо'];
 let state=P.start(),visual={...state},throttle=1,steer=0,turns=0,animation=null,forecast,overview=false,best=null,w=1,h=1,dpr=1,lastTime=0;
 let camera={x:state.x,y:state.y-80,z:1},dust=[],trails=[],sound=false,audio=null;
 try{const saved=Number(localStorage.getItem('apex-forest-best-v1'));if(saved>0&&Number.isFinite(saved))best=saved}catch{}
 function randomGenerator(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
 const random=randomGenerator(14351);
 const world=document.createElement('canvas');world.width=1600;world.height=1500;const g=world.getContext('2d');
 function path(c){c.beginPath();P.track.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath()}
 function line(c,width,color){path(c);c.lineWidth=width;c.strokeStyle=color;c.lineJoin='round';c.stroke()}
 function tree(x,y,r){
  g.fillStyle='#0c201933';g.beginPath();g.ellipse(x+16,y+22,r*.95,r*.65,-.6,0,Math.PI*2);g.fill();
  g.fillStyle='#293f26';g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
  for(let j=0;j<8;j++){const a=j*Math.PI/4,px=x+Math.cos(a)*r*.44,py=y+Math.sin(a)*r*.44,rr=r*(.43+random()*.17);const gradient=g.createRadialGradient(px-rr*.35,py-rr*.4,0,px,py,rr);gradient.addColorStop(0,['#81954a','#687d3c','#5d793c','#7c8b48'][j%4]);gradient.addColorStop(.6,['#4a6935','#526d36','#3b5e32'][j%3]);gradient.addColorStop(1,'#2c4b2d');g.fillStyle=gradient;g.beginPath();g.arc(px,py,rr,0,Math.PI*2);g.fill()}
  g.fillStyle='#9ead5950';g.beginPath();g.arc(x-r*.18,y-r*.28,r*.32,0,Math.PI*2);g.fill();
 }
 function bakeWorld(){
  g.fillStyle='#51623a';g.fillRect(0,0,1600,1500);
  for(let i=0;i<17000;i++){const x=random()*1600,y=random()*1500;g.fillStyle=random()>.5?'#a0a26a14':'#16372420';g.fillRect(x,y,1+random()*5,1+random()*3)}
  line(g,P.WIDTH+56,'#778063');line(g,P.WIDTH+36,'#a59d7a');line(g,P.WIDTH+20,'#bab39a');line(g,P.WIDTH+12,'#d3cfc0');line(g,P.WIDTH,'#464c4c');
  // Individually laid kerbs follow both sides of the circuit.
  for(let side of [-1,1])for(let i=0;i<P.track.length;i++){
   const p=P.track[i],q=P.track[(i+1)%P.track.length],n={x:-Math.sin(p.angle)*side,y:Math.cos(p.angle)*side},nn={x:-Math.sin(q.angle)*side,y:Math.cos(q.angle)*side};
   g.fillStyle=Math.floor(p.s/22)%2?'#d7d7c9':'#b45343';g.beginPath();g.moveTo(p.x+n.x*58,p.y+n.y*58);g.lineTo(q.x+nn.x*58,q.y+nn.y*58);g.lineTo(q.x+nn.x*66,q.y+nn.y*66);g.lineTo(p.x+n.x*66,p.y+n.y*66);g.closePath();g.fill();
  }
  line(g,P.WIDTH-7,'#4b5150');
  // Asphalt aggregate and old rubber: static, subtle and inexpensive to render.
  for(let i=0;i<24000;i++){const p=P.at(random()*P.length),side=(random()-.5)*(P.WIDTH-10);g.fillStyle=random()>.45?'#e3e4d00a':'#0b141319';g.fillRect(p.x-Math.sin(p.angle)*side,p.y+Math.cos(p.angle)*side,random()*2.3+.4,random()*2.3+.4)}
  g.setLineDash([13,22]);line(g,1,'#e9e7ce23');g.setLineDash([]);
  for(let s=170;s<P.length;s+=310){const p=P.at(s);g.save();g.translate(p.x,p.y);g.rotate(p.angle);g.strokeStyle='#e2e2ca38';g.lineWidth=2;g.beginPath();g.moveTo(-8,-8);g.lineTo(0,0);g.lineTo(-8,8);g.stroke();g.restore()}
  for(let s=100;s<P.length;s+=9){const p=P.at(s),curvature=Math.abs(P.angleDiff(P.at(s+18).angle,p.angle));if(curvature>.05){for(let offset of [-17,17]){g.fillStyle='#17211c12';g.beginPath();g.arc(p.x-Math.sin(p.angle)*offset,p.y+Math.cos(p.angle)*offset,2,0,Math.PI*2);g.fill()}}}
  // Steel guardrails sit beyond the gravel, leaving the shoulder driveable.
  for(let side of [-1,1]){g.lineCap='round';for(let s=0;s<P.length;s+=22){const p=P.at(s),q=P.at(s+23);g.strokeStyle='#202e28';g.lineWidth=5;g.beginPath();g.moveTo(p.x-Math.sin(p.angle)*87*side,p.y+Math.cos(p.angle)*87*side);g.lineTo(q.x-Math.sin(q.angle)*87*side,q.y+Math.cos(q.angle)*87*side);g.stroke();g.strokeStyle='#aab2a1';g.lineWidth=2;g.stroke()}}
  for(let i=0;i<1450;i++){const x=random()*1600,y=random()*1500,r=12+random()*21;if(P.nearest(x,y).distance>104+r*.28)tree(x,y,r)}
  const start=P.at(0);g.save();g.translate(start.x,start.y);g.rotate(start.angle);for(let a=0;a<3;a++)for(let b=0;b<12;b++){g.fillStyle=(a+b)%2?'#293332':'#e8e7d7';g.fillRect(a*6-9,b*9-54,6,9)}
  g.font='bold 14px Segoe UI';g.textAlign='center';g.fillStyle='#f3ebce';g.fillText('СТАРТ / ФИНИШ',-64,5);g.restore();
  // Pit-side painted markers, signboards and tyre stacks.
  for(let i=0;i<7;i++){const p=P.at(P.length-65-i*35);g.save();g.translate(p.x,p.y);g.rotate(p.angle);g.strokeStyle='#e8e6ce70';g.lineWidth=1;g.strokeRect(-11,-42,20,23);g.restore()}
  for(let k of [410,1120,2210,3060]){const p=P.at(k);g.save();g.translate(p.x-Math.sin(p.angle)*110,p.y+Math.cos(p.angle)*110);g.rotate(p.angle+Math.PI/2);g.fillStyle='#142322';g.fillRect(-35,-12,70,24);g.strokeStyle='#acbe7c';g.lineWidth=2;g.strokeRect(-35,-12,70,24);g.fillStyle='#d4e5b4';g.font='bold 10px Segoe UI';g.textAlign='center';g.fillText('A P E X',0,4);g.restore()}
 }
 bakeWorld();
 function buildControls(id,icons,names,type){const group=$(id);icons.forEach((icon,i)=>{const b=document.createElement('button');b.textContent=icon;b.setAttribute('aria-label',names[i]);b.title=names[i];b.dataset.value=i-2;if(type==='throttle'&&i<2)b.classList.add('brake');b.addEventListener('click',()=>select(type,i-2));group.appendChild(b)})}
 buildControls('throttle',['↓↓','↓','−','↑','↑↑'],throttleNames,'throttle');buildControls('steering',['↶','↖','↑','↗','↷'],steerNames,'steer');
 function select(type,value){if(animation||state.finished)return;if(type==='throttle')throttle=value;else steer=value;update()}
 const speedText=v=>Math.round(v*1.08);
 function update(){
  forecast=P.simulate(state,throttle,steer);
  document.querySelectorAll('#throttle button').forEach(b=>{b.setAttribute('aria-pressed',Number(b.dataset.value)===throttle);b.disabled=!!animation||state.finished});
  document.querySelectorAll('#steering button').forEach(b=>{b.setAttribute('aria-pressed',Number(b.dataset.value)===steer);b.disabled=!!animation||state.finished});
  $('throttle-label').textContent=throttleNames[throttle+2];$('steering-label').textContent=steerNames[steer+2];
  $('turn').textContent=state.finished?turns:turns+1;$('completed').textContent=`Сделано ходов: ${turns}`;$('best').textContent=best?`${best} ходов`:'Первый заезд';
  $('distance').textContent=Math.round(forecast.distance*.3);$('next-speed').textContent=speedText(forecast.state.v);
  const spinning=Math.abs(steer)>0&&state.v>150;
  $('risk').textContent=forecast.offroad?'Выезд на обочину · потеря сцепления':spinning?'Высокая скорость · широкая дуга':'Траектория на асфальте';
  document.querySelector('.forecast').classList.toggle('warning',forecast.offroad||spinning);
  $('phase').textContent=state.finished?'ЗАЕЗД ЗАВЕРШЁН':animation?'ВЫПОЛНЕНИЕ ХОДА':'ПЛАНИРОВАНИЕ';
  $('commit').disabled=!!animation||state.finished;$('commit').innerHTML=animation?'Машина в движении…':state.finished?'Финиш!':'Конец хода <span>ПРОБЕЛ ↗</span>';
  $('restart').disabled=!!animation;
  if(turns>0)$('hint').textContent=forecast.offroad?'Оранжевый участок — трава. Попробуй тормозить или изменить руль.':'Скорость сохранится. Подготовь удобный выход из поворота.';
 }
 function beep(freq,duration=.07){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),gain=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);gain.gain.setValueAtTime(.025,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(gain);gain.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch{}}
 function commit(){if(animation||state.finished)return;animation={path:forecast,start:performance.now(),duration:1000,lastIndex:0};beep(240);update()}
 function finishTurn(){state={...animation.path.state};visual={...state};animation=null;turns++;if(state.finished){const previous=best;if(!best||turns<best){best=turns;try{localStorage.setItem('apex-forest-best-v1',best)}catch{}}$('result-turns').textContent=turns;$('result-note').textContent=!previous?'Первый результат записан. Попробуем быстрее?':turns<previous?`Новый рекорд! На ${previous-turns} ходов быстрее.`:`Лучший результат: ${best} ходов. Можно быстрее.`;$('finish').hidden=false;beep(620,.3)}else beep(370);update()}
 function reset(){if(animation)return;state=P.start();visual={...state};turns=0;throttle=1;steer=0;trails=[];dust=[];$('finish').hidden=true;$('hint').textContent='Выбери газ и руль. Посмотри на дугу. Сделай ход.';camera.x=state.x;camera.y=state.y-80;update()}
 $('commit').addEventListener('click',commit);$('restart').addEventListener('click',reset);$('again').addEventListener('click',reset);
 function toggleCamera(){overview=!overview;$('camera').innerHTML=overview?'⊙ <span>За машиной</span>':'⊞ <span>Вся трасса</span>';$('camera').setAttribute('aria-pressed',overview)}
 $('camera').addEventListener('click',toggleCamera);
 $('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=$('lets-race').onclick=()=>$('help-dialog').close();
 document.addEventListener('keydown',e=>{if($('help-dialog').open||e.altKey||e.ctrlKey||e.metaKey||e.target.tagName==='INPUT')return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.repeat)return;switch(e.key.toLowerCase()){case 'arrowup':select('throttle',Math.min(2,throttle+1));break;case 'arrowdown':select('throttle',Math.max(-2,throttle-1));break;case 'arrowleft':select('steer',Math.max(-2,steer-1));break;case 'arrowright':select('steer',Math.min(2,steer+1));break;case ' ':commit();break;case 'r':reset();break;case 'm':toggleCamera();break}});
 function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
 new ResizeObserver(resize).observe(canvas);resize();
 function car(c,s,ghost=false,scale=1){
  c.save();c.translate(s.x,s.y);c.rotate(s.heading);c.scale(scale,scale);
  if(ghost){c.globalAlpha=.65;c.strokeStyle=forecast.offroad?'#efba72':'#cefc8b';c.lineWidth=1.5;c.setLineDash([4,3]);c.strokeRect(-21,-10,42,20);c.setLineDash([]);c.beginPath();c.moveTo(25,0);c.lineTo(17,-5);c.moveTo(25,0);c.lineTo(17,5);c.stroke();c.restore();return}
  c.fillStyle='#0008';c.beginPath();c.roundRect(-19,-7,44,24,7);c.fill();
  for(const x of [-12,12])for(const y of [-11,11]){c.save();c.translate(x,y);if(x>0)c.rotate((animation?steer:0)*.12);c.fillStyle='#111a1c';c.beginPath();c.roundRect(-5,-3,10,6,2);c.fill();c.fillStyle='#82908e';c.fillRect(-3,-3,5,1);c.restore()}
  const paint=c.createLinearGradient(0,-10,0,10);paint.addColorStop(0,'#1b609c');paint.addColorStop(.3,'#59afed');paint.addColorStop(.5,'#2786cf');paint.addColorStop(1,'#124778');c.fillStyle=paint;c.strokeStyle='#102d44';c.lineWidth=1;
  c.beginPath();c.moveTo(-22,-7);c.quadraticCurveTo(-23,-10,-17,-10);c.lineTo(12,-10);c.quadraticCurveTo(24,-9,24,-4);c.lineTo(24,4);c.quadraticCurveTo(24,9,12,10);c.lineTo(-17,10);c.quadraticCurveTo(-23,10,-22,7);c.closePath();c.fill();c.stroke();
  c.fillStyle='#dceae7';c.fillRect(8,-5,14,3);c.fillRect(8,2,14,3);c.fillRect(-21,-5,9,3);c.fillRect(-21,2,9,3);
  c.fillStyle='#11252f';c.beginPath();c.moveTo(8,-8);c.lineTo(12,-6);c.lineTo(12,6);c.lineTo(8,8);c.lineTo(3,7);c.lineTo(3,-7);c.closePath();c.fill();
  c.fillStyle='#83b7cc';c.fillRect(7,-6,2,12);c.fillStyle='#1b4870';c.fillRect(-8,-7,10,14);c.fillStyle='#e8efdb';c.fillRect(-8,-4,10,2);c.fillRect(-8,2,10,2);c.fillStyle='#11282f';c.fillRect(-12,-7,4,14);
  c.fillStyle='#edf7da';c.fillRect(21,-8,2,4);c.fillRect(21,4,2,4);c.fillStyle='#df6346';c.fillRect(-22,-8,2,4);c.fillRect(-22,4,2,4);c.fillStyle='#102332';c.fillRect(-21,-11,3,22);c.fillStyle='#96c9df';c.fillRect(4,-13,4,3);c.fillRect(4,10,4,3);
  c.restore();
 }
 function drawForecast(t){if(animation||state.finished)return;const samples=forecast.samples;ctx.lineCap='round';ctx.lineWidth=2.7/camera.z;ctx.setLineDash([8/camera.z,7/camera.z]);ctx.lineDashOffset=-t*.005;
  let offroad=samples[0].offroad,travel=0,runStart=0;ctx.beginPath();ctx.moveTo(samples[0].x,samples[0].y);
  for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];if(b.offroad!==offroad){ctx.strokeStyle=offroad?'#f2b16d':'#c5f46b';ctx.lineDashOffset=-t*.005-runStart;ctx.stroke();ctx.beginPath();ctx.moveTo(a.x,a.y);offroad=b.offroad;runStart=travel}ctx.lineTo(b.x,b.y);travel+=Math.hypot(b.x-a.x,b.y-a.y)}ctx.strokeStyle=offroad?'#f2b16d':'#c5f46b';ctx.lineDashOffset=-t*.005-runStart;ctx.stroke();
  ctx.setLineDash([]);const end=samples[samples.length-1];car(ctx,end,true);ctx.strokeStyle=forecast.offroad?'#efb36a':'#d5ff9b';ctx.lineWidth=1.3/camera.z;ctx.beginPath();ctx.arc(end.x,end.y,4/camera.z,0,Math.PI*2);ctx.stroke();
 }
 function drawGate(){if(state.finished)return;const gate=P.gates[state.nextGate];ctx.save();ctx.translate(gate.x,gate.y);ctx.rotate(gate.angle);ctx.strokeStyle='#d0e7ac44';ctx.lineWidth=1.5/camera.z;ctx.setLineDash([5,7]);ctx.beginPath();ctx.moveTo(0,-55);ctx.lineTo(0,55);ctx.stroke();ctx.setLineDash([]);for(const side of [-1,1]){ctx.fillStyle='#d3ecac';ctx.beginPath();ctx.arc(0,side*58,3,0,Math.PI*2);ctx.fill()}ctx.restore()}
 function drawMini(){mc.clearRect(0,0,180,150);mc.save();mc.translate(9,6);mc.scale(.123,.101);mc.translate(-180,-100);line(mc,37,'#64736a');line(mc,20,'#2a3936');const gate=P.gates[Math.min(state.nextGate,11)];mc.fillStyle='#c5f46b';mc.beginPath();mc.arc(gate.x,gate.y,20,0,Math.PI*2);mc.fill();mc.fillStyle='#7bc4f7';mc.strokeStyle='#e0f0f3';mc.lineWidth=6;mc.beginPath();mc.arc(visual.x,visual.y,23,0,Math.PI*2);mc.fill();mc.stroke();mc.restore();const p=state.finished?100:Math.min(99,Math.round(state.nextGate/12*100));$('progress').textContent=p+'%'}
 function frame(now){
  const delta=Math.min(.05,(now-lastTime)/1000||.016);lastTime=now;
  if(animation){const a=animation,t=Math.min(1,(now-a.start)/a.duration),f=t*(a.path.samples.length-1),i=Math.min(a.path.samples.length-2,Math.floor(f)),u=f-i,p=a.path.samples[i],q=a.path.samples[i+1];visual={...p,x:p.x+(q.x-p.x)*u,y:p.y+(q.y-p.y)*u,v:p.v+(q.v-p.v)*u,heading:p.heading+P.angleDiff(q.heading,p.heading)*u};
   for(let n=a.lastIndex+1;n<=i;n+=3){const s=a.path.samples[n];if(s.offroad){dust.push({x:s.x,y:s.y,r:5,life:1});}if(s.v>145&&Math.abs(steer)>0)trails.push({x:s.x,y:s.y,a:s.heading})}a.lastIndex=i;if(trails.length>900)trails.splice(0,trails.length-900);if(t>=1)finishTurn();
  }
  const target=overview?{x:810,y:750,z:Math.min(w/1450,h/1400)}:{x:visual.x+Math.cos(visual.heading)*65,y:visual.y+Math.sin(visual.heading)*65,z:Math.min(w/650,h/570)*1.12};const smooth=1-Math.exp(-delta*5);
  camera.x+=(target.x-camera.x)*smooth;camera.y+=(target.y-camera.y)*smooth;camera.z+=(target.z-camera.z)*smooth;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#3e5235';ctx.fillRect(0,0,w,h);ctx.save();ctx.translate(w/2,h/2);ctx.scale(camera.z,camera.z);ctx.translate(-camera.x,-camera.y);ctx.drawImage(world,0,0);
  for(let tr of trails){ctx.save();ctx.translate(tr.x,tr.y);ctx.rotate(tr.a);ctx.fillStyle='#14201a33';ctx.fillRect(-2,-10,5,2);ctx.fillRect(-2,8,5,2);ctx.restore()}
  drawGate();drawForecast(now);
  dust=dust.filter(d=>d.life>0);for(let d of dust){d.life-=delta*.7;d.r+=delta*11;ctx.fillStyle=`rgba(196,176,125,${Math.max(0,d.life*.25)})`;ctx.beginPath();ctx.arc(d.x+8*(1-d.life),d.y,d.r,0,Math.PI*2);ctx.fill()}
  car(ctx,visual);
  // The player marker remains legible when the entire circuit is in view.
  if(overview){ctx.strokeStyle='#b6e6ff';ctx.lineWidth=1/camera.z;ctx.beginPath();ctx.arc(visual.x,visual.y,21/camera.z,0,Math.PI*2);ctx.stroke()}
  ctx.restore();const vignette=ctx.createRadialGradient(w*.5,h*.45,h*.15,w*.5,h*.5,Math.max(w,h)*.8);vignette.addColorStop(0,'#0b171000');vignette.addColorStop(1,'#0b171078');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);const topShade=ctx.createLinearGradient(0,0,0,150);topShade.addColorStop(0,'#0e1c1bb0');topShade.addColorStop(1,'#0e1c1b00');ctx.fillStyle=topShade;ctx.fillRect(0,0,w,150);
  $('speed').textContent=speedText(visual.v);$('speed-bar').style.width=(visual.v/P.MAX_SPEED*100)+'%';const offroad=P.nearest(visual.x,visual.y).distance>P.WIDTH/2;$('surface').textContent=offroad?'Обочина · меньше сцепление':'Асфальт · хорошее сцепление';$('surface-dot').style.background=offroad?'#efb36a':'#c5f46b';drawMini();requestAnimationFrame(frame);
 }
 update();requestAnimationFrame(frame);
 // Read-only inspection for deterministic verification; gameplay stays in the controls.
 window.Apex={getState:()=>({...state,turns,throttle,steer,animating:!!animation,overview,best}),getForecast:()=>structuredClone(forecast)};
})();
