import { Injectable } from '@nestjs/common'
import { TaxonomyClassifierService } from './taxonomy-classification/taxonomy-classifier.service'
import type { TaxonomyClassificationResult } from './taxonomy-classification/contracts/classification-result.contract'

export type It04TaxonomyClassification = {
  l1Code: 'IT04'
  l2Code: string
  l2Name: string
  score: number
  scoreGap: number
  decisionSource: 'rule' | 'semantic' | 'hybrid'
  matchedPhrases: string[]
  matchedTokens: string[]
}

@Injectable()
export class It04TaxonomyClassifierService {
  constructor(
    private readonly taxonomyClassifierService: TaxonomyClassifierService,
  ) {}

  classifyCaseText(caseText: string): It04TaxonomyClassification | null {
    const result = this.taxonomyClassifierService.classifyCaseText({
      rawText: caseText,
      preferredL1Code: 'IT04',
    })

    return this.toIt04Classification(result)
  }

  private toIt04Classification(
    result: TaxonomyClassificationResult,
  ): It04TaxonomyClassification | null {
    if (
      result.pathDecision !== 'PRIMARY_CHAIN' ||
      result.l1Code !== 'IT04' ||
      !result.l2Code ||
      !result.l2Name ||
      result.decisionSource === 'none'
    ) {
      return null
    }

    return {
      l1Code: 'IT04',
      l2Code: result.l2Code,
      l2Name: result.l2Name,
      score: result.score,
      scoreGap: result.scoreGap,
      decisionSource: result.decisionSource,
      matchedPhrases: result.matchedPhrases,
      matchedTokens: result.matchedTokens,
    }
  }
}
