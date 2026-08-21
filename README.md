# Wonderland Craft · 爱丽丝的方块仙境

一个《爱丽丝梦游仙境》主题的类 Minecraft 沙盒：巨型蘑菇林、玫瑰花园、红白棋广场、
疯狂茶会、浮空黄金城堡、会逃跑的白兔、花间蝴蝶，以及天上若隐若现的柴郡猫微笑。
贴图与音效全部由代码程序化生成，无任何外部资源加载。

> 纯前端体素沙盒 · 零外部资源 · 离线可玩
>
> - 在线游玩：**https://wcraft.pages.dev**（Cloudflare，大陆直连友好）
>   - 备用 https://wl-c.netlify.app
> - Android apk： 查看 [releases](https://github.com/Sanotsu/wonderland-craft/releases)（桌面显示名 **Wonder Craft**，锁横屏，完全离线）

## 当前功能（v0.1.0）

- **两种模式**：创造（飞行、方块无限）/ 生存（血量、跌落伤害、方块需挖掘获得、死亡茶会重生）
- **世界生成**：文字/数字种子、隧道洞穴、三种分层矿石、洞窟萤火菌灯、6 类主题结构 + 浮空岛
- **体素光照**：天光/块光 BFS 传播，昼夜循环下夜晚真实衰减——火把与发光方块照亮四周
- **物品掉落**：挖掘掉落实体（重力/弹跳/磁吸拾取入快捷栏）
- **28 种方块**：快捷栏 26 格直选（滚轮/数字键/点选），生存模式带数量角标
- **自动存档**：localStorage（种子/模式/改动/背包/血量/昼夜/音乐开关），支持旧档迁移
- **氛围**：日月星空、天顶极光、粉彩彩虹拱、糖果色云、飘落玫瑰花瓣、WebAudio 八音盒
- **生物**：白兔（会逃跑）、蝴蝶（花间飞舞，随种子分布）

## 操作

| 桌面                                   | 功能                                      |
| -------------------------------------- | ----------------------------------------- |
| WASD / 空格 / Shift                    | 移动 / 跳跃 / 疾行（飞行时：上升 / 下降） |
| 左键 / 右键 / 中键                     | 破坏 / 放置 / 取色                        |
| 滚轮 / 数字键（Shift+数字选 11-20 格） | 选择方块                                  |
| F / G / H / P / M                      | 飞行 / 创造⇄生存 / 回茶会 / 截图 / 音乐   |
| ESC                                    | 菜单（含保存/重置世界/换种子开新世界）    |

| 触屏        | 功能                                           |
| ----------- | ---------------------------------------------- |
| 左侧滑动    | 虚拟摇杆移动（推满疾行，自动跳台阶）           |
| 右侧滑动    | 转视角                                         |
| 轻点 / 长按 | 放置 / 破坏（震动反馈）                        |
| ⬆ ⬇ ⛏ 🧱 🕊 | 跳跃 / 下降 / 破坏 / 放置 / 飞行按钮组（右下） |
| 🏠 ⏸        | 回茶会 / 暂停（右上）                          |

移动端为横屏设计：APK 已锁定横屏并沉浸全屏；手机浏览器进入游戏时自动全屏并尝试锁定横屏
（iOS 不支持时竖屏显示"请旋转手机"遮罩）。

## 本地运行与开发

```
# 本地预览（任一静态服务器指向 web/）
cd web && python -m http.server 8138
# → http://localhost:8138/

# 无头回归测试（66 项断言：世界/光照/存档 38 + 玩法闭环 28）
node tools/node-harness.mjs
node tools/node-gameplay-test.mjs

# 调试：URL 加 ?debug=1 显示实时状态条；?seed=xxx 指定种子；?touch=1 强制触屏模式
```

## 构建与发布

```
# Android APK（改 web/ 后）
npx cap sync android
cd android && .\gradlew.bat assembleDebug
copy app\build\outputs\apk\debug\app-debug.apk ..\wonderland-craft.apk

# 真机一条龙（构建+安装+logcat 日志，需 USB 连接并 adb 可用）
run-android.bat

# 正式签名 APK（首次：把 jks 路径与口令填入 android/key.properties，该文件不入库）
release-android.bat       # → wonderland-craft-release-<版本>.apk（构建+验签+SHA256）

# 网页部署（以下命名已存在，如需部署需新建其他名称和修改脚本对应内容）
deploy-cloudflare.bat   # Cloudflare Pages → wcraft.pages.dev（推荐）
deploy-netlify.bat      # Netlify → wl-c.netlify.app
```

**发版检查单**：`web/index.html` 全部 `?v=`（当前 0.1.0）、`package.json` version、
`android/app/build.gradle` versionCode/versionName 三处同步 bump；部署后浏览器验证
中文显示与资源版本号。**签名注意**：正式版必须始终使用同一 keystore（密钥/口令遗失
= 无法再发同签名更新），jks 与 key.properties 均已被 .gitignore 排除。

## 项目结构

```
wonderland-craft/
├── web/                  游戏本体（纯静态，三端共用）
│   ├── index.html        17 个脚本按序加载（全局词法作用域，顺序即依赖契约）
│   ├── css/style.css     HUD/标题/触屏自适应（CSS 变量按视口缩放）
│   ├── js/               17 个模块：config→noise→blocks→textures→worldgen→
│   │                     light→save→mesher→sky→particles→drops→creatures→
│   │                     audio→health→ui→player→main（加载顺序不可乱）
│   └── lib/three.min.js  唯一第三方库（本地内置，无 CDN）
├── android/              Capacitor 7 壳（已定制：沉浸全屏/横屏锁/res 最小化）
├── docs/                 CODE_ANALYSIS.md（架构与问题清单）· TODO.md（路线图）
├── tools/                deploy-cloudflare.mjs · node-harness.mjs · node-gameplay-test.mjs
├── wonderland-craft.apk  当前 debug 构建的安卓安装包
├── wonderland-craft-release-0.1.0.apk 正式签名发布包
├── deploy-cloudflare.bat / deploy-netlify.bat / run-android.bat / release-android.bat
├── capacitor.config.json / package.json / netlify.toml
```

## 已知限制与技术债

> 开发文档：
>
> - [代码分析报告](docs/CODE_ANALYSIS.md)
> - [玩法路线图](docs/TODO.md)

已知限制与技术债摘自 [代码分析报告](docs/CODE_ANALYSIS.md)（完整分级清单见该文档）：

- 世界固定 160×64×160 单世界，无无限地形；边界为隐形墙
- 生物无碰撞不可交互；无背包/合成/工具/敌对生物（P1 路线图见 TODO.md）
- localStorage 单键 5MB 上限，大量改建后可能存档失败（有 toast 提示）
- 资源版本号 `?v=` 手动维护；17 脚本加载顺序为契约，不可重排
- 世界生成在主线程（首屏约 0.6s），暂未迁 Web Worker
