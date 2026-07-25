# 任务计划

## 总体目标
完成桂英 AI 助手的跨平台构建，修复 Windows 启动问题，确保开箱即用。

## 阶段 1：项目初始化 ✅
**状态**：`done`

### 任务
- [x] Fork shixin-guo/picot 仓库
- [x] 改名"桂英"，替换图标
- [x] 更新所有品牌名（Picot → 桂英）
- [x] 创建 default-config/（settings.json、models-store.json、auth.json、skills/）

## 阶段 2：自定义开发 ✅
**状态**：`done`

### 任务
- [x] 精简 model-store 到 2 个模型
- [x] UI 隐藏其他供应商，只显示 "go"
- [x] 引导用户粘贴 API Key 的文案
- [x] 首次启动自动复制 default-config 到 ~/.pi/agent/
- [x] 预装 4 个 npm 插件

### 关键决策
- **启用 WebView2 自动安装**：NSIS 安装器配置 `installWebView2: true`
- **不预置 API Key**：用户自己粘贴，降低安全风险
- **使用 enabledModels 过滤**：而不是修改 models-store.json，避免被刷新覆盖
- **移除 updater**：没有代码签名证书，生成 updater 产物会失败

## 阶段 3：CI 构建配置 ✅
**状态**：`done`

### 任务
- [x] 重写 release.yml，去掉 tauri-action
- [x] 改为直接 npx tauri build + actions/upload-artifact
- [x] Windows 使用 --bundles nsis
- [x] Linux 使用 --bundles deb,rpm（跳过 AppImage）
- [x] 所有步骤使用 shell: bash（Windows 兼容）

### 关键决策
- **去掉 tauri-action**：需要签名密钥才能发布 Release
- **上传 Artifacts**：替代 GitHub Release 发布方式
- **跳过 AppImage**：linuxdeploy 在 ARM64 上有 bug

### 踩坑记录
- **\$ 转义问题**：Python 字符串中 `\$` 被保留为反斜杠+美元符号，导致 CI 表达式 \${{ }} 解析失败
- **PowerShell bash 混用**：Windows runner 上 CI step 默认用 PowerShell，bash 语法的 if 语句报错。修复：加 `shell: bash`
- **tauri.conf.json "windows": []**：窗口由 Rust 代码通过 WebviewWindowBuilder 动态创建

## 阶段 4：Windows 启动问题修复 🔴
**状态**：`in_progress`

### 任务
- [ ] 排查 Windows 上双击无反应的根本原因
- [x] 添加 pi 引擎启动失败的错误弹窗
- [x] 添加窗口创建失败的错误弹窗
- [x] 配置 NSIS 安装器 WebView2 最低版本
- [x] 修复 MessageDialogKind API 路径错误（`tauri::ipc::MessageDialogKind` → `MessageDialogKind`）
- [x] 去除残留 "Picot" 品牌名
- [x] 添加 Windows panic hook（静默崩溃 → 可见 Message Box）
- [x] 添加 Windows 启动日志文件（%LOCALAPPDATA%\桂英\guiying-startup.log）
- [x] pi 子进程 stderr 重定向到日志文件（Windows 上 inherit 会丢失）
- [ ] 下载 CI 新构建版本到 Windows 验证
- [ ] 根据日志文件诊断残留问题

### 风险与阻塞
- 无法在本地（macOS）测试 Windows 构建，需要 CI 构建后下载到 Windows 验证
- DLL 加载失败（VC++ Redistributable 缺失）发生在 main() 之前，panic hook 无法捕获
- 可能的残留问题：
  1. VC++ Redistributable 缺失 → 进程完全无法启动
  2. pi.exe 本身崩溃 → 现在 stderr 写入日志文件可查
  3. WebView2 版本过低 → 已配置 minimumWebview2Version
  4. 路径中包含特殊字符（中文用户名/安装路径）→ 已有 strip_verbatim_prefix 和 space-free mirror
