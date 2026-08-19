'use strict';
// P0 体素光照：天光（列扫描 + BFS 侧向衰减）与方块光源（火把/萤石/蘑菇盖 BFS），
// 0-15 两级网格；mesher 将天光烘进顶点色、块光写入 bl 顶点属性，
// 着色器按 max(天光×昼夜, 块光×暖色) 合成 → 夜晚火把真正照亮四周
const skyL=new Uint8Array(W*H*D);
const blkL=new Uint8Array(W*H*D);
const OPAQ=new Uint8Array(BLOCKS.length);   // 遮光查询表
const LUMT=new Uint8Array(BLOCKS.length);   // 自发光查询表
for(let i=0;i<BLOCKS.length;i++){
  const b=BLOCKS[i];
  OPAQ[i]=(b.solid&&!b.cross&&!b.tr)?1:0;
  LUMT[i]=b.lum||0;
}

function bfsSpread(grid,q){
  let head=0;
  while(head<q.length){
    const i=q[head++], lv=grid[i];
    if(lv<=1) continue;
    const nl=lv-1;
    const y=(i/(W*D))|0, rem=i-y*W*D, z=(rem/W)|0, x=rem-z*W;
    if(x>0        &&!OPAQ[world[i-1]]  &&grid[i-1]  <nl){ grid[i-1]  =nl; q.push(i-1); }
    if(x<W-1      &&!OPAQ[world[i+1]]  &&grid[i+1]  <nl){ grid[i+1]  =nl; q.push(i+1); }
    if(z>0        &&!OPAQ[world[i-W]]  &&grid[i-W]  <nl){ grid[i-W]  =nl; q.push(i-W); }
    if(z<D-1      &&!OPAQ[world[i+W]]  &&grid[i+W]  <nl){ grid[i+W]  =nl; q.push(i+W); }
    if(y>0        &&!OPAQ[world[i-W*D]]&&grid[i-W*D]<nl){ grid[i-W*D]=nl; q.push(i-W*D); }
    if(y<H-1      &&!OPAQ[world[i+W*D]]&&grid[i+W*D]<nl){ grid[i+W*D]=nl; q.push(i+W*D); }
  }
}

// 全图光照（世界生成 / 读档后调用一次）
function computeAllLight(){
  skyL.fill(0); blkL.fill(0);
  for(let x=0;x<W;x++)for(let z=0;z<D;z++){
    const col=z*W+x;
    for(let y=H-1;y>=0;y--){
      const i=col+y*W*D;
      if(OPAQ[world[i]]) break;
      skyL[i]=15;
    }
  }
  // 只把「相邻有可照亮的暗格」的亮格作为种子，避免整片天空入队
  const q=[];
  for(let y=0;y<H;y++)for(let z=0;z<D;z++){
    const row=z*W+y*W*D;
    for(let x=0;x<W;x++){
      const i=row+x;
      if(skyL[i]!==15) continue;
      if((x>0    &&skyL[i-1]  <14&&!OPAQ[world[i-1]])||
         (x<W-1  &&skyL[i+1]  <14&&!OPAQ[world[i+1]])||
         (z>0    &&skyL[i-W]  <14&&!OPAQ[world[i-W]])||
         (z<D-1  &&skyL[i+W]  <14&&!OPAQ[world[i+W]])||
         (y>0    &&skyL[i-W*D]<14&&!OPAQ[world[i-W*D]])) q.push(i);
    }
  }
  bfsSpread(skyL,q);
  const q2=[];
  for(let i=0;i<world.length;i++){
    const l=LUMT[world[i]];
    if(l){ blkL[i]=l; q2.push(i); }
  }
  bfsSpread(blkL,q2);
}

// 方块增删后局部重算：光源/阴影影响半径 ≤15，16 格框 + 全高 + 边界种子即完备
function onWorldEdit(x,y,z){
  const R=16;
  const x0=Math.max(0,x-R), x1=Math.min(W-1,x+R);
  const z0=Math.max(0,z-R), z1=Math.min(D-1,z+R);
  for(let cx=x0;cx<=x1;cx++)for(let cz=z0;cz<=z1;cz++){
    const col=cz*W+cx;
    for(let yy=0;yy<H;yy++){ const i=col+yy*W*D; skyL[i]=0; blkL[i]=0; }
    for(let yy=H-1;yy>=0;yy--){ const i=col+yy*W*D; if(OPAQ[world[i]])break; skyL[i]=15; }
  }
  const q=[], q2=[];
  for(let yy=0;yy<H;yy++)for(let cz=z0;cz<=z1;cz++)for(let cx=x0;cx<=x1;cx++){
    const i=idx(cx,yy,cz);
    if(skyL[i]===15) q.push(i);
    const l=LUMT[world[i]];
    if(l){ blkL[i]=l; q2.push(i); }
  }
  // 框外一圈既有光向框内续传
  const ring=(cx,cz)=>{
    if(cx<0||cz<0||cx>=W||cz>=D) return;
    for(let yy=0;yy<H;yy++){
      const i=idx(cx,yy,cz);
      if(skyL[i]>1) q.push(i);
      if(blkL[i]>1) q2.push(i);
    }
  };
  for(let cz=z0-1;cz<=z1+1;cz++){ ring(x0-1,cz); ring(x1+1,cz); }
  for(let cx=x0;cx<=x1;cx++){ ring(cx,z0-1); ring(cx,z1+1); }
  bfsSpread(skyL,q);
  bfsSpread(blkL,q2);
  for(let cz=z0>>4;cz<=(z1>>4);cz++)for(let cx=x0>>4;cx<=(x1>>4);cx++)
    if(cx>=0&&cz>=0&&cx<NCX&&cz<NCZ) dirty.add(cx+','+cz);
}

// 实体（掉落物等）取当前综合光照
function lightLevelAt(x,y,z){
  const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
  if(xi<0||zi<0||xi>=W||zi>=D||yi<0||yi>=H) return {s:1,b:0};
  const i=idx(xi,yi,zi);
  return {s:skyL[i]/15, b:blkL[i]/15};
}
