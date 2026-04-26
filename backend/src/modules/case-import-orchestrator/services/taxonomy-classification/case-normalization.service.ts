import { Injectable } from '@nestjs/common'
import {
  extractViolationThemesFromText,
  tokenizeText,
} from '../case-text-normalization.utils'
import type {
  NormalizedTaxonomyClassificationInput,
  TaxonomyClassificationInput,
} from './contracts/classification-result.contract'

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, '').trim()
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)))
}

@Injectable()
export class CaseNormalizationService {
  normalize(input: TaxonomyClassificationInput): NormalizedTaxonomyClassificationInput {
    const caseFacts = input.caseFacts ?? null
    const penaltyReason = input.penaltyReason ?? null
    const rawText = input.rawText.trim()
    const mergedText =
      rawText.length > 0
        ? rawText
        : [caseFacts, penaltyReason].filter((value): value is string => Boolean(value)).join('；')

    const normalizedText = normalizeWhitespace(mergedText)
    const normalizedTokens = dedupe(tokenizeText(mergedText).filter((token) => token.length >= 2))
    const normalizedPhrases = dedupe(extractViolationThemesFromText(mergedText)).slice(0, 8)

    return {
      rawText,
      caseFacts,
      penaltyReason,
      mergedText,
      normalizedText,
      normalizedTokens,
      normalizedPhrases,
    }
  }
}
