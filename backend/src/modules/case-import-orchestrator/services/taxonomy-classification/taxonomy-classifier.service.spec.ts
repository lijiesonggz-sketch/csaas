import {
  TAXONOMY_MULTIDOMAIN_ATDD_CSV_MAPPING_PATH,
  TAXONOMY_MULTIDOMAIN_ATDD_RULE_CASES,
  TAXONOMY_MULTIDOMAIN_ATDD_SEMANTIC_CASES,
} from '../../testing/taxonomy-multidomain-atdd.fixtures'
import * as domainRegistry from './profiles/domain-registry'
import { CaseNormalizationService } from './case-normalization.service'
import { CsvBackedMappingRepository } from './csv-backed-mapping.repository'
import { TaxonomyClassifierEngine } from './taxonomy-classifier.engine'
import { TaxonomyClassifierService } from './taxonomy-classifier.service'

describe('TaxonomyClassifierService', () => {
  const createService = () =>
    new TaxonomyClassifierService(
      new CaseNormalizationService(),
      new CsvBackedMappingRepository({
        mappingPath: TAXONOMY_MULTIDOMAIN_ATDD_CSV_MAPPING_PATH,
      }),
      new TaxonomyClassifierEngine(),
    )

  it('should orchestrate normalization, mapping load, and engine classification for supported domains without embedding domain logic', () => {
    const service = createService()

    const result = service.classifyCaseText({
      rawText: TAXONOMY_MULTIDOMAIN_ATDD_RULE_CASES[1].rawText,
      preferredL1Code: 'IT02',
    })

    expect(result.pathDecision).toBe('PRIMARY_CHAIN')
    expect(result.l1Code).toBe('IT02')
    expect(result.l2Code).toBe('IT02-03')
    expect(result.decisionSource).toBe('rule')
  })

  it('should classify golden rule cases for all IT01-IT08 domains instead of returning UNSUPPORTED_DOMAIN', () => {
    const service = createService()

    for (const testCase of TAXONOMY_MULTIDOMAIN_ATDD_RULE_CASES) {
      const result = service.classifyCaseText({
        rawText: testCase.rawText,
        preferredL1Code: testCase.l1Code,
      })

      expect(result.failureSemantics).not.toBe('UNSUPPORTED_DOMAIN')
      expect(result.pathDecision).toBe('PRIMARY_CHAIN')
      expect(result.l1Code).toBe(testCase.l1Code)
      expect(result.l2Code).toBe(testCase.expectedL2Code)
    }
  })

  it('should allow semantic mapping to carry long-tail domain cases when strong rule signals are absent', () => {
    const service = createService()

    for (const testCase of TAXONOMY_MULTIDOMAIN_ATDD_SEMANTIC_CASES) {
      const result = service.classifyCaseText({
        rawText: testCase.rawText,
        preferredL1Code: testCase.l1Code,
      })

      expect(result.pathDecision).toBe('PRIMARY_CHAIN')
      expect(result.failureSemantics).toBeNull()
      expect(result.decisionSource).toBe(testCase.expectedDecisionSource)
      expect(result.l2Code).toBe(testCase.expectedL2Code)
    }
  })

  it('should require preferredL1Code instead of defaulting silently to any domain', () => {
    const service = createService()

    const result = service.classifyCaseText({
      rawText: '未显式指定域的文本',
    })

    expect(result.pathDecision).toBe('UNCLASSIFIED')
    expect(result.failureSemantics).toBe('UNSUPPORTED_DOMAIN')
  })

  it('should refuse to classify domains that are not runtime-classifier-ready', () => {
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

    const registrySpy = jest
      .spyOn(domainRegistry, 'getTaxonomyDomainRegistryEntry')
      .mockReturnValue({
        profile: {
          l1Code: 'IT02',
          fallbackBucket: 'IT02-01',
          primaryThreshold: 5,
          semanticThreshold: 6.5,
          minimumScoreGap: 2,
          minimumPhraseHits: 1,
          scoreGapStrategy: 'default',
          gatePolicy: 'requires-domain-rollout-policy',
          fallbackPolicy: 'legacy-fallback-when-rollout-enabled',
          rulebookVersion: 'it02-rulebook-v1',
        },
        rulebook: {
          l1Code: 'IT02',
          version: 'it02-rulebook-v1',
          fallbackBucket: 'IT02-01',
          entries: [],
        },
        readiness: {
          stage: 'seed-ready',
          verifiableEntryPoint: 'TAXONOMY_DOMAIN_REGISTRY.IT02',
        },
      })

    const service = new TaxonomyClassifierService(
      normalizationService,
      mappingRepository as never,
      engine as never,
    )

    const result = service.classifyCaseText({
      rawText: '待 rollout 的域文本',
      preferredL1Code: 'IT02',
    })

    expect(result.pathDecision).toBe('UNCLASSIFIED')
    expect(result.failureSemantics).toBe('UNSUPPORTED_DOMAIN')
    expect(mappingRepository.loadByL1Code).not.toHaveBeenCalled()
    expect(engine.classify).not.toHaveBeenCalled()

    registrySpy.mockRestore()
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
      mappingRepository as never,
      engine as never,
    )

    const result = service.classifyCaseText({
      rawText: 'sample text',
      preferredL1Code: 'IT04',
    })

    expect(result.pathDecision).toBe('UNCLASSIFIED')
    expect(result.l1Code).toBe('IT04')
    expect(result.failureSemantics).toBe('ENGINE_ERROR')
  })
})
