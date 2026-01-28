import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ActionPlanMeasure, MeasurePriority } from '../../database/entities'

/**
 * 聚类差距分析结果
 */
export interface ClusterGapAnalysis {
  cluster_id: string
  cluster_name: string
  current_level: number
  target_level: number
  gap: number
  priority: MeasurePriority
  suggested_measure_count: number
  improvement_urgency: 'critical' | 'high' | 'medium' | 'low'
}

/**
 * 整体差距分析结果
 */
export interface GapAnalysisResult {
  survey_response_id: string
  overall_current_maturity: number
  overall_target_maturity: number
  overall_gap: number
  cluster_gaps: ClusterGapAnalysis[]
  total_measures_needed: number
  estimated_timeline: string
}

@Injectable()
export class ActionPlanService {
  constructor(
    @InjectRepository(ActionPlanMeasure)
    private actionPlanMeasureRepository: Repository<ActionPlanMeasure>,
  ) {}

  /**
   * 执行差距分析
   * @param clusterMaturity 聚类成熟度数据（来自成熟度分析结果）
   * @param targetMaturity 目标成熟度等级
   * @returns 差距分析结果
   */
  analyzeGaps(
    clusterMaturity: Array<{
      cluster_id: string
      cluster_name: string
      maturityLevel: number
      questions: any[]
    }>,
    targetMaturity: number,
  ): ClusterGapAnalysis[] {
    const clusterGaps: ClusterGapAnalysis[] = []

    for (const cluster of clusterMaturity) {
      const gap = targetMaturity - cluster.maturityLevel

      // 只分析需要改进的聚类（差距 > 0）
      if (gap <= 0) {
        continue
      }

      // 计算优先级和紧迫性
      const { priority, urgency } = this.calculatePriorityAndUrgency(
        cluster.maturityLevel,
        gap,
        clusterMaturity,
      )

      // 计算建议的措施数量
      const suggestedCount = this.calculateMeasureCount(gap, cluster.maturityLevel)

      clusterGaps.push({
        cluster_id: cluster.cluster_id,
        cluster_name: cluster.cluster_name,
        current_level: cluster.maturityLevel,
        target_level: targetMaturity,
        gap,
        priority,
        suggested_measure_count: suggestedCount,
        improvement_urgency: urgency,
      })
    }

    // 按优先级和差距大小排序
    clusterGaps.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      const priorityCompare = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityCompare !== 0) return priorityCompare
      return b.gap - a.gap // 差距大的排前面
    })

    return clusterGaps
  }

  /**
   * 计算优先级和改进紧迫性
   * @param currentLevel 当前成熟度
   * @param gap 差距
   * @param allClusters 所有聚类数据
   * @returns 优先级和紧迫性
   */
  private calculatePriorityAndUrgency(
    currentLevel: number,
    gap: number,
    allClusters: any[],
  ): { priority: MeasurePriority; urgency: 'critical' | 'high' | 'medium' | 'low' } {
    // 计算当前成熟度在所有聚类中的排名（百分位）
    const sortedLevels = allClusters.map((c) => c.maturityLevel).sort((a, b) => a - b)
    const rank = sortedLevels.indexOf(currentLevel)
    const percentile = rank / sortedLevels.length

    // 优先级判断逻辑
    let priority: MeasurePriority
    let urgency: 'critical' | 'high' | 'medium' | 'low'

    if (gap >= 2.0 && currentLevel < 2.0) {
      // 差距大且基础薄弱 → 高优先级/危急
      priority = MeasurePriority.HIGH
      urgency = 'critical'
    } else if (gap >= 1.5 && currentLevel < 2.5) {
      // 差距较大且成熟度较低 → 高优先级/高紧迫性
      priority = MeasurePriority.HIGH
      urgency = 'high'
    } else if (gap >= 1.0 || percentile < 0.25) {
      // 差距适中 或 处于最低25% → 中优先级
      priority = MeasurePriority.MEDIUM
      urgency = percentile < 0.25 ? 'high' : 'medium'
    } else {
      // 差距较小 → 低优先级
      priority = MeasurePriority.LOW
      urgency = 'low'
    }

    return { priority, urgency }
  }

  /**
   * 计算每个聚类需要的措施数量
   * @param gap 成熟度差距
   * @param currentLevel 当前成熟度
   * @returns 建议的措施数量
   */
  private calculateMeasureCount(gap: number, currentLevel: number): number {
    // 基础规则：每0.5分差距生成2-3条措施（提高颗粒度）
    let baseCount = Math.ceil((gap / 0.5) * 2)

    // 调整因子：基础薄弱的领域需要更多措施
    if (currentLevel < 1.5) {
      baseCount = Math.ceil(baseCount * 1.5) // 增加50%
    } else if (currentLevel < 2.5) {
      baseCount = Math.ceil(baseCount * 1.3) // 增加30%（从20%提高到30%）
    } else if (currentLevel < 3.5) {
      baseCount = Math.ceil(baseCount * 1.1) // 增加10%
    }

    // 限制范围：每个聚类最少3条，最多10条（提高上限）
    return Math.max(3, Math.min(10, baseCount))
  }

  /**
   * 估算总体改进时间线
   * @param totalGap 总体差距
   * @param clusterGaps 聚类差距数组
   * @returns 时间线描述
   */
  estimateTimeline(totalGap: number, clusterGaps: ClusterGapAnalysis[]): string {
    const highPriorityCount = clusterGaps.filter((c) => c.priority === MeasurePriority.HIGH).length
    const criticalCount = clusterGaps.filter((c) => c.improvement_urgency === 'critical').length

    if (totalGap >= 2.0 || criticalCount > 3) {
      return '12-18个月（长期规划）'
    } else if (totalGap >= 1.5 || highPriorityCount > 5) {
      return '9-12个月（中长期）'
    } else if (totalGap >= 1.0) {
      return '6-9个月（中期）'
    } else {
      return '3-6个月（短期）'
    }
  }

  /**
   * 计算总措施数量
   * @param clusterGaps 聚类差距数组
   * @returns 总措施数量
   */
  calculateTotalMeasures(clusterGaps: ClusterGapAnalysis[]): number {
    return clusterGaps.reduce((sum, cluster) => sum + cluster.suggested_measure_count, 0)
  }

  /**
   * 生成完整的差距分析报告
   * @param surveyResponseId 问卷响应ID
   * @param clusterMaturity 聚类成熟度数据
   * @param overallMaturity 总体成熟度
   * @param targetMaturity 目标成熟度
   * @returns 差距分析报告
   */
  generateGapAnalysisReport(
    surveyResponseId: string,
    clusterMaturity: any[],
    overallMaturity: number,
    targetMaturity: number,
  ): GapAnalysisResult {
    // 执行聚类差距分析
    const clusterGaps = this.analyzeGaps(clusterMaturity, targetMaturity)

    // 计算总体差距
    const overall_gap = targetMaturity - overallMaturity

    // 计算总措施数量
    const total_measures_needed = this.calculateTotalMeasures(clusterGaps)

    // 估算时间线
    const estimated_timeline = this.estimateTimeline(overall_gap, clusterGaps)

    return {
      survey_response_id: surveyResponseId,
      overall_current_maturity: overallMaturity,
      overall_target_maturity: targetMaturity,
      overall_gap,
      cluster_gaps: clusterGaps,
      total_measures_needed,
      estimated_timeline,
    }
  }

  /**
   * 获取改进建议摘要
   * @param gapAnalysis 差距分析结果
   * @returns 建议摘要
   */
  getImprovementSummary(gapAnalysis: GapAnalysisResult): {
    critical_areas: string[]
    quick_wins: string[]
    long_term_goals: string[]
  } {
    const { cluster_gaps } = gapAnalysis

    // 关键改进领域（高优先级 + 差距大）
    const critical_areas = cluster_gaps
      .filter((c) => c.priority === MeasurePriority.HIGH && c.gap >= 1.5)
      .map((c) => c.cluster_name)

    // 快速见效领域（中优先级 + 差距适中）
    const quick_wins = cluster_gaps
      .filter((c) => c.priority === MeasurePriority.MEDIUM && c.gap <= 1.0)
      .map((c) => c.cluster_name)

    // 长期目标（低优先级或差距大）
    const long_term_goals = cluster_gaps
      .filter((c) => c.priority === MeasurePriority.LOW || c.gap >= 2.0)
      .map((c) => c.cluster_name)

    return {
      critical_areas,
      quick_wins,
      long_term_goals,
    }
  }
}
