import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SurveyResponse } from '../../database/entities/survey-response.entity'
import { AITask, AITaskType } from '../../database/entities/ai-task.entity'
import { BinaryQuestion } from '../ai-generation/generators/binary-questionnaire.generator'

/**
 * 差距详情接口
 */
export interface GapDetail {
  cluster_id: string
  cluster_name: string
  category_name?: string
  clause_id: string
  clause_text: string
  question_text: string
  user_answer: boolean
  expected_answer: boolean
  gap: boolean
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

/**
 * 聚类差距汇总接口
 */
export interface ClusterGapSummary {
  cluster_id: string
  cluster_name: string
  category_name?: string
  total_clauses: number
  satisfied_clauses: number // 用户选择"有"
  gap_clauses: number // 用户选择"没有"
  gap_rate: number // 差距率 = gap_clauses / total_clauses
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

/**
 * 判断题差距分析输出接口
 */
export interface BinaryGapAnalysisOutput {
  total_clauses: number
  satisfied_clauses: number // 用户选择"有"的数量
  gap_clauses: number // 用户选择"没有"的数量
  compliance_rate: number // 合规率 = satisfied_clauses / total_clauses

  gap_details: GapDetail[]

  gap_clusters: ClusterGapSummary[]

  summary: {
    overview: string
    top_gap_clusters: string[] // 差距最大的前3个聚类
    recommendations: string[]
  }
}

/**
 * 判断题差距分析输入接口
 */
export interface BinaryGapAnalysisInput {
  surveyResponseId: string
  questionnaireTaskId: string
  clusteringTaskId: string
}

/**
 * 判断题差距分析服务
 * 基于用户问卷结果进行差距分析（纯计算，无AI调用）
 */
@Injectable()
export class BinaryGapAnalyzer {
  private readonly logger = new Logger(BinaryGapAnalyzer.name)

  constructor(
    @InjectRepository(SurveyResponse)
    private readonly surveyResponseRepository: Repository<SurveyResponse>,
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
  ) {}

  /**
   * 分析差距
   * @param input 输入参数
   * @returns 差距分析结果
   */
  async analyzeGap(input: BinaryGapAnalysisInput): Promise<BinaryGapAnalysisOutput> {
    this.logger.log(`Starting binary gap analysis for survey response: ${input.surveyResponseId}`)

    // 1. 获取问卷填写结果
    const surveyResponse = await this.surveyResponseRepository.findOne({
      where: { id: input.surveyResponseId },
      relations: ['questionnaireTask'],
    })

    if (!surveyResponse) {
      throw new NotFoundException(`Survey response not found: ${input.surveyResponseId}`)
    }

    if (surveyResponse.questionnaireTaskId !== input.questionnaireTaskId) {
      throw new Error('Questionnaire task ID mismatch')
    }

    // 2. 获取判断题问卷模板
    const questionnaireTask = await this.aiTaskRepository.findOne({
      where: { id: input.questionnaireTaskId },
    })

    if (!questionnaireTask || questionnaireTask.type !== AITaskType.BINARY_QUESTIONNAIRE) {
      throw new Error('Invalid questionnaire task or type')
    }

    const questionnaireResult = questionnaireTask.result?.selectedResult as any
    if (!questionnaireResult || !questionnaireResult.questionnaire) {
      throw new Error('Questionnaire result not found')
    }

    const questionnaire: BinaryQuestion[] = questionnaireResult.questionnaire

    this.logger.log(`Retrieved binary questionnaire with ${questionnaire.length} questions`)

    // 3. 获取聚类结果（用于获取聚类详情，可选）
    let clusteringResult: any = null
    try {
      const clusteringTask = await this.aiTaskRepository.findOne({
        where: { id: input.clusteringTaskId },
      })
      if (clusteringTask?.result?.selectedResult) {
        clusteringResult = clusteringTask.result.selectedResult
      }
    } catch (error) {
      this.logger.warn(`Failed to load clustering result: ${error.message}`)
    }

    // 4. 逐条比对用户答案 vs 期望答案
    const gapDetails: GapDetail[] = []
    const userAnswers = surveyResponse.answers

    for (const question of questionnaire) {
      const userAnswer = userAnswers[question.question_id]

      // 判断用户答案格式
      let actualAnswer: boolean
      if (typeof userAnswer === 'boolean') {
        actualAnswer = userAnswer
      } else if (userAnswer?.answer === 'A' || userAnswer?.answer === true) {
        actualAnswer = true
      } else if (userAnswer?.answer === 'B' || userAnswer?.answer === false) {
        actualAnswer = false
      } else {
        // 用户未回答，默认为"没有"
        actualAnswer = false
      }

      // 计算差距（用户选"没有" = 有差距）
      const hasGap = !actualAnswer

      // 计算优先级（基于重要性，可以从clusteringResult获取）
      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'
      if (clusteringResult) {
        // 尝试从聚类结果中获取重要性
        const cluster = clusteringResult.categories
          ?.flatMap((cat: any) => cat.clusters || [])
          .find((c: any) => c.id === question.cluster_id)

        if (cluster?.importance) {
          priority = cluster.importance
        }
      }

      gapDetails.push({
        cluster_id: question.cluster_id,
        cluster_name: question.cluster_name,
        category_name: question.category_name,
        clause_id: question.clause_id,
        clause_text: question.clause_text,
        question_text: question.question_text,
        user_answer: actualAnswer,
        expected_answer: question.expected_answer,
        gap: hasGap,
        priority,
      })
    }

    // 5. 按聚类聚合差距
    const clusterGapMap = new Map<string, ClusterGapSummary>()

    for (const detail of gapDetails) {
      const key = detail.cluster_id

      if (!clusterGapMap.has(key)) {
        clusterGapMap.set(key, {
          cluster_id: detail.cluster_id,
          cluster_name: detail.cluster_name,
          category_name: detail.category_name,
          total_clauses: 0,
          satisfied_clauses: 0,
          gap_clauses: 0,
          gap_rate: 0,
          priority: detail.priority,
        })
      }

      const summary = clusterGapMap.get(key)!
      summary.total_clauses++

      if (detail.gap) {
        summary.gap_clauses++
      } else {
        summary.satisfied_clauses++
      }

      summary.gap_rate = summary.gap_clauses / summary.total_clauses
    }

    const gapClusters = Array.from(clusterGapMap.values())

    // 按差距率降序排序
    gapClusters.sort((a, b) => b.gap_rate - a.gap_rate)

    // 6. 计算总体统计
    const totalClauses = gapDetails.length
    const satisfiedClauses = gapDetails.filter((d) => !d.gap).length
    const gapClauses = gapDetails.filter((d) => d.gap).length
    const complianceRate = totalClauses > 0 ? satisfiedClauses / totalClauses : 0

    // 7. 生成总结
    const topGapClusters = gapClusters.slice(0, 3).map((c) => c.cluster_name)
    const summary = this.generateSummary(gapClusters, complianceRate)

    this.logger.log(
      `Gap analysis completed: total=${totalClauses}, satisfied=${satisfiedClauses}, gap=${gapClauses}, compliance=${(complianceRate * 100).toFixed(1)}%`,
    )

    return {
      total_clauses: totalClauses,
      satisfied_clauses: satisfiedClauses,
      gap_clauses: gapClauses,
      compliance_rate: complianceRate,
      gap_details: gapDetails,
      gap_clusters: gapClusters,
      summary,
    }
  }

  /**
   * 生成差距分析总结
   */
  private generateSummary(
    gapClusters: ClusterGapSummary[],
    complianceRate: number,
  ): BinaryGapAnalysisOutput['summary'] {
    const topGapClusters = gapClusters.slice(0, 3).map((c) => c.cluster_name)
    const highGapClusters = gapClusters.filter((c) => c.gap_rate > 0.5)

    let overview = ''
    if (complianceRate >= 0.8) {
      overview = `整体合规情况良好（${(complianceRate * 100).toFixed(1)}%），大部分标准条款已得到满足。`
    } else if (complianceRate >= 0.5) {
      overview = `整体合规情况中等（${(complianceRate * 100).toFixed(1)}%），仍有部分条款需要改进。`
    } else {
      overview = `整体合规情况较低（${(complianceRate * 100).toFixed(1)}%），需要重点加强标准条款的落实。`
    }

    const recommendations: string[] = []

    if (highGapClusters.length > 0) {
      recommendations.push(`优先改进差距最大的领域：${topGapClusters.join('、')}`)
    }

    if (complianceRate < 0.8) {
      recommendations.push('建立标准条款落实的跟踪机制，定期检查执行情况')
      recommendations.push('针对差距较大的条款，制定具体的改进计划和责任人')
    }

    recommendations.push('建立持续改进机制，定期更新标准条款的执行状态')

    return {
      overview,
      top_gap_clusters: topGapClusters,
      recommendations,
    }
  }
}
