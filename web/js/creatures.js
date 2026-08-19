'use strict';
// 梦境生物：会逃跑的白兔 + 花间飞舞的蝴蝶（纯装饰，方块世界高度采样寻路）
const rabbits=[], butterflies=[];
let earL=[], earR=[];

function groundTop(x,z,fromY){
  for(let y=Math.min(H-1,Math.floor(fromY)+3);y>=0;y--){
    const b=getB(x,y,z);
    if(b&&BLOCKS[b].solid) return y+1;
  }
  return 1;
}

function makeRabbit(scene){
  const fur=new THREE.MeshBasicMaterial({color:0xf7f2ec});
  const pink=new THREE.MeshBasicMaterial({color:0xf5b8c8});
  const dark=new THREE.MeshBasicMaterial({color:0x3a2a3a});
  const g=new THREE.Group();
  const add=(w,h,d,m,x,y,z)=>{ const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
    mesh.position.set(x,y,z); g.add(mesh); return mesh; };
  add(.42,.32,.55,fur,0,.2,0);            // 身体（面朝 +z）
  add(.3,.28,.26,fur,0,.42,.3);           // 头
  add(.05,.05,.05,dark,-.11,.46,.42);     // 眼
  add(.05,.05,.05,dark,.11,.46,.42);
  add(.06,.05,.04,pink,0,.38,.44);        // 鼻
  const eL=add(.09,.32,.06,fur,-.08,.68,.26);
  const eR=add(.09,.32,.06,fur,.08,.68,.26);
  add(.16,.16,.14,fur,0,.26,-.3);         // 尾巴
  const parts={g,eL,eR};
  scene.add(g);
  return parts;
}

function butterflyTexture(hex){
  const cv=document.createElement('canvas'); cv.width=cv.height=64;
  const c=cv.getContext('2d');
  c.fillStyle=hex;
  c.beginPath(); c.ellipse(20,26,16,12,-.5,0,7); c.fill();
  c.beginPath(); c.ellipse(44,26,16,12,.5,0,7); c.fill();
  c.fillStyle='rgba(255,255,255,.55)';
  c.beginPath(); c.ellipse(20,22,7,5,-.5,0,7); c.fill();
  c.beginPath(); c.ellipse(44,22,7,5,.5,0,7); c.fill();
  c.strokeStyle='#5a4a3a'; c.lineWidth=4;
  c.beginPath(); c.moveTo(32,14); c.lineTo(32,50); c.stroke();
  const tx=new THREE.CanvasTexture(cv);
  tx.magFilter=THREE.NearestFilter; tx.minFilter=THREE.NearestFilter;
  return tx;
}

function initCreatures(scene){
  const r=mulberry((520^WORLD_SEED)>>>0); // 生物点位随世界种子变化
  for(let i=0;i<12;i++){
    let x=0,z=0,g=0;
    for(let tries=0;tries<50;tries++){
      x=8+((r()*(W-16))|0); z=8+((r()*(D-16))|0);
      const y=groundTop(x,z,H-6);
      if(getB(x,y-1,z)===B.GRASS){ g=y; break; }
    }
    if(!g) continue;
    const parts=makeRabbit(scene);
    rabbits.push({g:parts.g, eL:parts.eL, eR:parts.eR,
      x:x+.5, y:g, z:z+.5, yy:g, ty:g, dir:r()*6.28,
      state:'idle', t:r()*2, hop:0, flee:0, ph:r()*7});
  }
  const colors=['#ff9ec7','#a8d8ff','#ffe08a','#c9a8f5'];
  for(let i=0;i<18;i++){
    let ax=0,az=0,ay=0;
    for(let tries=0;tries<40;tries++){
      ax=10+r()*(W-20); az=10+r()*(D-20);
      const gx=Math.floor(ax), gz=Math.floor(az);
      const y=groundTop(gx,gz,H-6);
      if(getB(gx,y-1,gz)===B.GRASS){ ay=y+1+r()*1.5; break; }
    }
    if(!ay) continue;
    const spr=new THREE.Sprite(new THREE.SpriteMaterial({
      map:butterflyTexture(colors[i%colors.length]),transparent:true,depthWrite:false}));
    spr.scale.set(.34,.3,1);
    scene.add(spr);
    butterflies.push({spr, ax, ay, az, ph:r()*9, sp:.7+r()*.8});
  }
}

function updateCreatures(dt, now, pp){
  for(const rb of rabbits){
    const dx=rb.x-pp.x, dz=rb.z-pp.z;
    const d2=dx*dx+dz*dz;
    if(d2<12){ // 玩家靠近 → 逃向反方向
      rb.dir=Math.atan2(dx,dz);
      rb.flee=1.4;
      if(rb.state==='idle'){ rb.state='hop'; rb.hop=.4; }
    }
    if(rb.state==='idle'){
      rb.t-=dt;
      if(rb.t<=0){ rb.dir+=(Math.random()-.5)*2.6; rb.state='hop'; rb.hop=.42; }
      rb.yy=rb.y;
    }else{
      const sp=rb.flee>0?4.4:2.0;
      const nx=rb.x+Math.sin(rb.dir)*sp*dt, nz=rb.z+Math.cos(rb.dir)*sp*dt;
      const cx=Math.floor(nx), cz=Math.floor(nz);
      const gy=groundTop(cx,cz,rb.y);
      if(cx<3||cz<3||cx>W-4||cz>D-4||Math.abs(gy-rb.y)>1.25){
        rb.dir+=Math.PI*.6+Math.random();
      }else{
        rb.x=nx; rb.z=nz; rb.ty=gy;
      }
      rb.hop-=dt;
      const pr=1-Math.max(0,rb.hop)/.42;
      rb.yy=rb.ty+Math.sin(pr*Math.PI)*.42;
      if(rb.hop<=0){
        rb.state='idle';
        rb.t=rb.flee>0?.12:.5+Math.random()*1.5;
        rb.y=rb.ty;
      }
    }
    rb.flee=Math.max(0,rb.flee-dt);
    rb.g.position.set(rb.x,rb.yy,rb.z);
    if(rb.state==='hop') rb.g.rotation.y=rb.dir;
    const wig=Math.sin(now*.012+rb.ph)*.16;
    rb.eL.rotation.x=wig; rb.eR.rotation.x=-wig;
  }
  for(const bf of butterflies){
    const t=now*.001*bf.sp+bf.ph;
    bf.spr.position.set(
      bf.ax+Math.sin(t*1.3)*1.5,
      bf.ay+Math.sin(t*2.1)*.5+Math.sin(t*.7)*.4,
      bf.az+Math.cos(t*1.1)*1.5);
    const flap=Math.abs(Math.sin(t*16));
    bf.spr.scale.set(.12+flap*.26,.3,1);
  }
}
