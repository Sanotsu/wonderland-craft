# Wonderland Craft 代码分析报告

> 基于 2026-08 全量代码复查（P0 更新于 2026-08-19）。自研代码约 **2240 行**（不含 `lib/three.min.js`），
> 纯静态零运行时依赖，同一套 `web/` 同时服务浏览器、Netlify/Cloudflare 与 Capacitor APK。
>
> **修复记录**：2026-08-18 修复 A1-A5 + C7；2026-08-19 P0 玩法批次（世界种子/洞穴矿石/体素光照/
> 物品掉落/生存模式）上线，并修复测试中发现的 A6（重置世界被 pagehide 回写）、A7（全屏切换 resize 丢失），
> 新增 Node 无头回归（`tools/node-harness.mjs` + `tools/node-gameplay-test.mjs`）。
>
> **第二轮复查（2026-08-19 晚）**：17 个模块逐行复核。新确认 A8（图标贴图错位）与 B11-B17；
> **第三轮修复批次（同日）**：A8 / B11 / B12 / B14 / B17 全部修复并补 5 项断言（回归 **66 项全绿**：
> harness 38 + gameplay 28）；B15 复核确认为**误报**（原代码已有 `dx===Infinity` 守卫）。
> **移动端批次（同日）**：APK 沉浸全屏（Android 15 edge-to-edge 状态栏修复）、触屏点选 hotbar
> 误触发挖掘修复（合成 mousedown 守卫，player.js）、`run-android.bat` 构建装机日志一条龙；
> **版本基线重置为 v0.1.0**（index.html ?v= / package.json / build.gradle 同步），
> APK 显示名改为 **Wonder Craft**。
> 部署通道：`deploy-cloudflare.bat` → `tools/deploy-cloudflare.mjs`（登录检查 → 项目名 wcraft→wl-c
> 依次尝试、自动放弃随机后缀域名 → 部署 main 生产分支），现役地址 **https://wcraft.pages.dev**
> （旧 wl-c.pages.dev 保留作备用；脚本按输出文本而非退出码判定 wrangler 成败，规避 Windows 上
> 成功后偶发的 libuv 断言崩溃误判）。

## 一、架构总览

```
index.html（按序加载 17 个脚本，全局词法作用域共享，非 ES Module）
  │
  ├─ 数据层   config / noise（种子+3D噪声）/ blocks / textures / worldgen（洞穴/矿石/菌灯）/ save（v2）
  ├─ 渲染层   light（天光/块光 BFS）/ mesher（网格+光照烘焙）/ sky / particles / creatures
  ├─ 玩法层   drops（掉落实体）/ health（血量/死亡）
  ├─ 交互层   player（物理+输入+射线+生存钩子）/ ui（HUD+模式菜单）/ audio
  └─ 编排层   main（装配 + 帧循环 + 锁定状态机 + 尺寸自愈 + ?debug 状态条）
```

**加载顺序契约**（`index.html` 中顺序不可随意调整，全局绑定按此解析）：

| 顺序 | 模块 | 行数 | 职责 | 关键导出（全局） |
| --- | --- | --- | --- | --- |
| 1 | config.js | 9 | 常量、触屏检测、存档键、模式 | `W/H/D` `IS_TOUCH` `SAVE_KEY` `gameMode` |
| 2 | noise.js | 37 | 种子（v2档/URL/迁移）+2D/3D 值噪声 | `rnd2` `vnoise` `fbm` `vnoise3` `hashStr` `WORLD_SEED` `mulberry` |
| 3 | blocks.js | 42 | 方块注册表（28 种，含 lum 自发光） | `B` `BLOCKS` `HOTBAR` `inv` |
| 4 | textures.js | 303 | Canvas 程序化贴图图集（30 槽） | `atlas` `atlasTex` |
| 5 | worldgen.js | 225 | 地形/结构/洞穴/矿石/菌灯生成 | `world` `getB` `setRaw` `groundH` `teaH` `glowSpots` |
| 6 | light.js | 105 | 天光+块光两级 BFS（0-15）与局部重光 | `skyL` `blkL` `computeAllLight` `onWorldEdit` `lightLevelAt` |
| 7 | save.js | 81 | v2 存档：种子/模式/diff/背包/血量/音乐；v1 迁移；死亡落盘语义 | `saveGame` `loadGame` `recordEdit` `resetWorld` `newWorldWithSeed` |
| 8 | mesher.js | 165 | 区块网格（AO+光照烘焙+bl 属性+分帧重建） | `buildChunk` `buildAllChunks` `setLive` `processDirty` `matSolid/Cut/Trans` `uSkyF` |
| 9 | sky.js | 232 | 昼夜穹顶 shader/微笑/云/光尘/花瓣/发光（粒子不穿层） | `initSky` `updateSky` `dayTime` |
| 10 | particles.js | 40 | 破坏碎屑粒子池 | `initParticles` `spawnBurst` `updateParts` |
| 11 | drops.js | 78 | 掉落物实体：重力/弹跳/邻格磁吸+视线判定/拾取 | `drops` `spawnDrop` `updateDrops` |
| 12 | creatures.js | 130 | 白兔+蝴蝶（随种子分布） | `initCreatures` `updateCreatures` |
| 13 | audio.js | 49 | WebAudio 八音盒/音效合成 | `initAudio` `musicTick` `sfxBlip` `sfxCrunch` `musicOn` |
| 14 | health.js | 59 | 血量/受伤红闪/死亡重生/脱战回血 | `hp` `damage` `die` `respawn` `updateHealth` `updateHearts` |
| 15 | ui.js | 122 | 快捷栏+计数角标/模式切换/种子菜单/toast | `initUI` `selectSlot` `setGameMode` `updateInvUI` `toast` |
| 16 | player.js | 446 | 物理/键鼠/触屏/射线/生存钩子/手持 | `initPlayer` `stepPlayer` `doBreak` `doPlace` `enterGame` `setFly` |
| 17 | main.js | 113 | 装配+帧循环+死亡遮罩+尺寸自愈+debug | `scene` `camera` `renderer` `applyLockState` |

`android/` 为 Capacitor 7 生成的原生壳（`webDir` 指向 `web/`，已定制部分见下）。
- **Manifest**：锁横屏；`MainActivity` 沉浸全屏（隐藏状态栏/导航栏 + 打孔屏
  `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES`），修复 Android 15 edge-to-edge 下
  21:9 设备状态栏色带与画面割裂的问题（2026-08-19 实机验证）
- **res 最小集**：6 密度 `mipmap/ic_launcher`、`drawable/splash.png`（全密度共用单档）、
  layout/values/xml 各 1-2 个（均有引用）；已删除自适应图标（anydpi-v26/round/foreground）、
  portrait/land 多档 splash、Cordova 遗留 config.xml；商店图标在 `android/app/playstore-icon.png`
- **App 显示名**：`Wonder Craft`（strings.xml；安装包文件名仍为 wonderland-craft.apk）
- 版本基线 **v0.1.0**（2026-08-19 重置）：index.html 资源版本号统一 `?v=0.1.0`、
  package.json 0.1.0、build.gradle versionCode 1 / versionName "0.1.0"
部署脚本：`deploy-netlify.bat`（netlify-cli 直发 `web/`）与 `deploy-cloudflare.bat`（调用
`tools/deploy-cloudflare.mjs`：wrangler 登录检查 → `pages project list` 解析已有项目（清洗 │ 表格边框）
→ 项目名 wcraft→wl-c 依次尝试、创建时按输出文本判定成败（规避 Windows 上 wrangler 成功后偶发
libuv 断言崩溃导致退出码非 0 的误判）并剔除随机后缀域名 → 以 `--branch=main` 部署到生产分支，
解决非 git 环境下首次交互式建项目默认生产分支不为 main、导致 dashboard 显示
"No production deployment yet" 的坑）。现役 **https://wcraft.pages.dev**，备用 wl-c.pages.dev。

## 二、核心数据流

**世界 → 渲染**
- `world`：`Uint8Array(W×H×D)`（160×64×160），索引 `x + z*W + y*W*D`
- 生成期（worldgen.js 载入即执行 `genWorld()`）：地形列 → **carveCaves（双频带 3D 噪声交叠隧道）→ seedOres（噪声团块按深度分三种矿）→ lampCaves（洞底萤火菌灯+柔光）** → 4×4 结构格 → 浮空岛 → 小物点缀，全部 `setRaw` 直写 + `glowSpots` 收集
- 运行期修改走 `setLive()`：写体素 → `recordEdit`（存档 diff）→ **`onWorldEdit`（半径 16 格全高局部重光 + 标脏 3×3 区块）** → 分帧 `processDirty()`（每帧 3 个、按距玩家排序）
- `buildChunk()`：每区块最多 3 个 Mesh；顶点色 = 面光照 × AO × 天光（洞底 0.08 保底），块光写入自定义 `bl` 顶点属性
- **光照（light.js）**：`skyL`/`blkL` 两级 Uint8 网格；天光列扫描 + BFS 侧向衰减，块光从 lum 方块 BFS；`onBeforeCompile` 注入三材质着色器：`color *= max(uSkyF, bl×暖色)`——夜晚天光降到 0.13，火把/萤石光不受影响（实测夜景平均亮度 30/255）
- **掉落（drops.js）**：生存挖掘 → `spawnDrop`（复用手持方块几何，上限 80）→ 重力/弹跳 → 距离 <2.2 磁吸 → <1.1 拾取入 `inv` + toast；创造模式即挖即得

**输入 → 物理帧**
- `main.frame()` 固定步进：`stepPlayer(dt)` 内按 9ms 子步积分（防低速帧穿墙）
- 移动：键盘向量 / 触屏摇杆模拟量归一 → 期望速度 → 地面 12 / 空中 3.2 指数趋近
- 碰撞：逐轴 AABB 扫描 `collideBox` + 最多 4 次推箱修正；y 轴下压置 `onGround`
- 飞行：垂直速率按住 16 / 松开 5 的非对称趋近（快起缓停），自动跳仅非飞行时生效；**生存模式 `setFly` 强制关闭**
- **生存钩子**：下落累计 `fallDist`，落地 >3.5 格结算伤害（round(fall-3)）；y<-10 判死；挖掘连发间隔创造 230ms / 生存 520ms

**交互（射线）**
- `raycast()`：Amanatides-Woo DDA，最大 6.5 格，返回命中格+进入面法线（Node 已对 5 种俯角做命中断言）
- 破坏：置 0 + 上方十字面片连带清除 + 碎屑粒子 + 音效 + **生存掉落**；放置：命中面偏移（或替换十字格）+ 自身 AABB 相交拒绝 + 十字需地面支撑 + **生存消耗库存（空则 toast 拒绝）**

**存档（v2）**
- `{seed, mode, e:diff, p:玩家, inv, hp, s, d, m:音乐开关}` → `localStorage["wc_save_v2"]`；noise.js 在脚本加载期即读种子（v2 > URL ?seed= 优先级相反：URL > v2 > v1 迁移(种子0) > 随机）
- **死亡落盘语义（B11 修复）**：saveGame 检测 `deathScreen`，死亡期间的任何保存（暂停/20s/pagehide）一律改写为「出生点 + hp20 + 不飞行」——死亡画面直接关页面，重进即在茶会满血醒来
- **v1 自动迁移**：旧档按种子 0 复原完全相同地形，字段沿用，下次保存升级为 v2
- 触发点：暂停、每 20s 有脏数据、`pagehide`/`visibilitychange`、手动按钮；**重置/换种子置 `resetting` 标志禁止 pagehide 回写**（A6 修复）
- 加载：`genWorld()` → `loadGame()`（回放 diff + 模式/背包/血量）→ `computeAllLight()` → `buildAllChunks()`

**昼夜**
- `dayTime ∈ [0,1)`，240s 一天；太阳仰角 → `uDay` 平滑因子，驱动：穹顶 shader 调色板混合、雾/背景色、三材质 tint、`uSkyF`（天光系数 0.13~1）、云色、微笑透明度、光尘/花瓣/发光强度

## 三、已知问题清单（复查实测/推断分级）

### A. 确认的逻辑缺陷（✅ A1-A8 全部修复）

| # | 问题 | 位置 | 影响 | 修复方式 | 状态 |
| --- | --- | --- | --- | --- | --- |
| A1 | `saveGame()` 的 try/catch **静默吞错**（超 localStorage ~5MB 配额时无任何提示） | save.js | 大量改建后进度丢失且无感知 | catch 中 `toast('💾 保存失败…')` 并返回布尔结果 | ✅ 已修复（v3） |
| A2 | 桌面 `requestPointerLock` 无失败反馈 | player.js `enterGame` | 浏览器拒绝锁定时点击无响应、无提示 | main.js 监听 `pointerlockerror` → toast 提示重试 | ✅ 已修复（v4） |
| A3 | 触屏笔记本（`IS_TOUCH=true` 且接鼠标）`mousemove` 被整体禁用（原守卫误用 `e.pointerType`，mousemove 事件上恒为 undefined） | player.js mousemove 守卫 | 混合设备无法用鼠标转视角 | 改为 `lastTouchEnd` 时间戳守卫：触摸结束后 600ms 内忽略合成 mousemove，真实鼠标不受影响 | ✅ 已修复（v3） |
| A4 | 高亮框对十字面片（玫瑰）绘制整格立方线框 | player.js `hlBox` | 视觉与实际占格不符（轻微） | 命中 cross 时线框缩至 0.62 格并下贴（y+0.31），普通方块保持整格 | ✅ 已修复（v3） |
| A5 | 数字键仅映射前 10 格，其余 12 格只能滚轮/点选 | player.js | 纯便利性 | Shift+数字 1-9 选第 11-19 格、Shift+0 选第 20 格，余 2 格滚轮/点选 | ✅ 已修复（v3） |
| A6 | **「重置世界/新种子」被 pagehide 自动保存覆盖**：`location.reload()` 触发 `pagehide → saveGame()` 把刚删除的旧进度原样写回，重置完全失效（自上线以来就存在，P0 存种子/模式后更显性） | save.js | 玩家永远无法重置世界或换种子 | `resetting` 标志：resetWorld/newWorldWithSeed 置位后 `saveGame` 直接跳过；Node 断言覆盖 | ✅ 已修复（v5，2026-08-19） |
| A7 | **全屏/横竖屏切换可能吞掉 resize 事件**，渲染器卡在旧尺寸（IAB 实测复现：画布 800×480 而视口 1280×720） | main.js | 部分机型进入游戏后画面只占屏幕一角 | 帧循环自愈：每帧比对 `innerWidth/innerHeight` 变化即重设相机与画布 | ✅ 已修复（v7，2026-08-19） |
| A8 | **`drawIcon` 十字面片分支误用方块 id 当贴图槽索引**：`const s=(id%16)*16, sy=((id/16)|0)*16` 应按 `bd.s` 取槽。ROSER(id8→槽8)/ROSEW(id9→槽9) 碰巧一致，**萤火菌灯 TORCH(id27, 槽29) 的快捷栏图标显示成星光钻矿（槽27）贴图**；手持/掉落物几何走 `bd.s` 不受影响 | ui.js `drawIcon` | 快捷栏第 23 格图标与实物不符，生存模式选错方块 | cross 分支改用 `(bd.s%16)*16 / ((bd.s/16)|0)*16`（一行改动） | ✅ 已修复（ui.js v4，2026-08-19 三轮） |

### B. 设计限制（记录在案，非 bug）

| # | 项 | 说明 |
| --- | --- | --- |
| B1 | 世界边界是"隐形石墙" | `getB` 对 xz 越界返回 STONE（防坠落+防边界面渲染），玩家撞墙无提示 |
| ~~B2~~ | ~~固定世界种子~~ | ✅ P0 已实现种子系统：v2 存档携带种子、标题可输入文字/数字种子开新世界、v1 旧档迁移为种子 0（地形逐字节一致，Node 断言） |
| B3 | 后台标签 `dayTime` 冻结 | rAF 暂停导致时间不连续（体验可接受，切后台时会存档） |
| B4 | 生物无碰撞不可交互 | 兔/蝶纯装饰，不阻挡玩家、不可攻击/喂食 |
| B5 | 十字面片不可穿透放置 | 射线停在玫瑰格，无法"隔花放块"（MC 允许替换高草） |
| B6 | 半透明（魔药）方块 depthWrite=true | 相邻玻璃面偶发排序闪烁，孤立方块无影响 |
| B7 | localStorage 单键 5MB 上限 | edits 无压缩存储；10 万级改动将逼近上限 |
| B8 | 音频无空间化/无方块材质脚步声 | 全局音量，远近同响 |
| B9 | 洞穴无自然地表入口 | 挖掘仅保留在地表以下 ≥4 格，玩家需自行下挖（挖矿动机设计） |
| B10 | 光照局部重光半径固定 16 格 | 光源紧贴世界边缘时框外一侧无既有光可续传（边缘 16 格内无光源生成，实际不可见） |
| B11 | ~~**死亡即存档，读档语义不符直觉**~~（save.js/health.js） | ✅ 已修复（save.js v6，2026-08-19 三轮）：saveGame 检测 `deathScreen`，死亡期间落盘改写为「出生点 + hp=20 + 清飞行」，死亡画面关页面重进即在茶会满血醒来（gameplay 断言覆盖） |
| B12 | ~~掉落物磁吸无视线判定~~（drops.js） | ✅ 已修复（drops.js v2）：**邻格（Chebyshev≤1）直吸**（避免射线被脚下地面误挡），远处 2.2 格内需 raycast 视线可达才磁吸/拾取；拆墙后恢复吸附（gameplay [F] 断言覆盖） |
| B13 | 多标签页并发写同一 `wc_save_v2`（save.js） | last-write-wins 互相覆盖无提示，无 `storage` 事件协调；低频场景记录在案 |
| B14 | ~~`musicOn` 不持久化~~（audio.js/save.js） | ✅ 已修复（save.js v6）：存档新增 `m` 字段；M 键切换即置 saveDirty，读档回放（gameplay 断言覆盖） |
| ~~B15~~ | ~~`raycast` 整数起点 NaN 边界~~ | **误报撤销**（2026-08-19 三轮复核）：原代码已有 `dx===Infinity?Infinity:…` 守卫，方向分量为 0 时 `t` 直接置 `Infinity`，不会产生 NaN |
| B16 | H 键/🏠 按钮在生存模式是无成本逃命传送（player.js `goHome`） | 任何危险中一键回茶会；当前无敌对生物暂无实际影响，P1 红心士兵上线后需加冷却或战斗中禁用 |
| B17 | ~~花瓣/光尘粒子无视地形~~（sky.js） | ✅ 已修复（sky.js v4）：光尘初始高度跟随地表并逐格抬出树冠/屋檐；花瓣落在实体方块上立即重新扬起，不再穿层落入洞穴 |

### C. 技术债与工程风险

| # | 项 | 说明 | 建议 |
| --- | --- | --- | --- |
| C1 | **资源版本号需手动 bump** | 现行 `?v=0.1.0` 语义化：全量统一、随发版整体替换（当前基线 v0.1.0，2026-08-19 重置）。改代码忘 bump 仍会缓存混载（曾引发"glowSpots 未定义"假故障排查 30 分钟） | 构建脚本自动注入版本（读 package.json）；或迁移 Vite 后由打包接管文件名 |
| C2 | 脚本顺序即依赖契约 | 17 个 `<script>` 靠加载顺序共享全局，重排即炸 | 迁移 ES Modules（Capacitor 支持良好；`file://` 直开将失效，需权衡） |
| C3 | `updateSky` 每帧 CPU 遍历 340 光尘 + 110 花瓣 | 手机端两处 Float32Array 全量更新 | 位置计算下沉 vertex shader（uTime 驱动），CPU 归零 |
| C4 | `updateHandBlock` 每次选格重建几何 | 26 格轮换产生 GC 压力（微小；drops.js 已按 id 缓存可参照） | 按 id 缓存 26 份 geometry |
| C5 | 世界生成在主线程同步执行 | 首屏阻塞：地形+洞穴+矿石 ~400ms + 全图光照 ~25ms + 网格 ~220ms（Node 实测），桌面可感、手机更甚 | 迁 Web Worker 或分帧生成 |
| ~~C6~~ | ~~无任何测试~~ | ✅ 已建立 Node 无头回归（2026-08-19）：`tools/node-harness.mjs`（38 项：种子确定性/洞穴矿石/光照传播/局部重光/网格属性/存档往返）+ `tools/node-gameplay-test.mjs`（28 项：挖掘→掉落→拾取→库存、放置消耗、跌落伤害、死亡重生（含 B11 死亡存档/B14 字段断言）、回血、掉落物理、B12 隔墙视线）。vm 沙箱加载真实脚本，无 DOM 依赖桩 | 持续为新系统补断言 |
| C7 | ~~`onerror` 仅显示首错~~ | ~~第二个级联错误被覆盖~~ | ✅ 已修复（main.js v4）：`errLog` 数组保留最近 3 条，以「｜」拼接展示 |
| C8 | `onBeforeCompile` 字符串注入依赖 three 内部 chunk 名 | 升级 three 大版本时 `#include <color_fragment>` 等锚点可能改名导致光照注入静默失效（画面退回无昼夜衰减） | 升级 three 时跑夜景截图对比；或抽 ShaderMaterial 自管 |
| C9 | 调试观测依赖 `?debug=1` DOM 状态条 | 自动化测试曾因浏览器合成输入的 movement 坐标不可控消耗大量排查（本次实证 guest 全屏后布局 800×480 卡死） | 保留 debug 条；自动化优先走 Node 无头回归 |
| C10 | **文档与代码漂移**（二轮复查实证） | README 曾写"22 种方块"（实际 HOTBAR 26 格）、结构图列出已不存在的 `启动手机访问.bat`；功能迭代后文档易滞后 | 已随二轮复查勘误；后续改代码时同步更新 README/docs（列入 PR 自查项） |

## 四、性能画像

- **渲染**：桌面 60fps 稳定（P0 光照上线后实测不变）；移动端 2K 屏 DPR 钳制 1.5
- **P0 增量成本**（Node 实测，2026-08-19 二轮复核）：全图光照 23ms（一次性）、区块网格 199ms（一次性，洞穴面数 +~15%）、单次编辑局部重光 + 3×3 区块分帧重建（每帧 3 个，无感）
- **瓶颈预判**（按概率排序）：低端移动端填充率（全屏 shader 穹顶+雾+花瓣）→ 光尘 CPU 更新 → 洞穴场景网格量（必要时开 greedy meshing）
- **内存**：体素 1.6MB + 光照网格 3.2MB + 网格几何（估 40-80MB）+ 贴图 256KB，无泄漏路径（重建均 dispose；掉落物材质 kill 时 dispose）

## 五、与文档相关的代码导航

- 想加新方块：`blocks.js`（注册，可带 `lum` 自发光）→ `textures.js`（画贴图，注意图集槽位 16 个/行）→ `worldgen.js`（如果要自然生成）→ `HOTBAR`（入栏，生存模式自动获得计数角标）
- 想加发光方块：`blocks.js` 的 `lum` 字段即可（BFS 传播 + mesher 烘焙 + 夜景照明全自动）；`sky.js` 柔光精灵需在 worldgen 手动 `glowSpots.push`
- 想改手感：`player.js` 顶部常量（HW/PH/EYE）与 `stepPhysics` 内速度曲线；生存数值（跌落阈值/挖掘间隔）同文件内搜 `survival`
- 想改世界：`worldgen.js` 的 `genWorld` 结构格分发（CELL=40）；洞穴形态在 `carveCaves`（阈值 .085）、矿脉丰度在 `seedOres`（阈值 .805-.845）
- 想加新实体：参照 `creatures.js`（init + update 两段式，无碰撞版）或 `drops.js`（带物理与拾取）
- 想跑回归：`node tools/node-harness.mjs`（世界/光照/存档 38 项）+ `node tools/node-gameplay-test.mjs`（玩法闭环 28 项）
- 想装机调试：`run-android.bat`（构建 APK → 装到已连 USB 的手机 → 启动并流式输出 logcat）
- 想部署：`deploy-cloudflare.bat`（Cloudflare Pages，wcraft.pages.dev，大陆直连友好）或 `deploy-netlify.bat`（wl-c.netlify.app）；改完 `web/` 后重跑即可，APK 需另行 `npx cap sync android` 重新打包
- 想发版：全局替换 index.html 的 `?v=` 为新版本号 + package.json `version` + android/app/build.gradle `versionName/versionCode`，三处保持一致（当前基线 v0.1.0）
- 想调试：URL 加 `?debug=1` 显示实时状态条（pos/yaw/pitch/命中/库存/血量/掉落数）
