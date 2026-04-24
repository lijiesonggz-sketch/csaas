import {
  TAXONOMY_CLASSIFIER_ATDD_EXPECTED_RESULT,
  TAXONOMY_CLASSIFIER_ATDD_INVALID_MAPPING_CSV,
  TAXONOMY_CLASSIFIER_ATDD_MAPPING_SHAPE,
  TAXONOMY_CLASSIFIER_ATDD_NORMALIZED_INPUT,
  TAXONOMY_CLASSIFIER_ATDD_SOURCE_TEXT,
} from '../../testing/taxonomy-classification-atdd.fixtures'

describe('Story 6.1 - Taxonomy Classification Foundation (ATDD)', () => {
  it.skip('[P0][6.1-UNIT-001] should classify normalized IT04 input through a pure engine with no I/O dependency', () => {
    const { TaxonomyClassifierEngine } = require('./taxonomy-classifier.engine')
    const { IT04_RULEBOOK } = require('./rulebooks/it04.rulebook')

    const result = TaxonomyClassifierEngine.classify({
      input: TAXONOMY_CLASSIFIER_ATDD_NORMALIZED_INPUT,
      mappings: [TAXONOMY_CLASSIFIER_ATDD_MAPPING_SHAPE],
      rulebooks: [IT04_RULEBOOK],
      activeProfile: {
        l1Code: 'IT04',
        primaryThreshold: 6,
        scoreGapStrategy: 'default',
      },
    })

    expect(result).toMatchObject({
      l1Code: 'IT04',
      l2Code: TAXONOMY_CLASSIFIER_ATDD_EXPECTED_RESULT.l2Code,
      decisionSource: 'rule',
      scoreGap: TAXONOMY_CLASSIFIER_ATDD_EXPECTED_RESULT.scoreGap,
      pathDecision: 'PRIMARY_CHAIN',
    })
  })

  it.skip('[P0][6.1-UNIT-002] should keep confidence and low-confidence rejection inside engine instead of wrapper heuristics', () => {
    const { TaxonomyClassifierEngine } = require('./taxonomy-classifier.engine')

    const result = TaxonomyClassifierEngine.classify({
      input: {
        ...TAXONOMY_CLASSIFIER_ATDD_NORMALIZED_INPUT,
        normalizedTokens: ['报送'],
        normalizedPhrases: [],
      },
      mappings: [TAXONOMY_CLASSIFIER_ATDD_MAPPING_SHAPE],
      rulebooks: [],
      activeProfile: {
        l1Code: 'IT04',
        primaryThreshold: 6,
        scoreGapStrategy: 'default',
      },
    })

    expect(result).toMatchObject({
      pathDecision: expect.stringMatching(/ABSTAIN|UNCLASSIFIED/),
      failureSemantics: expect.stringMatching(/LOW_CONFIDENCE|NO_MATCH/),
    })
  })

  it.skip('[P0][6.1-INT-003] should load taxonomy mappings by l1Code and as full list through CsvBackedMappingRepository', async () => {
    const { CsvBackedMappingRepository } = require('./csv-backed-mapping.repository')

    const repository = new CsvBackedMappingRepository({
      mappingPath: 'docs/it-taxonomy-to-kg-semantic-mapping-2026-04-07.csv',
      mappingVersion: '2026-04-07',
    })

    const it04Mappings = await repository.loadByL1Code('IT04')
    const allMappings = await repository.loadAll()

    expect(it04Mappings).toEqual(
      expect.arrayContaining([expect.objectContaining(TAXONOMY_CLASSIFIER_ATDD_MAPPING_SHAPE)]),
    )
    expect(allMappings.length).toBeGreaterThan(it04Mappings.length)
  })

  it.skip('[P0][6.1-INT-004] should fail fast when mapping schema is invalid instead of silently degrading to IT04-only logic', async () => {
    const { CsvBackedMappingRepository } = require('./csv-backed-mapping.repository')

    const repository = new CsvBackedMappingRepository({
      csvText: TAXONOMY_CLASSIFIER_ATDD_INVALID_MAPPING_CSV,
      mappingVersion: 'invalid-fixture',
    })

    await expect(repository.loadAll()).rejects.toThrow(/schema|column|mapping/i)
  })

  it.skip('[P0][6.1-INT-005] should orchestrate normalization -> mapping load -> engine inside TaxonomyClassifierService without domain-specific branches', async () => {
    const { TaxonomyClassifierService } = require('./taxonomy-classifier.service')

    const normalizationService = {
      normalize: jest.fn().mockReturnValue(TAXONOMY_CLASSIFIER_ATDD_NORMALIZED_INPUT),
    }
    const mappingRepository = {
      loadByL1Code: jest.fn().mockResolvedValue([TAXONOMY_CLASSIFIER_ATDD_MAPPING_SHAPE]),
    }
    const engine = {
      classify: jest.fn().mockReturnValue(TAXONOMY_CLASSIFIER_ATDD_EXPECTED_RESULT),
    }

    const service = new TaxonomyClassifierService(
      normalizationService,
      mappingRepository,
      engine,
      [],
      [],
    )

    const result = await service.classifyCaseText({
      rawText: TAXONOMY_CLASSIFIER_ATDD_SOURCE_TEXT,
      preferredL1Code: 'IT04',
    })

    expect(normalizationService.normalize).toHaveBeenCalled()
    expect(mappingRepository.loadByL1Code).toHaveBeenCalledWith('IT04')
    expect(engine.classify).toHaveBeenCalled()
    expect(result).toMatchObject({
      l1Code: 'IT04',
      l2Code: 'IT04-10',
      decisionSource: 'rule',
    })
  })

  it.skip('[P1][6.1-INT-006] should keep It04TaxonomyClassifierService as a delegate-only wrapper over the generic facade', async () => {
    const { It04TaxonomyClassifierService } = require('../it04-taxonomy-classifier.service')

    const taxonomyClassifierService = {
      classifyCaseText: jest.fn().mockResolvedValue(TAXONOMY_CLASSIFIER_ATDD_EXPECTED_RESULT),
    }

    const wrapper = new It04TaxonomyClassifierService(taxonomyClassifierService)
    const result = await wrapper.classifyCaseText(TAXONOMY_CLASSIFIER_ATDD_SOURCE_TEXT)

    expect(taxonomyClassifierService.classifyCaseText).toHaveBeenCalledWith({
      rawText: TAXONOMY_CLASSIFIER_ATDD_SOURCE_TEXT,
      preferredL1Code: 'IT04',
    })
    expect(result).toMatchObject({
      l1Code: 'IT04',
      l2Code: 'IT04-10',
    })
  })
})
