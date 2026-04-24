import {
  TAXONOMY_MULTIDOMAIN_ATDD_CSV_MAPPING_PATH,
} from '../../testing/taxonomy-multidomain-atdd.fixtures'
import {
  TAXONOMY_MULTIDOMAIN_AUTOMATE_RULEBOOK_VARIANTS,
} from '../../testing/taxonomy-multidomain-automate.fixtures'
import { CaseNormalizationService } from './case-normalization.service'
import { CsvBackedMappingRepository } from './csv-backed-mapping.repository'
import { TaxonomyClassifierEngine } from './taxonomy-classifier.engine'
import { TaxonomyClassifierService } from './taxonomy-classifier.service'

describe('TaxonomyClassifierService rulebook regression coverage', () => {
  const createService = () =>
    new TaxonomyClassifierService(
      new CaseNormalizationService(),
      new CsvBackedMappingRepository({
        mappingPath: TAXONOMY_MULTIDOMAIN_ATDD_CSV_MAPPING_PATH,
      }),
      new TaxonomyClassifierEngine(),
    )

  for (const variant of TAXONOMY_MULTIDOMAIN_AUTOMATE_RULEBOOK_VARIANTS) {
    it(`[P0] should keep ${variant.id} on the rule path`, () => {
      const service = createService()

      const result = service.classifyCaseText({
        rawText: variant.rawText,
        preferredL1Code: variant.l1Code,
      })

      expect(result.pathDecision).toBe('PRIMARY_CHAIN')
      expect(result.failureSemantics).toBeNull()
      expect(result.l1Code).toBe(variant.l1Code)
      expect(result.l2Code).toBe(variant.expectedL2Code)
      expect(result.decisionSource).toBe(variant.expectedDecisionSource)
    })
  }
})
