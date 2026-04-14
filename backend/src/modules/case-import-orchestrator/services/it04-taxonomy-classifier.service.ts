import { Injectable } from '@nestjs/common'
import {
  classifyIt04CaseText,
  It04ClassificationResult,
  loadIt04TaxonomyMappings,
  It04TaxonomySemanticMapping,
} from './it04-benchmark.runner'

export type It04TaxonomyClassification = It04ClassificationResult & {
  l1Code: 'IT04'
}

@Injectable()
export class It04TaxonomyClassifierService {
  private readonly mappings: It04TaxonomySemanticMapping[]

  constructor() {
    this.mappings = loadIt04TaxonomyMappings()
  }

  classifyCaseText(caseText: string): It04TaxonomyClassification | null {
    const trimmed = caseText.trim()
    if (!trimmed) {
      return null
    }

    const result = classifyIt04CaseText(trimmed, this.mappings)

    if (!this.isConfident(result)) {
      return null
    }

    return {
      ...result,
      l1Code: 'IT04',
    }
  }

  private isConfident(result: It04ClassificationResult): boolean {
    if (result.decisionSource === 'rule') {
      return result.score >= 4
    }

    const phraseCount = result.matchedPhrases.length
    return result.score >= 6 && phraseCount > 0 && result.scoreGap >= 2
  }
}
