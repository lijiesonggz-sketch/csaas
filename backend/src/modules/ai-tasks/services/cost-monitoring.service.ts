import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AICostTracking } from '../../../database/entities/ai-cost-tracking.entity'
import { AITask } from '../../../database/entities/ai-task.entity'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'

/**
 * 模型定价配置（每1000 tokens的成本，单位：美元）
 */
export const MODEL_PRICING = {
  [AIModel.GPT4]: {
    input: 0.03, // $0.03 per 1K input tokens
    output: 0.06, // $0.06 per 1K output tokens
  },
  [AIModel.CLAUDE]: {
    input: 0.024, // $0.024 per 1K input tokens
    output: 0.072, // $0.072 per 1K output tokens
  },
  [AIModel.DOMESTIC]: {
    input: 0.002, // ¥0.012/1K tokens ≈ $0.002
    output: 0.002,
  },
}

/**
 * 成本阈值配置
 */
export const COST_THRESHOLDS = {
  PROJECT_WARNING: 30, // 单项目警告阈值（元）
  PROJECT_CRITICAL: 50, // 单项目严重阈值（元）
  TASK_ABNORMAL: 10, // 单任务异常阈值（元，正常应该<1元）
}

/**
 * 汇率配置
 */
const USD_TO_CNY = 7.2 // 美元到人民币汇率

export interface ProjectCostStats {
  projectId: string
  totalCost: number // 总成本（元）
  totalCostUSD: number // 总成本（美元）
  taskCount: number
  averageCostPerTask: number
  costByModel: Record<string, number>
  isWarning: boolean // 是否超过警告阈值
  isCritical: boolean // 是否超过严重阈值
}

export interface CostAlert {
  type: 'project_warning' | 'project_critical' | 'task_abnormal'
  projectId: string
  taskId?: string
  currentCost: number
  threshold: number
  message: string
  timestamp: Date
}

/**
 * 成本监控服务
 * 负责成本计算、统计和告警
 */
@Injectable()
export class CostMonitoringService {
  private readonly logger = new Logger(CostMonitoringService.name)

  constructor(
    @InjectRepository(AICostTracking)
    private readonly costRepo: Repository<AICostTracking>,
    @InjectRepository(AITask)
    private readonly taskRepo: Repository<AITask>,
  ) {}

  /**
   * 计算AI API调用成本
   */
  calculateCost(
    model: AIModel,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING[AIModel.GPT4]

    const inputCost = (inputTokens / 1000) * pricing.input
    const outputCost = (outputTokens / 1000) * pricing.output

    return inputCost + outputCost
  }

  /**
   * 获取项目的成本统计
   */
  async getProjectCostStats(projectId: string): Promise<ProjectCostStats> {
    // 获取项目的所有任务
    const tasks = await this.taskRepo.find({
      where: { projectId },
      relations: ['costs'],
    })

    if (tasks.length === 0) {
      return {
        projectId,
        totalCost: 0,
        totalCostUSD: 0,
        taskCount: 0,
        averageCostPerTask: 0,
        costByModel: {},
        isWarning: false,
        isCritical: false,
      }
    }

    // 计算总成本
    let totalCostUSD = 0
    const costByModel: Record<string, number> = {}

    tasks.forEach((task) => {
      task.costs?.forEach((cost) => {
        const costValue = parseFloat(cost.cost.toString())
        totalCostUSD += costValue

        const model = cost.model.toString()
        costByModel[model] = (costByModel[model] || 0) + costValue
      })
    })

    const totalCost = totalCostUSD * USD_TO_CNY
    const averageCostPerTask = tasks.length > 0 ? totalCost / tasks.length : 0

    return {
      projectId,
      totalCost,
      totalCostUSD,
      taskCount: tasks.length,
      averageCostPerTask,
      costByModel,
      isWarning: totalCost >= COST_THRESHOLDS.PROJECT_WARNING,
      isCritical: totalCost >= COST_THRESHOLDS.PROJECT_CRITICAL,
    }
  }

  /**
   * 获取任务的成本统计
   */
  async getTaskCostStats(taskId: string) {
    const costs = await this.costRepo.find({
      where: { taskId },
    })

    if (costs.length === 0) {
      return {
        taskId,
        totalCost: 0,
        totalCostUSD: 0,
        models: [],
      }
    }

    let totalCostUSD = 0
    const modelCosts = costs.map((cost) => {
      const costValue = parseFloat(cost.cost.toString())
      totalCostUSD += costValue

      return {
        model: cost.model,
        tokens: cost.tokens,
        cost: costValue,
        costCNY: costValue * USD_TO_CNY,
      }
    })

    return {
      taskId,
      totalCost: totalCostUSD * USD_TO_CNY,
      totalCostUSD,
      models: modelCosts,
    }
  }

  /**
   * 检查项目成本是否超过阈值，返回告警信息
   */
  async checkProjectCostAlert(projectId: string): Promise<CostAlert | null> {
    const stats = await this.getProjectCostStats(projectId)

    if (stats.isCritical) {
      return {
        type: 'project_critical',
        projectId,
        currentCost: stats.totalCost,
        threshold: COST_THRESHOLDS.PROJECT_CRITICAL,
        message: `项目 ${projectId} 成本已达 ¥${stats.totalCost.toFixed(2)}，超过严重阈值 ¥${COST_THRESHOLDS.PROJECT_CRITICAL}`,
        timestamp: new Date(),
      }
    }

    if (stats.isWarning) {
      return {
        type: 'project_warning',
        projectId,
        currentCost: stats.totalCost,
        threshold: COST_THRESHOLDS.PROJECT_WARNING,
        message: `项目 ${projectId} 成本已达 ¥${stats.totalCost.toFixed(2)}，接近警告阈值 ¥${COST_THRESHOLDS.PROJECT_WARNING}`,
        timestamp: new Date(),
      }
    }

    return null
  }

  /**
   * 检查任务成本是否异常
   */
  async checkTaskCostAlert(
    taskId: string,
    projectId: string,
  ): Promise<CostAlert | null> {
    const stats = await this.getTaskCostStats(taskId)

    if (stats.totalCost >= COST_THRESHOLDS.TASK_ABNORMAL) {
      return {
        type: 'task_abnormal',
        projectId,
        taskId,
        currentCost: stats.totalCost,
        threshold: COST_THRESHOLDS.TASK_ABNORMAL,
        message: `任务 ${taskId} 成本异常高：¥${stats.totalCost.toFixed(2)}，超过正常阈值 ¥${COST_THRESHOLDS.TASK_ABNORMAL}`,
        timestamp: new Date(),
      }
    }

    return null
  }

  /**
   * 发送成本告警（TODO: 集成邮件/短信服务）
   */
  async sendCostAlert(alert: CostAlert) {
    this.logger.warn(
      `[COST ALERT] ${alert.type.toUpperCase()}: ${alert.message}`,
    )

    // TODO: 集成邮件服务
    // await this.emailService.sendCostAlert(alert)

    // TODO: 集成短信服务
    // await this.smsService.sendCostAlert(alert)

    // TODO: 集成Webhook通知
    // await this.webhookService.sendCostAlert(alert)

    return alert
  }

  /**
   * 获取所有项目的成本概览
   */
  async getAllProjectsCostOverview() {
    const allTasks = await this.taskRepo.find({
      relations: ['costs'],
    })

    const projectGroups = new Map<string, AITask[]>()

    allTasks.forEach((task) => {
      if (!projectGroups.has(task.projectId)) {
        projectGroups.set(task.projectId, [])
      }
      projectGroups.get(task.projectId)?.push(task)
    })

    const overview = await Promise.all(
      Array.from(projectGroups.keys()).map((projectId) =>
        this.getProjectCostStats(projectId),
      ),
    )

    const totalCost = overview.reduce((sum, stat) => sum + stat.totalCost, 0)
    const totalTasks = overview.reduce((sum, stat) => sum + stat.taskCount, 0)

    return {
      totalProjects: overview.length,
      totalCost,
      totalTasks,
      averageCostPerProject: overview.length > 0 ? totalCost / overview.length : 0,
      projects: overview.sort((a, b) => b.totalCost - a.totalCost), // 按成本降序
    }
  }
}
