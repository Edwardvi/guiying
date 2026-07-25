# 桂英 项目总结

> 广告营销从业者的 AI 智能体 — 一句话把方案变成 PPT

基于 shixin-guo/picot (Tauri 2 跨平台) 的定制版。

---

## 项目位置

`/Users/f/Documents/picot-custom/`

## GitHub 仓库

`https://github.com/Edwardvi/guiying`
CI 构建: https://github.com/Edwardvi/guiying/actions
发布页: https://github.com/Edwardvi/guiying/releases

---

## 定制内容

### 品牌
- 应用名: **桂英**
- Bundle ID: `com.guiying.app`
- 图标: 来自 `/Users/f/Downloads/IMG_3685.JPG`

### 预置配置 (`default-config/`)
- `settings.json` — 默认模型 `deepseek-v4-flash`，仅保留 2 个模型，预装 4 个插件
- `models-store.json` — 仅 opencode-go 的 deepseek-v4-flash/pro
- `auth.json` — 空 Key（用户自己粘贴）
- `skills/` — 18 个精选 skill

### 预装 npm 插件
| 插件 | 版本 | 说明 |
|------|------|------|
| pi-web-access | 0.13.0 | 网页搜索/抓取/PDF/YouTube |
| pi-mcp-adapter | 2.11.0 | MCP 协议适配器 |
| pi-subagents | 0.35.1 | 子代理委派 |
| context-mode | 1.0.169 | 上下文压缩 |

### 预置 Skills
huashu-design, caveman, 4alaodeng, 4azhongdeng, 策展-framework, mao, nuwa, caveman-commit, caveman-compress, caveman-help, caveman-review, caveman-stats, cavecrew, grill-me, guizang-ppt-skill, web-access, html-ppt 等

### UI 修改
- 模型下拉只显示 opencode-go，改名为 "go"
- 设置面板隐藏其他供应商
- 首次打开时引导用户粘贴 API Key

---

## 修改过的核心文件

### Rust (`src-tauri/src/main.rs`)
- 添加了启动失败时的错误弹窗（pi 引擎失败、窗口创建失败）
- 修复了所有 "Picot" → "桂英" 品牌名
- 弹窗后 `std::process::exit(1)`

### CI (`.github/workflows/release.yml`)
- 重写为直接 `npx tauri build` + `actions/upload-artifact`
- 移除了需要签名密钥的 `tauri-action`
- Windows 使用 `--bundles nsis`，Linux 使用 `--bundles deb,rpm`
- 所有构建步骤使用 `shell: bash` 避免 PowerShell 不兼容

### Tauri 配置 (`src-tauri/tauri.conf.json`)
- `productName: "桂英"`, `version: "1.0.0"`
- `createUpdaterArtifacts: false`
- `windows: []` (窗口由 Rust 代码动态创建)
- NSIS 配置已添加 `installWebView2: true`

### 前端 UI (`public/`)
- `app.js` — 模型下拉过滤为只显示 opencode-go，供应商名改为 "go"
- `settings/editors.js` — 设置面板只显示 go 供应商
- `session/onboarding.js` — 引导文字改为中文
- `ui/message-renderer.js` — 欢迎文字改为中文

---

## 构建状态

### ✅ 构建成功的平台
- macOS ARM64 - DMG ✅
- macOS Intel (交叉编译) - DMG ✅
- Windows x64 - NSIS exe ✅
- Windows ARM64 - NSIS exe ✅
- Linux x64 - deb + rpm ✅

### ❌ Linux ARM64 - 因 linuxdeploy AppImage 工具失败，已加 `--bundles deb,rpm` 跳过

### 已知问题
- Windows 上双击后无反应（可能原因：WebView2 缺失、窗口创建失败）
- 最新版已添加错误弹窗 + WebView2 自动安装
- 构建需要 CI 跑约 20-30 分钟

---

## 本地构建环境

需要: bun, Rust, cargo, tauri-cli

```bash
cd ~/Documents/picot-custom
bash build.sh
```

## 触发 CI 构建

```bash
# 通过 GitHub API 触发（需设置 GITHUB_TOKEN 环境变量）
curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/Edwardvi/guiying/actions/workflows/319545254/dispatches" \
  -d '{"ref":"main"}'
```

## 更新前端文件后推送

```bash
cd ~/Documents/picot-custom
git add -A
git commit -m "change description"
git push
```

然后用 API 触发 CI（或在 GitHub 网页上手动触发）。

---

## 下一步待办

- [ ] 排查 Windows 上双击无反应的根本原因
- [ ] 去掉 `used import: TitleBarStyle` 警告
- [ ] 确认 Linux ARM64 构建通过
- [ ] 可以考虑购买代码签名证书（消除 SmartScreen 警告）
