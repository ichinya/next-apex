import './courses.js';
import './physics.js';
import './race.js';
import './planning.js';
import './session.js';
import {gsap} from 'gsap';
import {initializePhysics,physicsStats} from './rapier.mjs';
import {RaceRenderer} from './renderer.mjs';
import {RaceSound} from './sound.mjs';

const P=globalThis.RacePhysics,R=globalThis.Race,$=id=>document.getElementById(id);
const throttleNames=['Сильно тормозить','Немного тормозить','Сохранить скорость','Немного разогнаться','Сильно разогнаться'];
const steerNames=['Резко влево','Немного влево','Прямо','Немного вправо','Резко вправо'];
const kmh=v=>Math.round(v*1.08),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const bestKey=id=>id==='forest'?'apex-forest-best-v1':`apex-${id}-best-v1`;
function readBest(id){try{const value=Number(localStorage.getItem(bestKey(id)));return Number.isInteger(value)&&value>0?value:null;}catch{return null;}}
try{const id=localStorage.getItem('apex-selected-course');if(P.courses.some(c=>c.id===id))P.setCourse(id);}catch{}
const session=new globalThis.RaceSession(readBest(P.course.id)),sound=new RaceSound();
try{sound.enabled=localStorage.getItem('apex-sound-enabled')!=='false';}catch{}
const menu=$('main-menu'),gameChrome=[$('game-header'),$('game-content')];
let view,ready=false,lastRendered=0,contactPlayed=false,grassPlayed=false,tweenCount=0,menuOpen=true,raceStarted=false,menuPausedAt=performance.now();
function tween(target,from,to){tweenCount++;gsap.fromTo(target,from,{...to,duration:reducedMotion?0:(to.duration??.25),overwrite:true});}
function select(type,value,button){if(!ready||menuOpen||!session.select(type,value))return;sound.unlock();sound.play('select');update();if(button)tween(button,{scale:.92},{scale:1,duration:.18,ease:'power2.out'});}
function buildControls(id,icons,names,type){icons.forEach((icon,i)=>{const button=document.createElement('button');button.textContent=icon;button.dataset.value=i-2;button.setAttribute('aria-label',names[i]);button.title=names[i];if(type==='throttle'&&i<2)button.classList.add('brake');button.addEventListener('click',()=>select(type,i-2,button));$(id).appendChild(button);});}
buildControls('throttle',['↓↓','↓','−','↑','↑↑'],throttleNames,'throttle');buildControls('steering',['↶','↖','↑','↗','↷'],steerNames,'steer');
function update(){
 const locked=!ready||menuOpen||!!session.animation||session.state.finished;
 for(const [id,type] of [['throttle','throttle'],['steering','steer']])document.querySelectorAll(`#${id} button`).forEach(b=>{b.disabled=locked;b.setAttribute('aria-pressed',Number(b.dataset.value)===session[type]);});
 $('throttle-label').textContent=throttleNames[session.throttle+2];$('steering-label').textContent=steerNames[session.steer+2];
 $('turn').textContent=session.state.finished?session.turns:session.turns+1;$('completed').textContent=`Сделано ходов: ${session.turns}`;$('best').textContent=session.best?`${session.best} ходов`:'Первый заезд';
 const f=session.forecast,second=session.second;
 $('distance').textContent=Math.round(f.distance*.3);$('next-speed').textContent=kmh(f.state.v);
 $('second-forecast').textContent=second?`${kmh(second.state.v)} км/ч · ${second.offroad?'на траве':second.state.finished?'финиш':second.distance<.5?'остановка':'на асфальте'}`:'Финиш на первом ходу';$('second-forecast').classList.toggle('second-warning',!!second?.offroad);
 const spinning=Math.abs(session.steer)>0&&session.state.v>150;$('risk').textContent=f.offroad?'Выезд на обочину · потеря сцепления':spinning?'Высокая скорость · широкая дуга':'Траектория на асфальте';document.querySelector('.forecast').classList.toggle('warning',f.offroad||spinning);
 $('phase').textContent=!ready?'ПОДГОТОВКА':session.state.finished?'ЗАЕЗД ЗАВЕРШЁН':session.animation?'ВЫПОЛНЕНИЕ ХОДА':'ПЛАНИРОВАНИЕ';
 $('commit').disabled=locked;$('commit').innerHTML=!ready?'Готовим заезд…':session.animation?'Машины в движении…':session.state.finished?'Финиш!':'Конец хода <span>ПРОБЕЛ ↗</span>';$('restart').disabled=!ready||!!session.animation;
 $('hint').textContent=f.offroad?'Оранжевый участок — трава. Попробуй тормозить или изменить руль.':second?.offroad?'Сейчас на асфальте. Но накатом на втором ходу вынесет на траву.':'1 — выбранный манёвр. 2 — затем без газа, руль прямо.';
 const order=R.standings(session.racers);$('position').textContent=`${order.findIndex(r=>r.id==='player')+1} / 4`;
 $('standings').innerHTML=order.map(r=>`<li class="${r.id==='player'?'is-player':''}"><span class="racer-swatch" style="background:${r.color}"></span><span>${r.name}</span><small>${r.state.finished?'ФИНИШ':`${Math.max(0,Math.min(99,Math.floor(R.progress(r.state)/P.length*100)))}%`}</small></li>`).join('');$('race-status').textContent=session.animation?'Все машины в движении':session.state.finished?'Гонка завершена для тебя':'3 бота · общий ход';
 $('turn-review').hidden=!session.review||!!session.animation;
 if(session.review){$('review-title').textContent=`ИТОГ ХОДА ${session.review.turn}`;$('review-speed').textContent=session.review.speed;$('review-events').innerHTML=session.review.events.map(e=>`<li class="event-${e.kind}">${e.text}</li>`).join('');}
 if(view)view.setForecast(session.forecast,session.second);
 if(menuOpen)updateMenu();
}
function commit(){
 if(!ready||menuOpen||session.animation||session.state.finished)return;
 sound.unlock();if(!session.commit(()=>performance.now()))return;contactPlayed=grassPlayed=false;sound.play('turn',session.state.v);update();
}
function finishTurn(){
 sound.play('done');update();tween($('turn-review'),{opacity:0,y:8},{opacity:1,y:0,ease:'power2.out'});
 if(session.review.position!==session.review.previousPosition)tween($('position'),{scale:1.2},{scale:1,duration:.35,ease:'back.out(2)'});
 if(session.state.finished){
  try{localStorage.setItem(bestKey(P.course.id),session.best);}catch{}
  const place=session.review.position;document.querySelector('#finish h2').textContent=place===1?'Победа!':`${place}-е место из 4`;$('result-turns').textContent=session.turns;$('result-note').textContent=`${place===1?'Ты первым пересёк финиш.':'Все контрольные створы пройдены.'} Лучший результат: ${session.best} ходов.`;$('finish').hidden=false;sound.play('finish');tween($('finish'),{opacity:0,scale:.94},{opacity:1,scale:1,duration:.4,ease:'back.out(1.5)'});
 }
}
function reset(){if(!ready||!session.reset())return;sound.stop();gsap.killTweensOf($('finish'));$('finish').hidden=true;$('camera').innerHTML='⊞ <span>Вся трасса</span>';$('camera').setAttribute('aria-pressed',false);view.started=false;update();}
function camera(){if(!ready||menuOpen)return;session.overview=!session.overview;view.invalidate();$('camera').innerHTML=session.overview?'⊙ <span>За машиной</span>':'⊞ <span>Вся трасса</span>';$('camera').setAttribute('aria-pressed',session.overview);}
function updateMenu(){
 const finished=session.state.finished;
 $('menu-start').disabled=!ready;
 $('menu-start').innerHTML=!ready?'Готовим трассу… <span aria-hidden="true">↗</span>':`${finished?'Начать новую гонку':raceStarted?'Продолжить гонку':'Начать гонку'} <span aria-hidden="true">↗</span>`;
 $('menu-new').hidden=!raceStarted||finished;
 $('course-change-note').hidden=!raceStarted||finished;
 for(const button of $('course-selector').children){button.disabled=!ready;button.setAttribute('aria-pressed',button.dataset.course===P.course.id);const record=readBest(button.dataset.course);button.querySelector('small').textContent=record?`${record} ходов`:'Первый заезд';}
 $('menu-best').textContent=session.best?`Лучший круг — ${session.best} ходов.`:'Твой первый заезд начинается здесь.';
 $('menu-status').dataset.state=ready?'ready':'loading';
 $('menu-status').textContent=!ready?'Готовим трассу и машины…':finished?'Круг пройден. Готов к следующему старту?':raceStarted?`Заезд на паузе · ход ${session.turns+1}.`:'Трасса готова. Стартуем с места.';
}
function updateCourse(){
 const course=P.course,b=P.bounds;
 $('track-name').textContent=course.name;$('map-name').textContent=course.name.toUpperCase();$('finish-course').textContent=`ФИНИШ · ${course.name.toUpperCase()}`;
 $('race').setAttribute('aria-label',`Синяя машина на трассе «${course.name}». Зелёная линия показывает следующий манёвр.`);
 $('menu-course-name').textContent=course.name;$('menu-course-description').textContent=course.description;$('menu-course-tip').textContent=course.tip;
 $('menu-course-label').textContent=`ТРАССА ${course.number} · ${course.kind.toUpperCase()}`;$('menu-course-number').textContent=course.number;
 $('menu-course-distance').textContent=(P.length*.3/1000).toLocaleString('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1});
 $('menu-track').setAttribute('aria-label',course.name);$('menu-map').setAttribute('aria-label',`Схема трассы ${course.name}`);
 $('menu-map').setAttribute('viewBox',`${b.minX-40} ${b.minY-40} ${b.maxX-b.minX+80} ${b.maxY-b.minY+80}`);
 $('menu-course').setAttribute('d',`M${P.track.map(point=>`${point.x},${point.y}`).join(' L')} Z`);
 const start=P.at(0),normal={x:-Math.sin(start.angle)*P.WIDTH/2,y:Math.cos(start.angle)*P.WIDTH/2};
 menu.querySelector('.menu-start-line').setAttribute('d',`M${start.x-normal.x} ${start.y-normal.y} L${start.x+normal.x} ${start.y+normal.y}`);
 for(const marker of menu.querySelectorAll('.menu-grid-marker,.menu-grid-center')){marker.setAttribute('cx',session.state.x);marker.setAttribute('cy',session.state.y);}
 menu.style.setProperty('--course-accent',course.theme.accent);
}
async function chooseCourse(id){
 if(!ready||!menuOpen||id===P.course.id)return;
 const previous=P.course.id;ready=false;sound.stop();P.setCourse(id);updateCourse();update();
 try{
  await view.setCourse(P,R.grid());
  session.animation=null;session.best=readBest(id);raceStarted=false;ready=true;reset();updateCourse();
  view.draw(session,.016);drawMini();
  try{localStorage.setItem('apex-selected-course',id);}catch{}
  update();sound.unlock();sound.play('select');
  if(menuOpen&&!$('help-dialog').open&&[document.body,menu].includes(document.activeElement))$('course-selector').querySelector(`[data-course="${id}"]`).focus({preventScroll:true});
 }catch(error){
  console.error('Course loading failed',error);P.setCourse(previous);ready=true;updateCourse();update();
  $('menu-status').dataset.state='error';$('menu-status').textContent='Не удалось загрузить трассу. Выбери её ещё раз.';
 }
}
for(const course of P.courses){
 const button=document.createElement('button');button.type='button';button.dataset.course=course.id;button.style.setProperty('--course-accent',course.theme.accent);button.setAttribute('aria-label',`Трасса ${course.number}: ${course.name}, ${course.kind.toLowerCase()}`);
 button.innerHTML=`<span class="course-number">${course.number} ↗</span><strong>${course.name}</strong><small>Первый заезд</small>`;
 button.onclick=()=>chooseCourse(course.id);$('course-selector').appendChild(button);
}
function openMenu(){
 if(menuOpen)return;
 menuPausedAt=performance.now();menuOpen=true;sound.stop();
 gameChrome.forEach(element=>{element.inert=true;});document.body.classList.add('menu-active');
 update();menu.showModal();
}
function startFromMenu(restart=false){
 if(!ready)return;
 // A new race discards the paused turn; continuing keeps its remaining time.
 if(restart||session.state.finished){session.animation=null;reset();}
 const now=performance.now();if(session.animation)session.animation.start+=now-menuPausedAt;
 menuOpen=false;raceStarted=true;menu.close();document.body.classList.remove('menu-active');
 gameChrome.forEach(element=>{element.inert=false;});lastRendered=now;view.invalidate();update();
 sound.unlock();sound.play('select');(session.animation?$('menu-toggle'):$('commit')).focus({preventScroll:true});
}
function updateSound(){
 $('sound').setAttribute('aria-pressed',sound.enabled);$('sound').title=sound.enabled?'Выключить звук':'Включить звук';$('sound').setAttribute('aria-label',$('sound').title);
 $('menu-sound').setAttribute('aria-pressed',sound.enabled);$('menu-sound-state').textContent=sound.enabled?'ВКЛ':'ВЫКЛ';
}
function toggleSound(){sound.toggle();try{localStorage.setItem('apex-sound-enabled',String(sound.enabled));}catch{}updateSound();if(sound.enabled)setTimeout(()=>sound.play('select'),30);}
$('commit').onclick=commit;$('restart').onclick=$('again').onclick=reset;$('camera').onclick=camera;
$('sound').onclick=$('menu-sound').onclick=toggleSound;updateSound();
$('menu-toggle').onclick=openMenu;$('menu-start').onclick=()=>startFromMenu();$('menu-new').onclick=()=>startFromMenu(true);$('menu-retry').onclick=()=>location.reload();
$('finish-menu').onclick=openMenu;
menu.addEventListener('cancel',event=>{event.preventDefault();if(raceStarted)startFromMenu();});
menu.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const buttons=[...menu.querySelectorAll('button:not([disabled]):not([hidden])')],first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
$('help').onclick=$('menu-help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();$('lets-race').onclick=()=>{$('help-dialog').close();if(menuOpen)startFromMenu();};
document.addEventListener('keydown',e=>{if(menuOpen||$('help-dialog').open||e.altKey||e.ctrlKey||e.metaKey||e.target.matches('input,textarea,select,[contenteditable=true]'))return;if(e.key==='Escape'){e.preventDefault();openMenu();return;}if(e.key===' '&&e.target.closest('button'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.repeat)return;switch(e.key.toLowerCase()){case 'arrowup':select('throttle',Math.min(2,session.throttle+1));break;case 'arrowdown':select('throttle',Math.max(-2,session.throttle-1));break;case 'arrowleft':select('steer',Math.max(-2,session.steer-1));break;case 'arrowright':select('steer',Math.min(2,session.steer+1));break;case ' ':commit();break;case 'r':reset();break;case 'm':camera();break;}});
// The HTML menu is visible before modules load; modal mode adds focus trapping.
menu.close();menu.showModal();
updateCourse();

const mini=$('minimap'),mc=mini.getContext('2d');
function drawMini(){
 const b=P.bounds,scale=Math.min(162/(b.maxX-b.minX),132/(b.maxY-b.minY));
 mc.clearRect(0,0,180,150);mc.save();mc.translate((180-(b.maxX-b.minX)*scale)/2,(150-(b.maxY-b.minY)*scale)/2);mc.scale(scale,scale);mc.translate(-b.minX,-b.minY);mc.lineJoin='round';mc.beginPath();P.track.forEach((p,i)=>i?mc.lineTo(p.x,p.y):mc.moveTo(p.x,p.y));mc.closePath();mc.lineWidth=37;mc.strokeStyle=P.course.theme.accent;mc.stroke();mc.lineWidth=20;mc.strokeStyle='#293a35';mc.stroke();
 session.racers.forEach((r,i)=>{const s=session.visuals[i];mc.fillStyle=r.color;mc.beginPath();mc.arc(s.x,s.y,i?19:25,0,Math.PI*2);mc.fill();if(!i){mc.lineWidth=6;mc.strokeStyle='#e4f3ef';mc.stroke();}});mc.restore();$('progress').textContent=Math.max(0,Math.min(100,Math.round(R.progress(session.state)/P.length*100)))+'%';
}
function frame(now){
 requestAnimationFrame(frame);if(menuOpen){lastRendered=now;return;}const delta=Math.min(.06,(now-lastRendered)/1000||.016);
 if(session.advance(now))finishTurn();
 const moving=!!session.animation,s=session.visuals[0];
 if(moving&&s.contact&&!contactPlayed){sound.play('contact');contactPlayed=true;}
 if(moving&&s.offroad&&!grassPlayed){sound.play('grass');grassPlayed=true;}
 if(!view.needsDraw(session)||(!moving&&now-lastRendered<32))return;lastRendered=now;
 const result=view.draw(session,delta);$('turn-review').dataset.side=result.playerScreenX<view.width*.55?'right':'left';
 $('speed').textContent=kmh(s.v);$('speed-bar').style.width=(s.v/P.MAX_SPEED*100)+'%';const offroad=P.nearest(s.x,s.y).distance>P.WIDTH/2;$('surface').textContent=offroad?'Обочина · меньше сцепление':'Асфальт · хорошее сцепление';$('surface-dot').style.background=offroad?'#efb36a':'#c5f46b';drawMini();
}
update();
try{
 [view]=await Promise.all([RaceRenderer.create($('race'),P,session.racers),initializePhysics()]);
 view.draw(session,.016);drawMini();ready=true;update();$('boot').hidden=true;if(menuOpen&&!$('help-dialog').open)$('menu-start').focus({preventScroll:true});requestAnimationFrame(frame);
 window.Apex={getState:()=>({...session.state,course:P.course.id,turns:session.turns,throttle:session.throttle,steer:session.steer,animating:!!session.animation,overview:session.overview,best:session.best,menuOpen}),getCourses:()=>P.courses.map(c=>({id:c.id,name:c.name,best:readBest(c.id)})),getForecast:()=>structuredClone(session.forecast),getSecondForecast:()=>structuredClone(session.second),getReview:()=>structuredClone(session.review),getRacers:()=>structuredClone(session.racers),getVisuals:()=>structuredClone(session.visuals),getStandings:()=>R.standings(session.racers).map(r=>r.id),getDiagnostics:()=>({ready,renderer:view.stats,physics:{...physicsStats},audio:sound.stats,ui:{library:'GSAP',version:gsap.version,tweens:tweenCount}})};
 window.render_game_to_text=()=>JSON.stringify({course:P.course.name,phase:menuOpen?'menu':session.animation?'moving':session.state.finished?'finished':'planning',turn:session.turns+1,speed:kmh(session.state.v),throttle:session.throttle,steer:session.steer,place:R.standings(session.racers).findIndex(r=>r.id==='player')+1,review:session.review,integrations:window.Apex.getDiagnostics()});
}catch(error){console.error('Race initialization failed',error);$('menu-status').dataset.state='error';$('menu-status').textContent='Не удалось подготовить трассу. Попробуй загрузить её ещё раз.';$('menu-retry').hidden=false;$('menu-start').textContent='Заезд не загрузился';$('boot').innerHTML='<span class="eyebrow">ЗАЕЗД НЕ ЗАГРУЗИЛСЯ</span><p>Не удалось подготовить трассу. Попробуй ещё раз.</p><button class="primary" id="retry">Повторить</button>';$('retry').onclick=()=>location.reload();}
