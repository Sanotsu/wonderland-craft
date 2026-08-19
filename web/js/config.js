'use strict';
// 全局配置：贴图尺寸与世界尺寸、触屏检测（?touch=1 可强制开启便于测试）、
// 存档键与游戏模式（P0：v2 存档携带种子/模式/背包/血量）
const TILE=16, ATLAS=256;
const W=160, H=64, D=160, CH=16, NCX=W/CH, NCZ=D/CH;
const IS_TOUCH = new URLSearchParams(location.search).has('touch') ||
  (navigator.maxTouchPoints>0 && matchMedia('(pointer:coarse)').matches);
const SAVE_KEY='wc_save_v2';
let gameMode='creative'; // 'creative' | 'survival'
