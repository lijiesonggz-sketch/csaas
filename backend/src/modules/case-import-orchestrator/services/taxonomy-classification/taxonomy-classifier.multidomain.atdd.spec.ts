import {
  TAXONOMY_MULTIDOMAIN_ATDD_CSV_MAPPING_PATH,
  TAXONOMY_MULTIDOMAIN_ATDD_REQUIRED_PROFILE_FIELDS,
  TAXONOMY_MULTIDOMAIN_ATDD_RULE_CASES,
  TAXONOMY_MULTIDOMAIN_ATDD_SEMANTIC_CASES,
  TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES,
} from '../../testing/taxonomy-multidomain-atdd.fixtures'

describe('Story 6.2 - Taxonomy Multi-Domain Runtime Classifier (ATDD)', () => {
  it.skip(
    '[P0][6.2-INT-001] should expose declarative registry entries for IT01-IT08 with required profile fields and dedicated rulebooks',
    () => {
      const { TAXONOMY_DOMAIN_REGISTRY } = require('./profiles/domain-registry')

      expect(Object.keys(TAXONOMY_DOMAIN_REGISTRY).sort()).toEqual(
        [...TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES].sort(),
      )

      for (const l1Code of TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES) {
        const entry = TAXONOMY_DOMAIN_REGISTRY[l1Code]
        expect(entry).toBeDefined()
        expect(entry.profile.l1Code).toBe(l1Code)
        expect(entry.rulebook.l1Code).toBe(l1Code)

        for (const field of TAXONOMY_MULTIDOMAIN_ATDD_REQUIRED_PROFILE_FIELDS) {
          expect(entry.profile).toHaveProperty(field)
        }

        Object.values(entry.profile).forEach((value) => {
          expect(typeof value).not.toBe('function')
        })
      }
    },
  )

  it.skip(
    '[P0][6.2-INT-002] should classify each domain golden rule case through the configured rulebook instead of returning UNSUPPORTED_DOMAIN',
    () => {
      const { CaseNormalizationService } = require('./case-normalization.service')
      const { CsvBackedMappingRepository } = require('./csv-backed-mapping.repository')
      const { TaxonomyClassifierEngine } = require('./taxonomy-classifier.engine')
      const { TaxonomyClassifierService } = require('./taxonomy-classifier.service')

      const service = new TaxonomyClassifierService(
        new CaseNormalizationService(),
        new CsvBackedMappingRepository({
          mappingPath: TAXONOMY_MULTIDOMAIN_ATDD_CSV_MAPPING_PATH,
        }),
        new TaxonomyClassifierEngine(),
      )

      for (const testCase of TAXONOMY_MULTIDOMAIN_ATDD_RULE_CASES) {
        const result = service.classifyCaseText({
          rawText: testCase.rawText,
          preferredL1Code: testCase.l1Code,
        })

        expect(result.failureSemantics).not.toBe('UNSUPPORTED_DOMAIN')
        expect(result.pathDecision).toBe('PRIMARY_CHAIN')
        expect(result.l1Code).toBe(testCase.l1Code)
        expect(result.l2Code).toBe(testCase.expectedL2Code)
        expect(result.l2Name).toBe(testCase.expectedL2Name)
        expect(result.decisionSource).toBe('rule')
      }
    },
  )

  it.skip(
    '[P1][6.2-INT-003] should allow semantic mapping to carry long-tail domain cases when rulebooks abstain',
    () => {
      const { CaseNormalizationService } = require('./case-normalization.service')
      const { CsvBackedMappingRepository } = require('./csv-backed-mapping.repository')
      const { TaxonomyClassifierEngine } = require('./taxonomy-classifier.engine')
      const { TaxonomyClassifierService } = require('./taxonomy-classifier.service')

      const service = new TaxonomyClassifierService(
        new CaseNormalizationService(),
        new CsvBackedMappingRepository({
          mappingPath: TAXONOMY_MULTIDOMAIN_ATDD_CSV_MAPPING_PATH,
        }),
        new TaxonomyClassifierEngine(),
      )

      for (const testCase of TAXONOMY_MULTIDOMAIN_ATDD_SEMANTIC_CASES) {
        const result = service.classifyCaseText({
          rawText: testCase.rawText,
          preferredL1Code: testCase.l1Code,
        })

        expect(result.failureSemantics).not.toBe('UNSUPPORTED_DOMAIN')
        expect(result.pathDecision).toBe('PRIMARY_CHAIN')
        expect(result.l1Code).toBe(testCase.l1Code)
        expect(result.l2Code).toBe(testCase.expectedL2Code)
        expect(result.l2Name).toBe(testCase.expectedL2Name)
        expect(result.decisionSource).toBe(testCase.expectedDecisionSource)
      }
    },
  )

  it.skip(
    '[P0][6.2-INT-004] should stop co-locating the IT04 declarative profile inside it04.rulebook.ts',
    () => {
      const it04RulebookModule = require('./rulebooks/it04.rulebook')
      const { IT04_DOMAIN_PROFILE } = require('./profiles/it04.profile')

      expect(it04RulebookModule.IT04_DOMAIN_PROFILE).toBeUndefined()
      expect(IT04_DOMAIN_PROFILE.l1Code).toBe('IT04')
      expect(IT04_DOMAIN_PROFILE).toHaveProperty('gatePolicy')
      expect(IT04_DOMAIN_PROFILE).toHaveProperty('fallbackPolicy')
    },
  )
})

