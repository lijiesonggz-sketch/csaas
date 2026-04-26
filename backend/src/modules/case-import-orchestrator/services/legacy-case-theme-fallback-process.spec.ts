import { LegacyCaseThemeFallbackService } from './legacy-case-theme-fallback.service'

const makeControlPoint = (overrides: Record<string, unknown> = {}) => ({
  controlId: 'control-1',
  controlCode: 'CP-001',
  controlName: '反洗钱管理',
  controlDesc: '覆盖客户身份识别、反洗钱监测和尽职调查要求',
  controlFamily: 'GOV_RISK',
  aliases: ['客户身份识别管理'],
  keywords: ['客户身份识别', '反洗钱'],
  canonicalTheme: '反洗钱管理',
  status: 'ACTIVE',
  ...overrides,
})

describe('LegacyCaseThemeFallbackService.processLegacyFallback', () => {
  it('should return unmapped=true and empty mappings when domain is retired', async () => {
    const domainRolloutPolicyService = {
      shouldAllowLegacyFallback: jest.fn().mockResolvedValue(false),
    }
    const service = new LegacyCaseThemeFallbackService(
      domainRolloutPolicyService as never,
    )

    const result = await service.processLegacyFallback({
      l1Code: 'IT07',
      violationThemes: ['监管报送管理'],
      sourceText: '监管报送字段映射错误',
      controlPoints: [makeControlPoint() as never],
    })

    expect(result.allowed).toBe(false)
    expect(result.mode).toBe('legacy-off')
    expect(result.autoMappings).toHaveLength(0)
    expect(result.unmapped).toBe(true)
  })

  it('should use pre-resolved allowLegacyFallback=false without calling policy service', async () => {
    const domainRolloutPolicyService = {
      shouldAllowLegacyFallback: jest.fn(),
    }
    const service = new LegacyCaseThemeFallbackService(
      domainRolloutPolicyService as never,
    )

    const result = await service.processLegacyFallback({
      l1Code: 'IT07',
      violationThemes: ['监管报送管理'],
      sourceText: '监管报送字段映射错误',
      controlPoints: [],
      allowLegacyFallback: false,
    })

    expect(domainRolloutPolicyService.shouldAllowLegacyFallback).not.toHaveBeenCalled()
    expect(result.allowed).toBe(false)
    expect(result.unmapped).toBe(true)
  })

  it('should apply rule matching and produce autoMappings when domain is active', async () => {
    const domainRolloutPolicyService = {
      shouldAllowLegacyFallback: jest.fn().mockResolvedValue(true),
    }
    const service = new LegacyCaseThemeFallbackService(
      domainRolloutPolicyService as never,
    )

    const result = await service.processLegacyFallback({
      l1Code: 'IT02',
      violationThemes: ['反洗钱管理'],
      sourceText: '客户身份识别不到位',
      controlPoints: [makeControlPoint() as never],
    })

    expect(result.allowed).toBe(true)
    expect(result.mode).toBe('legacy-compatible')
    expect(result.normalizedThemes.length).toBeGreaterThan(0)
  })

  it('should trigger LLM when rule matching finds no auto-mappings', async () => {
    const domainRolloutPolicyService = {
      shouldAllowLegacyFallback: jest.fn().mockResolvedValue(true),
    }
    const caseThemeIntelligenceService = {
      suggestMappings: jest.fn().mockResolvedValue({
        normalizedThemes: ['销售行为管理'],
        recommendedMappings: [
          { controlId: 'control-2', confidenceScore: 0.82, reason: 'LLM match' },
        ],
      }),
    }
    const service = new LegacyCaseThemeFallbackService(
      domainRolloutPolicyService as never,
      caseThemeIntelligenceService as never,
    )

    const result = await service.processLegacyFallback({
      l1Code: 'IT02',
      violationThemes: ['完全不相关的主题xyz'],
      sourceText: '向投资者承诺收益',
      controlPoints: [],
    })

    expect(result.llmTriggered).toBe(true)
    expect(result.llmFallbackUsed).toBe(true)
    expect(result.autoMappings).toHaveLength(1)
    expect(result.autoMappings[0].source).toBe('LLM_FALLBACK')
  })

  it('should return unmapped=true when LLM also finds no mappings', async () => {
    const domainRolloutPolicyService = {
      shouldAllowLegacyFallback: jest.fn().mockResolvedValue(true),
    }
    const caseThemeIntelligenceService = {
      suggestMappings: jest.fn().mockResolvedValue({
        normalizedThemes: [],
        recommendedMappings: [],
      }),
    }
    const service = new LegacyCaseThemeFallbackService(
      domainRolloutPolicyService as never,
      caseThemeIntelligenceService as never,
    )

    const result = await service.processLegacyFallback({
      l1Code: 'IT02',
      violationThemes: ['完全不相关的主题xyz'],
      sourceText: '无法匹配的内容',
      controlPoints: [],
    })

    expect(result.llmTriggered).toBe(true)
    expect(result.unmapped).toBe(true)
    expect(result.autoMappings).toHaveLength(0)
  })

  it('should handle null l1Code as legacy-compatible without policy check', async () => {
    const domainRolloutPolicyService = {
      shouldAllowLegacyFallback: jest.fn(),
    }
    const service = new LegacyCaseThemeFallbackService(
      domainRolloutPolicyService as never,
    )

    const result = await service.processLegacyFallback({
      l1Code: null,
      violationThemes: ['反洗钱管理'],
      sourceText: '客户身份识别不到位',
      controlPoints: [],
    })

    expect(domainRolloutPolicyService.shouldAllowLegacyFallback).not.toHaveBeenCalled()
    expect(result.allowed).toBe(true)
    expect(result.mode).toBe('legacy-compatible')
  })
})

// ============================================================
// case-text-normalization.utils (re-export contract)
// ============================================================
describe('case-text-normalization.utils', () => {
  it('should export tokenizeText that splits Chinese and ASCII tokens', () => {
    const { tokenizeText } = require('./case-text-normalization.utils')
    const tokens = tokenizeText('EAST 报送字段映射错误，导致监管报送数据不准确')

    expect(Array.isArray(tokens)).toBe(true)
    expect(tokens).toEqual(expect.arrayContaining(['EAST', '报送', '监管']))
  })

  it('should export extractViolationThemesFromText that returns non-empty phrases', () => {
    const { extractViolationThemesFromText } = require('./case-text-normalization.utils')
    const phrases = extractViolationThemesFromText(
      '客户身份识别不到位；交易监测缺失；内部控制不完善',
    )

    expect(Array.isArray(phrases)).toBe(true)
    expect(phrases.length).toBeGreaterThan(0)
  })

  it('should export isWeakTheme that filters out regulatory boilerplate', () => {
    const { isWeakTheme } = require('./case-text-normalization.utils')

    expect(isWeakTheme('你公司存在以下问题')).toBe(true)
    expect(isWeakTheme('反洗钱管理')).toBe(false)
  })

  it('should return empty array for empty input', () => {
    const { extractViolationThemesFromText } = require('./case-text-normalization.utils')
    const phrases = extractViolationThemesFromText('')

    expect(Array.isArray(phrases)).toBe(true)
  })
})
