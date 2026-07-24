# 桂英 — AI 编程助手

基于 Picot（Tauri）的定制版，内置 Pi 引擎和预置配置。

## 定制内容

- **应用名**: 桂英
- **默认模型**: DeepSeek V4 Flash / V4 Pro
- **预装插件**: pi-web-access, pi-mcp-adapter, pi-subagents, context-mode
- **预置 Skills**: 18 个精选 skill
- **API Key**: 内置测试 Key，开箱即用

## 构建

```bash
# 开发模式
bun run dev

# 发布构建
bash scripts/build-custom.sh

# 产物在:
#   macOS: src-tauri/target/release/bundle/dmg/
#   Windows: src-tauri/target/release/bundle/msi/
#   Linux: src-tauri/target/release/bundle/deb/
```

## 技术栈

- Tauri 2.x (Rust 原生壳)
- Pi 0.80.10 (AI 引擎)
- Bun (构建工具)
