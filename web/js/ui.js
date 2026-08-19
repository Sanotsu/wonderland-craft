'use strict';
// HUD：快捷栏（等距方块图标 + 生存计数角标）/ 模式与种子菜单 / 提示浮层 / 标题与暂停菜单
let selIdx=0;
let toastTimer=null;
let seedArmed=false;

function setGameMode(m,silent){
  if(gameMode!==m){
    gameMode=m;
    if(m==='survival'&&player.fly) setFly(false);
    saveDirty=true;
  }
  document.body.classList.toggle('survival',gameMode==='survival');
  syncModeButtons();
  if(typeof updateHearts==='function') updateHearts();
  updateInvUI();
  if(!silent) toast(m==='survival'
    ?'❤ 生存模式：小心跌落；方块要挖了才有'
    :'🎨 创造模式：自由飞行，方块无限');
}
function syncModeButtons(){
  const c=document.getElementById('modeCreative'), s=document.getElementById('modeSurvival');
  if(!c||!s) return;
  c.classList.toggle('on',gameMode==='creative');
  s.classList.toggle('on',gameMode==='survival');
}
function updateInvUI(){
  const bar=document.getElementById('hotbar');
  [...bar.children].forEach((el,i)=>{
    const ct=el.querySelector('.ct');
    if(!ct) return;
    if(gameMode==='survival'){
      const n=inv[i]|0;
      ct.style.display='block';
      ct.textContent=n>0?n:'';
      el.classList.toggle('empty',n<=0);
    }else{
      ct.style.display='none';
      el.classList.remove('empty');
    }
  });
}

function initUI(){
  const hotbarEl=document.getElementById('hotbar');
  HOTBAR.forEach((id,i)=>{
    const slot=document.createElement('div'); slot.className='slot';
    const cv=document.createElement('canvas'); cv.width=cv.height=48;
    drawIcon(cv.getContext('2d'),id);
    slot.appendChild(cv);
    const ct=document.createElement('b'); ct.className='ct'; ct.style.display='none';
    slot.appendChild(ct);
    if(i<10){ const k=document.createElement('span'); k.className='k';
      k.textContent=(i+1)%10; slot.appendChild(k); }
    slot.addEventListener('click',()=>selectSlot(i));
    hotbarEl.appendChild(slot);
  });
  document.getElementById('hint').textContent = IS_TOUCH
    ? '左侧滑动 移动 · 右侧滑动 转视角 · 轻点 放置 · 长按 破坏'
    : '左键 破坏 · 右键 放置 · 滚轮/数字 选方块 · F 飞行 · G 模式 · H 回茶会 · P 截图 · M 音乐';
  document.getElementById('btnSave').addEventListener('click',()=>{ saveGame(); toast('💾 进度已保存'); });
  document.getElementById('btnReset').addEventListener('click',()=>resetWorld());

  document.getElementById('modeCreative').addEventListener('click',()=>setGameMode('creative'));
  document.getElementById('modeSurvival').addEventListener('click',()=>setGameMode('survival'));
  syncModeButtons();

  const seedInput=document.getElementById('seedInput');
  seedInput.value=WORLD_SEED;
  document.getElementById('btnSeed').addEventListener('click',()=>{
    const v=seedInput.value.trim();
    if(!seedArmed){
      seedArmed=true;
      toast('🎲 再点一次「新世界」确认（当前进度将丢弃）');
      setTimeout(()=>seedArmed=false,2500);
      return;
    }
    newWorldWithSeed(v);
  });
  selectSlot(0);
}

function drawIcon(c,id){
  c.imageSmoothingEnabled=false;
  const bd=BLOCKS[id];
  if(bd.cross){
    // A8：十字面片按 bd.s 取贴图槽（原误用方块 id，萤火菌灯 id27 显示成槽 27 星光钻矿）
    const s=(bd.s%16)*16, sy=((bd.s/16)|0)*16;
    c.drawImage(atlas,s,sy,16,16,6,6,36,36);
    return;
  }
  const t=13,cx=24;
  c.setTransform(t,t/2,-t,t/2,cx,6);
  c.drawImage(atlas,(bd.t%16)*16,((bd.t/16)|0)*16,16,16,0,0,1,1);
  c.setTransform(t,t/2,0,t,24-t,6+t/2);
  c.drawImage(atlas,(bd.s%16)*16,((bd.s/16)|0)*16,16,16,0,0,1,1);
  c.fillStyle='rgba(20,5,40,.18)'; c.fillRect(0,0,1,1);
  c.setTransform(t,-t/2,0,t,24,6+t);
  c.drawImage(atlas,(bd.s%16)*16,((bd.s/16)|0)*16,16,16,0,0,1,1);
  c.fillStyle='rgba(20,5,40,.34)'; c.fillRect(0,0,1,1);
  c.setTransform(1,0,0,1,0,0);
}

function selectSlot(i){
  selIdx=i;
  const hotbarEl=document.getElementById('hotbar');
  [...hotbarEl.children].forEach((el,j)=>el.classList.toggle('sel',j===i));
  if(typeof updateHandBlock==='function') updateHandBlock(HOTBAR[i]);
  toast('🧱 '+BLOCKS[HOTBAR[i]].n+(gameMode==='survival'?' ×'+(inv[i]|0):''));
}

function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.style.opacity=1;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.style.opacity=0,1400);
}

function showPauseUI(){
  document.getElementById('subtitle').textContent='梦暂醒了片刻…';
  document.getElementById('story').innerHTML='茶会还在继续，玫瑰还没染红。<br>随时回来，仙境等你。';
  document.getElementById('play').textContent='🐇 继续梦境';
}
