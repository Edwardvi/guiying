# 调研发现

## Windows 启动诊断增强 (2026-07-25)

### Windows GUI 静默崩溃问题
- **核心问题**：`#![windows_subsystem = "windows"]` 隐藏控制台，任何 Rust panic 对用户完全不可见
- **解决**：在 main() 最开始安装 panic hook，通过 MessageBoxW (user32.dll) 显示可见错误弹窗
- **日志方案**：启动进度写入 `%LOCALAPPDATA%\桂英\guiying-startup.log`，即使无弹窗也能随后排查

### pi 子进程 stderr 丢失
- **问题**：`Stdio::inherit()` 在 Windows GUI 应用中无处可去
- **解决**：Windows 上 pi stderr 重定向到 `%LOCALAPPDATA%\桂英\pi-stderr.log`

### Tauri 2 NSIS WebView2 配置
- **问题**：task_plan 标记 `installWebView2: true` 已添加，但实际 tauri.conf.json 中无任何 `bundle.windows` 配置
- **原因**：Tauri 2 中 WebView2 自动内嵌，无需 `installWebView2`（这是 Tauri 1 的配置）
- **修复**：添加 `bundle.windows.nsis.minimumWebview2Version: "110.0.0.0"` 确保最低版本检查

### Tauri 2 WebView2 自动引导
- **发现**：Tauri 2 通过 `webview2-com` crate 自动嵌入 WebView2 bootstrapper
- **NSIS 安装器**会自动下载安装 WebView2（如缺失）
- **但**若用户直接运行 exe 而不走安装器，WebView2 不会自动安装

## Windows 静默启动失败

### 发现
- **要点**：Win64 构建的安装包安装后，双击桂英.exe 无任何反应，也无错误弹窗
- **可能原因**：
  1. WebView2 运行时缺失（Win10 以下系统）
  2. Visual C++ Redistributable 缺失
  3. 窗口创建失败（`open_workspace_window` 返回 error 后仅 log，无弹窗）
  4. pi.exe 引擎启动失败（已在代码中添加弹窗处理）
- **已修复**：在 pi 引擎启动失败、窗口创建失败、broker 连接失败三个路径都加上了弹窗

### 踩坑记录
- **问题**：`MessageDialogKind::Error` 编译失败
- **原因**：我写了 `tauri::ipc::MessageDialogKind`，正确是 `tauri_plugin_dialog::MessageDialogKind`（已在第 33 行导入）
- **解决**：改为 `MessageDialogKind`

## CI 构建踩坑

### Python 字符串转义
- **问题**：YAML 中出现 `\${{ }}` 导致 GitHub Actions 无法解析
- **原因**：Python 的 `"""..."""` 字符串中 `\$` 被保留为字面量
- **解决**：用 `.replace(r'\${{', '${{')` 修复

### PowerShell vs Bash
- **问题**：Windows runner 上 bash 语法的 `if [ ... ]` 在 PowerShell 中报错
- **解决**：在 CI step 中添加 `shell: bash`

### tauri-action 发布冲突
- **问题**：`tauri-apps/tauri-action` 尝试上传同名 Release asset 时报 `already_exists`
- **解决**：去掉 tauri-action，改用 `actions/upload-artifact`

## NSIS 安装包大小
- macOS artifact 93MB（含 .app + .dmg + .tar.gz 三份文件）
- Windows artifact 45MB（仅 NSIS 安装包，LZMA 压缩）
- 实际安装后 Windows 占用应该接近 macOS（含 pi.exe）

## 模型精简
- opencode-go 提供 16 个模型
- 通过 `enabledModels` 限制为 deepseek-v4-flash / deepseek-v4-pro
- `models-store.json` 也同步裁剪（防止 pi 刷新时看到其他模型）

## 响应式降级限制
- 当前只有一个 900px 断点
- 缺少对大屏（1440p+）的适配
- 页面文字用 vw 单位，在极端尺寸下可能溢出
