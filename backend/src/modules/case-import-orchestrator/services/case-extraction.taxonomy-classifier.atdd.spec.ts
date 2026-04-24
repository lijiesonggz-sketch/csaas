import {
  TAXONOMY_CLASSIFIER_ATDD_CASE,
  TAXONOMY_CLASSIFIER_ATDD_EXPECTED_RESULT,
} from '../testing/taxonomy-classification-atdd.fixtures'

describe('Story 6.1 - Case Extraction Integration (ATDD)', () => {
  it.skip('[P0][6.1-INT-007] should persist l1Code/l2Code/confidenceScore through the generic taxonomy classifier facade during extraction', async () => {
    const { CaseExtractionService } = require('./case-extraction.service')
    const { ComplianceCase } = require('../../../database/entities/compliance-case.entity')
    const { RegulationClause } = require('../../../database/entities/regulation-clause.entity')

    const complianceCaseRepository = {
      find: jest.fn().mockResolvedValue([TAXONOMY_CLASSIFIER_ATDD_CASE]),
      save: jest.fn().mockImplementation(async (entity: unknown) => entity),
    }
    const regulationClauseRepository = {
      find: jest.fn().mockResolvedValue([]),
    }
    const caseThemeIntelligenceService = {
      refineViolationThemes: jest.fn().mockResolvedValue(null),
    }
    const taxonomyClassifierService = {
      classifyCaseText: jest.fn().mockReturnValue(TAXONOMY_CLASSIFIER_ATDD_EXPECTED_RESULT),
    }

    const service = new CaseExtractionService(
      complianceCaseRepository,
      regulationClauseRepository,
      caseThemeIntelligenceService,
      taxonomyClassifierService,
    )

    await service.extractBatch('batch-6-1-atdd')

    expect(taxonomyClassifierService.classifyCaseText).toHaveBeenCalled()
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT04',
        l2Code: 'IT04-10',
        confidenceScore: '9.0000',
        status: 'extracted',
      }),
    )
  })
})
