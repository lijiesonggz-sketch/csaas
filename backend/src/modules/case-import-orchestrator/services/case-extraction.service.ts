import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  ComplianceCase,
  ComplianceCaseClauseCandidate,
} from '../../../database/entities/compliance-case.entity'
import { RegulationClause } from '../../../database/entities/regulation-clause.entity'

export type CaseExtractionBatchResult = {
  batchId: string
  processedCount: number
  skippedCount: number
}

@Injectable()
export class CaseExtractionService {
  constructor(
    @InjectRepository(ComplianceCase)
    private readonly complianceCaseRepository: Repository<ComplianceCase>,
    @InjectRepository(RegulationClause)
    private readonly regulationClauseRepository: Repository<RegulationClause>,
  ) {}

  async extractBatch(batchId: string): Promise<CaseExtractionBatchResult> {
    const cases = await this.complianceCaseRepository.find({
      where: {
        importBatchId: batchId,
        status: 'pending',
      },
      order: {
        createdAt: 'ASC',
      },
    })

    let processedCount = 0

    for (const caseRecord of cases) {
      const sourceText = [caseRecord.penaltyReason, caseRecord.caseFacts]
        .filter((value): value is string => Boolean(value))
        .join('；')

      const violationThemes = this.extractViolationThemes(sourceText)
      const clauseCandidates = await this.findClauseCandidates(sourceText, violationThemes)

      caseRecord.violationThemes = violationThemes
      caseRecord.clauseCandidates = clauseCandidates
      caseRecord.extractedAt = new Date()
      caseRecord.status = 'extracted'

      await this.complianceCaseRepository.save(caseRecord)
      processedCount += 1
    }

    return {
      batchId,
      processedCount,
      skippedCount: 0,
    }
  }

  private extractViolationThemes(text: string): string[] {
    const fragments = text
      .split(/[；;。.\n，,、]/)
      .map((fragment) => fragment.replace(/\s+/g, '').trim())
      .filter((fragment) => fragment.length >= 4)

    const themes = Array.from(new Set(fragments.map((fragment) => fragment.slice(0, 24)))).slice(
      0,
      5,
    )

    if (themes.length > 0) {
      return themes
    }

    const fallbackKeywords = this.extractKeywords(text).slice(0, 5)
    return fallbackKeywords.length > 0 ? fallbackKeywords : ['待人工确认']
  }

  private async findClauseCandidates(
    sourceText: string,
    violationThemes: string[],
  ): Promise<ComplianceCaseClauseCandidate[]> {
    const keywords = this.extractKeywords(`${sourceText} ${violationThemes.join(' ')}`)

    if (keywords.length === 0) {
      return []
    }

    const clauses = await this.regulationClauseRepository.find({
      take: 50,
      order: {
        updatedAt: 'DESC',
      },
    })

    return clauses
      .map((clause) => {
        const haystack = [
          clause.clauseCode,
          clause.clauseSummary,
          clause.clauseText,
          ...(clause.keywords ?? []),
        ]
          .filter((value): value is string => Boolean(value))
          .join(' ')

        const matchedKeywords = keywords.filter((keyword) => haystack.includes(keyword))

        if (matchedKeywords.length === 0) {
          return null
        }

        return {
          clauseId: clause.clauseId,
          clauseCode: clause.clauseCode,
          summary: clause.clauseSummary,
          matchedKeywords,
          confidenceScore: Number(Math.min(1, 0.35 + matchedKeywords.length * 0.15).toFixed(2)),
        } satisfies ComplianceCaseClauseCandidate
      })
      .filter((candidate): candidate is ComplianceCaseClauseCandidate => candidate !== null)
      .sort(
        (left, right) =>
          right.matchedKeywords.length - left.matchedKeywords.length ||
          right.confidenceScore - left.confidenceScore,
      )
      .slice(0, 5)
  }

  private extractKeywords(text: string): string[] {
    const matches =
      text.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,12}/g)?.map((token) => token.trim()) ?? []
    const stopwords = new Set(['以及', '按照', '根据', '存在', '相关', '要求', '进行', '落实'])

    return Array.from(
      new Set(
        matches
          .flatMap((token) => {
            const stripped = token
              .replace(/(不到位|缺失|未及时|未按|未|不|违规|失败|薄弱|问题)/g, '')
              .trim()

            return [
              token,
              stripped,
              stripped.length >= 4 ? stripped.slice(0, 4) : null,
              stripped.length >= 6 ? stripped.slice(0, 6) : null,
              token.includes('可疑交易') ? '可疑交易' : null,
            ]
          })
          .filter(
            (token): token is string =>
              Boolean(token) && !stopwords.has(token) && token.length >= 2,
          ),
      ),
    )
  }
}
