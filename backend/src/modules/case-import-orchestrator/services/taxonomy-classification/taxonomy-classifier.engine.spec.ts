import {
  TAXONOMY_CLASSIFIER_ATDD_EXPECTED_RESULT,
  TAXONOMY_CLASSIFIER_ATDD_MAPPING_SHAPE,
  TAXONOMY_CLASSIFIER_ATDD_NORMALIZED_INPUT,
} from '../../testing/taxonomy-classification-atdd.fixtures'
import { TaxonomyClassifierEngine } from './taxonomy-classifier.engine'
import { IT04_DOMAIN_PROFILE } from './profiles/it04.profile'
import { IT04_RULEBOOK } from './rulebooks/it04.rulebook'

describe('TaxonomyClassifierEngine', () => {
  const engine = new TaxonomyClassifierEngine()

  it('should classify normalized IT04 input through rule signals', () => {
    const result = engine.classify({
      input: TAXONOMY_CLASSIFIER_ATDD_NORMALIZED_INPUT,
      mappings: [TAXONOMY_CLASSIFIER_ATDD_MAPPING_SHAPE],
      rulebook: IT04_RULEBOOK,
      activeProfile: IT04_DOMAIN_PROFILE,
      classifierVersion: 'taxonomy-classifier-6.1',
      mappingVersion: '2026-04-07',
      classifiedAt: '2026-04-24T16:00:00.000Z',
    })

    expect(result).toMatchObject({
      l1Code: 'IT04',
      l2Code: TAXONOMY_CLASSIFIER_ATDD_EXPECTED_RESULT.l2Code,
      decisionSource: 'rule',
      pathDecision: 'PRIMARY_CHAIN',
      failureSemantics: null,
    })
    expect(result.scoreGap).toBeGreaterThan(0)
    expect(result.matchedPhrases).toEqual(
      expect.arrayContaining(TAXONOMY_CLASSIFIER_ATDD_EXPECTED_RESULT.matchedSignals),
    )
  })

  it('should abstain when semantic evidence is too weak for primary classification', () => {
    const result = engine.classify({
      input: {
        ...TAXONOMY_CLASSIFIER_ATDD_NORMALIZED_INPUT,
        mergedText: '该问题仅体现一般性信息流程关注不足，缺少可稳定归类的登记补录或更新时效证据。',
        normalizedText: '该问题仅体现一般性信息流程关注不足缺少可稳定归类的登记补录或更新时效证据',
        normalizedTokens: ['信息流程', '关注不足', '时效证据'],
        normalizedPhrases: [],
      },
      mappings: [TAXONOMY_CLASSIFIER_ATDD_MAPPING_SHAPE],
      rulebook: undefined,
      activeProfile: IT04_DOMAIN_PROFILE,
      classifierVersion: 'taxonomy-classifier-6.1',
      mappingVersion: '2026-04-07',
      classifiedAt: '2026-04-24T16:00:00.000Z',
    })

    expect(result.pathDecision).toBe('ABSTAIN')
    expect(result.l2Code).toBeNull()
    expect(result.failureSemantics).toBe('LOW_CONFIDENCE')
  })

  it('should produce a semantic classification when phrase and token evidence meet semantic thresholds', () => {
    const result = engine.classify({
      input: {
        rawText: '监管报告真实性控制缺失，虚假报告问题持续出现。',
        caseFacts: null,
        penaltyReason: null,
        mergedText: '监管报告真实性控制缺失，虚假报告问题持续出现。',
        normalizedText: '监管报告真实性控制缺失虚假报告问题持续出现',
        normalizedTokens: ['监管报告', '真实性控制', '虚假报告'],
        normalizedPhrases: ['监管报告真实性控制'],
      },
      mappings: [
        {
          l1Code: 'IT04',
          l1Name: '数据治理与监管数据报送',
          l2Code: 'IT04-11',
          l2Name: '监管报告/报表/文件/资料虚假或失真',
          definition: '编制或提供虚假报告、报表、文件、资料',
          canonicalTheme: '监管报告真实性控制',
          aliases: ['虚假报告'],
          keywords: ['真实性控制', '虚假报告'],
        },
      ],
      rulebook: undefined,
      activeProfile: IT04_DOMAIN_PROFILE,
      classifierVersion: 'taxonomy-classifier-6.1',
      mappingVersion: '2026-04-07',
      classifiedAt: '2026-04-24T16:00:00.000Z',
    })

    expect(result.pathDecision).toBe('PRIMARY_CHAIN')
    expect(result.decisionSource).toBe('semantic')
    expect(result.l2Code).toBe('IT04-11')
  })
})
