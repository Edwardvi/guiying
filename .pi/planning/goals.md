# 桂英 项目目标

## 核心目标
基于 shixin-guo/picot (Tauri 2) 构建一个名为"桂英"的跨平台桌面 AI 助手，专为广告营销从业者定制，开箱即用。

## 成功标准
- [x] macOS ARM64 构建通过并产出 DMG
- [x] Windows x64 构建通过并产出 NSIS 安装包
- [x] 预置 4 个插件（pi-web-access、pi-mcp-adapter、pi-subagents、context-mode）
- [x] 预置 18 个 skills
- [x] 模型列表精简到 2 个（deepseek-v4-flash/pro）
- [x] UI 只显示 "go" 供应商
- [x] 首次启动引导用户粘贴 API Key
- [x] CI 自动化构建全平台
- [ ] Windows 上双击后正常启动（当前无反应）
- [ ] Linux ARM64 构建通过

## 非目标
- 不预置 API Key（用户自己配置）
- 不需要代码签名（正式发布前暂不考虑）
- 不需要自动更新（updater 已禁用）

## 约束与边界
- 技术栈：Tauri 2.x (Rust) + Pi 0.80.10
- 前端：原生 HTML/JS（public/ 目录）
- CI：GitHub Actions，只构建 tag 和 main 分支
- 授权方式：OpenCode Go (opencode-go)
