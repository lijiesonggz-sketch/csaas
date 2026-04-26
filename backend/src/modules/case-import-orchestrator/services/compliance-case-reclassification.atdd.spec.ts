import {
  TAXONOMY_RETIREMENT_ATDD_BACKFILL_REPORT,
  TAXONOMY_RETIREMENT_ATDD_RECLASSIFY_REPORT,
  TAXONOMY_RETIREMENT_ATDD_RECLASSIFY_SCOPE,
} from '../testing/taxonomy-retirement.atdd.fixtures'

describe('Story 6.6 - Compliance Case Reclassification & Backfill (ATDD)', () => {
  it(
    '[P0][6.6-INT-004] should reclassify selected scope by batch, case, domain, and classifier version without forcing a full clustering backfill, and keep latest pointer frozen in shadow-only dry runs',
    async () => {
      const { ComplianceCaseReclassificationService } = require('./compliance-case-reclassification.service')

      const complianceCaseRepository = {
        find: jest.fn().mockResolvedValue([
          {
            caseId: 'case-7',
            l1Code: 'IT07',
            createdAt: new Date(),
          },
          {
            caseId: 'case-8',
            l1Code: 'IT07',
            createdAt: new Date(),
          },
        ]),
      }
      const caseExtractionService = {
        reclassifyCases: jest.fn(),
      }

      const service = new ComplianceCaseReclassificationService(
        complianceCaseRepository,
        caseExtractionService,
      )

      const report = await service.reclassify({
        ...TAXONOMY_RETIREMENT_ATDD_RECLASSIFY_SCOPE,
      })

      expect(caseExtractionService.reclassifyCases).not.toHaveBeenCalled()
      expect(report).toEqual(
        expect.objectContaining(TAXONOMY_RETIREMENT_ATDD_RECLASSIFY_REPORT),
      )
    },
  )

  it(
    '[P1][6.6-INT-005] should extend backfill reporting for retirement rollback so affected domains, rollback compatibility, and no-legacy-restore guarantees are explicit',
    async () => {
      const { ComplianceCaseBackfillService } = require('./compliance-case-backfill.service')

      const complianceCaseRepository = {
        find: jest
          .fn()
          .mockResolvedValueOnce([
            {
              caseId: 'case-7',
              importBatchId: 'batch-7',
              humanReviewed: false,
              status: 'clustered',
              l1Code: 'IT07',
            },
            {
              caseId: 'case-8',
              importBatchId: 'batch-7',
              humanReviewed: false,
              status: 'clustered',
              l1Code: 'IT07',
            },
          ])
          .mockResolvedValueOnce([
            {
              caseId: 'case-7',
              importBatchId: 'batch-7',
              l1Code: 'IT07',
            },
            {
              caseId: 'case-8',
              importBatchId: 'batch-7',
              l1Code: 'IT07',
            },
          ]),
        save: jest.fn(),
      }
      const caseControlMapRepository = {
        delete: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
      }
      const caseExtractionService = {
        extractBatch: jest.fn().mockResolvedValue({
          processedCount: 2,
          skippedCount: 0,
        }),
      }
      const caseClusteringService = {
        clusterBatch: jest.fn().mockResolvedValue({
          processedCount: 2,
          skippedCount: 0,
          ruleMappedCaseCount: 0,
          llmTriggeredCaseCount: 0,
          llmAssistedRuleCaseCount: 0,
          llmFallbackCaseCount: 0,
          llmUnmappedCaseCount: 0,
          unmappedCaseCount: 0,
          ruleMapCount: 0,
          llmAssistedRuleMapCount: 0,
          llmFallbackMapCount: 0,
          chainMappedCaseCount: 2,
          chainMapCount: 2,
          fallbackToOldChainCount: 0,
        }),
      }

      const service = new ComplianceCaseBackfillService(
        complianceCaseRepository,
        caseControlMapRepository,
        caseExtractionService,
        caseClusteringService,
      )

      const report = await service.backfill({
        batchId: 'batch-7',
        l1Code: 'IT07',
        includeRetirementReadiness: true,
        dryRun: true,
      })

      expect(report).toEqual(
        expect.objectContaining(TAXONOMY_RETIREMENT_ATDD_BACKFILL_REPORT),
      )
      expect(report.requiresLegacyCodeRestore).toBe(false)
    },
  )
})
