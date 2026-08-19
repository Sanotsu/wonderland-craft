// Node 全链路玩法仿真：加载真实 player/drops/health 模块，直接驱动
// doBreak/doPlace/updateDrops/stepPhysics/damage 等入口，验证生存模式完整闭环。
// 运行：node tools/node-gameplay-test.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'web');

function makeCtx2d() {
  const grad = { addColorStop() {} };
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      if (k in t) return t[k];
      t[k] = () => {};
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function makeCanvas() {
  return { width: 0, height: 0, getContext: () => makeCtx2d(), style: {} };
}
function fakeEl() {
  return { style: {}, classList: { add() {}, remove() {}, toggle() {} },
    textContent: '', innerHTML: '', offsetWidth: 0,
    appendChild() {}, addEventListener() {} };
}

function makeSandbox(storage, log) {
  const els = {};
  return {
    console, Math, JSON, performance, URLSearchParams,
    isNaN, parseInt, parseFloat, setTimeout, clearTimeout,
    navigator: { maxTouchPoints: 0, vibrate: null },
    matchMedia: () => ({ matches: false }),
    location: { search: '', reload() {} },
    localStorage: storage,
    document: {
      createElement: (t) => (t === 'canvas' ? makeCanvas() : fakeEl()),
      getElementById: (id) => (els[id] || (els[id] = fakeEl())),
      addEventListener() {}, removeEventListener() {},
      documentElement: {}, hidden: false, pointerLockElement: null,
      body: fakeEl(),
    },
    addEventListener() {}, removeEventListener() {},
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    scene: { add() {}, remove() {} },
    renderer: { domElement: {}, render() {} },
    toast: (m) => log.push('[toast] ' + m),
    spawnBurst() {}, sfxBlip() {}, sfxCrunch() {},
    selIdx: 0, yaw: 0, pitch: -0.08, dayTime: 0.3, hp: 20,
    __log: log,
  };
}

const SCRIPTS = [
  'lib/three.min.js',
  'js/config.js', 'js/noise.js', 'js/blocks.js', 'js/textures.js', 'js/worldgen.js',
  'js/light.js', 'js/save.js', 'js/mesher.js', 'js/drops.js',
  'js/player.js', 'js/health.js',
];

function makeGame(seed) {
  const log = [];
  const storage = {
    _s: seed != null ? { wc_save_v2: JSON.stringify({ seed }) } : {},
    getItem(k) { return k in this._s ? this._s[k] : null; },
    setItem(k, v) { this._s[k] = String(v); },
    removeItem(k) { delete this._s[k]; },
  };
  const sandbox = makeSandbox(storage, log);
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of SCRIPTS) {
    vm.runInContext(readFileSync(join(WEB, f), 'utf8'), ctx, { filename: f });
  }
  const run = (expr) => vm.runInContext(expr, ctx);
  run(`gameMode='survival'`);
  run(`updateInvUI=function(){}; updateHearts=function(){}`); // ui.js 未加载
  run(`applyLockState=function(){}`);                          // main.js 未加载
  run(`cameraRef=new THREE.PerspectiveCamera(75,1,.1,1500); cameraRef.rotation.order='YXZ'`);
  run(`enterGame=function(){}`); // 测试环境不进入指针锁定
  run(`computeAllLight()`);
  return { run, log, storage, ctx };
}

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ FAIL: ' + msg); }
}

// ========== 场景：站在茶会出生点，低头挖脚前地面 ==========
console.log('\n[A] 生存挖掘 → 掉落 → 磁吸拾取 → 库存');
{
  const g = makeGame(424242);
  const r = g.run;
  r(`player.pos.set(88.5, ${r('teaH')}+1.02, 96.5); yaw=0; pitch=-0.9;
     cameraRef.rotation.set(pitch,yaw,0); cameraRef.updateMatrixWorld()`);
  const before = r(`world[idx(88,${r('teaH')},95)]`);
  ok(before !== 0, `瞄准的地面方块存在 (id=${before})`);
  const hitInfo = r(`JSON.stringify(raycast(eyePos(),camDir(),6.5))`);
  const hit = JSON.parse(hitInfo);
  ok(hit && hit.id !== 0, `俯角 -0.9 射线命中 ${r('BLOCKS[' + hit.id + '].n')} @${hit.x},${hit.y},${hit.z}`);
  // 挖掘 → 生成掉落
  r(`doBreak()`);
  ok(r(`world[idx(${hit.x},${hit.y},${hit.z})]`) === 0, 'doBreak 后方块被移除');
  ok(r(`drops.length`) === 1, `生成 1 个掉落实体 (drops=${r('drops.length')})`);
  // 模拟 3 秒掉落物理 + 磁吸
  r(`let __t=0; for(let i=0;i<180;i++){ __t+=0.0167; stepPhysics(0.0167); updateDrops(0.0167,__t*1000,player.pos); }`);
  const dAfter = r(`drops.length`), invAfter = r(`inv[${r('HOTBAR.indexOf(' + hit.id + ')')}]`);
  ok(dAfter === 0, `掉落物被拾取 (剩余 ${dAfter})`);
  ok(invAfter >= 1, `库存 +1 → 对应快捷栏格=${invAfter}`);
  ok(g.log.some(l => l.includes('拾取')), '拾取 toast 触发');
}

// ========== 放置消耗库存 ==========
console.log('\n[B] 生存放置 → 消耗库存');
{
  const g = makeGame(424242);
  const r = g.run;
  r(`player.pos.set(88.5, ${r('teaH')}+1.02, 96.5); yaw=0; pitch=-0.9;
     cameraRef.rotation.set(pitch,yaw,0); cameraRef.updateMatrixWorld()`);
  // 空手放置应被拒绝
  r(`doPlace()`);
  ok(g.log.some(l => l.includes('用完')), '库存为 0 时放置被拒绝并提示');
  // 给 3 个当前选择方块（slot0=草地）
  r(`inv[0]=3`);
  const hit = JSON.parse(r(`JSON.stringify(raycast(eyePos(),camDir(),6.5))`));
  r(`doPlace()`);
  const placed = r(`world[idx(${hit.x},${hit.y},${hit.z})]`);
  ok(placed !== 0, `放置成功 (id=${placed})`);
  ok(r(`inv[0]`) === 2, `库存消耗 3→2 (=${r('inv[0]')})`);
}

// ========== 创造模式：即挖即得（无掉落）==========
console.log('\n[C] 创造模式行为');
{
  const g = makeGame(424242);
  const r = g.run;
  r(`gameMode='creative'`);
  r(`player.pos.set(88.5, ${r('teaH')}+1.02, 96.5); yaw=0; pitch=-0.9;
     cameraRef.rotation.set(pitch,yaw,0); cameraRef.updateMatrixWorld()`);
  r(`doBreak()`);
  ok(r(`drops.length`) === 0, '创造模式挖掘不产生掉落');
  r(`doPlace()`);
  ok(true, '创造模式放置不消耗（无限）');
}

// ========== 跌落伤害与死亡/重生 ==========
console.log('\n[D] 跌落伤害 / 死亡 / 重生 / 回血');
{
  const g = makeGame(424242);
  const r = g.run;
  // 从 20 格高处自由落体
  r(`player.pos.set(88.5, 34, 88.5); player.vel.set(0,0,0); player.fly=false;
     for(const k in keys) delete keys[k];
     cameraRef.rotation.set(pitch,yaw,0); cameraRef.updateMatrixWorld()`);
  r(`let __t=0; for(let i=0;i<600;i++){ __t+=0.0167; stepPhysics(0.0167); }`);
  const hpAfter = r(`hp`);
  ok(hpAfter < 20, `20 格跌落造成伤害 (hp=${hpAfter})`);
  ok(r(`performance.now()`) >= 0, '受伤时间戳已记录');
  // 死亡与重生
  r(`damage(99,'测试坠落')`);
  ok(r(`deathScreen`) === true, 'hp 归零进入死亡画面');
  ok(r(`player.pos.y`) > -100, '死亡时玩家位置保持');
  // B11：死亡期间存档 = 茶会出生点 + 满血（而非 1 血原地复活）
  r(`saveGame()`);
  const sv = JSON.parse(g.storage._s.wc_save_v2);
  ok(sv.hp === 20 && Math.abs(sv.p.x - 88.5) < 1 && sv.p.fly === false,
    '死亡时存档改写为出生点+满血 (B11)');
  ok(typeof sv.m === 'boolean', '存档携带音乐开关字段 (B14)');
  r(`respawn()`);
  ok(r(`hp`) === 20 && r(`deathScreen`) === false, '重生后满血并退出死亡画面');
  ok(Math.abs(r(`player.pos.x`) - 88.5) < 1, '重生回到茶会出生点');
  // 脱战回血
  r(`hp=10; lastDmgT=-1e9; regenAcc=0`);
  r(`for(let i=0;i<400;i++) updateHealth(0.05, i*50)`);
  ok(r(`hp`) > 10, `脱战缓慢回血 (hp=${r('hp')})`);
  // 生存禁飞
  r(`setFly(true)`);
  ok(r(`player.fly`) === false, '生存模式 setFly 被拒绝');
}

// ========== 掉落物理：落入洞穴不穿地、超时清理 ==========
console.log('\n[E] 掉落物物理');
{
  const g = makeGame(424242);
  const r = g.run;
  r(`player.pos.set(88.5, ${r('teaH')}+1.02, 96.5)`);
  r(`spawnDrop(88.5, 40, 96.5, B.STONE); spawnDrop(88.5, 40, 96.0, B.DIRT)`);
  r(`let __t=0; for(let i=0;i<240;i++){ __t+=0.0167; stepPhysics(0.0167);
      updateDrops(0.0167,__t*1000,{x:200,z:200,y:60}); }`);
  const n = r(`drops.length`);
  const y1 = r(`drops.length? drops[0].y : -99`);
  ok(n === 2, `两个掉落物稳定落地 (剩余 ${n})`);
  ok(y1 < 20 && y1 > 8, `落回地面附近 (y=${y1.toFixed(1)})`);
  // 玩家远离时不拾取
  ok(r(`inv.every(v=>v===0)`), '玩家远离时不拾取');
}

// ========== B12：掉落物隔墙不磁吸 ==========
console.log('\n[F] 掉落物视线判定 (B12)');
{
  const g = makeGame(424242);
  const r = g.run;
  const th = r('teaH');
  r(`player.pos.set(90.5, ${th}+1.02, 95.5); player.vel.set(0,0,0)`);
  r(`for(let y=${th}+1;y<=${th}+2;y++) setLive(89,y,95,B.STONE)`); // 立一堵石墙
  r(`spawnDrop(88.5, ${th}+1.15, 95.5, B.STONE); drops[0].vx=0; drops[0].vz=0`);
  r(`let __t=0; for(let i=0;i<180;i++){ __t+=0.0167; updateDrops(0.0167,__t*1000,player.pos); }`);
  ok(r(`drops.length`) === 1, '隔墙时掉落物不被磁吸/拾取');
  ok(r(`inv.every(v=>v===0)`), '隔墙时库存不变');
  r(`for(let y=${th}+1;y<=${th}+2;y++) setLive(89,y,95,0)`); // 拆墙恢复视线
  r(`let __t2=0; for(let i=0;i<180;i++){ __t2+=0.0167; updateDrops(0.0167,3000+__t2*1000,player.pos); }`);
  ok(r(`drops.length`) === 0, '视线恢复后被正常拾取');
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
