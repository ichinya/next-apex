/* Course data is shared by simulation, scenery and the level selector. */
(function(root){
 'use strict';
 const courses=[
  {id:'forest',number:'01',name:'Лесное кольцо',kind:'Сбалансированная',description:'Асфальт. Лес. Решающий поворот.',tip:'Чередуй разгон и торможение перед внутренней петлёй.',width:116,seed:14351,
   anchors:[[400,850],[380,570],[410,320],[630,200],[940,200],[1180,340],[1200,550],[1040,690],[820,610],[700,750],[870,930],[1110,980],[1260,1140],[1100,1300],[780,1310],[520,1190],[410,1030]],
   theme:{accent:'#c5f46b',background:'#8b9e78',grass:'#647345',gravel:'#9b967a',asphalt:'#465052',trunk:'#53432e',rock:'#8a8d76',sun:'#fff1c9',sky:'#d8e8ed',ambient:'#5b593d',greens:['#4c7138','#5e7e3e','#78934e','#3d653c','#7b8b49'],trees:3100,rocks:110}},
  {id:'golden',number:'02',name:'Золотая дуга',kind:'Скоростная',description:'Осенний лес. Длинные прямые. Позднее торможение.',tip:'Набирай скорость на прямых и заранее готовь выход из дуги.',width:124,seed:8219,
   anchors:[[300,900],[300,600],[350,350],[560,220],[950,220],[1240,360],[1320,610],[1270,880],[1110,1110],[850,1260],[550,1250],[340,1100]],
   theme:{accent:'#f3c36b',background:'#b8a17a',grass:'#8b7d49',gravel:'#b6a07c',asphalt:'#514d49',trunk:'#66452b',rock:'#9d917c',sun:'#ffe2af',sky:'#f0dfc6',ambient:'#736044',greens:['#ad6b32','#c98b3b','#dfaf52','#82753d','#976144'],trees:2400,rocks:80}},
  {id:'serpentine',number:'03',name:'Каменный серпантин',kind:'Техничная',description:'Хвойный лес. Узкая дорога. Связки поворотов.',tip:'Сбавляй скорость до связки: следующий поворот уже рядом.',width:108,seed:30147,
   anchors:[[300,1000],[280,760],[330,510],[480,320],[750,210],[1030,230],[1240,390],[1260,610],[1100,760],[870,720],[720,580],[570,630],[600,840],[800,1000],[1050,1020],[1260,1140],[1170,1310],[890,1330],[610,1270],[420,1150]],
   theme:{accent:'#9fcce2',background:'#83969a',grass:'#52665b',gravel:'#87918a',asphalt:'#424c53',trunk:'#454b42',rock:'#8c999b',sun:'#dfedf5',sky:'#d0e1f0',ambient:'#485d62',greens:['#315c52','#426d60','#557e6b','#3d6261','#708b7a'],trees:2800,rocks:260}}
 ];
 root.RaceCourses=courses;if(typeof module!=='undefined')module.exports=courses;
})(typeof window!=='undefined'?window:globalThis);
