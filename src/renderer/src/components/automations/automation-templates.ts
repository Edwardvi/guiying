import type { AutomationSchedulePreset } from '../../../../shared/automations-types'
import type { TuiAgent } from '../../../../shared/types'
import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'

export type AutomationTemplate = {
  id: string
  category: string
  label: string
  description: string
  name: string
  prompt: string
  preset: AutomationSchedulePreset
  time?: string
  dayOfWeek?: string
  agentId?: TuiAgent
  missedRunGraceMinutes?: string
}

/**
 * guiying 预设自动化模板 — 替换 Orca 默认的 4 个开发模板。
 *
 * 每个模板自动启动 Pi agent，加载对应的 skill，
 * 用户点击即可开始对话，无需手动配置。
 */
export const getAutomationTemplates = createLocalizedCatalog((): AutomationTemplate[] => [
  {
    id: 'guiying-strategy-ppt',
    category: translate(
      'auto.components.automations.automation.templates.repoHealth.category',
      '品牌策略'
    ),
    label: translate(
      'auto.components.automations.automation.templates.b84757677d',
      '策略PPT'
    ),
    description: translate(
      'auto.components.automations.automation.templates.a7fbd32ddb',
      '用4alaodeng、fxxk4a、策展等营销方法论，一键生成品牌策略PPT。先分析客群，再给定位建议，最后产出可落地策略方案。'
    ),
    name: translate(
      'auto.components.automations.automation.templates.repoHealth.name',
      '策略PPT'
    ),
    prompt: translate(
      'auto.components.automations.automation.templates.repoHealth.prompt',
      '使用4alaodeng、fxxk4a、策展等营销方法论skills，帮我制作一份品牌策略PPT。先分析目标客群，再给出定位建议，最后产出可落地的策略方案。如果需要，可以用pro-presentation或html-ppt生成正式的PPT文件。'
    ),
    preset: 'daily',
    agentId: 'pi',
    time: '09:00'
  },
  {
    id: 'guiying-event-marketing',
    category: translate(
      'auto.components.automations.automation.templates.releasePrep.category',
      '事件营销'
    ),
    label: translate(
      'auto.components.automations.automation.templates.39ed39280a',
      '出圈事件营销'
    ),
    description: translate(
      'auto.components.automations.automation.templates.513401db93',
      '用4azhongdeng刷屏营销方法论，设计出圈事件方案。含事件创意、传播路径、执行时间线和预算估算。'
    ),
    name: translate(
      'auto.components.automations.automation.templates.releasePrep.name',
      '出圈事件营销'
    ),
    prompt: translate(
      'auto.components.automations.automation.templates.releasePrep.prompt',
      '使用4azhongdeng的刷屏营销方法论，为我的品牌设计一个出圈事件营销方案。需要包含：事件创意、传播路径、执行时间线和预算估算。'
    ),
    preset: 'daily',
    agentId: 'pi',
    time: '10:00'
  },
  {
    id: 'guiying-curation-narrative',
    category: translate(
      'auto.components.automations.automation.templates.recurringReview.category',
      '空间叙事'
    ),
    label: translate(
      'auto.components.automations.automation.templates.6023075b27',
      '品牌叙事策展'
    ),
    description: translate(
      'auto.components.automations.automation.templates.3b7281c75f',
      '用策展-framework方法论（原研哉/安藤忠雄/柳宗悦），设计品牌空间叙事方案。包括动线规划、感官体验、在地文化融入。'
    ),
    name: translate(
      'auto.components.automations.automation.templates.recurringReview.name',
      '品牌叙事策展'
    ),
    prompt: translate(
      'auto.components.automations.automation.templates.recurringReview.prompt',
      '使用策展方法论（基于原研哉、安藤忠雄、柳宗悦等大师），帮我设计一个品牌空间叙事方案。包括：动线规划、感官体验设计、在地文化融入策略。'
    ),
    preset: 'daily',
    agentId: 'pi',
    time: '11:00'
  }
])
