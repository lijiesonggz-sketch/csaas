import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  ComplianceCase,
  ComplianceCaseClauseCandidate,
} from '../../../database/entities/compliance-case.entity'
import { RegulationClause } from '../../../database/entities/regulation-clause.entity'
import {
  extractViolationThemesFromText,
  isWeakTheme,
  tokenizeText,
} from './case-theme.utils'
import { CaseThemeIntelligenceService } from './case-theme-intelligence.service'
import { TaxonomyClassifierService } from './taxonomy-classification/taxonomy-classifier.service'

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
    private readonly caseThemeIntelligenceService: CaseThemeIntelligenceService,
    private readonly taxonomyClassifierService: TaxonomyClassifierService,
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

      let violationThemes = extractViolationThemesFromText(sourceText)

      if (this.shouldUseLlmRefinement(violationThemes)) {
        const refinedThemes = await this.caseThemeIntelligenceService.refineViolationThemes(
          sourceText,
          violationThemes,
        )

        if (refinedThemes && refinedThemes.length > 0) {
          violationThemes = refinedThemes
        }
      }

      const clauseCandidates = await this.findClauseCandidates(sourceText, violationThemes)
      const taxonomyClassification = this.taxonomyClassifierService.classifyCaseText({
        rawText: sourceText,
        caseFacts: caseRecord.caseFacts,
        penaltyReason: caseRecord.penaltyReason,
        preferredL1Code: 'IT04',
      })
      const primaryClassification =
        taxonomyClassification.pathDecision === 'PRIMARY_CHAIN'
          ? taxonomyClassification
          : null

      caseRecord.violationThemes = violationThemes
      caseRecord.clauseCandidates = clauseCandidates
      caseRecord.l1Code = primaryClassification?.l1Code ?? null
      caseRecord.l2Code = primaryClassification?.l2Code ?? null
      caseRecord.confidenceScore =
        primaryClassification == null
          ? null
          : primaryClassification.confidenceScore.toFixed(4)
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

  private shouldUseLlmRefinement(violationThemes: string[]): boolean {
    if (violationThemes.length === 0) {
      return true
    }

    return violationThemes.every((theme) => isWeakTheme(theme) || theme.length <= 4)
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
    return tokenizeText(text)
  }
}
