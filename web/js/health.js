'use strict';
// P0 生存模式：血量（10 心 = 20 点）/ 受伤红闪 / 跌落伤害结算入口 /
// 死亡遮罩与茶会重生 / 脱战缓慢回血；创造模式下全部静默
let hp=20, lastDmgT=-1e9, regenAcc=0, deathScreen=false;

function initHealth(){
  updateHearts();
  document.getElementById('btnRespawn').addEventListener('click',()=>respawn());
}
function updateHearts(){
  const el=document.getElementById('hearts');
  el.style.display=gameMode==='survival'?'flex':'none';
  if(gameMode!=='survival') return;
  // 纯 CSS 红心（b=底板空心 em>s=血量填充，半心裁切左半），不依赖 emoji 字体
  let html='';
  for(let i=0;i<10;i++){
    const cls=hp>=i*2+2?'':(hp===i*2+1?' half':' off');
    html+='<span class="ht'+cls+'"><b></b><em><s></s></em></span>';
  }
  el.innerHTML=html;
}
function hurtFlash(){
  const h=document.getElementById('hurt');
  h.classList.remove('on');
  void h.offsetWidth; // 重启动画
  h.classList.add('on');
}
function damage(n,reason){
  if(gameMode!=='survival'||deathScreen||n<=0) return;
  hp=Math.max(0,hp-n);
  lastDmgT=performance.now();
  updateHearts(); hurtFlash();
  sfxBlip(180); sfxBlip(140);
  if(hp<=0) die(reason);
}
function die(reason){
  deathScreen=true;
  document.getElementById('deathMsg').textContent=reason||'梦境轻轻散去了…';
  if(document.pointerLockElement&&document.exitPointerLock) document.exitPointerLock();
  applyLockState(false);            // 保存并退出锁定（死亡期间标题保持隐藏）
  document.getElementById('title').style.display='none';
  document.getElementById('death').style.display='flex';
}
function respawn(){
  deathScreen=false;
  document.getElementById('death').style.display='none';
  hp=20; regenAcc=0; updateHearts();
  player.pos.copy(spawn);
  player.vel.set(0,0,0);
  fallDist=0;
  enterGame(renderer.domElement);
}
function updateHealth(dt, now){
  if(gameMode!=='survival'||deathScreen) return;
  if(hp>0&&hp<20&&now-lastDmgT>8000){ // 脱战 8 秒后缓慢回血
    regenAcc+=dt;
    if(regenAcc>3.5){ regenAcc=0; hp=Math.min(20,hp+1); updateHearts(); }
  }
}
