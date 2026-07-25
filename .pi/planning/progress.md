# 工作进度日志

## 会话 2026-07-25 10:30 — Windows 启动诊断增强

### 完成事项
- [x] 添加 Windows panic hook：静默崩溃 → MessageBox 可见错误
- [x] 添加 Windows 启动日志文件：`%LOCALAPPDATA%\桂英\guiying-startup.log`
- [x] pi 子进程 stderr 重定向到日志文件（`pi-stderr.log`）
- [x] 修复 tauri.conf.json 缺少 `bundle.windows.nsis` 配置
- [x] 在关键启动路径插入 startup_log 调用（static_dir、PiManager、BrokerWs、pi spawn）

### 当前状态
等待 CI 构建新版本。新版本将具有：
- 任何 Rust panic → Windows 错误弹窗 + 日志文件
- 启动进度全程写入日志文件，可定位卡在哪一步
- pi.exe 崩溃时 stderr 可见于日志文件

### 诊断方法（给测试者）
1. 安装/运行新版本后如果仍无反应
2. 打开 `%LOCALAPPDATA%\桂英\guiying-startup.log`
3. 检查最后一行日志，确定卡在哪个步骤
4. 如有 `pi-stderr.log`，查看 pi.exe 是否有错误输出

### 下一步
1. Push 到 GitHub，触发 CI 构建
2. 下载 Windows artifact 测试
3. 根据日志文件定位问题根因

### 关键文件
- `src-tauri/src/main.rs` — panic hook + startup_log 调用
- `src-tauri/src/pi_manager.rs` — pi stderr 重定向 + pi_stderr_log_path
- `src-tauri/tauri.conf.json` — bundle.windows.nsis 配置

### 验证结果
- 本地 macOS: cargo check 通过 ✅
- CI: 等待构建

## 会话 2026-07-24 — 项目初始化与初步构建

### 完成事项
- [x] Fork shixin-guo/picot 并改名"桂英"
- [x] 替换图标、更新品牌名
- [x] 创建 default-config（settings/models/auth/skills）
- [x] 精简模型列表、隐藏其他供应商
- [x] macOS 本地构建 DMG 成功
- [x] 推送到 GitHub、配置 CI

## 会话 2026-07-24 — CI 调试

### 完成事项
- [x] 调试 CI 构建（YAML 转义、PowerShell 兼容、Windows icon 格式、updater 签名）
- [x] macOS ARM64 + Intel、Linux x64 构建成功
- [x] Windows + Linux ARM64 失败

### 当前状态
Windows 构建失败：PowerShell 运行 bash 语法出错 + icon.ico 格式问题 + updater 密钥缺失

## 会话 2026-07-24 — CI 重写

### 完成事项
- [x] 重写 release.yml（去掉 tauri-action，改用直接构建 + artifact 上传）
- [x] 修复 YAML 表达式 `\$` 转义问题
- [x] 修复 Linux/Windows bundle 参数
- [x] Windows x64/ARM64 构建通过

### 当前状态
所有平台（除 Linux ARM64）构建成功 ✅
Windows 安装包 45MB，但用户反馈双击无反应

## 会话 2026-07-25 — 错误弹窗修复

### 完成事项
- [x] 添加 pi 引擎启动失败的错误弹窗
- [x] 添加窗口创建失败的错误弹窗
- [x] 修复 MessageDialogKind API 路径
- [x] 去除残留 Picot 品牌名
- [x] NSIS 配置 installWebView2: true
- [x] 创建 .pi/planning/ 持久化工作记忆文件

### 当前状态
等待 CI 构建结果验证 Windows 弹窗是否生效

### 下一步
1. 下载新构建的 Windows 版本测试
2. 如果还是无反应，根据弹窗内容判断问题类型
3. 如果是 WebView2 问题，确认自动安装逻辑是否生效
4. 如果弹窗也没出现，需要在更早的初始化阶段加错误捕获

### 关键文件
- `src-tauri/src/main.rs` — 三处错误弹窗逻辑
- `src-tauri/tauri.conf.json` — NSIS WebView2 配置
- `default-config/` — 配置文件
- `.github/workflows/release.yml` — CI 配置

### 验证结果
- 本地 macOS: 编译通过 ✅
- CI: 构建中...
