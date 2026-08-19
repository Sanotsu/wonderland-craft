'use strict';
// 梦境天空：昼夜循环穹顶（太阳/月亮/星星/极光/彩虹拱/日晕）、柴郡猫微笑、
// 糖果色云、漂浮光尘、飘落的玫瑰花瓣
let dayTime=0.15;      // 0~1 为一整天（240 秒），0.25 正午、0.75 午夜
let nightAmount=0;
let skyDome=null, smile=null, clouds=[], cloudMats=[], sparkleGeo=null, sparklePts=null;
let petGeo=null, petPts=null, petVy=null, petPh=null, petAmp=null, PET_N=0;
const glows=[];

function initSky(scene){
  const skyMat=new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{ uSun:{value:new THREE.Vector3(0,1,0)},
               uMoon:{value:new THREE.Vector3(0,-1,0)},
               uDay:{value:1}, uTime:{value:0} },
    vertexShader:'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`
      varying vec3 vP; uniform vec3 uSun; uniform vec3 uMoon;
      uniform float uDay; uniform float uTime;
      void main(){
        vec3 d=normalize(vP);
        vec3 dayTop=vec3(.42,.52,.95), dayMid=vec3(.82,.67,.97), dayBot=vec3(1.,.80,.92);
        vec3 nTop=vec3(.09,.07,.26), nMid=vec3(.18,.14,.40), nBot=vec3(.40,.22,.46);
        vec3 top=mix(nTop,dayTop,uDay), mid=mix(nMid,dayMid,uDay), bot=mix(nBot,dayBot,uDay);
        vec3 col = d.y>0. ? mix(mid,top,pow(min(d.y*1.5,1.),.75)) : mix(mid,bot,min(-d.y*3.,1.));

        // 柔光太阳 + 日晕环
        float sd=max(dot(d,uSun),0.);
        col += (vec3(1.,.85,.62)*pow(sd,20.)*.5 + vec3(1.,.96,.85)*pow(sd,220.)*.9)*uDay;
        col += vec3(1.,.9,.78)*pow(sd,60.)*.13*uDay;

        // 天顶极光彩带（缓慢流动的淡紫与薄荷）
        if(d.y>0.04){
          float b1=sin(d.x*6.+d.y*9.+uTime*.35);
          float b2=sin(d.x*4.-d.y*7.-uTime*.22+2.1);
          float aur=smoothstep(.55,.95,b1)*smoothstep(.25,.9,d.y)*.15
                  + smoothstep(.60,.95,b2)*smoothstep(.15,.8,d.y)*.11;
          col += aur*(vec3(.55,.35,.85)*.75 + vec3(.30,.62,.60)*.45)*uDay;
        }

        // 太阳一侧的粉彩彩虹拱
        float hAng=atan(d.x,d.z);
        float sunH=atan(uSun.x,uSun.z);
        float dAng=abs(atan(sin(hAng-sunH),cos(hAng-sunH)));
        float rr=length(vec2(dAng*.75,(d.y-.20)*2.6));
        float band=(1.-smoothstep(.52,.62,rr))*smoothstep(.38,.46,rr);
        if(band>0.){
          float t=clamp((rr-.40)/.20,0.,1.);
          vec3 rb=.5+.5*cos(6.2832*(t+vec3(0.,.33,.67)));
          col += band*mix(vec3(1.),rb,.45)*uDay*.30*smoothstep(0.,.06,d.y);
        }

        // 月亮与星星
        float md=max(dot(d,uMoon),0.);
        float night=1.-uDay;
        col += (vec3(.75,.80,1.)*pow(md,30.)*.22 + vec3(.92,.95,1.)*pow(md,700.)*1.3)*night;
        vec2 sph=vec2(atan(d.z,d.x)*9.55, asin(clamp(d.y,-1.,1.))*19.1);
        vec2 cell=floor(sph);
        float h=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
        float star=step(.994,h)*night*smoothstep(.02,.25,d.y);
        star*= .5+.5*sin(uTime*2.+h*40.);
        col+=star*vec3(1.,.97,.9);
        gl_FragColor=vec4(col,1.);
      }`
  });
  skyDome=new THREE.Mesh(new THREE.SphereGeometry(600,24,14),skyMat);
  skyDome.position.set(80,0,80); skyDome.renderOrder=-2; scene.add(skyDome);

  const smileCanvas=document.createElement('canvas'); smileCanvas.width=smileCanvas.height=256;
  { const c=smileCanvas.getContext('2d');
    const g=c.createRadialGradient(128,128,10,128,128,120);
    g.addColorStop(0,'rgba(160,120,225,.65)'); g.addColorStop(1,'rgba(160,120,225,0)');
    c.fillStyle=g; c.beginPath(); c.arc(128,128,120,0,7); c.fill();
    c.strokeStyle='#ffffd8'; c.lineWidth=13; c.lineCap='round';
    c.beginPath(); c.arc(128,108,62,0.25*Math.PI,0.75*Math.PI); c.stroke();
    c.strokeStyle='#f2c9ee'; c.lineWidth=3;
    for(let i=0;i<6;i++){ const a=0.3+i*0.08+0.25*Math.PI;
      const x=128+Math.cos(a)*62, y=108+Math.sin(a)*62;
      c.beginPath(); c.moveTo(x,y-8); c.lineTo(x,y+6); c.stroke(); }
    c.fillStyle='#eafff2';
    c.beginPath(); c.ellipse(88,74,15,9,-.3,0,7); c.fill();
    c.beginPath(); c.ellipse(168,74,15,9,.3,0,7); c.fill();
    c.fillStyle='#2f7d5b';
    c.beginPath(); c.arc(92,76,4,0,7); c.fill();
    c.beginPath(); c.arc(164,76,4,0,7); c.fill();
  }
  smile=new THREE.Sprite(new THREE.SpriteMaterial({
    map:new THREE.CanvasTexture(smileCanvas),transparent:true,fog:false,depthWrite:false}));
  smile.scale.set(46,46,1); smile.position.set(96,74,-36); scene.add(smile);

  // 糖果色云（腮红粉 / 薰衣草 / 薄荷）
  for(const hex of [0xffd9e8, 0xe6dcff, 0xdcf5ea]){
    cloudMats.push(new THREE.MeshBasicMaterial({
      color:hex,transparent:true,opacity:.8,fog:false}));
  }
  const r=mulberry(4242);
  for(let i=0;i<14;i++){
    const mat=cloudMats[(r()*cloudMats.length)|0];
    const grp=new THREE.Group();
    const w=6+r()*10, dp=4+r()*6;
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(w,1.3,dp),mat));
    const p2=new THREE.Mesh(new THREE.BoxGeometry(w*.55,1.1,dp*.6),mat);
    p2.position.set(w*.32,.7,dp*.15); grp.add(p2);
    const p3=new THREE.Mesh(new THREE.BoxGeometry(w*.4,1,dp*.5),mat);
    p3.position.set(-w*.34,.5,-dp*.12); grp.add(p3);
    grp.position.set(r()*220-30,76+r()*14,r()*220-30);
    grp.userData.by=grp.position.y; grp.userData.ph=r()*9;
    clouds.push(grp); scene.add(grp);
  }

  // 漂浮光尘（B17：悬浮高度跟随地表并抬出树冠/屋檐，不再埋进岩层）
  const N=340, pos=new Float32Array(N*3), rr=mulberry(777);
  for(let i=0;i<N;i++){
    const x=rr()*W, z=rr()*D;
    const g0=groundH(Math.floor(x),Math.floor(z))+1;
    let y=g0+rr()*Math.max(3,29-g0);
    for(let t=0;t<8;t++){ const b=getB(Math.floor(x),Math.floor(y),Math.floor(z));
      if(!(b&&BLOCKS[b].solid)) break; y+=1.5; }
    pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z;
  }
  sparkleGeo=new THREE.BufferGeometry();
  sparkleGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  sparklePts=new THREE.Points(sparkleGeo,new THREE.PointsMaterial({
    color:0xffd7ef,size:.22,transparent:true,opacity:.75,
    blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
  sparklePts.frustumCulled=false; scene.add(sparklePts);

  // 飘落的玫瑰花瓣
  PET_N=110;
  const pPos=new Float32Array(PET_N*3), pCol=new Float32Array(PET_N*3);
  petVy=new Float32Array(PET_N); petPh=new Float32Array(PET_N); petAmp=new Float32Array(PET_N);
  const petTexCanvas=document.createElement('canvas'); petTexCanvas.width=petTexCanvas.height=32;
  { const c=petTexCanvas.getContext('2d');
    c.translate(16,16); c.rotate(.6);
    c.fillStyle='#ffffff';
    c.beginPath(); c.ellipse(0,0,9,5.5,0,0,7); c.fill();
    c.fillStyle='rgba(255,255,255,.65)';
    c.beginPath(); c.ellipse(-2,-1,4,2.5,0,0,7); c.fill();
  }
  const petTex=new THREE.CanvasTexture(petTexCanvas);
  petTex.magFilter=THREE.NearestFilter; petTex.minFilter=THREE.NearestFilter;
  const cols=['#ff9ec7','#ffc4e2','#fff0f5','#e8b4ff'].map(hx=>new THREE.Color(hx));
  for(let i=0;i<PET_N;i++){
    pPos[i*3]=rr()*W; pPos[i*3+1]=4+rr()*28; pPos[i*3+2]=rr()*D;
    const cc=cols[(rr()*cols.length)|0];
    pCol[i*3]=cc.r; pCol[i*3+1]=cc.g; pCol[i*3+2]=cc.b;
    petVy[i]=.35+rr()*.5; petPh[i]=rr()*9; petAmp[i]=.5+rr()*1.1;
  }
  petGeo=new THREE.BufferGeometry();
  petGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
  petGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));
  petPts=new THREE.Points(petGeo,new THREE.PointsMaterial({
    map:petTex,size:.34,transparent:true,alphaTest:.15,vertexColors:true,
    depthWrite:false}));
  petPts.frustumCulled=false; scene.add(petPts);

  // 发光点缀：蘑菇伞盖 / 魔药 / 城堡窗（夜间尤为梦幻）
  const glowCanvas=document.createElement('canvas'); glowCanvas.width=glowCanvas.height=64;
  { const c=glowCanvas.getContext('2d');
    const g=c.createRadialGradient(32,32,2,32,32,30);
    g.addColorStop(0,'rgba(255,255,255,.95)');
    g.addColorStop(.35,'rgba(255,255,255,.38)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g; c.fillRect(0,0,64,64);
  }
  const glowTex=new THREE.CanvasTexture(glowCanvas);
  for(const s of glowSpots){
    const spr=new THREE.Sprite(new THREE.SpriteMaterial({
      map:glowTex,color:new THREE.Color(s.c),
      transparent:true,opacity:.2,depthWrite:false,
      blending:THREE.AdditiveBlending,fog:false}));
    spr.scale.set(s.r*2,s.r*2,1);
    spr.position.set(s.x,s.y,s.z);
    spr.renderOrder=2;
    glows.push(spr); scene.add(spr);
  }
}

function updateSky(dt, now, pp){
  dayTime=(dayTime+dt/240)%1;
  const a=dayTime*Math.PI*2, elev=Math.sin(a), az=Math.cos(a);
  const u=skyDome.material.uniforms;
  u.uSun.value.set(az*.9, elev, -.35).normalize();
  u.uMoon.value.set(-az*.9, -elev, .35).normalize();
  const c=Math.min(1,Math.max(0,(elev+.15)*3));
  const uDay=c*c*(3-2*c);
  u.uDay.value=uDay; u.uTime.value=now*.001;
  nightAmount=1-uDay;
  uSkyF.value=lerp(.13,1,uDay); // P0 光照：夜晚天光降到月光档，火把光不受影响

  if(scene){ // 雾/背景与地形材质随昼夜染色（白日更粉紫）
    scene.fog.color.setRGB(lerp(.150,1,uDay), lerp(.100,.835,uDay), lerp(.255,.945,uDay));
    scene.background=scene.fog.color;
    const t=lerp(.78,1,uDay);
    matSolid.color.setRGB(Math.min(1,t*.97),Math.min(1,t*.97),Math.min(1,t*1.05));
    matCut.color.copy(matSolid.color);
    matTrans.color.copy(matSolid.color);
  }
  for(const cl of clouds){ cl.position.x+=dt*.5; if(cl.position.x>200)cl.position.x=-40; }
  for(let i=0;i<clouds.length;i++){
    clouds[i].position.y=clouds[i].userData.by+Math.sin(now*.00008+clouds[i].userData.ph)*1.6;
  }

  smile.material.opacity=lerp(.85,.32+.3*Math.sin(now*.0004),uDay);
  smile.position.y=74+Math.sin(now*.0006)*2.5;
  const sp=sparkleGeo.attributes.position.array;
  for(let i=0;i<sp.length;i+=3){ sp[i+1]+=Math.sin(now*.001+i)*.002; }
  sparkleGeo.attributes.position.needsUpdate=true;
  sparklePts.material.opacity=Math.min(1,(.55+.3*Math.sin(now*.0012))*(1+nightAmount*.8));

  // 花瓣飘落，落低或落在实体上（B17：不穿地层）后在玩家附近重新扬起
  const pd=petGeo.attributes.position.array;
  for(let i=0;i<PET_N;i++){
    const j=i*3;
    pd[j+1]-=petVy[i]*dt;
    pd[j]+=Math.sin(now*.0006+petPh[i])*petAmp[i]*dt;
    pd[j+2]+=Math.cos(now*.0005+petPh[i]*1.3)*petAmp[i]*.6*dt;
    let reset=pd[j+1]<2.5;
    if(!reset){ const b=getB(Math.floor(pd[j]),Math.floor(pd[j+1]),Math.floor(pd[j+2]));
      if(b&&BLOCKS[b].solid) reset=true; }
    if(reset){
      if(pp){
        const ang=Math.random()*Math.PI*2, dist=6+Math.random()*46;
        pd[j]=Math.max(2,Math.min(W-3,pp.x+Math.sin(ang)*dist));
        pd[j+2]=Math.max(2,Math.min(D-3,pp.z+Math.cos(ang)*dist));
      }else{
        pd[j]=Math.random()*W; pd[j+2]=Math.random()*D;
      }
      pd[j+1]=22+Math.random()*12;
    }
  }
  petGeo.attributes.position.needsUpdate=true;
  petPts.material.opacity=lerp(.55,.95,uDay);

  // 发光点缀呼吸（夜晚更亮）
  for(let i=0;i<glows.length;i++){
    glows[i].material.opacity =
      lerp(.22,.62,nightAmount)*(0.82+0.18*Math.sin(now*.0018+i*1.7));
  }
}
