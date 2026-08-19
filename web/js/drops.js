'use strict';
// P0 物品掉落：生存模式挖掘后生成旋转小方块实体（复用手持方块几何），
// 受重力/弹跳，靠近磁吸自动拾取入快捷栏；创造模式不生成（即挖即得）
const DROPS_MAX=80;
const drops=[];
const dropGeoCache=new Map();
const matDropBase=new THREE.MeshBasicMaterial({map:atlasTex,vertexColors:true});
const _lo=new THREE.Vector3(), _ld=new THREE.Vector3(); // B12：磁吸视线判定的临时向量

function dropGeoFor(id){
  let g=dropGeoCache.get(id);
  if(!g){ g=buildHandGeometry(id); dropGeoCache.set(id,g); }
  return g;
}
function spawnDrop(x,y,z,id){
  if(drops.length>=DROPS_MAX) killDrop(0);
  const mesh=new THREE.Mesh(dropGeoFor(id),matDropBase.clone());
  mesh.scale.setScalar(.27);
  mesh.position.set(x,y,z);
  scene.add(mesh);
  drops.push({id, x, y, z,
    vx:(Math.random()-.5)*2.2, vy:2.6+Math.random()*1.4, vz:(Math.random()-.5)*2.2,
    mesh, age:0, ph:Math.random()*7});
}
function killDrop(i){
  const d=drops[i];
  scene.remove(d.mesh);
  d.mesh.material.dispose();
  drops.splice(i,1);
}
function pickupDrop(d){
  const si=HOTBAR.indexOf(d.id);
  if(si>=0){
    inv[si]=(inv[si]|0)+1;
    if(typeof updateInvUI==='function') updateInvUI();
    saveDirty=true;
  }
  sfxBlip(740+Math.random()*160);
  if(typeof toast==='function') toast('✨ 拾取 · '+BLOCKS[d.id].n);
}
function updateDrops(dt, now, pp){
  for(let i=drops.length-1;i>=0;i--){
    const d=drops[i];
    d.age+=dt;
    d.vy-=22*dt;
    const ny=d.y+d.vy*dt;
    if(d.vy<0&&solidAt(Math.floor(d.x),Math.floor(ny),Math.floor(d.z))){
      d.y=Math.floor(ny)+1.001;
      d.vy = d.vy<-4 ? -d.vy*.3 : 0;
      d.vx*=.7; d.vz*=.7;
    }else d.y=ny;
    const nx=d.x+d.vx*dt, nz=d.z+d.vz*dt;
    if(!solidAt(Math.floor(nx),Math.floor(d.y+.05),Math.floor(d.z))) d.x=nx; else d.vx=0;
    if(!solidAt(Math.floor(d.x),Math.floor(d.y+.05),Math.floor(nz))) d.z=nz; else d.vz=0;
    if(d.y<-8){ killDrop(i); continue; }
    if(pp&&d.age>.45){ // 磁吸 + 拾取（B12：邻格直吸；隔墙的远处需视线可达）
      const dx=pp.x-d.x, dy=pp.y+.8-d.y, dz=pp.z-d.z;
      const dist=Math.hypot(dx,dy,dz);
      let can=false;
      if(dist<2.2&&dist>.01){
        const near=Math.max(Math.abs(Math.floor(d.x)-Math.floor(pp.x)),
                            Math.abs(Math.floor(d.y)-Math.floor(pp.y)),
                            Math.abs(Math.floor(d.z)-Math.floor(pp.z)))<=1;
        if(near) can=true; // 脚边坑里/紧邻的掉落不受视线限制（射线会被脚下地面误挡）
        else{ _lo.set(d.x,d.y,d.z); _ld.set(dx,dy,dz).multiplyScalar(1/dist);
          can=!raycast(_lo,_ld,dist); }
      }
      if(can){
        const pull=Math.min(1,7.5*dt/dist); d.x+=dx*pull; d.y+=dy*pull; d.z+=dz*pull;
        if(dist<1.1){ pickupDrop(d); killDrop(i); continue; }
      }
    }
    d.mesh.position.set(d.x, d.y+.16+Math.sin(now*.003+d.ph)*.05, d.z);
    d.mesh.rotation.y=now*.0016+d.ph;
    d.mesh.rotation.z=.12;
    // 与地形一致的光照着色（洞里暗、火把边暖亮）
    const lv=lightLevelAt(d.x,d.y+.3,d.z);
    const f=Math.max(.15, Math.max(lv.s*uSkyF.value, lv.b));
    d.mesh.material.color.copy(matSolid.color).multiplyScalar(f);
  }
}
