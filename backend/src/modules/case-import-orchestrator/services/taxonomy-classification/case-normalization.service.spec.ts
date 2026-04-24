import { CaseNormalizationService } from './case-normalization.service'

describe('CaseNormalizationService', () => {
  const service = new CaseNormalizationService()

  it('should normalize caseFacts and penaltyReason into a unified classification input contract', () => {
    const result = service.normalize({
      rawText: '',
      caseFacts: '监管登记信息补录和更新没有时效监控，补录超期且无人催办。',
      penaltyReason: '导致信息更新不及时不规范。',
    })

    expect(result.mergedText).toContain('监管登记信息补录和更新没有时效监控')
    expect(result.normalizedText).toContain('监管登记信息补录和更新没有时效监控')
    expect(result.normalizedTokens.length).toBeGreaterThan(0)
    expect(result.normalizedTokens).toEqual(expect.arrayContaining(['补录', '更新']))
    expect(result.normalizedPhrases.length).toBeGreaterThan(0)
  })
})
