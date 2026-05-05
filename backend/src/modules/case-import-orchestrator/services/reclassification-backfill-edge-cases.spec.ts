import { BadRequestException } from '@nestjs/common'
import { ComplianceCaseReclassificationService } from './compliance-case-reclassification.service'
import { ComplianceCaseBackfillService } from './compliance-case-backfill.service'

// ============================================================
// ComplianceCaseReclassificationService — edge cases
// ============================================================
describe('ComplianceCaseReclassificationService edge cases', () => {
  const makeService = (findResult: unknown[] = []) => {
    const complianceCaseRepository = {
      find: jest.fn().mockResolvedValue(findResult),
    }
    const caseExtractionService = {
      reclassifyCases: jest.fn(),
    }
    return {
      service: new ComplianceCaseReclassificationService(
        complianceCaseRepository as never,
        caseExtractionService as never,
      ),
      complianceCaseRepository,
      caseExtractionService,
    }
  }

  it('should throw BadRequestException when no scope is provided', async () => {
    const { service } = makeService()

    await expect(service.reclassify({})).rejects.toThrow(BadRequestException)
  })

  it('should throw BadRequestException when no cases match the scope', async () => {
    const { service } = makeService([])

    await expect(service.reclassify({ l1Code: 'IT07' })).rejects.toThrow(BadRequestException)
  })

  it('should respect limit and offset params in dry-run', async () => {
    const { service, complianceCaseRepository } = makeService([
      { caseId: 'case-1', l1Code: 'IT07', createdAt: new Date() },
    ])

    await service.reclassify({ l1Code: 'IT07', limit: 10, offset: 0, dryRun: true })

    expect(complianceCaseRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 0 }),
    )
  })

  it('should keep latestPointerUpdated=false in dry-run even when forceLatestPointer=true', async () => {
    const { service } = makeService([{ caseId: 'case-1', l1Code: 'IT07', createdAt: new Date() }])

    const report = await service.reclassify({
      l1Code: 'IT07',
      shadowOnly: true,
      forceLatestPointer: true,
      dryRun: true,
    })

    expect(report.latestPointerUpdated).toBe(false)
  })

  it('should set latestPointerUpdated=false when shadowOnly=true and forceLatestPointer is not set', async () => {
    const { service } = makeService([{ caseId: 'case-1', l1Code: 'IT07', createdAt: new Date() }])

    const report = await service.reclassify({
      l1Code: 'IT07',
      shadowOnly: true,
      dryRun: true,
    })

    expect(report.latestPointerUpdated).toBe(false)
  })

  it('should include scope metadata in report', async () => {
    const { service } = makeService([{ caseId: 'case-1', l1Code: 'IT07', createdAt: new Date() }])

    const report = await service.reclassify({
      batchId: 'batch-7',
      l1Code: 'IT07',
      dryRun: true,
    })

    expect(report.scope.batchId).toBe('batch-7')
    expect(report.scope.l1Code).toBe('IT07')
  })
})

// ============================================================
// ComplianceCaseBackfillService — edge cases
// ============================================================
describe('ComplianceCaseBackfillService edge cases', () => {
  const makeService = (findResults: unknown[][] = [[]]) => {
    let callCount = 0
    const complianceCaseRepository = {
      find: jest.fn().mockImplementation(() => {
        const result = findResults[callCount] ?? findResults[findResults.length - 1]
        callCount++
        return Promise.resolve(result)
      }),
      save: jest.fn().mockResolvedValue(undefined),
    }
    const caseControlMapRepository = {
      delete: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
    }
    const caseExtractionService = {
      extractBatch: jest.fn().mockResolvedValue({ processedCount: 0, skippedCount: 0 }),
    }
    const caseClusteringService = {
      clusterBatch: jest.fn().mockResolvedValue({
        processedCount: 0,
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
      }),
    }
    return {
      service: new ComplianceCaseBackfillService(
        complianceCaseRepository as never,
        caseControlMapRepository as never,
        caseExtractionService as never,
        caseClusteringService as never,
      ),
      complianceCaseRepository,
      caseExtractionService,
      caseClusteringService,
    }
  }

  it('should throw BadRequestException when no scope is provided', async () => {
    const { service } = makeService([
      [{ caseId: 'c1', importBatchId: 'b1', humanReviewed: false, status: 'clustered' }],
    ])

    await expect(service.backfill({})).rejects.toThrow(BadRequestException)
  })

  it('should throw BadRequestException when no cases match the scope', async () => {
    const { service } = makeService([[]])

    await expect(service.backfill({ batchId: 'batch-99' })).rejects.toThrow(BadRequestException)
  })

  it('should throw BadRequestException when caseIds scope is used in non-dry-run mode', async () => {
    const { service } = makeService([
      [
        {
          caseId: 'case-1',
          importBatchId: 'batch-1',
          humanReviewed: false,
          status: 'clustered',
          l1Code: 'IT07',
        },
      ],
    ])

    await expect(service.backfill({ caseIds: ['case-1'] })).rejects.toThrow(BadRequestException)
  })

  it('should throw BadRequestException when l1Code scope is used in non-dry-run mode', async () => {
    const { service } = makeService([
      [
        {
          caseId: 'case-1',
          importBatchId: 'batch-1',
          humanReviewed: false,
          status: 'clustered',
          l1Code: 'IT07',
        },
      ],
    ])

    await expect(service.backfill({ l1Code: 'IT07' })).rejects.toThrow(BadRequestException)
  })

  it('should set rollbackCompatible=false when cases have no importBatchId', async () => {
    const { service } = makeService([
      [
        {
          caseId: 'case-1',
          importBatchId: null,
          humanReviewed: false,
          status: 'clustered',
          l1Code: 'IT07',
        },
      ],
    ])

    const report = await service.backfill({ caseIds: ['case-1'], dryRun: true })

    expect(report.rollbackCompatible).toBe(false)
    expect(report.requiresLegacyCodeRestore).toBe(true)
  })

  it('should skip human-reviewed cases and count them separately', async () => {
    const { service } = makeService([
      [
        { caseId: 'case-1', importBatchId: 'batch-1', humanReviewed: false, status: 'clustered' },
        { caseId: 'case-2', importBatchId: 'batch-1', humanReviewed: true, status: 'reviewed' },
      ],
    ])

    const report = await service.backfill({ batchId: 'batch-1', dryRun: true })

    expect(report.skippedReviewedCount).toBe(1)
    expect(report.resetCount).toBe(1)
  })
})
