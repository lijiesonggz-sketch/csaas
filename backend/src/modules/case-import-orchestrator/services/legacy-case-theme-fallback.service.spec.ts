import { LegacyCaseThemeFallbackService } from './legacy-case-theme-fallback.service'

describe('LegacyCaseThemeFallbackService', () => {
  it('should block retired domains and preserve explicit compatibility path for active domains', async () => {
    const domainRolloutPolicyService = {
      shouldAllowLegacyFallback: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true),
    }
    const service = new LegacyCaseThemeFallbackService(
      domainRolloutPolicyService as never,
    )

    const retiredDecision = await service.resolve({
      l1Code: 'IT07',
      normalizedThemes: ['监管报送管理'],
    })
    const activeDecision = await service.resolve({
      l1Code: 'IT02',
      normalizedThemes: ['治理与职责管理'],
    })

    expect(retiredDecision).toEqual(
      expect.objectContaining({
        allowed: false,
        mode: 'legacy-off',
      }),
    )
    expect(activeDecision).toEqual(
      expect.objectContaining({
        allowed: true,
        mode: 'legacy-compatible',
      }),
    )
  })

  it('should expose normalization utilities through the extracted case-text contract', () => {
    const {
      extractViolationThemesFromText,
      tokenizeText,
    } = require('./case-text-normalization.utils')

    const tokens = tokenizeText('EAST 报送字段映射错误，导致监管报送数据不准确')
    const phrases = extractViolationThemesFromText(
      'EAST 报送字段映射错误，导致监管报送数据不准确',
    )

    expect(tokens).toEqual(
      expect.arrayContaining(['EAST', '报送', '监管']),
    )
    expect(phrases.length).toBeGreaterThan(0)
  })
})
