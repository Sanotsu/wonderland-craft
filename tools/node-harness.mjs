// Node 无头验证：在 vm 沙箱中加载真实游戏脚本（与浏览器同全局词法作用域），
// 断言 P0 各系统的确定性与正确性。运行：node tools/node-harness.mjs
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
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
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

function makeSandbox(storage) {
  return {
    console, Math, JSON, performance, URLSearchParams,
    isNaN, parseInt, parseFloat,
    setTimeout, clearTimeout,
    navigator: { maxTouchPoints: 0, vibrate: null },
    matchMedia: () => ({ matches: false }),
    location: { search: '', reload() {} },
    localStorage: storage,
    document: {
      createElement: (tag) => (tag === 'canvas' ? makeCanvas() : { style: {}, appendChild() {}, addEventListener() {} }),
      getElementById: () => null,
      addEventListener() {}, removeEventListener() {},
      documentElement: {}, hidden: false, pointerLockElement: null,
    },
    addEventListener() {}, removeEventListener() {},
    innerWidth: 1280, innerHeight: 720,
    devicePixelRatio: 1,
    // 后置模块的运行时依赖桩（player/ui/main 不加载，save/mesher 会触达）
    scene: { add() {}, remove() {} },
    player: { pos: { x: 88, y: 14, z: 96, set() {} }, vel: { set() {} }, fly: false },
    setFly() {}, setGameMode() {}, toast() {}, selectSlot() {},
    selIdx: 0, yaw: 0, pitch: 0, dayTime: 0.2, hp: 20,
    spawnBurst() {}, sfxBlip() {}, sfxCrunch() {},
  };
}

const SCRIPTS = [
  'lib/three.min.js',
  'js/config.js', 'js/noise.js', 'js/blocks.js', 'js/textures.js', 'js/worldgen.js',
  'js/light.js', 'js/save.js', 'js/mesher.js',
];

function makeWorld(storageState) {
  const storage = {
    _s: storageState || {},
    getItem(k) { return k in this._s ? this._s[k] : null; },
    setItem(k, v) { this._s[k] = String(v); },
    removeItem(k) { delete this._s[k]; },
  };
  const sandbox = makeSandbox(storage);
  const ctx = vm.createContext(sandbox);
  for (const f of SCRIPTS) {
    vm.runInContext(readFileSync(join(WEB, f), 'utf8'), ctx, { filename: f });
  }
  const run = (expr) => vm.runInContext(expr, ctx);
  return { ctx, run, storage };
}

// —— 断言工具 ——
let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ FAIL: ' + msg); }
}

const CHECKSUM = `(() => {
  let h = 2166136261;
  for (let i = 0; i < world.length; i++) { h ^= world[i]; h = Math.imul(h, 16777619); }
  return (h >>> 0) + ':' + world.reduce((a, b) => a + b, 0);
})()`;

// ========== 1. 种子确定性 ==========
console.log('\n[1] 世界种子');
const runA = makeWorld({ wc_save_v2: JSON.stringify({ seed: 12345 }) });
const runA2 = makeWorld({ wc_save_v2: JSON.stringify({ seed: 12345 }) });
const runB = makeWorld({ wc_save_v2: JSON.stringify({ seed: 999 }) });
const ckA = runA.run(CHECKSUM), ckA2 = runA2.run(CHECKSUM), ckB = runB.run(CHECKSUM);
ok(runA.run('WORLD_SEED') === 12345, 'v2 存档种子被读取 (WORLD_SEED=12345)');
ok(ckA === ckA2, `同种子世界逐字节一致 (${ckA.split(':')[0]})`);
ok(ckA !== ckB, '不同种子生成不同世界');
const legacy = makeWorld({ wc_save_v1: JSON.stringify({ e: [] }) });
ok(legacy.run('WORLD_SEED') === 0, 'v1 旧档迁移 → 种子 0（地形与旧版一致）');
ok(runA.run('hashStr("wonderland")') > 0, '文字种子可哈希');

// ========== 2. 洞穴 / 矿石 / 菌灯 ==========
console.log('\n[2] 洞穴·矿石·洞窟灯 (seed=12345)');
{
  const r = runA;
  const stats = r.run(`(() => {
    let caveAir = 0, oreG = 0, oreS = 0, oreH = 0, torch = 0, oreHmaxY = -1;
    for (let i = 0; i < world.length; i++) {
      const b = world[i];
      if (b === B.OREG) oreG++;
      else if (b === B.ORES) oreS++;
      else if (b === B.OREH) { oreH++; const y = (i / (W * D)) | 0; if (y > oreHmaxY) oreHmaxY = y; }
      else if (b === B.TORCH) torch++;
    }
    for (let x = 2; x < W - 2; x++) for (let z = 2; z < D - 2; z++) {
      const top = groundH(x, z);
      for (let y = 5; y < top - 4; y++) if (world[idx(x, y, z)] === 0) caveAir++;
    }
    return { caveAir, oreG, oreS, oreH, torch, oreHmaxY,
      spawnGrass: world[idx(88, groundH(88, 96), 96)] === B.GRASS };
  })()`);
  ok(stats.caveAir > 5000, `地下存在洞穴空腔 (${(stats.caveAir / 1000).toFixed(1)}k 格)`);
  ok(stats.oreG > 200, `萤石糖矿生成 (${stats.oreG})`);
  ok(stats.oreS > 100, `星光钻矿生成 (${stats.oreS})`);
  ok(stats.oreH > 30, `红心宝石矿生成 (${stats.oreH})`);
  ok(stats.oreHmaxY <= 13, `红心宝石深度约束 y≤13 (max=${stats.oreHmaxY})`);
  ok(stats.torch > 10, `洞窟/地表萤火菌灯 (${stats.torch})`);
  ok(stats.spawnGrass, '洞穴未破坏地表（出生点为草地）');
}

// ========== 3. 体素光照 ==========
console.log('\n[3] 天光/块光传播');
{
  const r = runA;
  const t0 = performance.now();
  r.run('computeAllLight()');
  const ms = (performance.now() - t0).toFixed(0);
  ok(true, `computeAllLight 耗时 ${ms}ms`);
  const st = r.run(`(() => {
    const topSky = skyL[idx(88, H - 1, 96)];
    const underGround = skyL[idx(88, groundH(88, 96) - 1, 96)];
    let torchIdx = -1;
    for (let i = 0; i < world.length; i++) if (world[i] === B.TORCH) { torchIdx = i; break; }
    let adj = -1;
    if (torchIdx >= 0) {
      const y = (torchIdx / (W * D)) | 0, rem = torchIdx - y * W * D, z = (rem / W) | 0, x = rem - z * W;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = idx(x + dx, y, z + dz);
        if (world[j] === 0) { adj = blkL[j]; break; }
      }
      return { topSky, underGround, self: blkL[torchIdx], adj, bedrock: [skyL[idx(80, 2, 80)], blkL[idx(80, 2, 80)]] };
    }
    return { topSky, underGround, torchIdx };
  })()`);
  ok(st.topSky === 15, '露天顶部天光=15');
  ok(st.underGround === 0, '地表以下首格无天光');
  ok(st.self === 14, `菌灯格块光=14 (${st.self})`);
  ok(st.adj === 13, `邻格衰减为 13 (${st.adj})`);
  ok(st.bedrock[0] === 0, '基岩层无天光');
}

// ========== 4. 增删方块的局部光照更新 ==========
console.log('\n[4] onWorldEdit 局部重光');
{
  const r = runA;
  const st = r.run(`(() => {
    let spot = -1;
    for (let y = 6; y < 10 && spot < 0; y++) for (let x = 40; x < 60 && spot < 0; x++) {
      const i = idx(x, y, 50);
      if (world[i] === B.STONE && skyL[i] === 0 && blkL[i] === 0) spot = i;
    }
    if (spot < 0) return { found: false };
    const y = (spot / (W * D)) | 0, rem = spot - y * W * D, z = (rem / W) | 0, x = rem - z * W;
    setLive(x, y, z, 0); setLive(x + 1, y, z, 0); setLive(x + 2, y, z, 0); // 挖出空气腔
    dirty.clear();
    const placed = setLive(x, y, z, B.TORCH);
    const dirtyN = dirty.size; dirty.clear();
    const selfAfter = blkL[spot];
    const near1 = blkL[idx(x + 1, y, z)];
    const near2 = blkL[idx(x + 2, y, z)];
    setLive(x, y, z, B.STONE); setLive(x + 1, y, z, B.STONE); setLive(x + 2, y, z, B.STONE);
    dirty.clear();
    return { found: true, placed, dirtyN, selfAfter, near1, near2, off: blkL[spot] };
  })()`);
  ok(st.found, '找到无光石头样本');
  ok(st.placed === true, 'setLive 放置菌灯');
  ok(st.dirtyN > 0, `光照重算标记区块 dirty=${st.dirtyN}`);
  ok(st.selfAfter === 14, `放置后块光=14 (${st.selfAfter})`);
  ok(st.near1 === 13, `1 格外衰减 13 (${st.near1})`);
  ok(st.near2 === 12, `2 格外衰减 12 (${st.near2})`);
  ok(st.off === 0, '移除后块光熄灭');
}

// ========== 5. 网格构建与 bl 属性 ==========
console.log('\n[5] 区块网格 + 着色器属性');
{
  const r = runA;
  const t0 = performance.now();
  r.run('buildAllChunks()');
  const ms = (performance.now() - t0).toFixed(0);
  ok(true, `buildAllChunks 耗时 ${ms}ms`);
  const st = r.run(`(() => {
    const c = chunks.get('5,5');
    if (!c || !c.s) return { exists: false };
    const geo = c.s.geometry;
    const pn = geo.attributes.position.count, bn = geo.attributes.bl.count,
          cn = geo.attributes.color.count, inCount = geo.index.count;
    let blMax = 0, colMin = 1;
    for (let i = 0; i < bn; i++) blMax = Math.max(blMax, geo.attributes.bl.array[i]);
    for (let i = 0; i < cn; i++) colMin = Math.min(colMin, geo.attributes.color.array[i * 3]);
    return { exists: true, pn, bn, cn, inCount, blMax, colMin };
  })()`);
  ok(st.exists, '区块 (5,5) 不透明网格存在');
  ok(st.pn === st.bn && st.pn === st.cn, `顶点属性对齐 (pos=${st.pn}, bl=${st.bn}, col=${st.cn})`);
  ok(st.inCount % 3 === 0 && st.inCount > 0, `索引合法 (${st.inCount})`);
  ok(st.blMax > 0.5, `存在受块光照亮的顶点 (blMax=${st.blMax.toFixed(2)})`);
  ok(st.colMin < 0.2, `存在深洞暗顶点 (colMin=${st.colMin.toFixed(3)})`);
}

// ========== 6. 存档往返 ==========
console.log('\n[6] 存档 v2 往返');
{
  const w1 = makeWorld({ wc_save_v2: JSON.stringify({ seed: 777 }) });
  w1.run(`setLive(10, 20, 10, B.TORCH); inv[0] = 5; inv[3] = 2; saveGame()`);
  const data = JSON.parse(w1.storage._s.wc_save_v2);
  ok(data.seed === 777, `存档携带种子 (${data.seed})`);
  ok(data.inv[0] === 5 && data.inv[3] === 2, '库存序列化');
  ok(data.e.length === 1 && data.e[0][0] === '10,20,10', '方块 diff 序列化');
  const ck1 = w1.run(CHECKSUM);
  const w2 = makeWorld({ wc_save_v2: w1.storage._s.wc_save_v2 });
  w2.run('loadGame()');
  ok(w2.run(CHECKSUM) === ck1, '读档后世界与 存档种子+diff 复原一致');
  w2.run(`newWorldWithSeed('alice')`);
  const nd = JSON.parse(w2.storage._s.wc_save_v2);
  const h = w2.run(`hashStr('alice')`);
  ok(nd.seed === h, `文字种子新世界 (${nd.seed})`);
  // 重置/换种子重载期间 pagehide 不得把旧进度写回
  ok(w2.run('resetting') === true, 'newWorldWithSeed 置 resetting 标志');
  const before = w2.storage._s.wc_save_v2;
  w2.run('saveGame()');
  ok(w2.storage._s.wc_save_v2 === before, 'resetting 期间 saveGame 不写档');
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
