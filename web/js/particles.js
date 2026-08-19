'use strict';
// 破坏方块时的彩色碎屑粒子（Points 池）
const PN=360;
let pPos, pCol, pGeo, pPts, pCursor=0;
const parts=[];

function initParticles(scene){
  pPos=new Float32Array(PN*3); pCol=new Float32Array(PN*3);
  for(let i=0;i<PN;i++){ parts.push({life:0,vx:0,vy:0,vz:0}); pPos[i*3+1]=-999; }
  pGeo=new THREE.BufferGeometry();
  pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
  pGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));
  pPts=new THREE.Points(pGeo,new THREE.PointsMaterial({
    vertexColors:true,size:.16,transparent:true,opacity:.95,depthWrite:false}));
  pPts.frustumCulled=false; scene.add(pPts);
}

function spawnBurst(x,y,z,hex){
  const col=new THREE.Color(hex);
  for(let n=0;n<14;n++){
    const i=pCursor; pCursor=(pCursor+1)%PN;
    parts[i].life=.55+Math.random()*.25;
    parts[i].vx=(Math.random()-.5)*4.5; parts[i].vy=Math.random()*4.5+1; parts[i].vz=(Math.random()-.5)*4.5;
    pPos[i*3]=x+(Math.random()-.5)*.6; pPos[i*3+1]=y+(Math.random()-.5)*.6; pPos[i*3+2]=z+(Math.random()-.5)*.6;
    pCol[i*3]=col.r; pCol[i*3+1]=col.g; pCol[i*3+2]=col.b;
  }
  pGeo.attributes.color.needsUpdate=true;
}

function updateParts(dt){
  let any=false;
  for(let i=0;i<PN;i++){
    if(parts[i].life<=0) continue;
    any=true; parts[i].life-=dt;
    parts[i].vy-=14*dt;
    pPos[i*3]+=parts[i].vx*dt; pPos[i*3+1]+=parts[i].vy*dt; pPos[i*3+2]+=parts[i].vz*dt;
    if(parts[i].life<=0) pPos[i*3+1]=-999;
  }
  if(any) pGeo.attributes.position.needsUpdate=true;
}
