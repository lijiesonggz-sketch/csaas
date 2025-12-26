import { Injectable, Logger } from '@nestjs/common'

/**
 * 高风险条款接口
 */
export interface HighRiskClause {
  clause_id: string
  clause_text: string
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_reasons: string[] // 触发高风险的原因
}

/**
 * 高风险识别结果
 */
export interface HighRiskIdentificationResult {
  high_risk_clauses: HighRiskClause[]
  medium_risk_clauses: HighRiskClause[]
  low_risk_clauses: HighRiskClause[]
  statistics: {
    total: number
    high: number
    medium: number
    low: number
  }
}

/**
 * 高风险条款识别器
 * 根据关键词、章节编号、行业等规则识别高风险条款
 */
@Injectable()
export class HighRiskClauseIdentifier {
  private readonly logger = new Logger(HighRiskClauseIdentifier.name)

  // 高风险关键词（中英文）
  private readonly HIGH_RISK_KEYWORDS = [
    // 中文关键词
    '安全',
    '合规',
    '法律',
    '责任',
    '数据保护',
    '访问控制',
    '审计',
    '监管',
    '风险',
    '违规',
    '处罚',
    '泄露',
    '备份',
    '恢复',
    '加密',
    '认证',
    '授权',
    '隐私',
    '机密',
    '敏感',
    // 英文关键词
    'security',
    'compliance',
    'legal',
    'liability',
    'protection',
    'access control',
    'audit',
    'regulation',
    'risk',
    'violation',
    'penalty',
    'breach',
    'backup',
    'recovery',
    'encryption',
    'authentication',
    'authorization',
    'privacy',
    'confidential',
    'sensitive',
  ]

  // 中等风险关键词
  private readonly MEDIUM_RISK_KEYWORDS = [
    '管理',
    '流程',
    '文档',
    '培训',
    '监控',
    '评估',
    '测试',
    '变更',
    '配置',
    '部署',
    'management',
    'process',
    'documentation',
    'training',
    'monitoring',
    'assessment',
    'testing',
    'change',
    'configuration',
    'deployment',
  ]

  // 高风险章节模式（ISO 27001、等保、COBIT等）
  private readonly HIGH_RISK_CHAPTER_PATTERNS = [
    /^[5-8]\.\d+/, // ISO 27001 第5-8章（核心控制）
    /^A\.[5-9]\.\d+/, // ISO 27001 附录A 第5-9章
    /^7\.\d+/, // 等保2.0 第7章（安全技术要求）
    /^8\.\d+/, // 等保2.0 第8章（安全管理要求）
    /^3\.\d+/, // COBIT 第3章（合规）
  ]

  /**
   * 识别条款的风险级别
   * @param clauses 条款列表
   * @returns 高风险识别结果
   */
  identifyHighRiskClauses(
    clauses: Array<{
      clause_id: string
      clause_text: string
      source_document_name?: string
    }>,
  ): HighRiskIdentificationResult {
    this.logger.log(`Identifying high-risk clauses for ${clauses.length} clauses...`)

    const highRiskClauses: HighRiskClause[] = []
    const mediumRiskClauses: HighRiskClause[] = []
    const lowRiskClauses: HighRiskClause[] = []

    for (const clause of clauses) {
      const riskAssessment = this.assessClauseRisk(clause)

      if (riskAssessment.risk_level === 'HIGH') {
        highRiskClauses.push(riskAssessment)
      } else if (riskAssessment.risk_level === 'MEDIUM') {
        mediumRiskClauses.push(riskAssessment)
      } else {
        lowRiskClauses.push(riskAssessment)
      }
    }

    const result: HighRiskIdentificationResult = {
      high_risk_clauses: highRiskClauses,
      medium_risk_clauses: mediumRiskClauses,
      low_risk_clauses: lowRiskClauses,
      statistics: {
        total: clauses.length,
        high: highRiskClauses.length,
        medium: mediumRiskClauses.length,
        low: lowRiskClauses.length,
      },
    }

    this.logger.log(
      `High-risk identification completed: HIGH=${result.statistics.high}, MEDIUM=${result.statistics.medium}, LOW=${result.statistics.low}`,
    )

    return result
  }

  /**
   * 评估单个条款的风险级别
   * @param clause 条款信息
   * @returns 风险评估结果
   */
  private assessClauseRisk(clause: {
    clause_id: string
    clause_text: string
    source_document_name?: string
  }): HighRiskClause {
    const risk_reasons: string[] = []
    let riskScore = 0

    // 1. 检查高风险关键词
    const highRiskKeywordCount = this.countKeywordMatches(
      clause.clause_text,
      this.HIGH_RISK_KEYWORDS,
    )

    if (highRiskKeywordCount > 0) {
      riskScore += highRiskKeywordCount * 3 // 每个高风险关键词加3分
      risk_reasons.push(`包含${highRiskKeywordCount}个高风险关键词`)
    }

    // 2. 检查中等风险关键词
    const mediumRiskKeywordCount = this.countKeywordMatches(
      clause.clause_text,
      this.MEDIUM_RISK_KEYWORDS,
    )

    if (mediumRiskKeywordCount > 0) {
      riskScore += mediumRiskKeywordCount * 1 // 每个中等风险关键词加1分
      risk_reasons.push(`包含${mediumRiskKeywordCount}个管理关键词`)
    }

    // 3. 检查章节编号
    if (this.isHighRiskChapter(clause.clause_id)) {
      riskScore += 5 // 高风险章节加5分
      risk_reasons.push('属于高风险章节（核心控制/合规章节）')
    }

    // 4. 检查特定标准的高风险标识
    if (clause.source_document_name) {
      if (this.isHighRiskByStandard(clause.clause_id, clause.source_document_name)) {
        riskScore += 3
        risk_reasons.push(`${clause.source_document_name}标准的关键条款`)
      }
    }

    // 5. 确定风险级别
    let risk_level: 'HIGH' | 'MEDIUM' | 'LOW'

    if (riskScore >= 8 || risk_reasons.length >= 2) {
      risk_level = 'HIGH'
    } else if (riskScore >= 3 || risk_reasons.length >= 1) {
      risk_level = 'MEDIUM'
    } else {
      risk_level = 'LOW'
      risk_reasons.push('无明显风险标识')
    }

    return {
      clause_id: clause.clause_id,
      clause_text: clause.clause_text,
      risk_level,
      risk_reasons,
    }
  }

  /**
   * 计算文本中匹配的关键词数量
   * @param text 文本内容
   * @param keywords 关键词列表
   * @returns 匹配数量
   */
  private countKeywordMatches(text: string, keywords: string[]): number {
    const lowerText = text.toLowerCase()
    let count = 0

    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        count++
      }
    }

    return count
  }

  /**
   * 判断章节编号是否属于高风险章节
   * @param clauseId 条款ID
   * @returns 是否高风险章节
   */
  private isHighRiskChapter(clauseId: string): boolean {
    for (const pattern of this.HIGH_RISK_CHAPTER_PATTERNS) {
      if (pattern.test(clauseId)) {
        return true
      }
    }
    return false
  }

  /**
   * 根据标准判断是否高风险
   * @param clauseId 条款ID
   * @param standardName 标准名称
   * @returns 是否高风险
   */
  private isHighRiskByStandard(clauseId: string, standardName: string): boolean {
    const lowerStandardName = standardName.toLowerCase()

    // ISO 27001 特定高风险条款
    if (lowerStandardName.includes('iso') && lowerStandardName.includes('27001')) {
      // 附录A的核心控制
      if (clauseId.match(/^A\.(5|6|7|8|9|10|11|12|13|14)\.\d+/)) {
        return true
      }
    }

    // 等保2.0 特定高风险条款
    if (lowerStandardName.includes('等保')) {
      // 第7、8章（安全技术和管理要求）
      if (clauseId.match(/^[78]\.\d+/)) {
        return true
      }
    }

    // COBIT 特定高风险条款
    if (lowerStandardName.includes('cobit')) {
      // 第3章（合规）、第4章（治理）
      if (clauseId.match(/^[34]\.\d+/)) {
        return true
      }
    }

    return false
  }

  /**
   * 生成高风险识别详细报告
   */
  generateDetailedReport(result: HighRiskIdentificationResult): string {
    const lines: string[] = []

    lines.push(`=== High-Risk Clause Identification Report ===\n`)

    // 统计信息
    lines.push(`Statistics:`)
    lines.push(`  Total Clauses: ${result.statistics.total}`)
    lines.push(
      `  High Risk: ${result.statistics.high} (${((result.statistics.high / result.statistics.total) * 100).toFixed(1)}%)`,
    )
    lines.push(
      `  Medium Risk: ${result.statistics.medium} (${((result.statistics.medium / result.statistics.total) * 100).toFixed(1)}%)`,
    )
    lines.push(
      `  Low Risk: ${result.statistics.low} (${((result.statistics.low / result.statistics.total) * 100).toFixed(1)}%)\n`,
    )

    // 高风险条款详情
    if (result.high_risk_clauses.length > 0) {
      lines.push(`High Risk Clauses (requires mandatory review):`)
      result.high_risk_clauses.forEach((clause, index) => {
        lines.push(`\n  ${index + 1}. ${clause.clause_id}`)
        lines.push(`     Reasons: ${clause.risk_reasons.join('; ')}`)
        lines.push(`     Text: ${clause.clause_text.substring(0, 100)}...`)
      })
    }

    return lines.join('\n')
  }
}
