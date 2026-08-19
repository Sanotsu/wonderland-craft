'use strict';
// 确定性随机与值噪声（世界生成与贴图绘制共用）
// P0 种子系统：WORLD_SEED 在世界生成前确定（URL ?seed= > v2 存档 > v1 旧档(等价盐 0) > 随机），
// 加盐进 rnd2 哈希后，地形/结构/洞穴/矿石全部随种子确定性地变化
function hashStr(s){ let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0; }
let WORLD_SEED=(Math.random()*1e9)|0;
try{
  const qs=new URLSearchParams(location.search).get('seed');
  const d2=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
  const d1=JSON.parse(localStorage.getItem('wc_save_v1')||'null');
  if(qs!==null&&qs!=='') WORLD_SEED=/^-?\d+$/.test(qs)?(+qs|0):hashStr(qs);
  else if(d2&&typeof d2.seed==='number') WORLD_SEED=d2.seed|0;
  else if(d1) WORLD_SEED=0; // v1 旧档：未加盐哈希等价于种子 0，迁移后地形不变
}catch(e){}
function rnd2(x,y){ let h=(Math.imul(x,374761393)+Math.imul(y,668265263)
                               +Math.imul(WORLD_SEED|0,951274213))|0;
  h=Math.imul(h^(h>>>13),1274126177); h^=h>>>16; return (h>>>0)/4294967295; }
function lerp(a,b,t){ return a+(b-a)*t; }
function smooth(t){ return t*t*(3-2*t); }
function vnoise(x,z){ const xi=Math.floor(x), zi=Math.floor(z), xf=x-xi, zf=z-zi;
  const a=rnd2(xi,zi), b=rnd2(xi+1,zi), c=rnd2(xi,zi+1), d=rnd2(xi+1,zi+1);
  return lerp(lerp(a,b,smooth(xf)), lerp(c,d,smooth(xf)), smooth(zf)); }
function fbm(x,z){ return vnoise(x,z)*.6 + vnoise(x*2.7+31,z*2.7+17)*.3 + vnoise(x*6.1+90,z*6.1+7)*.1; }
// P0 洞穴：三线性值噪声（双频带交叠出隧道网）
function vnoise3(x,y,z){
  const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
  const xf=smooth(x-xi), yf=smooth(y-yi), zf=smooth(z-zi);
  const r=(dx,dy,dz)=>rnd2(xi+dx+(zi+dz)*7919, (yi+dy)*131+(zi+dz)*17);
  return lerp(
    lerp(lerp(r(0,0,0),r(1,0,0),xf), lerp(r(0,1,0),r(1,1,0),xf), yf),
    lerp(lerp(r(0,0,1),r(1,0,1),xf), lerp(r(0,1,1),r(1,1,1),xf), yf), zf);
}
function mulberry(s){ return function(){ s|=0; s=(s+0x6D2B79F5)|0;
  let t=Math.imul(s^(s>>>15),1|s); t=(t+Math.imul(t^(t>>>7),61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296; }; }
