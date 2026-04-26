import {
  TAXONOMY_RETIREMENT_ATDD_ACTIVE_POLICY,
  TAXONOMY_RETIREMENT_ATDD_NORMALIZATION_SAMPLE,
  TAXONOMY_RETIREMENT_ATDD_RETIRED_POLICY,
} from '../testing/taxonomy-retirement.atdd.fixtures'

describe('Story 6.6 - Legacy Case Theme Fallback Cleanup (ATDD)', () => {
  it(
    '[P0][6.6-INT-006] should disable legacy old-chain execution for retired domains while preserving an explicit compatibility path for domains that are not yet retired',
    async () => {
      const { LegacyCaseThemeFallbackService } = require('./legacy-case-theme-fallback.service')

      const policyReader = {
        shouldAllowLegacyFallback: jest
          .fn()
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true),
      }
      const ruleMatcher = {
        match: jest.fn().mockResolvedValue({
          controlId: 'control-1',
          confidenceScore: 0.91,
        }),
      }

      const service = new LegacyCaseThemeFallbackService(
        policyReader,
        ruleMatcher,
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
          reason: expect.stringContaining('legacy-off'),
        }),
      )
      expect(activeDecision).toEqual(
        expect.objectContaining({
          allowed: true,
          mode: 'legacy-compatible',
        }),
      )
    },
  )

  it(
    '[P1][6.6-UNIT-007] should preserve normalization utilities after selective cleanup by exposing tokenizer and phrase extraction outside the retired legacy scoring path',
    () => {
      const {
        extractViolationThemesFromText,
        tokenizeText,
      } = require('./case-text-normalization.utils')

      const tokens = tokenizeText(
        TAXONOMY_RETIREMENT_ATDD_NORMALIZATION_SAMPLE.rawText,
      )
      const phrases = extractViolationThemesFromText(
        TAXONOMY_RETIREMENT_ATDD_NORMALIZATION_SAMPLE.rawText,
      )

      expect(tokens).toEqual(
        expect.arrayContaining(
          ['EAST', '报送', '监管'],
        ),
      )
      expect(phrases.length).toBeGreaterThan(0)
    },
  )
})
