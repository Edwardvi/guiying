# guiying

基于 [Orca](https://github.com/stablyai/orca) 定制的 Pi 编程 Agent 桌面 IDE。开箱即用，内置 20 个营销/创意方法论 skills。

## 与 Orca 原版的区别

| | Orca | guiying |
|---|---|---|
| 默认 Agent | Claude / 自动检测 | **仅 Pi**（其他全部隐藏） |
| 内置 Skills | 无 | **23 个中文营销方法论 skills** |
| AI 供应商 | 展示全部（Claude/Codex/Gemini 等） | **仅 OpenCodeGo** |
| 首次启动 | 显示 8 步引导向导 | **跳过引导，直接进工作区** |
| 自动化模板 | 4 个开发模板（repo 健康、发布准备等） | **3 个营销模板（策略PPT、出圈事件、品牌策展）** |
| Pi 安装 | 需要用户手动 `npm install -g pi` | **内置 Pi CLI + 扩展包，离线可用** |
| UI 品牌 | Orca | **guiying** |

## 下载

去 [Releases](https://github.com/Edwardvi/guiying/releases) 页面下载最新版本：

- **macOS Apple Silicon**: `guiying-macos-arm64.dmg`
- **macOS Intel**: `guiying-macos-x64.dmg`
- **Windows**: `guiying-windows-setup.exe`

## 使用方式

1. 安装并打开 guiying
2. 首次启动自动初始化 Pi 环境（秒级，完全离线）
3. 在工作区中选择 **Pi** agent
4. 或者使用内置的自动化模板：
   - **策略PPT** — 一键生成品牌策略PPT（4alaodeng + fxxk4a + 策展）
   - **出圈事件营销** — 设计刷屏级事件方案（4azhongdeng）
   - **品牌叙事策展** — 空间叙事体验设计（策展-framework）

## 内置 Skills（20个）

### 营销方法论
- **4alaodeng** — 营销策略与品牌定位（叶茂中/小马宋/史玉柱）
- **4azhongdeng** — 出圈事件与刷屏级活动营销（天与空/W）
- **fxxk4a** — 反广告·不投广告做品牌（胖东来/海底捞/Patagonia）

### 策展与叙事
- **策展** / **策展-framework** — 空间叙事与在地文化体验设计（原研哉/安藤忠雄/柳宗悦）

### 设计产出
- **design-deck** — 花叔 Design 专业设计工作流（HTML + PDF + 可编辑 PPTX）
- **editorial-deck** — 横向翻页网页 PPT（杂志风/瑞士风，WebGL 背景）
- **pro-presentation** — 全能 HTML 演示工具包（36 主题/15 模板/演讲者模式）

### AI 协作者
- **nuwa** — 女娲造人（人物思维 Skill 蒸馏）
- **mao** — 毛泽东方法论 AI 分析

### 效率工具
- **caveman** 系列（7个） — 超压缩通信/commit/代码审查
- **grill-me** — 压力测试会话
- **planning-with-files** — 跨会话上下文连续工作
- **web-access** — 网页搜索与内容抓取

### Pi 扩展包（4个）
- **pi-web-access** — 网页搜索、URL 抓取
- **pi-mcp-adapter** — MCP 协议集成
- **pi-subagents** — 子代理调度
- **context-mode** — 上下文管理（索引/搜索/统计）

## 开发

### 构建

```bash
pnpm install --frozen-lockfile
pnpm build:relay
pnpm build:electron-vite
pnpm exec electron-builder --mac  # macOS
pnpm exec electron-builder --win  # Windows
```

### 技术栈

- **Electron** + **React** + **TypeScript**
- **electron-vite** 构建
- **electron-builder** 打包
- Pi agent 运行在 Electron 内置的 Node.js 上（无需用户额外安装）

## License

MIT（继承自 Orca）
