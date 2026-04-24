import { CaseNormalizationService } from './case-normalization.service'
import { TaxonomyClassifierService } from './taxonomy-classifier.service'

describe('TaxonomyClassifierService', () => {
  it('should orchestrate normalization, mapping load, and engine classification without embedding domain logic', () => {
    const normalizationService = {
      normalize: jest.fn().mockReturnValue({
        rawText: 'sample text',
        caseFacts: null,
        penaltyReason: null,
        mergedText: 'sample text',
        normalizedText: 'sampletext',
        normalizedTokens: ['sample'],
        normalizedPhrases: [],
      }),
    } as unknown as CaseNormalizationService
    const mappingRepository = {
      loadAll: jest.fn(),
      loadByL1Code: jest.fn().mockReturnValue([
        {
          l1Code: 'IT04',
          l1Name: '数据治理与监管数据报送',
          l2Code: 'IT04-10',
          l2Name: '信息登记/录入/更新不及时不规范',
          definition: 'definition',
          canonicalTheme: '信息登记与更新管理',
          aliases: ['信息登记'],
          keywords: ['更新不及时'],
        },
      ]),
      getVersion: jest.fn().mockReturnValue('2026-04-07'),
    }
    const engine = {
      classify: jest.fn().mockReturnValue({
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

    const service = new TaxonomyClassifierService(
      normalizationService,
      mappingRepository,
      engine as never,
    )

    const result = service.classifyCaseText({
      rawText: '监管登记信息补录和更新没有时效监控',
      preferredL1Code: 'IT04',
    })

    expect(normalizationService.normalize).toHaveBeenCalledWith({
      rawText: '监管登记信息补录和更新没有时效监控',
      preferredL1Code: 'IT04',
    })
    expect(mappingRepository.loadByL1Code).toHaveBeenCalledWith('IT04')
    expect(engine.classify).toHaveBeenCalled()
    expect(result.pathDecision).toBe('PRIMARY_CHAIN')
  })

  it('should return UNCLASSIFIED instead of silently falling back to IT04 for unsupported preferred domains', () => {
    const normalizationService = {
      normalize: jest.fn(),
    } as unknown as CaseNormalizationService
    const mappingRepository = {
      loadAll: jest.fn(),
      loadByL1Code: jest.fn(),
      getVersion: jest.fn().mockReturnValue('2026-04-07'),
    }
    const engine = {
      classify: jest.fn(),
    }

    const service = new TaxonomyClassifierService(
      normalizationService,
      mappingRepository,
      engine as never,
    )

    const result = service.classifyCaseText({
      rawText: '某个尚未接入的 IT02 风险案例',
      preferredL1Code: 'IT02',
    })

    expect(result.pathDecision).toBe('UNCLASSIFIED')
    expect(result.l1Code).toBe('IT02')
    expect(result.failureSemantics).toBe('UNSUPPORTED_DOMAIN')
    expect(mappingRepository.loadByL1Code).not.toHaveBeenCalled()
    expect(engine.classify).not.toHaveBeenCalled()
  })

  it('should require preferredL1Code instead of defaulting silently to IT04', () => {
    const normalizationService = {
      normalize: jest.fn(),
    } as unknown as CaseNormalizationService
    const mappingRepository = {
      loadAll: jest.fn(),
      loadByL1Code: jest.fn(),
      getVersion: jest.fn().mockReturnValue('2026-04-07'),
    }
    const engine = {
      classify: jest.fn(),
    }

    const service = new TaxonomyClassifierService(
      normalizationService,
      mappingRepository,
      engine as never,
    )

    const result = service.classifyCaseText({
      rawText: '未显式指定域的文本',
    })

    expect(result.pathDecision).toBe('UNCLASSIFIED')
    expect(result.failureSemantics).toBe('UNSUPPORTED_DOMAIN')
    expect(mappingRepository.loadByL1Code).not.toHaveBeenCalled()
    expect(engine.classify).not.toHaveBeenCalled()
  })

  it('should convert repository or engine exceptions into ENGINE_ERROR terminal results', () => {
    const normalizationService = {
      normalize: jest.fn().mockReturnValue({
        rawText: 'sample text',
        caseFacts: null,
        penaltyReason: null,
        mergedText: 'sample text',
        normalizedText: 'sampletext',
        normalizedTokens: ['sample'],
        normalizedPhrases: [],
      }),
    } as unknown as CaseNormalizationService
    const mappingRepository = {
      loadAll: jest.fn(),
      loadByL1Code: jest.fn().mockImplementation(() => {
        throw new Error('csv missing')
      }),
      getVersion: jest.fn().mockReturnValue('2026-04-07'),
    }
    const engine = {
      classify: jest.fn(),
    }

    const service = new TaxonomyClassifierService(
      normalizationService,
      mappingRepository,
      engine as never,
    )

    const result = service.classifyCaseText({
      rawText: 'sample text',
      preferredL1Code: 'IT04',
    })

    expect(result.pathDecision).toBe('UNCLASSIFIED')
    expect(result.failureSemantics).toBe('ENGINE_ERROR')
  })
})
