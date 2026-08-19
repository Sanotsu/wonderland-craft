'use strict';
// 程序化像素贴图图集（16x16 / 格，256x256 画布）与 THREE 纹理
// 美术规范：每张贴图带 2~3 层明暗（底色 + 噪点 + 高光/描边），花体带细节
const atlas=document.createElement('canvas'); atlas.width=atlas.height=ATLAS;
const ac=atlas.getContext('2d');
function P(x,y,c){ ac.fillStyle=c; ac.fillRect(x,y,1,1); }
function F(t,c){ const x=(t%16)*16, y=((t/16)|0)*16; ac.fillStyle=c; ac.fillRect(x,y,16,16); }
function SP(t,r,cols,n){ const x0=(t%16)*16, y0=((t/16)|0)*16;
  for(let i=0;i<n;i++) P(x0+((r()*16)|0), y0+((r()*16)|0), cols[(r()*cols.length)|0]); }
function DISC(t,cx,cy,rad,c){ const x0=(t%16)*16, y0=((t/16)|0)*16;
  for(let dy=-rad-1;dy<=rad+1;dy++)for(let dx=-rad-1;dx<=rad+1;dx++){
    if(dx*dx+dy*dy<=rad*rad) P(x0+cx+dx,y0+cy+dy,c); } }
function RING(t,cx,cy,r1,r2,c){ const x0=(t%16)*16, y0=((t/16)|0)*16;
  for(let dy=-r2-1;dy<=r2+1;dy++)for(let dx=-r2-1;dx<=r2+1;dx++){
    const d=dx*dx+dy*dy; if(d<=r2*r2&&d>r1*r1) P(x0+cx+dx,y0+cy+dy,c); } }
function X0(t){ return (t%16)*16; }
function Y0(t){ return ((t/16)|0)*16; }

(function drawTiles(){
  let r;

  // 0 薄荷草地：底色 + 三层噪点 + 雏菊 + 粉花
  r=mulberry(11); F(0,'#7cd0a4');
  SP(0,r,['#6abf92','#8fe0b4','#5eb386','#79cfa0','#85dcae'],160);
  for(const [dx,dy] of [[3,3],[11,10],[6,12]]){ DISC(0,dx,dy,1.1,'#ffffff'); P(X0(0)+dx,Y0(0)+dy,'#ffd76e'); }
  for(const [px,py] of [[12,3],[4,7]]){ P(X0(0)+px,Y0(0)+py,'#ff9ec7'); P(X0(0)+px+1,Y0(0)+py,'#ffd0e4'); P(X0(0)+px,Y0(0)+py+1,'#ffd0e4'); }

  // 1 草地侧壁：泥土 + 双色草缘 + 垂根
  r=mulberry(22); F(1,'#a5794f'); SP(1,r,['#96683f','#b58a5c','#8e5f38','#a1734a'],95);
  { const gx=X0(1), gy=Y0(1);
    for(let x=0;x<16;x++){
      const h=2+((r()*2.4)|0);
      for(let y=0;y<h;y++) P(gx+x,gy+y, y===h-1?'#5cb385':'#82dcaa');
      P(gx+x,gy+h,'#6cc79a');
      if(r()<.35) P(gx+x,gy+h+1,'#5cb385');
      if(r()<.3){ const ry=gy+6+((r()*8)|0); P(gx+x,ry,'#8e5f38'); }
      if(r()<.12) P(gx+x,gy+((r()*2)|0),'#ff9ec7');
    } }

  // 2 泥土：石粒 + 根须
  r=mulberry(33); F(2,'#a5794f'); SP(2,r,['#96683f','#b58a5c','#8e5f38','#a1734a'],120);
  { const gx=X0(2), gy=Y0(2);
    for(const [sx,sy] of [[3,4],[11,9],[7,13]]){ DISC(2,sx,sy,1,'#a9a194'); P(gx+sx,gy+sy+1,'#8d857a'); }
    for(let i=0;i<4;i++){ const rx=(r()*14)|0, ry=(r()*13)|0; P(gx+rx,gy+ry,'#8e5f38'); P(gx+rx,gy+ry+1,'#8e5f38'); } }

  // 3 梦境石头：大色斑 + 裂纹
  r=mulberry(44); F(3,'#b4b6c6'); SP(3,r,['#a5a5b8','#c3c3d2','#9c9cb0','#adadbe'],120);
  DISC(3,5,5,2.2,'#c2c4d2'); DISC(3,11,11,2.6,'#a6a8ba');
  { const gx=X0(3), gy=Y0(3);
    P(gx+4,gy+10,'#8f92a6');P(gx+5,gy+11,'#8f92a6');P(gx+6,gy+12,'#8f92a6');
    P(gx+12,gy+3,'#8f92a6');P(gx+12,gy+4,'#8f92a6'); }

  // 4 城堡石砖：砖缝 + 苔点
  r=mulberry(55); F(4,'#cfcadd');
  { const gx=X0(4), gy=Y0(4);
    for(const yy of [0,5,10,15]) for(let x=0;x<16;x++) P(gx+x,gy+yy,'#9894b8');
    for(let row=0;row<3;row++){ const off=(row%2)?3:9;
      for(let y=1;y<5;y++) P(gx+((off+16)%16),gy+row*5+y,'#9894b8');
      for(let y=1;y<5;y++) P(gx+((off+8)%16),gy+row*5+y,'#9894b8'); }
    for(let i=0;i<5;i++) P(gx+((r()*16)|0),gy+1+((r()*14)|0),'#7fae7a');
    P(gx+4,gy+2,'#e26d8f'); P(gx+11,gy+7,'#e26d8f'); P(gx+6,gy+12,'#e26d8f'); }

  // 5 蘑菇柄：分段环纹 + 顶部亮
  r=mulberry(66); F(5,'#f0e6d2');
  { const gx=X0(5), gy=Y0(5);
    for(let x=0;x<16;x++)for(let y=0;y<3;y++) if(r()<.8) P(gx+x,gy+y,'#f8f1e4');
    for(const yy of [5,10,15]) for(let x=0;x<16;x++) if(r()<.85) P(gx+x,gy+yy,'#d9c9ac');
    for(let i=0;i<6;i++){ const x=(r()*16)|0,y0=(r()*10)|0,h=3+((r()*5)|0);
      for(let y=y0;y<Math.min(16,y0+h);y++) if(r()<.7) P(gx+x,gy+y,'#e4d6bc'); }
    SP(5,r,['#f8f1e4','#e8dac2'],24); }

  // 6/7 蘑菇盖：弧面渐变 + 白斑带影 + 边缘暗环
  for(const [t,base,inner,edge] of [[6,'#e34b60','#ec6d7f','#c23a50'],
                                    [7,'#5b7ce8','#6f8cf0','#4865cc']]){
    r=mulberry(t*13); F(t,base);
    DISC(t,8,7,5.4,inner);
    RING(t,8,7,6.4,7.4,edge);
    { const gx=X0(t), gy=Y0(t);
      for(let x=2;x<8;x++) P(gx+x,gy+2,'#ffffff40'); }
    for(const [cx,cy,s] of [[3,3,1.7],[11,5,1.5],[5,11,1.6],[12,12,1.4]]){
      DISC(t,cx,cy,s,'#fff6f0'); P(X0(t)+cx-((s/2)|0),Y0(t)+cy+1,'#e3cdc9'); }
    SP(t,r,[base,inner],26);
  }

  // 8/9 玫瑰（透明十字面片）：双朵盛放 + 花苞 + 叶对 + 落瓣
  for(const [t,outer,inner,rim,heart] of [
        [8,'#ff5f8f','#ff9ec0','#d94776','#ffd0e0'],
        [9,'#fdf4f8','#ffffff','#e8ccd8','#ffd9e6']]){
    const x0=X0(t), y0=Y0(t);
    ac.clearRect(x0,y0,16,16);
    for(let y=6;y<16;y++){ P(x0+7,y,'#3e8f5c'); if(y>8&&y%3) P(x0+8,y,'#357c4e'); }
    P(x0+5,10,'#3e8f5c');P(x0+4,11,'#357c4e');P(x0+3,11,'#54a86e');
    P(x0+10,11,'#3e8f5c');P(x0+11,12,'#357c4e');P(x0+12,12,'#54a86e');
    P(x0+6,13,'#3e8f5c');P(x0+9,8,'#54a86e');
    for(const [cx,cy,rad] of [[4,4,2.7],[11,4,2.7],[8,9,2.2]]){
      DISC(t,cx,cy,rad,outer);
      RING(t,cx,cy,rad-.6,rad,rim);
      DISC(t,cx,cy,rad*.55,inner);
      P(x0+cx,y0+cy-1,heart); P(x0+cx-1,y0+cy,'#ffffff');
    }
    P(x0+3,14,outer); P(x0+12,13,outer); P(x0+3,15,rim); P(x0+12,14,rim);
  }

  // 10 魔法树篱：叶簇十字 + 浆果
  r=mulberry(99); F(10,'#2e7c4e');
  { const gx=X0(10), gy=Y0(10);
    for(let i=0;i<26;i++){ const x=(r()*15)|0, y=(r()*15)|0;
      P(gx+x,gy+y,'#3d9663'); P(gx+x+1,gy+y,'#256b42'); P(gx+x,gy+y+1,'#256b42'); P(gx+x+1,gy+y+1,'#358a58'); }
    SP(10,r,['#256b42','#1f5c38','#358a58'],60);
    for(let i=0;i<3;i++) P(gx+((r()*15)|0),gy+((r()*15)|0),'#ff9ec7'); }

  // 11/12 棋格：大理石纹 + 角部柔光
  for(const [t,base,vein,gloss] of [[11,'#f6f1e4','#e7dfcf','#ffffff'],
                                    [12,'#c42f4a','#a82640','#d8536c']]){
    F(t,base);
    { const gx=X0(t), gy=Y0(t); r=mulberry(t*7);
      for(let k=0;k<2;k++){ let x=(r()*4)|0, y=0;
        while(y<16){ P(gx+Math.min(15,x),gy+y,vein); y++; x+=(r()<.3?(r()<.5?1:-1):0); } }
      for(let i=0;i<8;i++) P(gx+((r()*4)|0),gy+((r()*4)|0),gloss);
      P(gx+12,gy+12,gloss); P(gx+13,gy+12,gloss); }
  }

  // 13 茶杯侧壁：瓷面 + 双色带 + 金线 + 心点
  F(13,'#fdf7ee');
  { const gx=X0(13), gy=Y0(13);
    for(let y=0;y<16;y++){ P(gx,gy+y,'#f4ead9'); P(gx+15,gy+y,'#f8f0e2'); }
    for(let x=0;x<16;x++)P(gx+x,gy+1,'#e8ddcf');
    for(let x=0;x<16;x++)P(gx+x,gy+3,'#57aab4');
    for(let x=0;x<16;x++)P(gx+x,gy+2,'#6cc7cf');
    for(let x=0;x<16;x++)P(gx+x,gy+13,'#d4a94f');
    for(let x=0;x<16;x++)P(gx+x,gy+12,'#e6c46e');
    for(const [hx,hy] of [[4,7],[11,6]]){ P(gx+hx,gy+hy,'#e26d8f');P(gx+hx+1,gy+hy,'#e26d8f');
      P(gx+hx,gy+hy+1,'#e26d8f');P(gx+hx+1,gy+hy+1,'#d8536c'); } }

  // 14 茶杯顶：金沿 + 青环 + 心
  DISC(14,7,7,7.2,'#fbf4ea');
  RING(14,7,7,5.6,6.6,'#e6c46e');
  RING(14,7,7,5.0,5.6,'#f7dd9a');
  RING(14,7,7,3.0,4.2,'#6cc7cf');
  RING(14,7,7,2.4,3.0,'#8fdde2');
  DISC(14,7,7,1.4,'#fbf4ea');
  { const gx=X0(14), gy=Y0(14);
    P(gx+7,gy+6,'#e26d8f');P(gx+6,gy+7,'#e26d8f');P(gx+8,gy+7,'#e26d8f');P(gx+7,gy+8,'#d8536c'); }

  // 15 “吃我”曲奇：辐射渐变 + 巧克力豆带高光 + 咬痕
  r=mulberry(111); F(15,'#d9a05f'); DISC(15,8,8,6.4,'#e2ad6e');
  SP(15,r,['#e7b477','#c98f4c','#dca767'],40);
  { const gx=X0(15), gy=Y0(15);
    for(const [cx,cy] of [[3,4],[9,3],[6,9],[12,8],[4,12]]){
      DISC(15,cx,cy,1,'#6f4222'); P(gx+cx,gy+cy,'#8a5a33'); }
    DISC(15,13,2,2.2,'#c98f4c');
    P(gx+2,gy+14,'#b57f42');P(gx+3,gy+15,'#b57f42');P(gx+8,gy+2,'#f0c98e'); }

  // 16 纸牌：奶油底 + 金框角 + 3D 红心 + 角标
  F(16,'#fbf8f1');
  { const gx=X0(16), gy=Y0(16);
    for(let i=1;i<15;i++){ P(gx+i,gy+1,'#e6dcc8'); P(gx+i,gy+14,'#e6dcc8');
      P(gx+1,gy+i,'#e6dcc8'); P(gx+14,gy+i,'#e6dcc8'); }
    for(const [cx,cy] of [[2,2],[13,2],[2,13],[13,13]]) P(gx+cx,gy+cy,'#e6c46e');
    const heart=['.XX.XX.','XXXXXXX','XXXXXXX','.XXXXX.','..XXX..','...X...'];
    for(let y=0;y<heart.length;y++)for(let x=0;x<7;x++) if(heart[y][x]==='X'){
      P(gx+4+x,gy+5+y, (x<2&&y<2)?'#ffffff':((x+y)>9?'#b02540':'#e04763')); }
    P(gx+5,gy+5,'#ff8fa8'); P(gx+6,gy+5,'#ff8fa8');
    for(const [px,py] of [[3,3],[12,11]]){ P(gx+px,gy+py,'#d8354f');P(gx+px+1,gy+py,'#d8354f');
      P(gx+px,gy+py+1,'#d8354f');P(gx+px+1,gy+py+1,'#b02540'); } }

  // 17 “喝我”魔药：渐变玻璃 + 气泡带高光 + 金丝带 + 星光
  { const x0=X0(17), y0=Y0(17);
    ac.clearRect(x0,y0,16,16);
    ac.fillStyle='rgba(150,240,255,0.50)'; ac.fillRect(x0,y0,16,8);
    ac.fillStyle='rgba(96,204,255,0.62)'; ac.fillRect(x0,y0+8,16,8);
    ac.fillStyle='rgba(255,255,255,0.35)';
    ac.fillRect(x0,y0,16,1);ac.fillRect(x0,y0+15,16,1);ac.fillRect(x0,y0,1,16);ac.fillRect(x0+15,y0,1,16);
    ac.fillStyle='rgba(230,196,110,0.78)'; ac.fillRect(x0,y0+12,16,2);
    ac.fillStyle='rgba(255,255,255,0.22)'; ac.fillRect(x0+3,y0+2,1,7); ac.fillRect(x0+4,y0+2,1,3);
    r=mulberry(112);
    for(let i=0;i<5;i++){ ac.fillStyle='rgba(225,250,255,0.85)';
      ac.fillRect(x0+((r()*14)|0),y0+((r()*9)|0),2,2); }
    ac.fillStyle='#ffffff';
    ac.fillRect(x0+11,y0+2,1,5); ac.fillRect(x0+9,y0+4,5,1); }

  // 18 柴郡迷雾：渐变条纹 + 完整笑容（齿缝）+ 弯月眼
  { const x0=X0(18), y0=Y0(18);
    F(18,'#8f6fd8');
    ac.fillStyle='#9a7ce0'; ac.fillRect(x0,y0,16,6);
    for(const sx of [1,5,9,13]){ for(let y=0;y<16;y++){
      const w=(Math.sin(y*0.7+sx)*0.8)|0; P(x0+((sx+w+16)%16),y0+y,'#6b4fb8'); } }
    for(let x=2;x<=13;x++){ const y=10+Math.round(((x-7.5)*(x-7.5))/7);
      P(x0+x,y0+y,'#fff5fa'); P(x0+x,y0+y+1,'#fff5fa');
      if(((x-2)%3)===2) P(x0+x,y0+11,'#e0b6d8'); }
    for(const [ex,flip] of [[5,0],[10,1]]){
      P(x0+ex,y0+4,'#fff5fa');P(x0+ex+1,y0+4,'#fff5fa');
      P(x0+ex+(flip?0:1),y0+5,'#3f2d5e'); }
    P(x0+2,y0+2,'#ffffff'); P(x0+14,y0+13,'#ffffff'); }

  // 19 梦境树干：波纹脊线 + 节疤
  r=mulberry(114); F(19,'#6b4634');
  { const x0=X0(19), y0=Y0(19);
    for(const bx of [0,3,6,9,12]){ for(let y=0;y<16;y++)
      if(r()>.2) P(x0+((bx+((r()*2)|0))%16),y0+y,'#5a3a2a'); }
    for(const bx of [1,4,7,10,13]) for(let y=0;y<16;y+=2)
      if(r()>.5) P(x0+(bx%16),y0+y,'#7d5540');
    DISC(19,9,7,1.3,'#4a2f22'); RING(19,9,7,1.3,1.9,'#5f3f2f');
    SP(19,r,['#7d5540'],26); }

  // 20/21 棉花糖/薰衣草叶：底色噪点 + 小花簇
  for(const [t,base,dots,bl,cen] of [
        [20,'#ffaed4',['#ff96c4','#ffc4e2','#f886b8','#ffbcdc'],'#ffffff','#ff8fc0'],
        [21,'#c3a6f2',['#b193e6','#d3bcf7','#a685dd','#cbb4f4'],'#efe6ff','#b193e6']]){
    r=mulberry(t*9); F(t,base); SP(t,r,dots,150);
    { const gx=X0(t), gy=Y0(t);
      for(let i=0;i<4;i++){ const x=(r()*14)|0, y=(r()*14)|0;
        P(gx+x,gy+y,bl); P(gx+x+1,gy+y,bl); P(gx+x,gy+y+1,bl); P(gx+x+1,gy+y+1,cen); } } }

  // 22 黄金：三调斜纹 + 十字星芒
  r=mulberry(117); F(22,'#eec65e');
  { const gx=X0(22), gy=Y0(22);
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      if((x+y)%6<2) P(gx+x,gy+y,'#f9e08d');
    }
    for(const [sx,sy] of [[3,4],[11,10]]){
      P(gx+sx,gy+sy-1,'#fffbe0');P(gx+sx,gy+sy+1,'#fffbe0');
      P(gx+sx-1,gy+sy,'#fffbe0');P(gx+sx+1,gy+sy,'#fffbe0');P(gx+sx,gy+sy,'#ffffff'); } }
  SP(22,r,['#d9a83f'],22);

  // 23 素瓷底
  F(23,'#fbf4ea'); RING(23,7,7,5.5,6.5,'#e8ddcf');
  SP(23,mulberry(118),['#f1e7d8'],18);

  // 24 红心砖：明暗砖 + 白心带影
  r=mulberry(120); F(24,'#d8476b');
  { const gx=X0(24), gy=Y0(24);
    for(let x=0;x<16;x++)for(let y=0;y<3;y++) if(r()<.6) P(gx+x,gy+y,'#e0567a');
    for(const yy of [0,5,10,15]) for(let x=0;x<16;x++) P(gx+x,gy+yy,'#a83352');
    for(let row=0;row<3;row++){ const off=(row%2)?3:9;
      for(let y=1;y<5;y++){ P(gx+((off+16)%16),gy+row*5+y,'#a83352');
        P(gx+((off+8)%16),gy+row*5+y,'#a83352'); } }
    for(const [hx,hy] of [[2,2],[10,7],[5,12],[12,12]]){
      P(gx+hx+1,gy+hy,'#fff0f4'); P(gx+hx,gy+hy+1,'#fff0f4'); P(gx+hx+1,gy+hy+1,'#fff0f4');
      P(gx+hx+2,gy+hy+1,'#fff0f4'); P(gx+hx+1,gy+hy+2,'#fff0f4');
      P(gx+hx+1,gy+hy+3,'#b03252'); } }

  // 25 糖果棒：斜纹 + 光泽线 + 薄荷点
  { const x0=X0(25), y0=Y0(25);
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)
      P(x0+x,y0+y, ((x+y)%7<3)?'#ff5f6d':'#fff6f3');
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)
      if((x-y+32)%9===0) P(x0+x,y0+y,'#ffd9d9');
    P(x0+4,y0+3,'#9fe8d9'); P(x0+12,y0+11,'#9fe8d9'); }

  // 26 萤石糖矿：梦境石基底 + 发光糖晶簇（粉/青双色 + 白芯 + 星闪）
  { F(26,'#a9abbd'); SP(26,mulberry(126),['#999bae','#b8bad0','#8f92a6'],90);
    r=mulberry(226);
    for(const [cx,cy,rad,core,edge] of [
        [4,4,1.6,'#fff0fa','#ffb8e0'], [11,6,1.4,'#e4fbff','#8ef0e8'],
        [7,11,1.8,'#fff0fa','#ffb8e0'], [13,13,1.3,'#e4fbff','#8ef0e8']]){
      DISC(26,cx,cy,rad,edge); DISC(26,cx,cy,rad*.55,core);
      P(X0(26)+cx,Y0(26)+cy-1,'#ffffff');
    }
    for(const [sx,sy] of [[6,3],[12,9],[3,12]]){ P(X0(26)+sx,Y0(26)+sy,'#ffffff');
      P(X0(26)+sx,Y0(26)+sy-1,'#fff0fa'); P(X0(26)+sx,Y0(26)+sy+1,'#ffd7f0'); } }

  // 27 星光钻矿：石基底 + 淡蓝钻面（切面高光 + 十字星芒）
  { F(27,'#a9abbd'); SP(27,mulberry(127),['#999bae','#b8bad0','#8f92a6'],90);
    for(const [cx,cy,w,h] of [[4,5,2.6,2.9],[11,10,2.9,3.2],[12,3,1.8,2.0]]){
      const x0=X0(27), y0=Y0(27);
      for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
        const t=Math.abs(dx)/w+Math.abs(dy)/h;
        if(t<=1) P(x0+cx+dx,y0+cy+dy, t>.62?'#7ea8d8':(t>.3?'#a8d0f0':'#dff2ff'));
      }
      P(x0+cx-1,y0+cy-1,'#ffffff'); P(x0+cx-2,y0+cy-2,'#cfe8ff');
    }
    P(X0(27)+6,Y0(27)+12,'#ffffff'); P(X0(27)+8,Y0(27)+11,'#bfe0ff'); }

  // 28 红心宝石矿：石基底 + 红心晶芽（立体心形 + 高光点）
  { F(28,'#a9abbd'); SP(28,mulberry(128),['#999bae','#b8bad0','#8f92a6'],90);
    const heart=['.XX.XX.','XXXXXXX','XXXXXXX','.XXXXX.','..XXX..','...X...'];
    for(const [hx,hy] of [[1,2],[8,8],[9,1]]){
      const x0=X0(28), y0=Y0(28);
      for(let y=0;y<heart.length;y++)for(let x=0;x<7;x++) if(heart[y][x]==='X'){
        const lit=(x<2&&y<2)||((x===1||x===4)&&y===1);
        P(x0+hx+x,y0+hy+y, lit?'#ff9ec0':((x+y)>8?'#b02540':'#e04763'));
      }
      P(x0+hx+1,y0+hy+1,'#ffd0e0');
    } }

  // 29 萤火菌灯（十字面片，透明底）：奶油柄 + 琥珀粉伞 + 白斑 + 光晕像素
  { const x0=X0(29), y0=Y0(29);
    ac.clearRect(x0,y0,16,16);
    for(let y=8;y<16;y++){ P(x0+7,y,'#f0e6d2'); if(y>9&&y%2) P(x0+8,y,'#d9c9ac'); }
    P(x0+6,14,'#d9c9ac'); P(x0+6,15,'#e8dac2');
    for(let dy=-3;dy<=3;dy++)for(let dx=-5;dx<=5;dx++){
      const d=dx*dx/3.2+dy*dy; if(d>7.4) continue;
      P(x0+7+dx,y0+7+dy, d>4.8?'#e8a05c':(d>1.8?'#ffc878':'#ffe9a8'));
    }
    P(x0+5,y0+6,'#fff6d8'); P(x0+9,y0+7,'#fff6d8'); P(x0+7,y0+5,'#ffffff');
    for(const [gx,gy] of [[4,5],[11,6],[3,8],[12,9]]){
      P(x0+gx,y0+gy,'#ffe9a8'); P(x0+gx+1,y0+gy,'#fff6d8'); } }
})();

const atlasTex=new THREE.CanvasTexture(atlas);
atlasTex.magFilter=THREE.NearestFilter; atlasTex.minFilter=THREE.NearestFilter;
atlasTex.generateMipmaps=false;
