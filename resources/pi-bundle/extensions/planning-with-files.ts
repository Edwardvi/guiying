/**
 * planning-with-files — Pi Extension
 *
 * 自动化钩子，让 planning-with-files 的四个文件（goals.md / task_plan.md /
 * findings.md / progress.md）在每次 Agent 交互中自动发挥作用。
 *
 * 功能：
 * 1. session_start：检测已有计划文件，通知用户
 * 2. before_agent_start：读取计划文件，注入系统提示
 * 3. 提供自定义工具 plan_status：让 LLM 快速查看计划状态
 *
 * 安装：放在 ~/.pi/agent/extensions/planning-with-files.ts
 * 配合：~/.pi/agent/skills/planning-with-files/SKILL.md
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";

const PLAN_FILES = ["goals.md", "task_plan.md", "findings.md", "progress.md"] as const;

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function findPlanFiles(cwd: string): string[] {
  return PLAN_FILES.filter((f) => {
    try {
      return fs.existsSync(path.join(cwd, f));
    } catch {
      return false;
    }
  });
}

function readPlanFiles(cwd: string): string {
  const existing = findPlanFiles(cwd);
  if (existing.length === 0) return "";

  return existing
    .map((f) => {
      try {
        const content = fs.readFileSync(path.join(cwd, f), "utf-8");
        // 截断过长文件，避免吃掉太多上下文
        const maxLen = 8000;
        const truncated =
          content.length > maxLen
            ? content.slice(0, maxLen) + `\n\n... (截断，完整文件共 ${content.length} 字符，请用 Read 工具读取)`
            : content;
        return `### ${f}\n\n${truncated}`;
      } catch (e: any) {
        return `### ${f}\n\n[读取失败: ${e.message}]`;
      }
    })
    .join("\n\n---\n\n");
}

function getPlanSummary(cwd: string): string {
  const existing = findPlanFiles(cwd);
  if (existing.length === 0) return "无计划文件。";

  const lines: string[] = [];
  for (const f of existing) {
    try {
      const content = fs.readFileSync(path.join(cwd, f), "utf-8");
      const size = content.length;
      // 提取第一行作为摘要
      const firstLine = content.split("\n")[0]?.replace(/^#+\s*/, "") || "(空)";

      // 统计 checkbox
      const total = (content.match(/- \[[ x]\]/g) || []).length;
      const done = (content.match(/- \[x\]/g) || []).length;

      lines.push(
        `- **${f}** (${size} 字符): ${firstLine}${total > 0 ? ` — 任务进度 ${done}/${total}` : ""}`
      );
    } catch {
      lines.push(`- **${f}**: 读取失败`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 扩展主体
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  // ── 1. 会话启动：检测计划文件 ──────────────────────────────────
  pi.on("session_start", async (_event, ctx) => {
    const existing = findPlanFiles(ctx.cwd);
    if (existing.length > 0) {
      // 用 setStatus 在页脚显示，不打扰工作流
      ctx.ui.setStatus("planning", `📋 计划文件: ${existing.length} 个`);
    }
  });

  // ── 2. Agent 启动前：注入计划文件到系统提示 ────────────────────
  pi.on("before_agent_start", async (event, ctx) => {
    const planContent = readPlanFiles(ctx.cwd);
    if (!planContent) {
      // 没有计划文件 — 如果任务看起来复杂，提醒创建
      const promptLen = event.prompt?.length || 0;
      if (promptLen > 200) {
        return {
          systemPrompt:
            event.systemPrompt +
            `\n\n<planning-hint>\n此任务看起来比较复杂。如果预计需要 5+ 工具调用或多阶段工作，建议先创建项目计划文件（goals.md / task_plan.md / findings.md / progress.md）来维持跨会话的上下文连续性。参考 /skill:planning-with-files\n</planning-hint>`,
        };
      }
      return;
    }

    // 有已有计划文件 — 注入内容
    const injection = `
<planning-files>
以下项目计划文件已存在。这是当前项目的工作记忆，跨越会话持久化。

**重要**：
- 开始工作前，确认你理解了当前阶段和下一步
- 完成任务后，更新 task_plan.md 的 checkbox
- 发现新信息，追加到 findings.md
- 本会话结束时，更新 progress.md 记录进展

${planContent}
</planning-files>

<planning-reminder>
每次做出进展后，请更新对应的计划文件。会话结束前，务必更新 progress.md 让下一个会话能无缝接手。
如果尚未读取完整文件内容，使用 Read 工具读取对应的 md 文件。
</planning-reminder>`;

    return {
      systemPrompt: event.systemPrompt + injection,
    };
  });

  // ── 3. 工具调用拦截：提醒维护计划文件 ─────────────────────────
  pi.on("tool_call", async (event, _ctx) => {
    // 监听对计划文件本身的写入 — 不做拦截，只是确保不被意外阻止
    if (event.toolName === "write" || event.toolName === "edit") {
      const filePath: string | undefined = event.input?.path;
      if (filePath) {
        const base = path.basename(filePath);
        if ((PLAN_FILES as readonly string[]).includes(base)) {
          // 允许写入计划文件，不做任何干预
          // 如果后续想加 completion gate 可以在这里扩展
        }
      }
    }
  });

  // ── 4. 自定义工具：plan_status ─────────────────────────────────
  // 让 LLM 可以快速查看计划文件状态，而不需要逐个读取
  pi.registerTool({
    name: "plan_status",
    label: "Plan Status",
    description:
      "查看当前项目的计划文件状态（goals.md / task_plan.md / findings.md / progress.md）。返回各文件是否存在、大小和任务进度摘要。",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd;
      const existing = findPlanFiles(cwd);
      const summary = getPlanSummary(cwd);

      if (existing.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "📭 当前项目没有计划文件。\n\n如果需要开始规划，请创建以下文件：\n- goals.md — 项目目标与成功标准\n- task_plan.md — 阶段划分与任务清单\n- findings.md — 调研发现与技术笔记\n- progress.md — 会话工作日志",
            },
          ],
          details: { existingFiles: [], projectRoot: cwd },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `## 计划文件状态\n\n${summary}\n\n> 使用 Read 工具读取具体文件内容。`,
          },
        ],
        details: { existingFiles: existing, projectRoot: cwd },
      };
    },
  });
}
