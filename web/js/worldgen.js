'use strict';
// 世界数据与地形/结构生成
const world=new Uint8Array(W*H*D);
const glowSpots=[]; // 发光点缀（蘑菇伞盖/魔药/城堡窗），sky.js 据此生成柔光精灵
const idx=(x,y,z)=> x + z*W + y*W*D;
function getB(x,y,z){
  if(y<0) return B.STONE;
  if(y>=H) return B.AIR;
  if(x<0||z<0||x>=W||z>=D) return B.STONE;
  return world[idx(x,y,z)];
}
function setRaw(x,y,z,id){
  if(x<0||z<0||x>=W||z>=D||y<0||y>=H) return;
  world[idx(x,y,z)]=id;
}
function groundH(x,z){ return (6 + fbm(x*0.02+3.7, z*0.02+9.1)*11)|0; }

function columnBase(x,z,top){ // 石-土-草
  for(let y=0;y<=top;y++)
    setRaw(x,y,z, y===top?B.GRASS : (y>top-4?B.DIRT:B.STONE));
}
function flatten(cx,cz,rad,topId){
  const top=groundH(cx,cz);
  for(let dx=-rad;dx<=rad;dx++)for(let dz=-rad;dz<=rad;dz++){
    if(dx*dx+dz*dz>rad*rad) continue;
    const x=cx+dx,z=cz+dz; if(x<1||z<1||x>=W-1||z>=D-1)continue;
    for(let y=top+1;y<Math.min(H,top+14);y++) setRaw(x,y,z,B.AIR);
    for(let y=0;y<=top;y++) setRaw(x,y,z, y===top?(topId||B.GRASS):(y>top-4?B.DIRT:B.STONE));
  }
  return top;
}
function bigMushroom(x,z,capId,r){
  const h=groundH(x,z), n=4+((rnd2(x,z)*4)|0);
  for(let y=1;y<=n;y++) setRaw(x,h+y,z,B.STEM);
  setRaw(x,h,z,B.DIRT);
  const cr=2+(r||0), ty=h+n+1;
  for(let dx=-cr;dx<=cr;dx++)for(let dz=-cr;dz<=cr;dz++){
    const d2=dx*dx+dz*dz;
    if(d2>cr*cr+cr*0.6) continue;
    if(d2>(cr-1)*(cr-1) && rnd2(x+dx,z+dz)<.4) continue;
    setRaw(x+dx,ty,z+dz,capId);
    if(d2<=(cr-1)*(cr-1)*0.5) setRaw(x+dx,ty+1,z+dz,capId);
  }
  glowSpots.push({x:x+.5,y:ty+1.4,z:z+.5,
    c:capId===B.CAPR?'#ff7a8c':'#8fb0ff',r:cr*1.15+.8});
}
function candyTree(x,z){
  const h=groundH(x,z), n=4+((rnd2(x,z)*3)|0);
  const leaf=rnd2(x*3,z*5)<.55?B.LEAFP:B.LEAFL;
  for(let y=1;y<=n;y++) setRaw(x,h+y,z,B.BARK);
  const r=2+(rnd2(x+9,z+7)>.6?1:0), cy=h+n;
  for(let dx=-r;dx<=r;dx++)for(let dy=-1;dy<=r;dy++)for(let dz=-r;dz<=r;dz++){
    const d2=dx*dx+dy*dy*1.4+dz*dz;
    if(d2>r*r+1.2) continue;
    if(d2>(r-0.6)*(r-0.6) && rnd2(x+dx*7+dy,z+dz*5)<.35) continue;
    if(getB(x+dx,cy+dy,z+dz)===B.AIR) setRaw(x+dx,cy+dy,z+dz,leaf);
  }
}
function buildGrove(cx,cz){
  for(let i=0;i<11;i++){
    const a=rnd2(cx+i*3,cz-i)*Math.PI*2, d=3+rnd2(cx-i,cz+i*7)*13;
    bigMushroom(cx+Math.round(Math.sin(a)*d), cz+Math.round(Math.cos(a)*d),
      rnd2(cx+i,cz+i*2)<.6?B.CAPR:B.CAPB, rnd2(cx+i*5,cz)>.55?1:0);
  }
}
function buildForest(cx,cz){
  for(let i=0;i<14;i++){
    const a=rnd2(cx+i,cz+i*13)*Math.PI*2, d=2+rnd2(cx*2+i,cz-i)*14;
    const x=cx+Math.round(Math.sin(a)*d), z=cz+Math.round(Math.cos(a)*d);
    if(x>2&&z>2&&x<W-3&&z<D-3) candyTree(x,z);
  }
}
function buildGarden(cx,cz){
  flatten(cx,cz,7,B.GRASS);
  const h=groundH(cx,cz), half=6;
  for(let x=-half;x<=half;x++)for(let z=-half;z<=half;z++){
    const wx=cx+x, wz=cz+z, edge=(Math.abs(x)===half||Math.abs(z)===half);
    if(edge){
      if(z===half && Math.abs(x)<=1) continue;
      setRaw(wx,h+1,wz,B.HEDGE);
      if(Math.abs(x)===half&&Math.abs(z)===half) setRaw(wx,h+2,wz,B.HEDGE);
    } else if(((x&1)===0)&&((z&1)===0)&&getB(wx,h+1,wz)===B.AIR){
      setRaw(wx,h+1,wz, (((x+z)>>1)&1)?B.ROSER:B.ROSEW);
    }
  }
}
function buildChess(cx,cz){
  const h=flatten(cx,cz,8,0);
  for(let dx=-8;dx<=8;dx++)for(let dz=-8;dz<=8;dz++){
    if(dx*dx+dz*dz>64) continue;
    const x=cx+dx,z=cz+dz;
    setRaw(x,h,z, (((x>>1)+(z>>1))&1)?B.CHKW:B.CHKR);
  }
  for(const [px,pz] of [[-4,-4],[4,-4],[-4,4],[4,4]]){
    setRaw(cx+px,h+1,cz+pz,B.STEM); setRaw(cx+px,h+2,cz+pz,B.STEM);
    setRaw(cx+px,h+3,cz+pz,B.CAPR);
  }
  setRaw(cx,h+1,cz,B.STEM); setRaw(cx,h+2,cz,B.STEM); setRaw(cx,h+3,cz,B.STEM);
  setRaw(cx,h+4,cz,B.CAPB);
}
let teaH=12;
function buildTeaParty(cx,cz){
  teaH=flatten(cx,cz,9,B.GRASS);
  const h=teaH;
  for(const lx of [cx-4,cx,cx+4])for(const lz of [cz-1,cz+1]) setRaw(lx,h+1,lz,B.CARD);
  for(let dx=-4;dx<=4;dx++)for(let dz=-1;dz<=1;dz++) setRaw(cx+dx,h+2,cz+dz,B.CHKW);
  for(const dx of [-3,-1,1,3]) setRaw(cx+dx,h+3,cz+(dx%2?-1:1),B.TEACUP);
  setRaw(cx,h+3,cz,B.POTION);
  glowSpots.push({x:cx+.5,y:h+3.5,z:cz+.5,c:'#8ae8ff',r:2.6});
  setRaw(cx-4,h+3,cz,B.COOKIE); setRaw(cx+4,h+3,cz,B.COOKIE);
  for(const row of [-3,3]){
    for(const dx of [-3,-1,1,3]){
      setRaw(cx+dx,h+1,cz+row,B.CARD);
      setRaw(cx+dx,h+2,cz+row+(row<0?-1:1),B.CARD);
    }
  }
  for(const gx of [cx-2,cx+2]){ for(let y=1;y<=3;y++) setRaw(gx,h+y,cz-6,B.HEDGE);
    setRaw(gx,h+4,cz-6,B.ROSER); }
  for(let dx=-2;dx<=2;dx++) setRaw(cx+dx,h+4,cz-6,B.HEDGE);
  setRaw(cx-1,h+5,cz-6,B.ROSER); setRaw(cx+1,h+5,cz-6,B.ROSEW);
  for(const [lx,lz] of [[cx-8,cz-7],[cx+8,cz+7]]){
    setRaw(lx,h+1,lz,B.GOLD); setRaw(lx,h+2,lz,B.GOLD); setRaw(lx,h+3,lz,B.POTION);
    glowSpots.push({x:lx+.5,y:h+3.5,z:lz+.5,c:'#8ae8ff',r:2.4});
  }
  for(let i=0;i<8;i++){
    const a=rnd2(i*31,i*17)*Math.PI*2, d=5+rnd2(i,i+9)*3;
    const x=cx+Math.round(Math.sin(a)*d), z=cz+Math.round(Math.cos(a)*d);
    if(getB(x,h+1,z)===B.AIR && getB(x,h,z)===B.GRASS) setRaw(x,h+1,z, rnd2(x,z)<.6?B.ROSER:B.ROSEW);
  }
}
function buildIsland(cx,Y,cz,rad,withCastle){
  for(let dx=-rad;dx<=rad;dx++)for(let dz=-rad;dz<=rad;dz++){
    const d2=dx*dx+dz*dz; if(d2>rad*rad) continue;
    const x=cx+dx,z=cz+dz;
    setRaw(x,Y,z,B.GRASS);
    const depth=Math.max(1,Math.round(2+(rad-Math.sqrt(d2))*0.8));
    for(let y=1;y<=depth;y++) setRaw(x,Y-y,z, y>1?B.STONE:B.DIRT);
  }
  if(!withCastle) return;
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(let y=1;y<=4;y++)
    setRaw(cx+dx,Y+y,cz+dz,B.CARD);
  for(const [wx,wz] of [[0,-1],[0,1],[-1,0],[1,0]]) setRaw(cx+wx,Y+2,cz+wz,B.POTION);
  for(const [wx,wz] of [[0,-1],[0,1],[-1,0],[1,0]])
    glowSpots.push({x:cx+wx+.5,y:Y+2.5,z:cz+wz+.5,c:'#a8e8ff',r:1.9});
  for(const [wx,wz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) setRaw(cx+wx,Y+5,cz+wz,B.GOLD);
  setRaw(cx,Y+5,cz,B.GOLD); setRaw(cx,Y+6,cz,B.GOLD); setRaw(cx,Y+7,cz,B.POTION);
  glowSpots.push({x:cx+.5,y:Y+7.5,z:cz+.5,c:'#ffe9a8',r:2.4});
}
/* ---------- P0：洞穴 / 矿石 / 洞窟萤灯 ---------- */
// 双频带值噪声交叠（两曲面相交成管）挖出隧道网；只在地表以下 4 格内活动，保持表面完整
function carveCaves(){
  for(let x=1;x<W-1;x++)for(let z=1;z<D-1;z++){
    const top=Math.min(H-6, groundH(x,z)-4);
    for(let y=5;y<=top;y++){
      const n1=vnoise3(x*.062, y*.105, z*.062);
      if(Math.abs(n1-.5)>=.085) continue;
      const n2=vnoise3(x*.055+103.7, y*.095+47.3, z*.055+211.9);
      if(Math.abs(n2-.5)<.085) setRaw(x,y,z,B.AIR);
    }
  }
}
// 矿脉：单噪声场高值成团，按深度分三种矿（越深越稀有）
function seedOres(){
  for(let x=0;x<W;x++)for(let z=0;z<D;z++){
    const top=groundH(x,z);
    for(let y=3;y<top-3;y++){
      if(world[idx(x,y,z)]!==B.STONE) continue;
      const o=vnoise3(x*.31+17.7, y*.31+3.3, z*.31+29.1);
      if(o>.845&&y<13) setRaw(x,y,z,B.OREH);
      else if(o>.825&&y<23) setRaw(x,y,z,B.ORES);
      else if(o>.805&&y<28) setRaw(x,y,z,B.OREG);
    }
  }
}
// 洞窟萤火菌灯：长在洞底的稀疏光源，让深处的梦境自带微光
function lampCaves(){
  for(let x=1;x<W-1;x++)for(let z=1;z<D-1;z++){
    const top=Math.min(H-6, groundH(x,z)-5);
    for(let y=5;y<=top;y++){
      if(world[idx(x,y,z)]!==B.AIR||world[idx(x,y-1,z)]===B.AIR) continue;
      if(!BLOCKS[world[idx(x,y-1,z)]].solid) continue;
      if(rnd2(x*3+7, z*5+y*11)<.004){
        setRaw(x,y,z,B.TORCH);
        glowSpots.push({x:x+.5,y:y+.9,z:z+.5,c:'#ffe9a8',r:2.4});
      }
    }
  }
}
function genWorld(){
  for(let x=0;x<W;x++)for(let z=0;z<D;z++) columnBase(x,z,groundH(x,z));
  carveCaves();
  seedOres();
  lampCaves();
  const CELL=40;
  for(let ccx=0;ccx<4;ccx++)for(let ccz=0;ccz<4;ccz++){
    const bx=ccx*CELL+20+(((rnd2(ccx+5,ccz)*10)|0)-5);
    const bz=ccz*CELL+20+(((rnd2(ccx,ccz+9)*10)|0)-5);
    const r=rnd2(ccx*7+77,ccz*13+31);
    if(ccx===2&&ccz===2){ buildTeaParty(88,88); continue; }
    let f = r<.24?'grove': r<.48?'forest': r<.66?'garden': r<.80?'chess':'meadow';
    if(f==='grove') buildGrove(bx,bz);
    else if(f==='forest') buildForest(bx,bz);
    else if(f==='garden') buildGarden(bx,bz);
    else if(f==='chess') buildChess(bx,bz);
  }
  buildIsland(36,40,52,5,true);
  buildIsland(124,43,108,4,false);
  { const h=groundH(124,108); // 岛上的巨型蓝蘑菇
    for(let y=1;y<=4;y++) setRaw(124,43+y,108,B.STEM);
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)
      if(dx*dx+dz*dz<=5.5) setRaw(124+dx,48,108+dz,B.CAPB); }
  for(let x=1;x<W-1;x++)for(let z=1;z<D-1;z++){ // 小型点缀
    const r=rnd2(x+901,z+417);
    if(r>=0.02) continue;
    let y=H-2; while(y>0&&getB(x,y,z)===B.AIR) y--;
    if(getB(x,y,z)!==B.GRASS||getB(x,y+1,z)!==B.AIR) continue;
    const rr=rnd2(x*3,z*3);
    if(rr<.30) setRaw(x,y+1,z,B.CAPR);
    else if(rr<.42){ setRaw(x,y+1,z,B.STEM); setRaw(x,y+2,z,B.CAPB); }
    else if(rr<.80) setRaw(x,y+1,z, rr<.62?B.ROSER:B.ROSEW);
    else if(rr<.84){ setRaw(x,y+1,z,B.TORCH); // 地表偶生的萤火菌灯
      glowSpots.push({x:x+.5,y:y+1.4,z:z+.5,c:'#ffe9a8',r:2.2}); }
  }
}
genWorld();
