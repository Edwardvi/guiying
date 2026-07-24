# 桂英 · GUIYING

> 桂英 · AI 营销创意助手 — 一句话把方案变成PPT。
>
> 面向广告/营销/策展从业者的桌面 AI 智能体，开箱即用。

桂英是基于 Picot 的桌面 AI 助手，专为广告营销场景定制。下载即用，开箱即需。

## 功能

- 🎯 **方案提报** — 一句话描述需求，自动生成完整的策展/营销方案
- 📄 **PPT 生成** — 从方案到 PPT 演示文稿，一气呵成
- 🧠 **营销方法论** — 内置 4alaodeng、4azhongdeng 等营销策略框架
- 🎨 **视觉设计** — 支持高保真原型、动画、信息图制作
- 🔌 **开箱即用** — 预装 AI 引擎和核心技能，粘贴 API Key 即可使用

## 下载

从 [GitHub Releases](https://github.com/Edwardvi/guiying/releases) 下载对应平台的安装包：

| 平台 | 安装包 |
|------|--------|
| macOS Apple Silicon | `桂英_*_aarch64.dmg` |
| macOS Intel | `桂英_*_x64.dmg` |
| Windows x64 | `桂英_*_x64-setup.exe` |
| Windows arm64 | `桂英_*_arm64-setup.exe` |
| Linux x64 | `桂英_*_amd64.deb` |
| Linux arm64 | `桂英_*_arm64.deb` |

## 安装

### macOS

1. 下载 `.dmg` 文件
2. 双击打开，将 **桂英.app** 拖入 Applications 文件夹
3. 首次打开如果提示"未验证开发者"，右键点击 → 打开

### Windows

1. 下载 `-setup.exe` 文件
2. 双击运行安装程序
3. 按照向导完成安装

### Linux

```bash
sudo dpkg -i 桂英_*_amd64.deb
```

## 首次使用

1. 打开桂英，选择一个项目文件夹
2. 点击左下角模型按钮 → Open Settings
3. 粘贴你的 API Key
4. 开始使用！

## 技术栈

- **桌面壳**: Tauri 2.x (Rust)
- **AI 引擎**: Pi 0.80.10
- **预置插件**: pi-web-access, pi-mcp-adapter, pi-subagents, context-mode
- **预置技能**: 18个精选 skill（营销、设计、策展、代码等）
