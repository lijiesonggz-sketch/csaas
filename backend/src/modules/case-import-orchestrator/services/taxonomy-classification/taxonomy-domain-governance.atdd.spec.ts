import {
  TAXONOMY_MULTIDOMAIN_ATDD_ALLOWED_READINESS_STATES,
  TAXONOMY_MULTIDOMAIN_ATDD_CSV_MAPPING_PATH,
  TAXONOMY_MULTIDOMAIN_ATDD_RULE_CASES,
  TAXONOMY_MULTIDOMAIN_ATDD_RUNTIME_READINESS,
  TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES,
} from '../../testing/taxonomy-multidomain-atdd.fixtures'

describe('Story 6.2 - Taxonomy Domain Governance (ATDD)', () => {
  it.skip(
    '[P0][6.2-UNIT-005] should assign independent rulebook versions across IT01-IT08 and keep precedence centralized in engine',
    () => {
      const { TAXONOMY_DOMAIN_REGISTRY } = require('./profiles/domain-registry')

      const versions = TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES.map(
        (l1Code) => TAXONOMY_DOMAIN_REGISTRY[l1Code].rulebook.version,
      )

      expect(new Set(versions).size).toBe(
        TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES.length,
      )

      for (const l1Code of TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES) {
        expect(TAXONOMY_DOMAIN_REGISTRY[l1Code].rulebook).not.toHaveProperty(
          'precedenceStrategy',
        )
        expect(TAXONOMY_DOMAIN_REGISTRY[l1Code].rulebook).not.toHaveProperty(
          'rolloutState',
        )
      }
    },
  )

  it.skip(
    '[P1][6.2-UNIT-006] should expose per-domain readiness metadata and cap 6.2-delivered domains at runtime-classifier-ready',
    () => {
      const { TAXONOMY_DOMAIN_REGISTRY } = require('./profiles/domain-registry')

      for (const l1Code of TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES) {
        const readiness = TAXONOMY_DOMAIN_REGISTRY[l1Code].readiness

        expect(readiness).toBeDefined()
        expect(TAXONOMY_MULTIDOMAIN_ATDD_ALLOWED_READINESS_STATES).toContain(
          readiness.stage,
        )
        expect(readiness.stage).toBe(TAXONOMY_MULTIDOMAIN_ATDD_RUNTIME_READINESS)
        expect(readiness.verifiableEntryPoint).toBeTruthy()
      }
    },
  )

  it.skip(
    '[P1][6.2-INT-007] should keep the IT04 benchmark helper on the shared engine after multi-domain registry expansion',
    () => {
      const { classifyIt04CaseText, loadIt04TaxonomyMappings } = require('../it04-benchmark.runner')
      const { IT04_DOMAIN_PROFILE } = require('./profiles/it04.profile')
      const { IT04_RULEBOOK } = require('./rulebooks/it04.rulebook')

      const mappings = loadIt04TaxonomyMappings(
        TAXONOMY_MULTIDOMAIN_ATDD_CSV_MAPPING_PATH,
      )
      const ruleCase = TAXONOMY_MULTIDOMAIN_ATDD_RULE_CASES.find(
        (entry) => entry.l1Code === 'IT04',
      )

      const result = classifyIt04CaseText(ruleCase.rawText, mappings)

      expect(result.l2Code).toBe(ruleCase.expectedL2Code)
      expect(result.decisionSource).toBe('rule')
      expect(IT04_RULEBOOK.version).toBe(IT04_DOMAIN_PROFILE.rulebookVersion)
    },
  )
})

