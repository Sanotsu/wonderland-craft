'use strict';
// localStorage 存档 v2：种子 + 模式 + 方块 diff + 玩家状态 + 随身库存 + 血量 + 昼夜
// （SAVE_KEY 在 config.js 定义；v1 旧档自动迁移——旧世界等价种子 0，地形不变）
const edits=new Map();
let saveDirty=false, resetArmed=false, resetting=false;

function recordEdit(x,y,z,id){
  edits.set(x+','+y+','+z,id);
  saveDirty=true;
}
function isSaveDirty(){ return saveDirty; }

function saveGame(){
  // 重置/换种子重载期间禁止 pagehide 自动保存把旧进度写回
  if(resetting) return true;
  // B11：死亡期间落盘 = 「在茶会边醒来」：位置回出生点、满血、清飞行，避免关页面重进变成 1 血原地复活
  const dead=(typeof deathScreen!=='undefined')&&deathScreen;
  let ok=true;
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      seed:WORLD_SEED, mode:gameMode,
      e:Array.from(edits.entries()),
      p:dead?{x:spawn.x,y:spawn.y,z:spawn.z,yaw,pitch,fly:false}
        :{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw,pitch,fly:player.fly},
      inv:Array.from(inv), hp:dead?20:hp,
      s:selIdx, d:dayTime,
      m:(typeof musicOn==='boolean')?musicOn:true // B14：音乐开关持久化
    }));
    saveDirty=false;
  }catch(err){
    ok=false;
    // A1：配额溢出等保存失败不再静默（pagehide 场景 toast 不可见，属预期）
    toast('💾 保存失败：浏览器存储空间不足，进度未能写入');
  }
  return ok;
}

function loadGame(){
  let data=null;
  try{
    data=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    if(!data){ // v1 迁移：字段子集直接沿用（noise.js 已按种子 0 复原地形）
      data=JSON.parse(localStorage.getItem('wc_save_v1')||'null');
    }
  }catch(e){}
  if(!data) return;
  for(const [k,id] of (data.e||[])){
    const [x,y,z]=k.split(',').map(Number);
    setRaw(x,y,z,id);
  }
  if(data.p){
    player.pos.set(data.p.x,data.p.y,data.p.z);
    yaw=data.p.yaw; pitch=data.p.pitch;
    setFly(!!data.p.fly);
  }
  if(Array.isArray(data.inv)){
    for(let i=0;i<HOTBAR.length;i++) inv[i]=(typeof data.inv[i]==='number'&&data.inv[i]>0)?data.inv[i]|0:0;
  }
  if(typeof data.hp==='number') hp=Math.min(20,Math.max(1,Math.round(data.hp)));
  if(typeof data.s==='number'&&data.s>=0&&data.s<HOTBAR.length) selectSlot(data.s);
  if(typeof data.d==='number') dayTime=data.d;
  if(typeof data.m==='boolean'&&typeof musicOn!=='undefined') musicOn=data.m; // B14
  if(data.mode==='survival') setGameMode('survival',true); // 静默应用模式与 HUD
}

function resetWorld(){
  if(!resetArmed){
    resetArmed=true;
    toast('🗑 再点一次「重置世界」确认（不可恢复）');
    setTimeout(()=>resetArmed=false,2500);
    return;
  }
  try{ localStorage.removeItem(SAVE_KEY); localStorage.removeItem('wc_save_v1'); }catch(e){}
  resetting=true;
  location.reload();
}
// 用指定种子开新世界（标题菜单调用；数字或任意文字均可）
function newWorldWithSeed(seedStr){
  const s=/^-?\d+$/.test(seedStr)?(+seedStr|0):hashStr(seedStr||String(Math.random()));
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify({seed:s,mode:gameMode})); }catch(e){}
  resetting=true;
  location.reload();
}
