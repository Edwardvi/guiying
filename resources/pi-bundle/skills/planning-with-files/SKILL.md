---
name: planning-with-files
description: 跨会话上下文连续工作——通过维护 task_plan.md / findings.md / progress.md / goals.md 四个持久化文件，让 AI 在长任务、多会话、上下文窗口重置后仍能连续工作。触发词：多步骤任务、长任务、跨会话、上下文管理、planning、任务规划、恢复进度、继续工作、5+ 工具调用、复杂项目。
---

# Planning with Files — 跨会话持久化工作记忆

> 基于 [OthmanAdi/planning-with-files](https://github.com/OthmanAdi/planning-with-files) 和 [Harness Engineering 教程](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-05-why-long-running-tasks-lose-continuity/)，适配 Pi Agent 扩展能力。
> 作者：[13啦](https://zhuanlan.zhihu.com/p/2059648027586045590)

## 问题

AI Agent 上下文窗口有限。长任务、多会话场景下，Agent 丢失：
- 之前做了什么
- 为什么做那些决策
- 当前卡在哪里
- 下一步该做什么

**解决方案**：把"工作记忆"写到磁盘上。四个 Markdown 文件 = 永不丢失的上下文。

## 四个核心文件

| 文件 | 用途 | 更新时机 |
|------|------|---------|
| `goals.md` | 项目目标、成功标准、非目标（scope） | 项目开始时创建，目标变化时更新 |
| `task_plan.md` | 阶段划分、任务清单、决策记录 | 规划时创建，完成/变更时更新 |
| `findings.md` | 调研发现、技术笔记、踩坑记录 | 发现新信息时随时追加 |
| `progress.md` | 每次会话的工作日志 | **每个会话结束时必须更新** |

### 文件位置

默认放在项目根目录。如果需要隔离，可放在 `.pi/planning/` 下。

## 何时使用

**触发条件**（满足任一即启动）：
- 任务需要 **5 个以上工具调用**
- 用户说"这是一个大任务"、"分阶段做"、"跨多个会话"
- 涉及多个文件/模块的改动
- 需要调研 + 实现 + 验证的完整流程
- 用户明确要求"做个计划"

**不需要的场景**：
- 单次简单问答
- 一个工具调用就能完成的事
- 纯信息查询

## 文件模板

### goals.md

```markdown
# 项目目标

## 核心目标
[1-2 句话：我们要达成什么，为什么重要]

## 成功标准
- [ ] 标准 1：具体、可验证
- [ ] 标准 2
- [ ] 标准 3

## 非目标（明确不做的事）
- 非目标 1
- 非目标 2

## 约束与边界
- 技术栈约束
- 时间/资源约束
- 兼容性要求

## 更新记录
- YYYY-MM-DD：初始创建
```

### task_plan.md

```markdown
# 任务计划

## 总体目标
[一句话描述]

## 阶段 1：[阶段名称] 🔄
**目标**：[本阶段要达成什么]
**状态**：`in_progress` | `pending` | `done`

### 任务
- [ ] 任务 1.1：描述
- [ ] 任务 1.2：描述
- [x] 任务 1.3：描述 ✓

### 关键决策
- **决策**：[做了什么选择，为什么]
- **替代方案**：[考虑过但放弃的方案及原因]

## 阶段 2：[阶段名称] ⏳
**状态**：`pending`

- [ ] 任务 2.1：描述
- [ ] 任务 2.2：描述

## 风险与阻塞
- [ ] 风险/阻塞 1：描述 + 缓解措施
```

### findings.md

```markdown
# 调研发现

## [主题/日期]

### 发现
- **要点**：发现内容
- **来源**：文件路径 / URL / 文档
- **影响**：对当前任务的意义

### 技术笔记
```code snippet or key observation```

### 踩坑记录
- **问题**：遇到了什么
- **原因**：为什么发生
- **解决**：怎么解决的
```

### progress.md

```markdown
# 工作进度日志

## 会话 [YYYY-MM-DD HH:MM] — [简短标题]

### 完成事项
- [x] 事项 1
- [x] 事项 2

### 当前状态
- 阶段 X 进行中
- 已完成 N/M 任务

### 下一步
1. 下一步动作 1
2. 下一步动作 2

### 遇到的问题
- 问题描述 + 当前处理方式

### 关键文件
- `src/xxx.ts` — 修改了什么
- `docs/yyy.md` — 新增文档

### 验证结果
- 测试通过/失败情况
- 手动验证结果
```

## 工作流

### 第一步：启动时自动恢复

当新会话开始时，**必须先读取已存在的计划文件**：

```
1. 检查项目根目录是否有 goals.md / task_plan.md / findings.md / progress.md
2. 如果有：全部读一遍，理解当前状态
3. 如果没有 + 任务复杂：创建这四个文件
```

> Pi 扩展已自动将计划文件内容注入系统提示。你会在上下文中看到 `<planning-files>` 块。但如果需要完整内容，仍要用 Read 工具读取原文件。

### 第二步：执行中维护

- **每完成一个任务**：勾选 `task_plan.md` 中的 checkbox（`- [x]`）
- **每发现新信息**：追加到 `findings.md`
- **做出技术决策**：记录到 `task_plan.md` 的"关键决策"部分
- **遇到阻塞**：更新 `task_plan.md` 的"风险与阻塞"

### 第三步：会话结束时

**强制动作** — 更新 `progress.md`，记录：
1. 本次会话完成了什么
2. 当前停在哪个任务
3. 下一步该做什么
4. 有哪些未解决的问题

这样下一个会话（或另一个 Agent 实例）可以无缝接手。

### 第四步：项目完成时

- 所有阶段标记为 `done`
- `progress.md` 最后一条记录标记项目完成
- 四个文件保留在项目中，作为项目记忆

## 与 Pi 扩展的配合

本 skill 配套的 Pi 扩展（`~/.pi/agent/extensions/planning-with-files.ts`）提供自动化的钩子：

1. **会话启动**：检测已有计划文件，通知你
2. **Agent 启动前**：自动将计划文件内容注入系统提示
3. **会话结束时**：提醒更新 progress.md

如果你发现这些自动化没生效，请检查：
- 扩展文件是否存在：`ls ~/.pi/agent/extensions/planning-with-files.ts`
- 重启 Pi 是否加载了扩展

## 设计原则

1. **文件即真相** — 磁盘上的文件才是真实状态，不要只记在"脑子"里
2. **写比不写强** — 哪怕只写一行进展，也好过什么都不写
3. **下一个接手者视角** — 假设下一个会话是全新的 Agent 实例，它能不能只看这四个文件就知道该干什么
4. **目标先行** — `goals.md` 定义了"为什么做"，防止在执行中迷失方向
5. **决策可追溯** — 记录"为什么选 A 不选 B"，避免重复讨论

## 参考

- [planning-with-files (GitHub)](https://github.com/OthmanAdi/planning-with-files) — 原始 Skill
- [Harness Engineering: 让跨会话的任务保持上下文连续](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-05-why-long-running-tasks-lose-continuity/)
- [知乎原文：如何在 Pi 上实现跨上下文连续工作](https://zhuanlan.zhihu.com/p/2059648027586045590)
- 作者：13啦
