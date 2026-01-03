import { Injectable, Logger } from '@nestjs/common'
import {
  SimilarityCalculator,
} from './validators/similarity.calculator'
import {
  ConsistencyValidator,
  ConsistencyReport,
  ValidationResult,
} from './validators/consistency.validator'
import {
  CoverageChecker,
  CoverageReport,
  ClusteringResult,
} from './validators/coverage.checker'

export interface QualityScores {
  structural: number
  semantic: number
  detail: number
}

export interface FullValidationReport {
  qualityScores: QualityScores
  consistencyReport: ConsistencyReport
  coverageReport?: CoverageReport // 仅聚类任务需要
  overallScore: number
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  passed: boolean
}

/**
 * 质量验证服务
 * 统一的质量验证接口
 */
@Injectable()
export class QualityValidationService {
  private readonly logger = new Logger(QualityValidationService.name)

  constructor(
    private readonly similarityCalculator: SimilarityCalculator,
    private readonly consistencyValidator: ConsistencyValidator,
    private readonly coverageChecker: CoverageChecker,
  ) {}

  /**
   * 执行完整的质量验证（不含覆盖率检查）
   * @param results 三模型的输出结果
   * @returns 验证报告
   */
  async validateQuality(results: ValidationResult): Promise<FullValidationReport> {
    this.logger.log('Starting full quality validation...')

    // 统计成功模型数量
    const successfulCount = [results.gpt4, results.claude, results.domestic].filter(
      (r) => r !== null,
    ).length

    this.logger.log(`Successful models: ${successfulCount}/3`)

    // 一致性验证
    const consistencyReport = await this.consistencyValidator.validate(results)

    // 提取质量分数
    const qualityScores: QualityScores = {
      structural: consistencyReport.structuralScore,
      semantic: consistencyReport.semanticScore,
      detail: consistencyReport.detailScore,
    }

    // 总体分数和置信度（传递成功模型数量）
    const overallScore = consistencyReport.overallScore
    const confidenceLevel = this.consistencyValidator.getConfidenceLevel(
      overallScore,
      successfulCount,
    )

    // 判断是否通过
    const passed = this.consistencyValidator.isPassed(consistencyReport)

    const report: FullValidationReport = {
      qualityScores,
      consistencyReport,
      overallScore,
      confidenceLevel,
      passed,
    }

    this.logger.log(
      `Quality validation completed: overall=${overallScore.toFixed(4)}, confidence=${confidenceLevel}, passed=${passed}`,
    )

    return report
  }

  /**
   * 执行聚类结果的质量验证（含覆盖率检查）
   * @param results 三模型的输出结果
   * @param standardDocument 标准文档原文
   * @returns 验证报告
   */
  async validateClusteringQuality(
    results: ValidationResult,
    standardDocument: string,
  ): Promise<FullValidationReport> {
    this.logger.log('Starting clustering quality validation...')

    // 基础质量验证
    const baseReport = await this.validateQuality(results)

    // 选择最佳聚类结果进行覆盖率检查（简化：使用GPT-4的结果）
    const bestClustering = results.gpt4 as ClusteringResult

    // 覆盖率检查
    const coverageReport = await this.coverageChecker.checkCoverage(
      standardDocument,
      bestClustering,
    )

    // 更新passed状态（需要同时满足一致性和覆盖率要求）
    const coveragePassed = this.coverageChecker.isPassed(coverageReport)
    const passed = baseReport.passed && coveragePassed

    const report: FullValidationReport = {
      ...baseReport,
      coverageReport,
      passed,
    }

    this.logger.log(
      `Clustering validation completed: coverage=${(coverageReport.coverageRate * 100).toFixed(2)}%, passed=${passed}`,
    )

    return report
  }

  /**
   * 单独检查覆盖率
   * @param clusteringResult 聚类结果
   * @param standardDocument 标准文档
   * @returns 覆盖率报告
   */
  async checkCoverage(
    clusteringResult: ClusteringResult,
    standardDocument: string,
  ): Promise<CoverageReport> {
    return this.coverageChecker.checkCoverage(standardDocument, clusteringResult)
  }

  /**
   * 计算语义相似度
   * @param text1 文本1
   * @param text2 文本2
   * @returns 相似度分数
   */
  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    return this.similarityCalculator.calculateSimilarity(text1, text2)
  }

  /**
   * 计算结构相似度
   * @param obj1 对象1
   * @param obj2 对象2
   * @returns 相似度分数
   */
  calculateStructuralSimilarity(
    obj1: Record<string, any>,
    obj2: Record<string, any>,
  ): number {
    return this.similarityCalculator.calculateStructuralSimilarity(obj1, obj2)
  }
}
