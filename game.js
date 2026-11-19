(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const $ = id => document.getElementById(id);
  const ui = {
    intro: $("intro"), result: $("result"), missionTitle: $("mission-title"),
    missionCopy: $("mission-copy"), cores: $("cores"), coreFill: $("core-fill"),
    heat: $("heat"), timer: $("timer"), speed: $("speed"), speedFill: $("speed-fill"),
    gear: $("gear"), resultKicker: $("result-kicker"), resultTitle: $("result-title"),
    resultCopy: $("result-copy")
  };
  const world = { w: 2400, h: 1800 };
  const route = [
    {x: 450, y: 350}, {x: 1200, y: 315}, {x: 1940, y: 390},
    {x: 2100, y: 900}, {x: 1930, y: 1410}, {x: 1200, y: 1480},
    {x: 470, y: 1395}, {x: 300, y: 900}
  ];
  const keys = { left: false, right: false, throttle: false, brake: false };
  const car = { x: route[0].x, y: route[0].y, angle: .02, speed: 0, boost: 100, boostTime: 0, pulse: 1, shield: 0 };
  let vw = 0, vh = 0, mode = "intro", elapsed = 0, previous = 0, cores = 0;
  let pickups = [], cops = [], particles = [], audio, sound = false, shake = 0, dash = 0;
  let seed = 89171;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const buildings = [], flowers = ["#ff8cbc", "#f7e976", "#a9a4ff", "#ffae6f", "#e7f2ce"];
  for (let x = 55; x < world.w - 100; x += 285) {
    for (let y = 55; y < world.h - 100; y += 255) {
      buildings.push({x, y, w: 180 + rand() * 45, h: 150 + rand() * 45, color: ["#647381", "#64756c", "#766d7b", "#7d776d", "#516d76"][Math.floor(rand()*5)], seed: rand()*1000});
    }
  }

  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    vw = r.width; vh = r.height;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize); resize();

  function routePoint(t) {
    const i = Math.floor(t) % route.length, p = t - Math.floor(t);
    const a = route[(i - 1 + route.length) % route.length], b = route[i];
    const c = route[(i + 1) % route.length], d = route[(i + 2) % route.length];
    const p2 = p*p, p3 = p2*p;
    return {
      x: .5*((2*b.x)+(-a.x+c.x)*p+(2*a.x-5*b.x+4*c.x-d.x)*p2+(-a.x+3*b.x-3*c.x+d.x)*p3),
      y: .5*((2*b.y)+(-a.y+c.y)*p+(2*a.y-5*b.y+4*c.y-d.y)*p2+(-a.y+3*b.y-3*c.y+d.y)*p3)
    };
  }
  function onRoad(x,y) {
    for (let i=0; i<route.length*22; i++) {
      const p=routePoint(i/22);
      if (Math.hypot(x-p.x,y-p.y)<137) return true;
    }
    return false;
  }
  function newRun() {
    mode="playing"; elapsed=0; cores=0; cops=[]; particles=[]; shake=0;
    car.x=route[0].x; car.y=route[0].y; car.angle=.02; car.speed=0; car.boost=100; car.boostTime=0; car.pulse=1; car.shield=0;
    pickups=[
      {x:800,y:302,type:"core"}, {x:1875,y:875,type:"core"}, {x:1310,y:1480,type:"core"},
      {x:1600,y:335,type:"boost"}, {x:2040,y:1110,type:"boost"}, {x:740,y:1380,type:"boost"},
      {x:1120,y:315,type:"pulse"}, {x:1985,y:1280,type:"pulse"}
    ].map(p=>({...p,got:false}));
    ui.intro.classList.add("hidden"); ui.result.classList.add("hidden");
    ui.missionTitle.textContent="The Last Seed";
    ui.missionCopy.textContent="Find the bloom caches and reach the Skygarden.";
    hud();
  }
  $("start").addEventListener("click", newRun);
  $("again").addEventListener("click", newRun);
  function formatTime(s) { return `${Math.floor(s/60).toString().padStart(2,"0")}:${Math.floor(s%60).toString().padStart(2,"0")}`; }
  function tone(freq,duration=.12,type="sine") {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext||window.webkitAudioContext)();
      const o=audio.createOscillator(), g=audio.createGain();
      o.type=type; o.frequency.value=freq; g.gain.setValueAtTime(.035,audio.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime+duration);
    } catch (error) { console.warn("Audio could not be started.",error); }
  }
  $("sound").addEventListener("click",()=>{
    sound=!sound; $("sound-state").textContent=sound?"ON":"OFF"; if(sound) tone(520);
  });
  function boost() {
    if(mode!=="playing"||car.boost<28)return;
    car.boost-=28; car.boostTime=1.5; car.speed=Math.min(535,car.speed+85); car.shield=.45; shake=4;
    burst(car.x-Math.cos(car.angle)*25,car.y-Math.sin(car.angle)*25,"#70f3df",9); tone(440,.12,"sawtooth");
  }
  function pulse() {
    if(mode!=="playing"||car.pulse<1)return;
    car.pulse=0; car.shield=1.5; cops.forEach(c=>c.stunned=2.6); shake=6;
    burst(car.x,car.y,"#ff9ad0",22); tone(740,.2);
  }
  function onKey(e,down) {
    const k=e.key.toLowerCase();
    if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();
    if(k==="a"||k==="arrowleft")keys.left=down;
    if(k==="d"||k==="arrowright")keys.right=down;
    if(k==="w"||k==="arrowup")keys.throttle=down;
    if(k==="s"||k==="arrowdown")keys.brake=down;
    if(down&&!e.repeat&&k===" ")boost();
    if(down&&!e.repeat&&k==="e")pulse();
    if(down&&k==="escape")mode=mode==="paused"?"playing":mode==="playing"?"paused":mode;
  }
  addEventListener("keydown",e=>onKey(e,true)); addEventListener("keyup",e=>onKey(e,false));
  document.querySelectorAll("[data-control]").forEach(button=>{
    const control=button.dataset.control;
    const press=e=>{
      e.preventDefault(); button.setPointerCapture?.(e.pointerId);
      if(control==="boost")boost(); else if(control==="pulse")pulse(); else keys[control]=true;
    };
    const release=e=>{e.preventDefault();if(control!=="boost"&&control!=="pulse")keys[control]=false;};
    button.addEventListener("pointerdown",press); button.addEventListener("pointerup",release);
    button.addEventListener("pointercancel",release); button.addEventListener("lostpointercapture",release);
  });
  function burst(x,y,color,n) {
    for(let i=0;i<n;i++){const a=rand()*Math.PI*2,v=25+rand()*180;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.35+rand()*.65,color,size:2+rand()*3});}
  }
  function finish(win) {
    mode=win?"won":"lost"; ui.result.classList.remove("hidden");
    ui.resultKicker.textContent=win?"MISSION COMPLETE":"RUN ENDED";
    ui.resultTitle.textContent=win?"A garden takes root.":"The night caught up.";
    ui.resultCopy.textContent=win?`You brought the seed vault home in ${formatTime(elapsed)}. Neon Bay is brighter tonight.`:"The seed vault is safe at the garage. Take a breath, then try another route.";
    tone(win?660:160,.25,win?"sine":"triangle");
  }
  function update(dt) {
    if(mode!=="playing")return;
    elapsed+=dt; dash+=dt*(3+car.speed/60); car.shield=Math.max(0,car.shield-dt); shake=Math.max(0,shake-dt*13);
    const road=onRoad(car.x,car.y);
    car.boostTime=Math.max(0,car.boostTime-dt);
    car.speed+=keys.throttle?(road?220:95)*dt:-(keys.brake?320:70)*dt;
    if(!road)car.speed-=110*dt;
    car.speed=Math.max(0,Math.min(car.boostTime>0?535:400,car.speed));
    if(keys.left)car.angle-=(.92+car.speed/260)*dt*Math.min(1,car.speed/65+.25);
    if(keys.right)car.angle+=(.92+car.speed/260)*dt*Math.min(1,car.speed/65+.25);
    car.x=Math.max(25,Math.min(world.w-25,car.x+Math.cos(car.angle)*car.speed*dt));
    car.y=Math.max(25,Math.min(world.h-25,car.y+Math.sin(car.angle)*car.speed*dt));
    if(car.boostTime>0)car.boost=Math.max(0,car.boost-dt*20);else car.boost=Math.min(100,car.boost+dt*4);
    car.pulse=Math.min(1,car.pulse+dt*.018);
    if(elapsed>9&&cops.length===0)spawnCop();
    if(elapsed>29&&cops.length<2)spawnCop();
    if(elapsed>62&&cops.length<3)spawnCop();
    cops.forEach(c=>{
      c.stunned=Math.max(0,c.stunned-dt); if(c.stunned>0)return;
      const target=Math.atan2(car.y-c.y,car.x-c.x);
      c.angle+=Math.atan2(Math.sin(target-c.angle),Math.cos(target-c.angle))*Math.min(1,dt*2.5);
      const dist=Math.hypot(car.x-c.x,car.y-c.y); c.speed=Math.min(285,c.speed+dt*35);
      c.x+=Math.cos(c.angle)*c.speed*dt; c.y+=Math.sin(c.angle)*c.speed*dt;
      if(dist<40&&car.shield<=0){car.speed*=.55;shake=7;c.x-=Math.cos(c.angle)*32;c.y-=Math.sin(c.angle)*32;tone(130,.12,"square");}
    });
    pickups.forEach(p=>{
      if(p.got||Math.hypot(car.x-p.x,car.y-p.y)>38)return;
      p.got=true;
      if(p.type==="core"){cores++;car.boost=Math.min(100,car.boost+20);burst(p.x,p.y,"#ff8fc9",18);tone(780);}
      if(p.type==="boost"){car.boost=Math.min(100,car.boost+38);burst(p.x,p.y,"#70f3df",14);tone(590);}
      if(p.type==="pulse"){car.pulse=1;burst(p.x,p.y,"#b7a3ff",14);tone(650);}
    });
    particles=particles.filter(p=>p.life>0);
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.vx*=.985;p.vy*=.985;});
    if(cops.some(c=>Math.hypot(car.x-c.x,car.y-c.y)<51)&&car.speed<35&&car.shield<=0){finish(false);return;}
    if(cores>=3&&Math.hypot(car.x-route[0].x,car.y-route[0].y)<90&&elapsed>7){finish(true);return;}
    hud();
  }
  function spawnCop() {
    const p=routePoint((elapsed*.017+route.length-1.3)%route.length);
    cops.push({x:p.x,y:p.y,angle:0,speed:145+Math.min(elapsed*1.5,65),stunned:0,siren:rand()*10});
  }
  function hud() {
    ui.cores.textContent=`${cores} / 3`;ui.coreFill.style.width=`${cores/3*100}%`;
    [...ui.heat.children].forEach((el,i)=>el.classList.toggle("active",i<Math.min(5,cops.length+(elapsed>8?1:0))));
    ui.timer.textContent=formatTime(elapsed);
    const speed=Math.round(car.speed*.34);ui.speed.textContent=String(speed).padStart(3,"0");
    $("speed-fill").style.width=`${Math.min(100,speed/1.7)}%`;
    ui.gear.textContent=mode==="paused"?"PAUSED":speed>95?"GEAR 02":speed>15?"GEAR 01":"READY";
    if(cores===3){ui.missionTitle.textContent="Skygarden run";ui.missionCopy.textContent="All cores secured. Return to the glowing garage.";}
  }
  function roundRect(x,y,w,h,r) {
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);
  }
  function flower(x,y,size,color) {
    ctx.strokeStyle="#bcecb2b8";ctx.lineWidth=1.5*size;ctx.beginPath();ctx.moveTo(x,y+5*size);ctx.lineTo(x+size,y+13*size);ctx.stroke();
    ctx.fillStyle=color;
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.arc(x+Math.cos(a)*3.5*size,y+Math.sin(a)*3.5*size,2.4*size,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle="#f8ed9c";ctx.beginPath();ctx.arc(x,y,1.5*size,0,Math.PI*2);ctx.fill();
  }
  function drawDistrict(b) {
    const near=route.some(p=>Math.hypot(p.x-b.x-b.w/2,p.y-b.y-b.h/2)<285);
    ctx.fillStyle="#1d272f55";roundRect(b.x-6,b.y+8,b.w+12,b.h+12,12);ctx.fill();
    ctx.fillStyle="#41535a";roundRect(b.x-5,b.y,b.w+10,b.h+7,12);ctx.fill();
    ctx.fillStyle=b.color;roundRect(b.x,b.y,b.w,b.h,10);ctx.fill();
    const grad=ctx.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h);grad.addColorStop(0,"#ffffff33");grad.addColorStop(1,"#11192229");
    ctx.fillStyle=grad;roundRect(b.x+7,b.y+7,b.w-14,b.h-14,8);ctx.fill();
    ctx.fillStyle="#111b263d";roundRect(b.x+16,b.y+15,b.w-32,b.h-30,7);ctx.fill();
    const n=3+Math.floor(b.w/75);
    for(let i=0;i<n;i++){const wx=b.x+23+i*(b.w-46)/(n-1);ctx.fillStyle=i%3?"#8deedd70":"#ffc47c85";roundRect(wx,b.y+22+(i%2)*7,7,b.h*.37,3);ctx.fill();}
    for(let i=0;i<(near?8:12);i++){
      const t=b.seed+i*19.7,fx=b.x+15+(Math.sin(t)+1)/2*(b.w-30),fy=b.y+15+(Math.cos(t*.71)+1)/2*(b.h-30);
      if(fx>b.x+52&&fx<b.x+b.w-52&&fy>b.y+48&&fy<b.y+b.h-42)continue;
      flower(fx,fy,.5+(i%3)*.12,flowers[(i+Math.floor(b.seed))%flowers.length]);
    }
  }
  function drawRoad() {
    function path(){ctx.beginPath();for(let i=0;i<=route.length*24;i++){const p=routePoint(i/24);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.closePath();}
    ctx.lineJoin="round";ctx.lineCap="round";
    path();ctx.strokeStyle="#343c47";ctx.lineWidth=308;ctx.stroke();
    path();ctx.strokeStyle="#b1a99e";ctx.lineWidth=292;ctx.stroke();
    path();ctx.strokeStyle="#505967";ctx.lineWidth=274;ctx.stroke();
    path();ctx.strokeStyle="#ffffff2b";ctx.lineWidth=2;ctx.setLineDash([19,20]);ctx.lineDashOffset=-dash*8;ctx.stroke();ctx.setLineDash([]);
    for(let i=0;i<36;i++){
      const p=routePoint(i/4),q=routePoint(i/4+.01),a=Math.atan2(q.y-p.y,q.x-p.x)+Math.PI/2;
      for(const side of [-1,1]){ctx.fillStyle=i%2?"#f8a77f":"#f2ebe1";roundRect(p.x+Math.cos(a)*144*side-7,p.y+Math.sin(a)*144*side-5,14,9,2);ctx.fill();}
    }
  }
  function carDraw(x,y,angle,type,siren=0,stunned=false) {
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.fillStyle="#0a0f1580";roundRect(-21,-10,44,26,8);ctx.fill();
    ctx.fillStyle="#141a23";for(const [wx,wy] of [[-15,-16],[7,-16],[-15,10],[7,10]]){roundRect(wx,wy,11,7,2);ctx.fill();}
    ctx.fillStyle=type==="cop"?"#e5ebee":"#fc78b9";roundRect(-22,-11,43,22,7);ctx.fill();
    ctx.fillStyle=type==="cop"?"#7a97ad":"#bd438c";roundRect(-10,-8,20,16,5);ctx.fill();
    ctx.fillStyle=type==="cop"?"#bdeeff":"#b9fff0";roundRect(-7,-7,14,14,4);ctx.fill();
    ctx.fillStyle="#fff1bd";ctx.shadowColor="#fff1bd";ctx.shadowBlur=8;ctx.fillRect(18,-7,3,5);ctx.fillRect(18,2,3,5);ctx.shadowBlur=0;
    if(type==="cop"){ctx.fillStyle=stunned?"#b7a3ff":Math.sin(siren)>0?"#ff6376":"#588dff";ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=10;roundRect(-3,-3,7,6,2);ctx.fill();}
    ctx.restore();
  }
  function drawFlowerPickup(p) {
    const pulse=1+Math.sin(elapsed*4+p.x)*.13,color=p.type==="core"?"#ff8fc9":p.type==="boost"?"#75f3de":"#b7a3ff";
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(pulse,pulse);ctx.shadowColor=color;ctx.shadowBlur=15;
    ctx.fillStyle="#18222fc7";ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
    if(p.type==="core")flower(0,-2,1.7,color);else{ctx.fillStyle=color;ctx.font="bold 17px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(p.type==="boost"?"↯":"✦",0,1);}
    ctx.restore();
  }
  function drawWorld() {
    ctx.fillStyle="#405b54";ctx.fillRect(0,0,world.w,world.h);
    ctx.fillStyle="#38514d";for(let i=0;i<160;i++){ctx.globalAlpha=.12;ctx.beginPath();ctx.arc(i*193%world.w,i*317%world.h,22+i%4*7,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    drawRoad();buildings.forEach(drawDistrict);
    ctx.save();ctx.translate(route[0].x,route[0].y);
    ctx.fillStyle="#283c42";roundRect(-78,-29,156,58,9);ctx.fill();ctx.strokeStyle="#74f5d6";ctx.lineWidth=2;ctx.shadowColor="#74f5d6";ctx.shadowBlur=12;
    ctx.beginPath();ctx.moveTo(-53,7);ctx.lineTo(-34,-6);ctx.lineTo(-18,-6);ctx.lineTo(-5,-17);ctx.lineTo(30,-17);ctx.lineTo(51,-5);ctx.lineTo(58,8);ctx.closePath();ctx.stroke();
    ctx.shadowBlur=0;ctx.fillStyle="#95ffe9";ctx.font="bold 10px monospace";ctx.textAlign="center";ctx.fillText("SKYGARDEN / GARAGE",0,43);ctx.restore();
    ctx.save();ctx.translate(1200,900);ctx.strokeStyle="#77efda55";ctx.lineWidth=3;ctx.setLineDash([6,8]);ctx.beginPath();ctx.ellipse(0,0,112,62,.1,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="#405e58";ctx.beginPath();ctx.ellipse(0,0,68,33,.1,0,Math.PI*2);ctx.fill();for(let i=0;i<9;i++)flower(-50+i*12,Math.sin(i*2)*16,.8,flowers[i%5]);ctx.restore();
    pickups.forEach(p=>{if(!p.got)drawFlowerPickup(p);});
    cops.forEach(c=>carDraw(c.x,c.y,c.angle,"cop",c.siren,c.stunned>0));
    particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
    carDraw(car.x,car.y,car.angle,"player");
    if(car.shield>0){ctx.strokeStyle="#6fffff77";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(car.x,car.y,31,21,0,0,Math.PI*2);ctx.stroke();}
    if(cores===3&&Math.hypot(car.x-route[0].x,car.y-route[0].y)>110){
      const a=Math.atan2(route[0].y-car.y,route[0].x-car.x);ctx.save();ctx.translate(car.x+Math.cos(a)*70,car.y+Math.sin(a)*70);ctx.rotate(a);
      ctx.fillStyle="#76f5dc";ctx.shadowColor="#76f5dc";ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-8,-8);ctx.lineTo(-5,0);ctx.lineTo(-8,8);ctx.closePath();ctx.fill();ctx.restore();
    }
  }
  function draw() {
    const dpr=Math.min(devicePixelRatio||1,2),cam=Math.min(vw/900,vh/560);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,vw,vh);
    ctx.save();ctx.translate(vw/2+(rand()-.5)*shake,vh/2+(rand()-.5)*shake);ctx.scale(cam,cam);ctx.translate(-car.x,-car.y);drawWorld();ctx.restore();
    if(mode==="paused"){ctx.fillStyle="#080d13a8";ctx.fillRect(0,0,vw,vh);ctx.fillStyle="#f3f5f8";ctx.textAlign="center";ctx.font="800 28px Manrope,sans-serif";ctx.fillText("PAUSED",vw/2,vh/2);ctx.font="12px monospace";ctx.fillText("PRESS ESC TO KEEP ROLLING",vw/2,vh/2+25);}
  }
  function frame(time){const dt=Math.min(.04,(time-previous)/1000||0);previous=time;update(dt);draw();requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
})();
