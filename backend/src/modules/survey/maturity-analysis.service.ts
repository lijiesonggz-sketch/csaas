import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SurveyResponse } from '../../database/entities/survey-response.entity'
import { AIGenerationResult } from '../../database/entities/ai-generation-result.entity'

/**
 * 聚类成熟度
 */
export interface ClusterMaturity {
  cluster_id: string
  cluster_name: string
  dimension: string
  maturityLevel: number
  totalScore: number
  maxScore: number
  questionsCount: number
  calculation: string
  grade: string
  isShortcoming: boolean
  questions: {
    question_id: string
    question_text: string
    selected_option: string
    selected_option_text: string
    score: number
    level: number
  }[]
}

/**
 * 冲突检测结果
 */
export interface ConflictDetection {
  intraCluster: {
    cluster_id: string
    cluster_name: string
    conflictType: string
    description: string
    questions: string[]
    scores: number[]
    variance: number
    suggestion: string
  }[]
  interCluster: {
    ruleId: string
    conflictType: string
    description: string
    prerequisiteCluster: {
      cluster_id: string
      cluster_name: string
      maturityLevel: number
    }
    dependentCluster: {
      cluster_id: string
      cluster_name: string
      maturityLevel: number
    }
    suggestion: string
  }[]
  hasConflict: boolean
  conflictCount: number
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
}

/**
 * 成熟度分析结果
 */
export interface MaturityAnalysisResult {
  surveyResponseId: string
  respondentInfo: {
    name: string
    department?: string
    position?: string
    submittedAt: Date
  }
  overall: {
    maturityLevel: number
    calculation: {
      totalScore: number
      maxScore: number
      formula: string
    }
    grade: string
    description: string
  }
  distribution: {
    level_1: number
    level_2: number
    level_3: number
    level_4: number
    level_5: number
  }
  clusterMaturity: ClusterMaturity[]
  dimensionMaturity: {
    dimension: string
    clusterCount: number
    maturityLevel: number
    grade: string
  }[]
  conflicts: ConflictDetection
  topShortcomings: {
    rank: number
    cluster_id: string
    cluster_name: string
    maturityLevel: number
    gap: number
  }[]
  topStrengths: {
    rank: number
    cluster_id: string
    cluster_name: string
    maturityLevel: number
    advantage: number
  }[]
  statistics: {
    totalQuestions: number
    answeredQuestions: number
    totalClusters: number
    shortcomingClusters: number
    strengthClusters: number
    averageClusterMaturity: number
    minClusterMaturity: number
    maxClusterMaturity: number
    clusterMaturityStdDev: number
    maturityRange: number
  }
}

/**
 * 成熟度分析服务
 */
@Injectable()
export class MaturityAnalysisService {
  private readonly logger = new Logger(MaturityAnalysisService.name)

  constructor(
    @InjectRepository(SurveyResponse)
    private readonly surveyResponseRepository: Repository<SurveyResponse>,
    @InjectRepository(AIGenerationResult)
    private readonly aiGenerationResultRepository: Repository<AIGenerationResult>,
  ) {}

  /**
   * 分析问卷成熟度
   */
  async analyzeSurvey(surveyResponseId: string): Promise<MaturityAnalysisResult> {
    this.logger.log(`Starting maturity analysis for survey: ${surveyResponseId}`)

    // 1. 获取问卷填写记录
    const surveyResponse = await this.surveyResponseRepository.findOne({
      where: { id: surveyResponseId },
    })

    if (!surveyResponse) {
      throw new NotFoundException(`Survey response not found: ${surveyResponseId}`)
    }

    if (surveyResponse.status !== 'submitted' && surveyResponse.status !== 'completed') {
      throw new BadRequestException('Survey must be submitted before analysis')
    }

    // 2. 获取问卷模板
    const questionnaireResult = await this.aiGenerationResultRepository.findOne({
      where: { taskId: surveyResponse.questionnaireTaskId },
    })

    if (!questionnaireResult || !questionnaireResult.selectedResult) {
      throw new NotFoundException('Questionnaire template not found')
    }

    const questionnaire = questionnaireResult.selectedResult.questionnaire
    const answers = surveyResponse.answers

    // 3. 计算总体成熟度
    const overall = this.calculateOverallMaturity(questionnaire, answers)

    // 4. 计算各聚类成熟度
    const clusterMaturity = this.calculateClusterMaturity(questionnaire, answers, overall.maturityLevel)

    // 5. 计算成熟度分布（基于聚类）
    const distribution = this.calculateDistribution(clusterMaturity)

    // 6. 计算维度成熟度
    const dimensionMaturity = this.calculateDimensionMaturity(clusterMaturity)

    // 7. 冲突检测
    const conflicts = this.detectConflicts(clusterMaturity)

    // 8. 识别TOP5短板和优势
    const topShortcomings = this.getTopShortcomings(clusterMaturity, 5)
    const topStrengths = this.getTopStrengths(clusterMaturity, 5)

    // 9. 统计数据
    const statistics = this.calculateStatistics(clusterMaturity, questionnaire.length)

    return {
      surveyResponseId,
      respondentInfo: {
        name: surveyResponse.respondentName,
        department: surveyResponse.respondentDepartment,
        position: surveyResponse.respondentPosition,
        submittedAt: surveyResponse.submittedAt,
      },
      overall,
      distribution,
      clusterMaturity,
      dimensionMaturity,
      conflicts,
      topShortcomings,
      topStrengths,
      statistics,
    }
  }

  /**
   * 计算总体成熟度
   */
  private calculateOverallMaturity(questionnaire: any[], answers: Record<string, any>) {
    let totalScore = 0
    let maxScore = questionnaire.length * 5

    for (const question of questionnaire) {
      const answer = answers[question.question_id]
      if (answer) {
        totalScore += answer.score || 0
      }
    }

    const maturityLevel = (totalScore / maxScore) * 5
    const grade = this.getGrade(maturityLevel)

    return {
      maturityLevel: Number(maturityLevel.toFixed(2)),
      calculation: {
        totalScore,
        maxScore,
        formula: `${totalScore} / ${maxScore} × 5 = ${maturityLevel.toFixed(2)}`,
      },
      grade,
      description: this.getGradeDescription(grade, maturityLevel),
    }
  }

  /**
   * 计算成熟度分布（按聚类统计）
   * level_1: 0-1分的聚类数量
   * level_2: 1-2分的聚类数量
   * level_3: 2-3分的聚类数量
   * level_4: 3-4分的聚类数量
   * level_5: 4-5分的聚类数量
   */
  private calculateDistribution(clusterMaturity: ClusterMaturity[]) {
    const distribution = {
      level_1: 0,
      level_2: 0,
      level_3: 0,
      level_4: 0,
      level_5: 0,
    }

    for (const cluster of clusterMaturity) {
      const level = cluster.maturityLevel
      if (level < 1) distribution.level_1++
      else if (level < 2) distribution.level_2++
      else if (level < 3) distribution.level_3++
      else if (level < 4) distribution.level_4++
      else distribution.level_5++
    }

    return distribution
  }

  /**
   * 计算各聚类成熟度
   */
  private calculateClusterMaturity(
    questionnaire: any[],
    answers: Record<string, any>,
    overallMaturity: number,
  ): ClusterMaturity[] {
    // 按聚类分组
    const clusterMap = new Map<string, any[]>()

    for (const question of questionnaire) {
      const clusterId = question.cluster_id
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, [])
      }
      clusterMap.get(clusterId).push(question)
    }

    const clusterMaturityList: ClusterMaturity[] = []

    for (const [clusterId, questions] of clusterMap.entries()) {
      let totalScore = 0
      const questionDetails = []

      for (const question of questions) {
        const answer = answers[question.question_id]
        const score = answer?.score || 0
        totalScore += score

        // 获取选中的选项文本
        let selectedOptionText = ''
        if (answer?.answer) {
          const selectedAnswer = answer.answer
          const options = question.options || []

          if (Array.isArray(selectedAnswer)) {
            // 多选题
            const texts = selectedAnswer
              .map((optionId: string) => {
                const option = options.find((opt: any) => opt.option_id === optionId)
                return option?.text || optionId
              })
              .filter(Boolean)
            selectedOptionText = texts.join('; ')
          } else {
            // 单选题
            const option = options.find((opt: any) => opt.option_id === selectedAnswer)
            selectedOptionText = option?.text || selectedAnswer
          }
        }

        questionDetails.push({
          question_id: question.question_id,
          question_text: question.question_text,
          selected_option: answer?.answer || '',
          selected_option_text: selectedOptionText,
          score,
          level: Math.round(score),
        })
      }

      const maxScore = questions.length * 5
      const maturityLevel = (totalScore / maxScore) * 5

      clusterMaturityList.push({
        cluster_id: clusterId,
        cluster_name: questions[0].cluster_name,
        dimension: questions[0].dimension || '',
        maturityLevel: Number(maturityLevel.toFixed(2)),
        totalScore,
        maxScore,
        questionsCount: questions.length,
        calculation: `${totalScore} / ${maxScore} × 5 = ${maturityLevel.toFixed(2)}`,
        grade: this.getGrade(maturityLevel),
        isShortcoming: maturityLevel < overallMaturity,
        questions: questionDetails,
      })
    }

    return clusterMaturityList
  }

  /**
   * 计算维度成熟度
   */
  private calculateDimensionMaturity(clusterMaturity: ClusterMaturity[]) {
    const dimensionMap = new Map<string, ClusterMaturity[]>()

    for (const cluster of clusterMaturity) {
      const dimension = cluster.dimension || '其他'
      if (!dimensionMap.has(dimension)) {
        dimensionMap.set(dimension, [])
      }
      dimensionMap.get(dimension).push(cluster)
    }

    const dimensionMaturity = []

    for (const [dimension, clusters] of dimensionMap.entries()) {
      const avgMaturity =
        clusters.reduce((sum, c) => sum + c.maturityLevel, 0) / clusters.length

      dimensionMaturity.push({
        dimension,
        clusterCount: clusters.length,
        maturityLevel: Number(avgMaturity.toFixed(2)),
        grade: this.getGrade(avgMaturity),
      })
    }

    return dimensionMaturity
  }

  /**
   * 冲突检测
   */
  private detectConflicts(clusterMaturity: ClusterMaturity[]): ConflictDetection {
    const intraCluster = this.detectIntraClusterConflicts(clusterMaturity)
    const interCluster = this.detectInterClusterConflicts(clusterMaturity)

    const conflictCount = intraCluster.length + interCluster.length
    const hasConflict = conflictCount > 0

    let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW'
    if (conflictCount >= 5) severity = 'HIGH'
    else if (conflictCount >= 3) severity = 'MEDIUM'

    return {
      intraCluster,
      interCluster,
      hasConflict,
      conflictCount,
      severity,
    }
  }

  /**
   * 检测聚类内冲突（方差过大）
   */
  private detectIntraClusterConflicts(clusterMaturity: ClusterMaturity[]) {
    const conflicts = []

    for (const cluster of clusterMaturity) {
      const scores = cluster.questions.map((q) => q.score)
      const variance = this.calculateVariance(scores)

      // 方差 > 2.0 视为冲突
      if (variance > 2.0) {
        conflicts.push({
          cluster_id: cluster.cluster_id,
          cluster_name: cluster.cluster_name,
          conflictType: 'HIGH_VARIANCE',
          description: `该聚类内${cluster.questionsCount}个问题得分差异过大（最低${Math.min(...scores)}分，最高${Math.max(...scores)}分）`,
          questions: cluster.questions.map((q) => q.question_id),
          scores,
          variance: Number(variance.toFixed(2)),
          suggestion: '请检查是否存在理解偏差或填写错误',
        })
      }
    }

    return conflicts
  }

  /**
   * 检测跨聚类冲突（前置依赖缺失）
   */
  private detectInterClusterConflicts(clusterMaturity: ClusterMaturity[]) {
    // 定义依赖规则
    const conflictRules = [
      {
        ruleId: 'R001',
        prerequisite: { keywords: ['组织架构', '职责'], minLevel: 2.0 },
        dependent: { keywords: ['策略', '制度'], minLevel: 3.0 },
        description: '组织架构和职责不清晰的情况下，策略制度成熟度过高不合理',
      },
      {
        ruleId: 'R002',
        prerequisite: { keywords: ['分类分级'], minLevel: 2.0 },
        dependent: { keywords: ['加密', '存储安全'], minLevel: 3.5 },
        description: '未建立数据分类分级体系，但加密和存储安全成熟度过高存在矛盾',
      },
      {
        ruleId: 'R003',
        prerequisite: { keywords: ['策略', '文化'], minLevel: 2.0 },
        dependent: { keywords: ['培训', '意识'], minLevel: 3.5 },
        description: '安全策略和文化缺失，但培训和意识成熟度过高不合逻辑',
      },
      {
        ruleId: 'R004',
        prerequisite: { keywords: ['数据收集', '来源'], minLevel: 2.0 },
        dependent: { keywords: ['数据使用', '加工'], minLevel: 3.5 },
        description: '数据收集和来源管理薄弱，但数据使用和加工管理成熟度过高',
      },
      {
        ruleId: 'R005',
        prerequisite: { keywords: ['监管', '报告'], minLevel: 1.5 },
        dependent: { keywords: ['审计', '监督'], minLevel: 3.5 },
        description: '未建立监管报告机制，但内部审计和监督成熟度过高',
      },
      {
        ruleId: 'R006',
        prerequisite: { keywords: ['事件', '应急'], minLevel: 1.5 },
        dependent: { keywords: ['日志', '审计'], minLevel: 3.5 },
        description: '应急响应机制缺失，但日志和审计成熟度过高不匹配',
      },
    ]

    const conflicts = []

    for (const rule of conflictRules) {
      // 查找前置聚类（匹配任一关键词即可）
      const prerequisiteCluster = clusterMaturity.find((c) =>
        rule.prerequisite.keywords.some(keyword => c.cluster_name.includes(keyword))
      )

      // 查找依赖聚类（匹配任一关键词即可）
      const dependentCluster = clusterMaturity.find((c) =>
        rule.dependent.keywords.some(keyword => c.cluster_name.includes(keyword))
      )

      if (prerequisiteCluster && dependentCluster && prerequisiteCluster.cluster_id !== dependentCluster.cluster_id) {
        // 前置条件成熟度过低 && 依赖项成熟度过高 = 冲突
        if (
          prerequisiteCluster.maturityLevel < rule.prerequisite.minLevel &&
          dependentCluster.maturityLevel >= rule.dependent.minLevel
        ) {
          conflicts.push({
            ruleId: rule.ruleId,
            conflictType: 'PREREQUISITE_MISSING',
            description: rule.description,
            prerequisiteCluster: {
              cluster_id: prerequisiteCluster.cluster_id,
              cluster_name: prerequisiteCluster.cluster_name,
              maturityLevel: prerequisiteCluster.maturityLevel,
            },
            dependentCluster: {
              cluster_id: dependentCluster.cluster_id,
              cluster_name: dependentCluster.cluster_name,
              maturityLevel: dependentCluster.maturityLevel,
            },
            suggestion: `建议先提升"${prerequisiteCluster.cluster_name}"的成熟度（当前${prerequisiteCluster.maturityLevel.toFixed(2)}），再考虑"${dependentCluster.cluster_name}"的高成熟度（当前${dependentCluster.maturityLevel.toFixed(2)}）`,
          })
        }
      }
    }

    return conflicts
  }

  /**
   * 获取TOP N短板
   */
  private getTopShortcomings(clusterMaturity: ClusterMaturity[], n: number) {
    const shortcomings = clusterMaturity
      .filter((c) => c.isShortcoming)
      .sort((a, b) => a.maturityLevel - b.maturityLevel)
      .slice(0, n)

    const avgMaturity =
      clusterMaturity.reduce((sum, c) => sum + c.maturityLevel, 0) / clusterMaturity.length

    return shortcomings.map((c, index) => ({
      rank: index + 1,
      cluster_id: c.cluster_id,
      cluster_name: c.cluster_name,
      maturityLevel: c.maturityLevel,
      gap: Number((avgMaturity - c.maturityLevel).toFixed(2)),
    }))
  }

  /**
   * 获取TOP N优势
   */
  private getTopStrengths(clusterMaturity: ClusterMaturity[], n: number) {
    const strengths = clusterMaturity
      .filter((c) => !c.isShortcoming)
      .sort((a, b) => b.maturityLevel - a.maturityLevel)
      .slice(0, n)

    const avgMaturity =
      clusterMaturity.reduce((sum, c) => sum + c.maturityLevel, 0) / clusterMaturity.length

    return strengths.map((c, index) => ({
      rank: index + 1,
      cluster_id: c.cluster_id,
      cluster_name: c.cluster_name,
      maturityLevel: c.maturityLevel,
      advantage: Number((c.maturityLevel - avgMaturity).toFixed(2)),
    }))
  }

  /**
   * 计算统计数据
   */
  private calculateStatistics(clusterMaturity: ClusterMaturity[], totalQuestions: number) {
    const maturityLevels = clusterMaturity.map((c) => c.maturityLevel)
    const average = maturityLevels.reduce((sum, l) => sum + l, 0) / maturityLevels.length
    const stdDev = this.calculateStandardDeviation(maturityLevels)

    return {
      totalQuestions,
      answeredQuestions: totalQuestions,
      totalClusters: clusterMaturity.length,
      shortcomingClusters: clusterMaturity.filter((c) => c.isShortcoming).length,
      strengthClusters: clusterMaturity.filter((c) => !c.isShortcoming).length,
      averageClusterMaturity: Number(average.toFixed(2)),
      minClusterMaturity: Number(Math.min(...maturityLevels).toFixed(2)),
      maxClusterMaturity: Number(Math.max(...maturityLevels).toFixed(2)),
      clusterMaturityStdDev: Number(stdDev.toFixed(2)),
      maturityRange: Number(
        (Math.max(...maturityLevels) - Math.min(...maturityLevels)).toFixed(2),
      ),
    }
  }

  /**
   * 计算标准差
   */
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2))
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length
    return Math.sqrt(variance)
  }

  /**
   * 计算方差
   */
  private calculateVariance(scores: number[]): number {
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length
    return variance
  }

  /**
   * 获取成熟度等级
   */
  private getGrade(maturityLevel: number): string {
    if (maturityLevel < 2) return '初始级'
    if (maturityLevel < 3) return '初步规范级'
    if (maturityLevel < 4) return '充分规范级'
    if (maturityLevel < 4.5) return '量化管理级'
    return '卓越级'
  }

  /**
   * 获取等级描述
   */
  private getGradeDescription(grade: string, maturityLevel: number): string {
    const descriptions = {
      初始级: '企业数据安全管理处于起步阶段，缺乏系统化管理',
      初步规范级: '企业已建立基本的数据安全管理框架，但仍有较多短板需要改进',
      充分规范级: '企业数据安全管理体系较为完善，达到行业平均水平',
      量化管理级: '企业数据安全管理精细化程度高，接近行业领先水平',
      卓越级: '企业数据安全管理达到行业卓越水平，具备持续优化能力',
    }
    return descriptions[grade] || ''
  }
}
