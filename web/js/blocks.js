'use strict';
// 方块注册表：t/b/s 为顶/底/侧贴图索引，cross 为十字面片，tr 为半透明，lum 为自发光等级(0-15)
const B={AIR:0,GRASS:1,DIRT:2,STONE:3,BRICK:4,STEM:5,CAPR:6,CAPB:7,ROSER:8,ROSEW:9,
  HEDGE:10,CHKW:11,CHKR:12,TEACUP:13,COOKIE:14,CARD:15,POTION:16,CHESHIRE:17,
  BARK:18,LEAFP:19,LEAFL:20,GOLD:21,HEART:22,CANDY:23,
  OREG:24,ORES:25,OREH:26,TORCH:27};
const BLOCKS=[
  {n:'空气',solid:false},
  {n:'薄荷草地',t:0,b:2,s:1,c:'#7fd6a6'},
  {n:'泥土',t:2,b:2,s:2,c:'#a5794f'},
  {n:'梦境石头',t:3,b:3,s:3,c:'#b6b6c6'},
  {n:'城堡石砖',t:4,b:4,s:4,c:'#cfcadd'},
  {n:'蘑菇柄',t:5,b:5,s:5,c:'#f2e7d4'},
  {n:'红蘑菇盖',t:6,b:6,s:6,c:'#e8485f',lum:5},
  {n:'蓝蘑菇盖',t:7,b:7,s:7,c:'#5f7bef',lum:5},
  {n:'红玫瑰',t:8,s:8,cross:true,solid:false,c:'#ff5f8f'},
  {n:'白玫瑰',t:9,s:9,cross:true,solid:false,c:'#fdf3f6'},
  {n:'魔法树篱',t:10,b:10,s:10,c:'#2f7d4f'},
  {n:'象牙棋格',t:11,b:11,s:11,c:'#f4efe2'},
  {n:'绯红棋格',t:12,b:12,s:12,c:'#c22e49'},
  {n:'疯狂茶杯',t:14,b:23,s:13,c:'#fbf4ea'},
  {n:'“吃我”曲奇',t:15,b:15,s:15,c:'#d9a05f'},
  {n:'纸牌方块',t:16,b:16,s:16,c:'#faf6ee'},
  {n:'“喝我”魔药',t:17,b:17,s:17,tr:true,c:'#8ae8ff',lum:7},
  {n:'柴郡迷雾',t:18,b:18,s:18,c:'#8f6fd8',lum:6},
  {n:'梦境树干',t:19,b:19,s:19,c:'#6b4634'},
  {n:'棉花糖树叶',t:20,b:20,s:20,c:'#ffaed2'},
  {n:'薰衣草树叶',t:21,b:21,s:21,c:'#c3a6f2'},
  {n:'黄金',t:22,b:22,s:22,c:'#efc65c',lum:3},
  {n:'红心砖',t:24,b:24,s:24,c:'#d8476b'},
  {n:'糖果棒',t:25,b:25,s:25,c:'#ff6b7a'},
  {n:'萤石糖矿',t:26,b:26,s:26,c:'#ffd9f0',lum:12},
  {n:'星光钻矿',t:27,b:27,s:27,c:'#cfe8ff'},
  {n:'红心宝石矿',t:28,b:28,s:28,c:'#ff5f8f',lum:4},
  {n:'萤火菌灯',t:29,s:29,cross:true,solid:false,c:'#ffe9a8',lum:14},
];
for(const bl of BLOCKS){ if(bl.solid===undefined) bl.solid=true; }
const HOTBAR=[B.GRASS,B.STONE,B.BRICK,B.HEDGE,B.BARK,B.LEAFP,B.LEAFL,B.STEM,B.CAPR,B.CAPB,
  B.ROSER,B.ROSEW,B.CHKW,B.CHKR,B.TEACUP,B.COOKIE,B.CARD,B.POTION,B.CHESHIRE,B.GOLD,
  B.HEART,B.CANDY,B.TORCH,B.OREG,B.ORES,B.OREH];
// 生存模式随身库存：与 HOTBAR 下标对齐的计数（创造模式忽略）
const inv=new Array(HOTBAR.length).fill(0);
