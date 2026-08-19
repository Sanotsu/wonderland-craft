'use strict';
// 入口：场景/渲染器初始化、锁定状态（指针锁定 / 触屏软锁定）、存档、主循环
let scene, camera, renderer;

function applyLockState(v){
  setLocked(v);
  document.body.classList.toggle('playing',v);
  document.getElementById('crosshair').style.display=v?'block':'none';
  document.getElementById('title').style.display=(v||deathScreen)?'none':'flex';
  if(!v){ showPauseUI(); saveGame(); }
}

// C7：错误日志保留最近 3 条，级联错误不再被首错覆盖
const errLog=[];
window.onerror = function(m,s,l){
  const src=(s||'?').split('/').pop();
  errLog.push(m+' @'+src+':'+l);
  if(errLog.length>3) errLog.shift();
  const e=document.getElementById('err');
  e.style.display='block'; e.textContent='脚本错误: '+errLog.join(' ｜ ');
};

(function boot(){
  if(typeof THREE==='undefined'){
    const e=document.getElementById('err');
    e.style.display='block';
    e.textContent='无法加载 lib/three.min.js，请检查项目文件是否完整';
    return;
  }
  if(IS_TOUCH) document.body.classList.add('touch');

  // ?debug=1：左下角状态条（自动化测试读取用）
  let dbgEl=null;
  if(new URLSearchParams(location.search).has('debug')){
    dbgEl=document.createElement('div'); dbgEl.id='debug';
    document.body.appendChild(dbgEl);
  }

  scene=new THREE.Scene();
  scene.background=new THREE.Color(0xffd9ea);
  scene.fog=new THREE.Fog(0xffd9ea,50,115);
  camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,1500);
  camera.rotation.order='YXZ';
  scene.add(camera); // 让手持方块作为相机子节点渲染
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH?1.5:1.75));
  renderer.setSize(innerWidth,innerHeight);
  document.body.appendChild(renderer.domElement);
  addEventListener('resize',applyViewport);
  function applyViewport(){ camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); }
  // 全屏/横竖屏切换可能吞掉 resize 事件：帧内自愈
  let lastVW=innerWidth, lastVH=innerHeight;

  initSky(scene);
  initParticles(scene);
  initUI();
  initHealth();
  initPlayer(scene, camera, renderer.domElement);
  loadGame();          // 先应用存档（方块 diff / 模式 / 库存 / 血量）
  computeAllLight();   // 再烘焙体素光照
  initCreatures(scene);
  buildAllChunks();

  document.addEventListener('pointerlockchange',()=>{
    applyLockState(document.pointerLockElement===renderer.domElement);
  });
  document.addEventListener('pointerlockerror',()=>{ // A2：锁定被拒时给出反馈
    toast('🖱 指针锁定被浏览器拒绝，请再点一次「坠入仙境」重试');
  });
  document.getElementById('play').addEventListener('click',()=>enterGame(renderer.domElement));
  renderer.domElement.addEventListener('click',()=>{ if(!isLocked()) enterGame(renderer.domElement); });
  document.getElementById('btnPause').addEventListener('click',()=>applyLockState(false));
  addEventListener('pagehide',()=>saveGame());
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) saveGame(); });

  let last=performance.now(), fps=0, fpsN=0, fpsT=0, saveAcc=0;
  function frame(now){
    requestAnimationFrame(frame);
    if(innerWidth!==lastVW||innerHeight!==lastVH){ // 自愈尺寸
      lastVW=innerWidth; lastVH=innerHeight; applyViewport();
    }
    let dt=Math.min(.05,(now-last)/1000); last=now;
    fpsN++; fpsT+=dt; if(fpsT>=.5){ fps=Math.round(fpsN/fpsT); fpsN=0; fpsT=0; }

    processDirty();
    if(isLocked()){
      stepPlayer(dt, now);
      updateDrops(dt, now, player.pos);
      updateHealth(dt, now);
    }
    else menuCamera(now);
    updateSky(dt, now, player.pos);
    updateCreatures(dt, now, player.pos);
    updateParts(dt);
    musicTick(dt);
    renderer.render(scene,camera);

    saveAcc+=dt;
    if(saveAcc>20){ saveAcc=0; if(isSaveDirty()) saveGame(); }

    const p=player.pos;
    const dayIcon=Math.sin(dayTime*Math.PI*2)>-0.15?'☀️':'🌙';
    document.getElementById('info').textContent=
      fps+' fps · x'+p.x.toFixed(0)+' y'+p.y.toFixed(0)+' z'+p.z.toFixed(0)+
      (player.fly?' · 飞行':'')+(gameMode==='survival'?' · 生存':'')+' · '+dayIcon;
    if(dbgEl) dbgEl.textContent=JSON.stringify({
      pos:[p.x.toFixed(2),p.y.toFixed(2),p.z.toFixed(2)], yaw:yaw.toFixed(3), pitch:pitch.toFixed(3),
      locked, mode:gameMode, hp, selIdx, drops:drops.length, hit:lastHit,
      inv:inv.join(',')});
  }
  requestAnimationFrame(frame);
})();
