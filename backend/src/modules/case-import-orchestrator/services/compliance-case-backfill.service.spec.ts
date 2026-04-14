import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { CaseClusteringService } from './case-clustering.service'
import { CaseExtractionService } from './case-extraction.service'
import { ComplianceCaseBackfillService } from './compliance-case-backfill.service'

describe('ComplianceCaseBackfillService', () => {
  let service: ComplianceCaseBackfillService

  const complianceCaseRepository = {
    find: jest.fn(),
    save: jest.fn(),
  }

  const caseControlMapRepository = {
    delete: jest.fn(),
    find: jest.fn(),
  }

  const caseExtractionService = {
    extractBatch: jest.fn(),
  }

  const caseClusteringService = {
    clusterBatch: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceCaseBackfillService,
        {
          provide: getRepositoryToken(ComplianceCase),
          useValue: complianceCaseRepository,
        },
        {
          provide: getRepositoryToken(CaseControlMap),
          useValue: caseControlMapRepository,
        },
        {
          provide: CaseExtractionService,
          useValue: caseExtractionService,
        },
        {
          provide: CaseClusteringService,
          useValue: caseClusteringService,
        },
      ],
    }).compile()

    service = module.get(ComplianceCaseBackfillService)
    jest.clearAllMocks()
  })

  it('should reset non-reviewed cases and rerun extraction and clustering by batch', async () => {
    complianceCaseRepository.find
      .mockResolvedValueOnce([
        {
          caseId: 'case-1',
          importBatchId: 'batch-1',
          humanReviewed: false,
          status: 'clustered',
        },
        {
          caseId: 'case-2',
          importBatchId: 'batch-1',
          humanReviewed: true,
          status: 'reviewed',
        },
      ])
      .mockResolvedValueOnce([
        {
          caseId: 'case-1',
          importBatchId: 'batch-1',
          humanReviewed: false,
          status: 'clustered',
        },
      ])
    complianceCaseRepository.save.mockResolvedValue(undefined)
    caseControlMapRepository.delete.mockResolvedValue(undefined)
    caseControlMapRepository.find.mockResolvedValue([
      {
        caseId: 'case-1',
        controlId: 'control-1',
        source: 'RULE',
      },
    ])
    caseExtractionService.extractBatch.mockResolvedValue({
      batchId: 'batch-1',
      processedCount: 1,
      skippedCount: 0,
    })
    caseClusteringService.clusterBatch.mockResolvedValue({
      batchId: 'batch-1',
      processedCount: 1,
      skippedCount: 0,
      ruleMappedCaseCount: 1,
      llmTriggeredCaseCount: 0,
      llmAssistedRuleCaseCount: 0,
      llmFallbackCaseCount: 0,
      llmUnmappedCaseCount: 0,
      unmappedCaseCount: 0,
      ruleMapCount: 1,
      llmAssistedRuleMapCount: 0,
      llmFallbackMapCount: 0,
    })

    const report = await service.backfill({ batchId: 'batch-1' })

    expect(caseControlMapRepository.delete).toHaveBeenCalledWith({
      caseId: expect.any(Object),
      reviewStatus: 'PENDING',
    })
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          caseId: 'case-1',
          l1Code: null,
          l2Code: null,
          confidenceScore: null,
          status: 'pending',
        }),
      ]),
    )
    expect(caseExtractionService.extractBatch).toHaveBeenCalledWith('batch-1')
    expect(caseClusteringService.clusterBatch).toHaveBeenCalledWith('batch-1')
    expect(report).toEqual({
      requestedCount: 2,
      resetCount: 1,
      skippedReviewedCount: 1,
      skippedMissingBatchCount: 0,
      extractedCount: 1,
      clusteredCount: 1,
      autoMappedCaseCount: 1,
      unmappedCaseCount: 0,
      ruleMappedCaseCount: 1,
      llmTriggeredCaseCount: 0,
      llmAssistedRuleCaseCount: 0,
      llmFallbackCaseCount: 0,
      llmUnmappedCaseCount: 0,
      mapCountBySource: {
        RULE: 1,
        LLM_ASSISTED_RULE: 0,
        LLM_FALLBACK: 0,
        MANUAL: 0,
      },
      mappedCaseCountBySource: {
        RULE: 1,
        LLM_ASSISTED_RULE: 0,
        LLM_FALLBACK: 0,
        MANUAL: 0,
      },
      batchIds: ['batch-1'],
    })
  })
})
