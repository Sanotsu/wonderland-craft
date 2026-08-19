'use strict';
// 区块网格构建：面剔除 + 逐顶点 AO + 三种材质通道（不透明/镂空/半透明）
// P0 光照：天光烘进顶点色、块光写入 bl 属性；着色器按 max(天光×昼夜, 块光暖色) 合成
const matSolid=new THREE.MeshBasicMaterial({map:atlasTex,vertexColors:true});
const matCut=new THREE.MeshBasicMaterial({map:atlasTex,vertexColors:true,alphaTest:.5,side:THREE.DoubleSide});
const matTrans=new THREE.MeshBasicMaterial({map:atlasTex,vertexColors:true,transparent:true});
const uSkyF={value:1}; // 昼夜天光系数（sky.js 每帧更新，夜≈0.13）
function injectLight(mat){
  mat.onBeforeCompile=sh=>{
    sh.uniforms.uSkyF=uSkyF;
    sh.vertexShader=sh.vertexShader
      .replace('#include <common>','#include <common>\nattribute float bl;\nvarying float vBl;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvBl=bl;');
    sh.fragmentShader=sh.fragmentShader
      .replace('#include <common>','#include <common>\nuniform float uSkyF;\nvarying float vBl;')
      .replace('#include <color_fragment>',
        '#include <color_fragment>\n  diffuseColor.rgb *= max(vec3(uSkyF), vBl*vec3(1.0,.88,.72));');
  };
}
injectLight(matSolid); injectLight(matCut); injectLight(matTrans);

const FACES=[
  {dir:[-1,0,0],light:.68,corners:[{p:[0,1,0],uv:[0,1]},{p:[0,0,0],uv:[0,0]},{p:[0,1,1],uv:[1,1]},{p:[0,0,1],uv:[1,0]}]},
  {dir:[1,0,0], light:.68,corners:[{p:[1,1,1],uv:[0,1]},{p:[1,0,1],uv:[0,0]},{p:[1,1,0],uv:[1,1]},{p:[1,0,0],uv:[1,0]}]},
  {dir:[0,-1,0],light:.5, corners:[{p:[1,0,1],uv:[1,0]},{p:[0,0,1],uv:[0,0]},{p:[1,0,0],uv:[1,1]},{p:[0,0,0],uv:[0,1]}]},
  {dir:[0,1,0], light:1,  corners:[{p:[0,1,1],uv:[1,1]},{p:[1,1,1],uv:[0,1]},{p:[0,1,0],uv:[1,0]},{p:[1,1,0],uv:[0,0]}]},
  {dir:[0,0,-1],light:.82,corners:[{p:[1,0,0],uv:[0,0]},{p:[0,0,0],uv:[1,0]},{p:[1,1,0],uv:[0,1]},{p:[0,1,0],uv:[1,1]}]},
  {dir:[0,0,1], light:.82,corners:[{p:[0,0,1],uv:[0,0]},{p:[1,0,1],uv:[1,0]},{p:[0,1,1],uv:[0,1]},{p:[1,1,1],uv:[1,1]}]},
];
const AO_TAB=[.45,.66,.84,1];
const occl=(x,y,z)=>{ const b=getB(x,y,z);
  return b!==0 && BLOCKS[b].solid && !BLOCKS[b].cross && !BLOCKS[b].tr ? 1:0; };
// 天光采样（越界视为满亮：露天侧面/世界顶）
function skyAt(x,y,z){
  if(y<0) return 0;
  if(y>=H||x<0||z<0||x>=W||z>=D) return 1;
  return skyL[idx(x,y,z)]/15;
}
function blkAt(x,y,z){
  if(y<0||y>=H||x<0||z<0||x>=W||z>=D) return 0;
  return blkL[idx(x,y,z)]/15;
}
const AMB=.08; // 深洞保底的微光，不至于纯黑

const chunks=new Map();
const dirty=new Set();
function tileUV(t){
  const col=t%16,row=(t/16)|0,pad=.6;
  return { u0:(col*16+pad)/ATLAS, u1:((col+1)*16-pad)/ATLAS,
           v0:1-((row+1)*16-pad)/ATLAS, v1:1-(row*16+pad)/ATLAS };
}
function buildChunk(cx,cz){
  const key=cx+','+cz;
  const old=chunks.get(key);
  if(old){ for(const m of [old.s,old.c,old.t]) if(m){ scene.remove(m); m.geometry.dispose(); } }
  const G={s:mkG(),c:mkG(),t:mkG()};
  function mkG(){ return {p:[],u:[],col:[],b:[],i:[]}; }
  const x0=cx*CH, z0=cz*CH;
  for(let ly=0;ly<H;ly++)for(let lz=0;lz<CH;lz++)for(let lx=0;lx<CH;lx++){
    const x=x0+lx,y=ly,z=z0+lz;
    const id=world[idx(x,y,z)];
    if(!id) continue;
    const bd=BLOCKS[id];
    if(bd.cross){ addCross(G.c,x,y,z,bd.s); continue; }
    for(const f of FACES){
      const nx=x+f.dir[0],ny=y+f.dir[1],nz=z+f.dir[2];
      const nb=getB(nx,ny,nz), nbd=BLOCKS[nb];
      let vis;
      if(bd.tr) vis=(nb===0||nbd.cross);
      else vis=!(nb!==0 && !nbd.cross && !nbd.tr);
      if(!vis) continue;
      const t=tileUV(f.dir[1]>0?bd.t:(f.dir[1]<0?bd.b:bd.s));
      const tgt=bd.tr?G.t:G.s;
      const sf=bd.tr?1:skyAt(nx,ny,nz); // 半透魔药自体发光，不做天光衰减
      addFace(tgt,x,y,z,f,t,bd.tr?1:f.light,sf,blkAt(nx,ny,nz));
    }
  }
  const out={s:null,c:null,t:null};
  out.s=finish(G.s,matSolid); out.c=finish(G.c,matCut); out.t=finish(G.t,matTrans);
  chunks.set(key,out);
  function finish(g,mat){
    if(!g.i.length) return null;
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(g.p,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(g.u,2));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(g.col,3));
    geo.setAttribute('bl',new THREE.Float32BufferAttribute(g.b,1));
    geo.setIndex(g.i);
    geo.boundingSphere=new THREE.Sphere(
      new THREE.Vector3(x0+CH/2,H/2,z0+CH/2), Math.hypot(CH/2,H/2,CH/2)+1);
    const m=new THREE.Mesh(geo,mat);
    scene.add(m); return m;
  }
  function addFace(g,x,y,z,f,t,light,sf,bf){
    const axis=f.dir[0]!==0?0:(f.dir[1]!==0?1:2);
    const ta=axis===0?1:0, tb=axis===2?1:2;
    const base=g.p.length/3, ao=[];
    const amb=AMB+(1-AMB)*sf;
    for(let ci=0;ci<4;ci++){
      const c=f.corners[ci];
      g.p.push(x+c.p[0],y+c.p[1],z+c.p[2]);
      g.u.push(c.uv[0]?t.u1:t.u0, c.uv[1]?t.v1:t.v0);
      const off=[f.dir[0],f.dir[1],f.dir[2]];
      const s1=[...off], s2=[...off], cc=[...off];
      s1[ta]+= c.p[ta]?1:-1; s2[tb]+= c.p[tb]?1:-1;
      cc[ta]+= c.p[ta]?1:-1; cc[tb]+= c.p[tb]?1:-1;
      const o1=occl(x+s1[0],y+s1[1],z+s1[2]),
            o2=occl(x+s2[0],y+s2[1],z+s2[2]),
            oc=occl(x+cc[0],y+cc[1],z+cc[2]);
      const a=(o1&&o2)?0:3-(o1+o2+oc);
      ao.push(a);
      const l=light*AO_TAB[a]*amb;
      g.col.push(l,l,l);
      g.b.push(bf);
    }
    if(ao[0]+ao[3]>ao[1]+ao[2]) g.i.push(base,base+1,base+3,base,base+3,base+2);
    else g.i.push(base,base+1,base+2,base+2,base+1,base+3);
  }
  function addCross(g,x,y,z,tile){
    const t=tileUV(tile);
    const amb=.95*(AMB+(1-AMB)*skyAt(x,y,z));
    const bl=blkAt(x,y,z);
    const j1=(rnd2(x,z)-.5)*.12, j2=(rnd2(z,x)-.5)*.12;
    const a=.15+j1,b=.85+j2,l=amb;
    quads([[a,0,a],[b,0,b],[b,1,b],[a,1,a]]);
    quads([[a,0,b],[b,0,a],[b,1,a],[a,1,b]]);
    function quads(q){
      const base=g.p.length/3, uvs=[[0,0],[1,0],[1,1],[0,1]];
      for(let i=0;i<4;i++){
        g.p.push(x+q[i][0],y+q[i][1],z+q[i][2]);
        g.u.push(uvs[i][0]?t.u1:t.u0, uvs[i][1]?t.v1:t.v0);
        g.col.push(l,l,l);
        g.b.push(bl);
      }
      g.i.push(base,base+1,base+2,base,base+2,base+3);
    }
  }
}
function buildAllChunks(){
  for(let cx=0;cx<NCX;cx++)for(let cz=0;cz<NCZ;cz++) buildChunk(cx,cz);
}
function markDirty(x,z){
  const cx=x>>4, cz=z>>4;
  const add=(a,b)=>{ if(a>=0&&b>=0&&a<NCX&&b<NCZ) dirty.add(a+','+b); };
  add(cx,cz);
  if((x&15)===0)add(cx-1,cz); if((x&15)===15)add(cx+1,cz);
  if((z&15)===0)add(cx,cz-1); if((z&15)===15)add(cx,cz+1);
}
function setLive(x,y,z,id){
  if(x<0||z<0||x>=W||z>=D||y<0||y>=H) return false;
  world[idx(x,y,z)]=id;
  recordEdit(x,y,z,id);
  onWorldEdit(x,y,z); // 局部重算光照并标记受影响区块（含 markDirty 的邻界范围）
  return true;
}
// 分帧重建：每帧最多 3 个区块，按离玩家距离优先，避免火把放置时整片卡顿
function processDirty(){
  if(!dirty.size) return;
  const pcx=Math.floor(player.pos.x/CH), pcz=Math.floor(player.pos.z/CH);
  const arr=[];
  for(const k of dirty){ const c=k.split(','); arr.push({k,a:+c[0],b:+c[1]}); }
  arr.sort((p,q)=>((p.a-pcx)**2+(p.b-pcz)**2)-((q.a-pcx)**2+(q.b-pcz)**2));
  const n=Math.min(arr.length,3);
  for(let i=0;i<n;i++){ buildChunk(arr[i].a,arr[i].b); dirty.delete(arr[i].k); }
}
