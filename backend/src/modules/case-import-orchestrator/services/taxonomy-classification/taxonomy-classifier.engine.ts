import { Injectable } from '@nestjs/common'
import type {
  TaxonomyClassificationResult,
  TaxonomyClassifierEngineArgs,
  TaxonomyMappingRecord,
  TaxonomyRulebook,
} from './contracts/classification-result.contract'

type RuleMatch = {
  l2Code: string
  score: number
  matchedSignals: string[]
}

type SemanticMatch = {
  mapping: TaxonomyMappingRecord
  score: number
  matchedPhrases: string[]
  matchedTokens: string[]
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)))
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, '').trim()
}

@Injectable()
export class TaxonomyClassifierEngine {
  classify(args: TaxonomyClassifierEngineArgs): TaxonomyClassificationResult {
    const {
      input,
      mappings,
      rulebook,
      activeProfile,
      classifierVersion,
      mappingVersion,
      classifiedAt,
    } = args

    if (input.normalizedText.length === 0) {
      return this.buildTerminalResult({
        l1Code: activeProfile.l1Code,
        classifierVersion,
        mappingVersion,
        rulebookVersion: activeProfile.rulebookVersion,
        classifiedAt,
        score: 0,
        scoreGap: 0,
        decisionSource: 'none',
        matchedSignals: [],
        matchedTokens: [],
        pathDecision: 'UNCLASSIFIED',
        failureSemantics: 'NO_MATCH',
      })
    }

    if (mappings.length === 0) {
      return this.buildTerminalResult({
        l1Code: activeProfile.l1Code,
        classifierVersion,
        mappingVersion,
        rulebookVersion: activeProfile.rulebookVersion,
        classifiedAt,
        score: 0,
        scoreGap: 0,
        decisionSource: 'none',
        matchedSignals: [],
        matchedTokens: [],
        pathDecision: 'UNCLASSIFIED',
        failureSemantics: 'MAPPING_MISSING',
      })
    }

    const ruleMatches = this.scoreRuleSignals(input.mergedText, rulebook).sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.l2Code.localeCompare(right.l2Code)
    })
    const semanticMatches = this.scoreSemanticMappings(
      input.normalizedText,
      input.normalizedTokens,
      mappings,
      rulebook?.fallbackBucket ?? activeProfile.fallbackBucket ?? null,
    )

    const bestRule = ruleMatches[0]
    const secondRule = ruleMatches[1]
    if (bestRule && bestRule.score >= activeProfile.primaryThreshold) {
      const mapped = mappings.find((mapping) => mapping.l2Code === bestRule.l2Code)
      return this.buildPrimaryResult({
        l1Code: activeProfile.l1Code,
        l2Code: bestRule.l2Code,
        l2Name: mapped?.l2Name ?? bestRule.l2Code,
        score: bestRule.score,
        scoreGap: Number((bestRule.score - (secondRule?.score ?? 0)).toFixed(2)),
        decisionSource: 'rule',
        matchedSignals: bestRule.matchedSignals,
        matchedTokens: [],
        classifierVersion,
        mappingVersion,
        rulebookVersion: rulebook?.version ?? activeProfile.rulebookVersion,
        classifiedAt,
      })
    }

    const bestSemantic = semanticMatches[0]
    const secondSemantic = semanticMatches[1]

    if (!bestSemantic || bestSemantic.score <= 0) {
      return this.buildTerminalResult({
        l1Code: activeProfile.l1Code,
        classifierVersion,
        mappingVersion,
        rulebookVersion: rulebook?.version ?? activeProfile.rulebookVersion,
        classifiedAt,
        score: 0,
        scoreGap: 0,
        decisionSource: 'none',
        matchedSignals: [],
        matchedTokens: [],
        pathDecision: 'UNCLASSIFIED',
        failureSemantics: 'NO_MATCH',
      })
    }

    const semanticScoreGap = Number(
      (bestSemantic.score - (secondSemantic?.score ?? 0)).toFixed(2),
    )
    const hasPrimarySemanticConfidence =
      bestSemantic.score >= activeProfile.semanticThreshold &&
      semanticScoreGap >= activeProfile.minimumScoreGap &&
      bestSemantic.matchedPhrases.length >= activeProfile.minimumPhraseHits

    if (hasPrimarySemanticConfidence) {
      return this.buildPrimaryResult({
        l1Code: bestSemantic.mapping.l1Code,
        l2Code: bestSemantic.mapping.l2Code,
        l2Name: bestSemantic.mapping.l2Name,
        score: bestSemantic.score,
        scoreGap: semanticScoreGap,
        decisionSource: 'semantic',
        matchedSignals: bestSemantic.matchedPhrases,
        matchedTokens: bestSemantic.matchedTokens,
        classifierVersion,
        mappingVersion,
        rulebookVersion: rulebook?.version ?? activeProfile.rulebookVersion,
        classifiedAt,
      })
    }

    return this.buildTerminalResult({
      l1Code: activeProfile.l1Code,
      classifierVersion,
      mappingVersion,
      rulebookVersion: rulebook?.version ?? activeProfile.rulebookVersion,
      classifiedAt,
      score: bestSemantic.score,
      scoreGap: semanticScoreGap,
      decisionSource: bestSemantic.matchedPhrases.length > 0 ? 'semantic' : 'none',
      matchedSignals: bestSemantic.matchedPhrases,
      matchedTokens: bestSemantic.matchedTokens,
      pathDecision: 'ABSTAIN',
      failureSemantics: 'LOW_CONFIDENCE',
    })
  }

  private scoreRuleSignals(caseText: string, rulebook?: TaxonomyRulebook | null): RuleMatch[] {
    if (!rulebook) {
      return []
    }

    return rulebook.entries
      .map((entry) => {
        const matchedSignals: string[] = []
        let score = 0
        for (const signal of entry.signals) {
          if (signal.pattern.test(caseText)) {
            matchedSignals.push(signal.label)
            score += signal.weight
          }
        }

        return {
          l2Code: entry.l2Code,
          score,
          matchedSignals,
        }
      })
      .filter((entry) => entry.score > 0)
  }

  private scoreSemanticMappings(
    normalizedText: string,
    textTokens: string[],
    mappings: TaxonomyMappingRecord[],
    fallbackBucketCode: string | null,
  ): SemanticMatch[] {
    return mappings
      .map((mapping) => {
        const phrases = dedupe([
          mapping.l2Name,
          mapping.canonicalTheme,
          mapping.definition,
          ...mapping.aliases,
          ...mapping.keywords,
        ]).filter((phrase) => phrase.length >= 2)

        const matchedPhrases = phrases.filter((phrase) =>
          normalizedText.includes(normalizeWhitespace(phrase)),
        )
        const mappingTokens = new Set(
          dedupe(
            phrases
              .flatMap((phrase) => phrase.split(/[\s/|、，,；;。！？!]+/))
              .map((token) => normalizeWhitespace(token))
              .filter((token) => token.length >= 2),
          ),
        )
        const matchedTokens = dedupe(textTokens.filter((token) => mappingTokens.has(token)))

        let score = 0
        score += matchedPhrases.reduce(
          (sum, phrase) => sum + (normalizeWhitespace(phrase).length >= 6 ? 4 : 2),
          0,
        )
        score += matchedTokens.length * 0.5

        if (normalizedText.includes(normalizeWhitespace(mapping.l2Name))) {
          score += 3
        }
        if (
          mapping.canonicalTheme &&
          normalizedText.includes(normalizeWhitespace(mapping.canonicalTheme))
        ) {
          score += 2
        }

        if (fallbackBucketCode && mapping.l2Code === fallbackBucketCode) {
          score -= 1.5
        }

        return {
          mapping,
          score,
          matchedPhrases: matchedPhrases.slice(0, 8),
          matchedTokens: matchedTokens.slice(0, 10),
        }
      })
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }

        if (right.matchedPhrases.length !== left.matchedPhrases.length) {
          return right.matchedPhrases.length - left.matchedPhrases.length
        }

        if (fallbackBucketCode && left.mapping.l2Code === fallbackBucketCode) {
          return 1
        }
        if (fallbackBucketCode && right.mapping.l2Code === fallbackBucketCode) {
          return -1
        }

        return left.mapping.l2Code.localeCompare(right.mapping.l2Code)
      })
  }

  private buildPrimaryResult(args: {
    l1Code: string
    l2Code: string
    l2Name: string
    score: number
    scoreGap: number
    decisionSource: 'rule' | 'semantic'
    matchedSignals: string[]
    matchedTokens: string[]
    classifierVersion: string
    mappingVersion: string
    rulebookVersion: string
    classifiedAt: string
  }): TaxonomyClassificationResult {
    return {
      l1Code: args.l1Code,
      l2Code: args.l2Code,
      l2Name: args.l2Name,
      score: Number(args.score.toFixed(2)),
      confidenceScore: Number(args.score.toFixed(2)),
      scoreGap: Number(args.scoreGap.toFixed(2)),
      decisionSource: args.decisionSource,
      matchedSignals: [...args.matchedSignals],
      matchedPhrases: [...args.matchedSignals],
      matchedTokens: [...args.matchedTokens],
      classifierVersion: args.classifierVersion,
      mappingVersion: args.mappingVersion,
      rulebookVersion: args.rulebookVersion,
      classifiedAt: args.classifiedAt,
      pathDecision: 'PRIMARY_CHAIN',
      failureSemantics: null,
    }
  }

  private buildTerminalResult(args: {
    l1Code: string | null
    classifierVersion: string
    mappingVersion: string
    rulebookVersion: string
    classifiedAt: string
    score: number
    scoreGap: number
    decisionSource: 'rule' | 'semantic' | 'none'
    matchedSignals: string[]
    matchedTokens: string[]
    pathDecision: 'ABSTAIN' | 'UNCLASSIFIED'
    failureSemantics:
      | 'LOW_CONFIDENCE'
      | 'NO_MATCH'
      | 'MAPPING_MISSING'
      | 'ENGINE_ERROR'
      | 'UNSUPPORTED_DOMAIN'
  }): TaxonomyClassificationResult {
    return {
      l1Code: args.l1Code,
      l2Code: null,
      l2Name: null,
      score: Number(args.score.toFixed(2)),
      confidenceScore: Number(args.score.toFixed(2)),
      scoreGap: Number(args.scoreGap.toFixed(2)),
      decisionSource: args.decisionSource,
      matchedSignals: [...args.matchedSignals],
      matchedPhrases: [...args.matchedSignals],
      matchedTokens: [...args.matchedTokens],
      classifierVersion: args.classifierVersion,
      mappingVersion: args.mappingVersion,
      rulebookVersion: args.rulebookVersion,
      classifiedAt: args.classifiedAt,
      pathDecision: args.pathDecision,
      failureSemantics: args.failureSemantics,
    }
  }
}
