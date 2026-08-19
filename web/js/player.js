'use strict';
// 玩家：第一人称物理（AABB/重力/跳跃/飞行/自动跳跃）、键鼠与触屏输入、
// 视线射线与方块增删、手持方块显示与挥动动画
const HW=.3, PH=1.8, EYE=1.62, EPS=.001;
const spawn=new THREE.Vector3(88.5,teaH+1.02,96.5);
const player={pos:spawn.clone(),vel:new THREE.Vector3(),onGround:false,fly:false};
let fallDist=0; // P0 生存：累计下落距离，落地结算跌落伤害
let yaw=0, pitch=-.08, locked=false, welcomed=false;
let lastHit='none'; // 调试：最近一次视线命中的方块（?debug=1 时显示）
const keys={};
const mouse={l:false,r:false,t:0};
let hlBox=null, cameraRef=null;

// 触屏状态
const joy={id:null, ox:0, oy:0, x:0, y:0};
let lastTouchEnd=0; // A3：用于过滤触摸派生的合成 mousemove
const look={id:null, lx:0, ly:0, t0:0, moved:0, consumed:false, holdTimer:null};
const JOY_R=52;

// 手持方块
let handGroup=null, swingT=0, bobPhase=0;

function setFly(v){
  if(v&&gameMode==='survival') v=false; // 生存模式禁飞
  player.fly=v;
  player.vel.set(0,0,0);
  document.body.classList.toggle('flying',v);
}
function goHome(){
  player.pos.copy(spawn);
  player.vel.set(0,0,0);
  toast('🐇 回到疯狂茶会');
}
function screenshot(){
  try{
    renderer.render(scene,camera);
    const a=document.createElement('a');
    a.download='wonderland-'+Date.now()+'.png';
    a.href=renderer.domElement.toDataURL('image/png');
    a.click();
    toast('📸 截图已保存');
  }catch(e){}
}

function initPlayer(scene, camera, dom){
  cameraRef=camera;
  hlBox=new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002,1.002,1.002)),
    new THREE.LineBasicMaterial({color:0xffe9a8,transparent:true,opacity:.95}));
  hlBox.visible=false; scene.add(hlBox);

  handGroup=new THREE.Group();
  handGroup.position.set(.6,-.52,-.9);
  handGroup.rotation.set(.1,-.35,.05);
  handGroup.visible=false;
  camera.add(handGroup);
  updateHandBlock(HOTBAR[selIdx]);

  addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(['w','a','s','d',' ','shift','f','g','m','h','p'].includes(k)) e.preventDefault();
    keys[k]=true;
    if(k==='f'&&locked){
      if(gameMode==='survival'){ toast('❤ 生存模式不能飞行'); }
      else{ setFly(!player.fly);
        toast(player.fly?'🕊 梦境飞行：开':'🕊 梦境飞行：关'); }
    }
    if(k==='g'&&locked) setGameMode(gameMode==='survival'?'creative':'survival');
    if(k==='m'){ musicOn=!musicOn; saveDirty=true; toast(musicOn?'🎵 音乐盒：开':'🎵 音乐盒：关'); } // B14：切换即持久化
    if(k==='h') goHome();
    if(k==='p') screenshot();
    // A5：数字键选前 10 格，Shift+数字选第 11-20 格（余下两格滚轮/点选）
    if(k>='1'&&k<='9') selectSlot(e.shiftKey? +k+9 : +k-1);
    if(k==='0') selectSlot(e.shiftKey? 19 : 9);
  });
  addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
  addEventListener('wheel',e=>{
    if(!locked) return;
    e.preventDefault();
    selectSlot((selIdx+(e.deltaY>0?1:HOTBAR.length-1))%HOTBAR.length);
  },{passive:false});
  addEventListener('mousemove',e=>{
    if(!locked) return;
    // A3：触屏设备上点按会派生合成 mousemove（无 pointerType 可辨），
    // 仅在触摸结束后短窗口内忽略，真实鼠标（触屏笔记本）不受影响
    if(IS_TOUCH && performance.now()-lastTouchEnd<600) return;
    yaw-=e.movementX*0.0022; pitch-=e.movementY*0.0022;
    pitch=Math.max(-1.55,Math.min(1.55,pitch));
  });
  addEventListener('mousedown',e=>{
    if(!locked) return;
    // 触屏合成 mousedown 过滤：点 hotbar 选格/按 UI 按钮后浏览器会派生合成鼠标事件，
    // 若不拦截会误触发 doBreak/doPlace（与 mousemove 的 A3 守卫同一策略）
    if(IS_TOUCH && performance.now()-lastTouchEnd<600) return;
    if(e.button===0){ mouse.l=true; doBreak(); mouse.t=performance.now(); }
    if(e.button===2){ mouse.r=true; doPlace(); mouse.t=performance.now(); }
    if(e.button===1){ // 中键取色
      e.preventDefault();
      const hit=raycast(eyePos(),camDir(),6.5);
      if(hit){ const i=HOTBAR.indexOf(hit.id); if(i>=0) selectSlot(i); }
    }
  });
  addEventListener('mouseup',e=>{
    if(IS_TOUCH && performance.now()-lastTouchEnd<600) return; // 过滤触屏合成事件
    if(e.button===0)mouse.l=false; if(e.button===2)mouse.r=false; });

  // 触屏上任何触摸结束（含 hotbar/按钮等 DOM）都刷新时间戳，
  // 供 mousedown/mouseup/mousemove 的合成事件守卫使用
  addEventListener('touchend',()=>{ lastTouchEnd=performance.now(); },{capture:true,passive:true});
  addEventListener('touchcancel',()=>{ lastTouchEnd=performance.now(); },{capture:true,passive:true});
  addEventListener('contextmenu',e=>e.preventDefault());

  if(IS_TOUCH){ initTouchInput(dom); initTouchButtons(); }
}

/* ---------------- 触屏输入 ---------------- */
function initTouchInput(canvas){
  const joyEl=document.getElementById('joy'), knob=document.getElementById('joyKnob');
  const setKnob=(dx,dy)=>{ knob.style.transform=`translate(${dx}px,${dy}px)`; };

  canvas.addEventListener('touchstart',e=>{
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.clientX<innerWidth*.42 && joy.id===null){
        joy.id=t.identifier; joy.ox=t.clientX; joy.oy=t.clientY; joy.x=0; joy.y=0;
        joyEl.style.display='block';
        joyEl.style.left=(t.clientX-60)+'px';
        joyEl.style.top=(t.clientY-60)+'px';
        setKnob(0,0);
      }else if(look.id===null){
        look.id=t.identifier; look.lx=t.clientX; look.ly=t.clientY;
        look.t0=performance.now(); look.moved=0; look.consumed=false;
        look.holdTimer=setTimeout(()=>{
          if(look.id!==null&&!look.consumed&&look.moved<14){
            look.consumed=true;
            doBreak();
            if(navigator.vibrate) navigator.vibrate(25);
            mouse.l=true; mouse.t=performance.now(); // 继续按住则连续挖掘
          }
        },360);
      }
    }
  },{passive:false});

  canvas.addEventListener('touchmove',e=>{
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier===joy.id){
        let dx=t.clientX-joy.ox, dy=t.clientY-joy.oy;
        const len=Math.hypot(dx,dy), m=Math.min(1,len/JOY_R);
        if(len>0){ dx=dx/len*m*JOY_R; dy=dy/len*m*JOY_R; }
        setKnob(dx,dy);
        joy.x=dx/JOY_R; joy.y=dy/JOY_R;
      }else if(t.identifier===look.id){
        const dx=t.clientX-look.lx, dy=t.clientY-look.ly;
        look.lx=t.clientX; look.ly=t.clientY;
        look.moved+=Math.abs(dx)+Math.abs(dy);
        yaw-=dx*.0044; pitch-=dy*.0044;
        pitch=Math.max(-1.55,Math.min(1.55,pitch));
      }
    }
  },{passive:false});

  const end=e=>{
    e.preventDefault();
    lastTouchEnd=performance.now(); // A3：供 mousemove 守卫过滤合成事件
    for(const t of e.changedTouches){
      if(t.identifier===joy.id){
        joy.id=null; joy.x=0; joy.y=0; joyEl.style.display='none';
      }else if(t.identifier===look.id){
        clearTimeout(look.holdTimer);
        const dur=performance.now()-look.t0;
        if(!look.consumed&&look.moved<14&&dur<300) doPlace(); // 轻点=放置
        look.id=null;
        mouse.l=false; // 结束屏幕长按的连续挖掘
      }
    }
  };
  canvas.addEventListener('touchend',end,{passive:false});
  canvas.addEventListener('touchcancel',end,{passive:false});
}

function initTouchButtons(){
  const hold=(id,down,up)=>{
    const el=document.getElementById(id);
    el.addEventListener('pointerdown',e=>{ e.preventDefault();
      // 指针捕获：手指在按钮上微移/滑出也不松开，长按才稳定
      if(el.setPointerCapture){ try{ el.setPointerCapture(e.pointerId); }catch(_){ } }
      down(); });
    el.addEventListener('pointerup',()=>up&&up());
    el.addEventListener('pointercancel',()=>up&&up());
    el.addEventListener('lostpointercapture',()=>up&&up());
  };
  hold('btnJump',()=>keys[' ']=true,()=>keys[' ']=false);
  hold('btnDown',()=>keys['shift']=true,()=>keys['shift']=false);
  hold('btnBreak',()=>{ doBreak(); mouse.l=true; mouse.t=performance.now(); },()=>mouse.l=false);
  hold('btnPlace',()=>{ doPlace(); mouse.r=true; mouse.t=performance.now(); },()=>mouse.r=false);
  const tap=(id,fn)=>{ const el=document.getElementById(id);
    el.addEventListener('pointerdown',e=>{ e.preventDefault(); fn(); }); };
  tap('btnFly',()=>{
    if(gameMode==='survival'){ toast('❤ 生存模式不能飞行'); return; }
    setFly(!player.fly);
    toast(player.fly?'🕊 梦境飞行：开':'🕊 梦境飞行：关'); });
  tap('btnHome',()=>goHome());
}

/* ---------------- 物理 ---------------- */
function isLocked(){ return locked; }
function setLocked(v){ locked=v; }
function enterGame(dom){
  initAudio();
  if(IS_TOUCH){ applyLockState(true); tryLandscape(); }
  else if(dom.requestPointerLock){ dom.requestPointerLock(); }
  else{ applyLockState(true); }
}
// 移动端浏览器：全屏并尝试锁定横屏（iOS 不支持则靠竖屏提示遮罩）
function tryLandscape(){
  try{
    const el=document.documentElement;
    const fs=(el.requestFullscreen&&!document.fullscreenElement)
      ? el.requestFullscreen() : Promise.resolve();
    Promise.resolve(fs)
      .then(()=>{ if(screen.orientation&&screen.orientation.lock)
        return screen.orientation.lock('landscape'); })
      .catch(()=>{});
  }catch(e){}
}

function solidAt(x,y,z){ const b=getB(x,y,z); return b!==0&&BLOCKS[b].solid; }
function collideBox(px,py,pz){
  const x0=Math.floor(px-HW),x1=Math.floor(px+HW-1e-9),
        y0=Math.floor(py),y1=Math.floor(py+PH-1e-9),
        z0=Math.floor(pz-HW),z1=Math.floor(pz+HW-1e-9);
  for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)
    if(solidAt(x,y,z)) return [x,y,z];
  return null;
}
function moveAxis(a,d){
  const p=player.pos; p[a]+=d;
  for(let iter=0;iter<4;iter++){
    const c=collideBox(p.x,p.y,p.z);
    if(!c) return;
    if(a==='y'){
      if(d<0){ p.y=c[1]+1+EPS; player.vel.y=0; player.onGround=true; }
      else{ p.y=c[1]-PH-EPS; player.vel.y=0; }
    }else if(a==='x'){
      p.x = d>0 ? c[0]-HW-EPS : c[0]+1+HW+EPS; player.vel.x=0;
    }else{
      p.z = d>0 ? c[2]-HW-EPS : c[2]+1+HW+EPS; player.vel.z=0;
    }
  }
}
function stepPhysics(dt){
  const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  let ix=0,iz=0;
  if(keys['w'])iz+=1; if(keys['s'])iz-=1; if(keys['d'])ix+=1; if(keys['a'])ix-=1;
  if(IS_TOUCH&&joy.id!==null){ ix+=joy.x; iz+=-joy.y; } // 摇杆模拟量输入
  const joySprint=IS_TOUCH&&joy.id!==null&&Math.hypot(joy.x,joy.y)>.95;
  const sprint=(keys['shift']&&!player.fly)||joySprint;
  const speed=player.fly?12:(sprint?8.6:5.7);
  const wish=new THREE.Vector3().addScaledVector(fwd,iz).addScaledVector(right,ix);
  const wl=wish.length();
  if(wl>0) wish.multiplyScalar(speed*Math.min(1,wl)/wl);

  if(IS_TOUCH&&!player.fly&&player.onGround&&wl>speed*.3){ // 自动跳上 1 格台阶（飞行时禁用，避免腾空突兀）
    const mdx=wish.x/wl, mdz=wish.z/wl;
    const bx=Math.floor(player.pos.x+mdx*.75), bz=Math.floor(player.pos.z+mdz*.75);
    const fy=Math.floor(player.pos.y+.05);
    if(solidAt(bx,fy,bz)&&!solidAt(bx,fy+1,bz)&&!solidAt(bx,fy+2,bz)&&
       !solidAt(Math.floor(player.pos.x),fy+2,Math.floor(player.pos.z))){
      player.vel.y=8.2;
    }
  }

  const acc=player.fly?10:(player.onGround?12:3.2);
  const t=Math.min(1,acc*dt);
  player.vel.x+=(wish.x-player.vel.x)*t;
  player.vel.z+=(wish.z-player.vel.z)*t;
  if(player.fly){
    let vy=0; if(keys[' '])vy=speed; if(keys['shift'])vy=-speed;
    // 按住时快速起升/下降，松开后缓慢漂停（气泡般的悬浮感）
    const rate = vy!==0 ? 16 : 5;
    player.vel.y+=(vy-player.vel.y)*Math.min(1,rate*dt);
    fallDist=0;
  }else{
    player.vel.y-=26*dt;
    if(player.vel.y<-42)player.vel.y=-42;
    if(player.vel.y<0) fallDist-=player.vel.y*dt;
    if(keys[' ']&&player.onGround){ player.vel.y=8.6; player.onGround=false; }
  }
  player.onGround=false;
  moveAxis('y',player.vel.y*dt);
  moveAxis('x',player.vel.x*dt);
  moveAxis('z',player.vel.z*dt);
  if(player.onGround){ // 落地：结算跌落伤害（>3.5 格开始）
    if(fallDist>3.5) damage(Math.min(20,Math.round(fallDist-3)),'从高处跌进了梦的裂缝');
    fallDist=0;
  }
  if(player.pos.y<-10){
    if(gameMode==='survival'){ damage(99,'坠入了无梦的深渊'); }
    player.pos.copy(spawn); player.vel.set(0,0,0); fallDist=0;
  }
}

/* ---------------- 射线与增删 ---------------- */
function raycast(o,dir,maxD){
  let ix=Math.floor(o.x),iy=Math.floor(o.y),iz=Math.floor(o.z);
  const sx=dir.x>0?1:-1, sy=dir.y>0?1:-1, sz=dir.z>0?1:-1;
  const dx=Math.abs(1/dir.x), dy=Math.abs(1/dir.y), dz=Math.abs(1/dir.z);
  let tx=dx===Infinity?Infinity:(dir.x>0?(ix+1-o.x):(o.x-ix))*dx;
  let ty=dy===Infinity?Infinity:(dir.y>0?(iy+1-o.y):(o.y-iy))*dy;
  let tz=dz===Infinity?Infinity:(dir.z>0?(iz+1-o.z):(o.z-iz))*dz;
  let face=[0,0,0], t=0;
  for(let i=0;i<160&&t<=maxD;i++){
    const b=getB(ix,iy,iz);
    if(b) return {x:ix,y:iy,z:iz,id:b,face};
    if(tx<ty&&tx<tz){ ix+=sx;t=tx;tx+=dx;face=[-sx,0,0]; }
    else if(ty<tz){ iy+=sy;t=ty;ty+=dy;face=[0,-sy,0]; }
    else{ iz+=sz;t=tz;tz+=dz;face=[0,0,-sz]; }
  }
  return null;
}
function camDir(){ const v=new THREE.Vector3(); cameraRef.getWorldDirection(v); return v; }
function eyePos(){ return new THREE.Vector3(player.pos.x,player.pos.y+EYE,player.pos.z); }

function doBreak(){
  const hit=raycast(eyePos(),camDir(),6.5);
  if(!hit) return;
  const bd=BLOCKS[hit.id];
  setLive(hit.x,hit.y,hit.z,0);
  const above=getB(hit.x,hit.y+1,hit.z);
  if(above&&BLOCKS[above].cross){
    setLive(hit.x,hit.y+1,hit.z,0);
    if(gameMode==='survival') spawnDrop(hit.x+.5,hit.y+1.35,hit.z+.5,above);
  }
  spawnBurst(hit.x+.5,hit.y+.5,hit.z+.5,bd.c);
  sfxCrunch();
  swingT=1;
  if(gameMode==='survival') spawnDrop(hit.x+.5,hit.y+.35,hit.z+.5,hit.id);
}
function doPlace(){
  const hit=raycast(eyePos(),camDir(),6.5);
  if(!hit) return;
  const id=HOTBAR[selIdx], bd=BLOCKS[id];
  if(gameMode==='survival'&&(inv[selIdx]|0)<=0){
    toast('🎒 '+bd.n+' 用完了，去挖一点回来吧');
    return;
  }
  let tx,ty,tz;
  if(BLOCKS[hit.id].cross){ tx=hit.x;ty=hit.y;tz=hit.z; }
  else{ tx=hit.x+hit.face[0]; ty=hit.y+hit.face[1]; tz=hit.z+hit.face[2]; }
  if(ty<0||ty>=H||tx<0||tz<0||tx>=W||tz>=D) return;
  const cur=getB(tx,ty,tz);
  if(cur!==0&&!BLOCKS[cur].cross) return;
  if(bd.cross&&!solidAt(tx,ty-1,tz)){ toast('🌹 需要种在方块上'); return; }
  if(bd.solid){
    const p=player.pos;
    if(tx+1>p.x-HW&&tx<p.x+HW&&ty+1>p.y&&ty<p.y+PH&&tz+1>p.z-HW&&tz<p.z+HW) return;
  }
  if(!setLive(tx,ty,tz,id)) return;
  if(gameMode==='survival'){
    inv[selIdx]=Math.max(0,(inv[selIdx]|0)-1);
    updateInvUI(); saveDirty=true;
  }
  sfxBlip(520+((tx+tz)&3)*60);
  swingT=1;
}

/* ---------------- 手持方块 ---------------- */
function buildHandGeometry(id){
  const bd=BLOCKS[id];
  const p=[],u=[],col=[],bl=[],ind=[];
  function quad(pts,t,light){
    const base=p.length/3, uvs=[[0,0],[1,0],[1,1],[0,1]];
    for(let i=0;i<4;i++){
      p.push(pts[i][0],pts[i][1],pts[i][2]);
      u.push(uvs[i][0]?t.u1:t.u0, uvs[i][1]?t.v1:t.v0);
      col.push(light,light,light);
      bl.push(.9); // 手持物恒定亮度的块光下限，夜晚也看得清
    }
    ind.push(base,base+1,base+2,base,base+2,base+3);
  }
  if(bd.cross){
    quad([[0,0,0],[1,0,1],[1,1,1],[0,1,0]],tileUV(bd.s),1);
  }else{
    for(const f of FACES){
      const t=tileUV(f.dir[1]>0?bd.t:(f.dir[1]<0?bd.b:bd.s));
      quad(f.corners.map(c=>c.p),t,f.light);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  geo.setAttribute('bl',new THREE.Float32BufferAttribute(bl,1));
  geo.setIndex(ind);
  geo.translate(-.5,-.5,-.5);
  return geo;
}
function updateHandBlock(id){
  if(!handGroup) return;
  while(handGroup.children.length){
    const m=handGroup.children.pop();
    m.geometry.dispose();
  }
  const bd=BLOCKS[id];
  const mat=bd.cross?matCut:(bd.tr?matTrans:matSolid);
  const mesh=new THREE.Mesh(buildHandGeometry(id),mat);
  mesh.scale.setScalar(.4);
  handGroup.add(mesh);
}

/* ---------------- 每帧驱动 ---------------- */
function stepPlayer(dt, now){
  const steps=Math.max(1,Math.ceil(dt/0.009)), h=dt/steps;
  for(let i=0;i<steps;i++) stepPhysics(h);
  cameraRef.position.copy(eyePos());
  cameraRef.rotation.set(pitch,yaw,0);
  if(!welcomed){
    welcomed=true;
    toast(IS_TOUCH?'🐇 欢迎来到仙境！（建议横屏游玩）':'🐇 欢迎来到仙境！去茶会看看吧（往前走）');
  }
  if(mouse.l&&now-mouse.t>(gameMode==='survival'?520:230)){ doBreak(); mouse.t=now; }
  if(mouse.r&&now-mouse.t>230){ doPlace(); mouse.t=now; }
  cameraRef.updateMatrixWorld();
  const hit=raycast(eyePos(),camDir(),6.5);
  lastHit = hit ? (hit.x+','+hit.y+','+hit.z+'#'+hit.id) : 'none';
  if(hit){
    // A4：十字面片（玫瑰）用缩小贴地的线框，普通方块保持整格
    const cross=!!(BLOCKS[hit.id]&&BLOCKS[hit.id].cross);
    hlBox.visible=true;
    hlBox.position.set(hit.x+.5, hit.y+(cross?.31:.5), hit.z+.5);
    hlBox.scale.setScalar(cross?.62:1);
  }
  else{ hlBox.visible=false; hlBox.scale.setScalar(1); }

  const hs=Math.hypot(player.vel.x,player.vel.z);
  bobPhase+=hs*dt*1.9;
  swingT=Math.max(0,swingT-dt*4.5);
  if(handGroup){
    handGroup.visible=true;
    handGroup.position.set(.6, -.52+Math.sin(bobPhase)*.02-swingT*.1, -.9-swingT*.12);
    handGroup.rotation.set(.1-swingT*.85,-.35,.05);
  }
}

function menuCamera(now){
  const t=now*.00008;
  const mx=88+Math.sin(t)*17, mz=88+Math.cos(t)*17;
  const my=Math.max(teaH+9, groundH(Math.floor(mx),Math.floor(mz))+3);
  cameraRef.position.set(mx,my,mz);
  cameraRef.lookAt(88,teaH+2,88);
  hlBox.visible=false;
  if(handGroup) handGroup.visible=false;
}
