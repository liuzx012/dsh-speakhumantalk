# 安装 dsh-speakhumantalk

两种装法，装备用。`dsh plugin add` 会自己把这个包登记进 `dsh.profile.bundles`（因为包里带 `dsh.bundle.patch`），不用手改配置。

## 一、从 tgz 装（推荐，给其他 DSH 用）

```powershell
dsh plugin --profile web add "file:C:/path/dsh-speakhumantalk-1.0.0.tgz"
```

装完检查组合结果，能看到 `# == dsh-speakhumantalk`：

```powershell
dsh --profile web --dump-config | Select-String speakhumantalk
```

重启该 profile 生效。

## 二、从解压目录装（开发态，改完直接生效）

```powershell
dsh plugin --profile web add "link:C:/path/dsh-speakhumantalk"
```

同样会自动进 bundles。目录留着，改代码重启就生效，不需要重新打包。

## 三、手工装（profile 被应用独占时）

desktop profile 被 Electron 独占，`dsh plugin` 会拒绝。手工三步：

1. 把整个 `dsh-speakhumantalk` 目录放到一个稳定位置，别放临时目录。
2. profile 的 `package.json` 里加依赖与 bundle：
   ```json
   "dependencies": { "dsh-speakhumantalk": "link:C:/path/dsh-speakhumantalk" },
   "dsh": { "profile": { "bundles": ["...", "dsh-speakhumantalk"] } }
   ```
3. 建链接（Windows 用 junction，不必管理员）：
   ```powershell
   New-Item -ItemType Junction -Path "$profile\node_modules\dsh-speakhumantalk" -Target "C:\path\dsh-speakhumantalk"
   ```

重启。

## 验证

重启后新开会话，问「你现在有什么工具」，应该能看到 `deslop_scan` / `deslop_rewrite` / `deslop_mode` / `deslop_voice`；`$DSH_HOME/skills/` 下会多出 `deslop` 与 `deslop-chat` 两个目录。

不启动应用的静态检查：

```powershell
node test/run.mjs
node test/plugin-smoke.mjs
node test/integration-assemble.mjs
```

三条都过，说明引擎、插件面与真实 SystemPrompt 组装都没问题。

## 关闭与卸载

运行期关掉：`deslop_mode(mode=off)`，或让模型调这个工具。恢复到默认：`deslop_mode(mode=balanced)`。

彻底卸载：从 `dsh.profile.bundles` 删掉 `dsh-speakhumantalk`，删 `node_modules` 里的链接，删 `$DSH_HOME/skills/deslop*` 与 `$DSH_HOME/deslop/`。重启。
