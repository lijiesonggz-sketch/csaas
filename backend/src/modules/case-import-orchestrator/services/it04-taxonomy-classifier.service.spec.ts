import { It04TaxonomyClassifierService } from './it04-taxonomy-classifier.service'

describe('It04TaxonomyClassifierService', () => {
  it('should delegate to the generic taxonomy classifier facade and preserve the IT04 compatibility contract', () => {
    const taxonomyClassifierService = {
      classifyCaseText: jest.fn().mockReturnValue({
        l1Code: 'IT04',
        l2Code: 'IT04-10',
        l2Name: '信息登记/录入/更新不及时不规范',
        score: 9,
        confidenceScore: 9,
        scoreGap: 5,
        decisionSource: 'rule',
        matchedSignals: ['更新不及时'],
        matchedPhrases: ['更新不及时'],
        matchedTokens: [],
        classifierVersion: 'taxonomy-classifier-6.1',
        mappingVersion: '2026-04-07',
        rulebookVersion: 'it04-rulebook-v1',
        classifiedAt: new Date().toISOString(),
        pathDecision: 'PRIMARY_CHAIN',
        failureSemantics: null,
      }),
    }

    const service = new It04TaxonomyClassifierService(
      taxonomyClassifierService as never,
    )

    const result = service.classifyCaseText('监管登记信息补录和更新没有时效监控')

    expect(taxonomyClassifierService.classifyCaseText).toHaveBeenCalledWith({
      rawText: '监管登记信息补录和更新没有时效监控',
      preferredL1Code: 'IT04',
    })
    expect(result).toMatchObject({
      l1Code: 'IT04',
      l2Code: 'IT04-10',
      score: 9,
    })
  })

  it('should return null when the generic classifier abstains', () => {
    const taxonomyClassifierService = {
      classifyCaseText: jest.fn().mockReturnValue({
        l1Code: 'IT04',
        l2Code: null,
        l2Name: null,
        score: 2,
        confidenceScore: 2,
        scoreGap: 0.5,
        decisionSource: 'none',
        matchedSignals: [],
        matchedPhrases: [],
        matchedTokens: [],
        classifierVersion: 'taxonomy-classifier-6.1',
        mappingVersion: '2026-04-07',
        rulebookVersion: 'it04-rulebook-v1',
        classifiedAt: new Date().toISOString(),
        pathDecision: 'ABSTAIN',
        failureSemantics: 'LOW_CONFIDENCE',
      }),
    }

    const service = new It04TaxonomyClassifierService(
      taxonomyClassifierService as never,
    )

    expect(service.classifyCaseText('弱信号文本')).toBeNull()
  })
})
