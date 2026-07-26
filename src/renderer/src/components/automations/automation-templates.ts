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
 * guiying 预设自动化模板。
 *
 * 每个模板指定 agentId='pi'，用户点击即启动 Pi agent 开始对话。
 * 文案直接使用中文，不经过 translate() 以避免与 Orca 原有 i18n key 冲突。
 */
export const getAutomationTemplates = createLocalizedCatalog((): AutomationTemplate[] => [
  {
    id: 'guiying-strategy-ppt',
    category: '品牌策略',
    label: '策略PPT',
    description: '用4alaodeng、fxxk4a、策展等营销方法论，一键生成品牌策略PPT。先分析客群，再给定位建议，最后产出可落地策略方案。',
    name: '策略PPT',
    prompt: '使用4alaodeng、fxxk4a、策展等营销方法论skills，帮我制作一份品牌策略PPT。先分析目标客群，再给出定位建议，最后产出可落地的策略方案。如果需要，可以用pro-presentation或html-ppt生成正式的PPT文件。',
    preset: 'daily',
    agentId: 'pi',
    time: '09:00'
  },
  {
    id: 'guiying-event-marketing',
    category: '事件营销',
    label: '出圈事件营销',
    description: '用4azhongdeng刷屏营销方法论，设计出圈事件方案。含事件创意、传播路径、执行时间线和预算估算。',
    name: '出圈事件营销',
    prompt: '使用4azhongdeng的刷屏营销方法论，为我的品牌设计一个出圈事件营销方案。需要包含：事件创意、传播路径、执行时间线和预算估算。',
    preset: 'daily',
    agentId: 'pi',
    time: '10:00'
  },
  {
    id: 'guiying-curation-narrative',
    category: '空间叙事',
    label: '品牌叙事策展',
    description: '用策展方法论（原研哉/安藤忠雄/柳宗悦），设计品牌空间叙事方案。包括动线规划、感官体验、在地文化融入。',
    name: '品牌叙事策展',
    prompt: '使用策展方法论（基于原研哉、安藤忠雄、柳宗悦等大师），帮我设计一个品牌空间叙事方案。包括：动线规划、感官体验设计、在地文化融入策略。',
    preset: 'daily',
    agentId: 'pi',
    time: '11:00'
  }
])
