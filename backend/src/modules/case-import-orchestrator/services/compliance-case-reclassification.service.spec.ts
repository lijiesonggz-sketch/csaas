import { ComplianceCaseReclassificationService } from './compliance-case-reclassification.service'
import { parseArgs } from '../../../../scripts/reclassify-compliance-cases'

describe('ComplianceCaseReclassificationService', () => {
  const complianceCaseRepository = {
    find: jest.fn(),
  }

  const caseExtractionService = {
    reclassifyCases: jest.fn(),
  }

  let service: ComplianceCaseReclassificationService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ComplianceCaseReclassificationService(
      complianceCaseRepository as never,
      caseExtractionService as never,
    )
  })

  it('should support dry-run reclassification by domain without forcing clustering', async () => {
    complianceCaseRepository.find.mockResolvedValue([
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
    ])

    const report = await service.reclassify({
      l1Code: 'IT07',
      shadowOnly: true,
      dryRun: true,
      classifierVersion: 'taxonomy-classifier-6.6',
    })

    expect(caseExtractionService.reclassifyCases).not.toHaveBeenCalled()
    expect(report).toEqual(
      expect.objectContaining({
        dryRun: true,
        reranClustering: false,
        latestPointerUpdated: false,
        caseCount: 2,
        affectedDomains: ['IT07'],
        classifierVersion: 'taxonomy-classifier-6.6',
      }),
    )
  })

  it('should execute targeted reclassification and return runtime classifier metadata', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-7',
        importBatchId: 'batch-7',
        l1Code: 'IT07',
        createdAt: new Date(),
      },
    ])
    caseExtractionService.reclassifyCases.mockResolvedValue({
      processedCount: 1,
      affectedDomains: ['IT07'],
      latestPointerUpdated: true,
      classifierVersion: 'taxonomy-classifier-6.6',
    })

    const report = await service.reclassify({
      caseIds: ['case-7'],
      forceLatestPointer: true,
      classifierVersion: 'taxonomy-classifier-6.6',
    })

    expect(caseExtractionService.reclassifyCases).toHaveBeenCalledWith(
      expect.objectContaining({
        caseIds: ['case-7'],
        forceLatestPointer: true,
        classifierVersion: 'taxonomy-classifier-6.6',
      }),
    )
    expect(report.latestPointerUpdated).toBe(true)
    expect(report.reranClustering).toBe(false)
  })

  it('should parse kebab-case CLI arguments for reclassification script', () => {
    expect(
      parseArgs([
        '--batch-id=batch-7',
        '--case-ids=case-7,case-8',
        '--domain=IT07',
        '--classifier-version=taxonomy-classifier-6.6',
        '--shadow-only=true',
        '--force-latest-pointer=false',
        '--dry-run=true',
      ]),
    ).toEqual({
      batchId: 'batch-7',
      caseIds: ['case-7', 'case-8'],
      l1Code: 'IT07',
      classifierVersion: 'taxonomy-classifier-6.6',
      shadowOnly: true,
      forceLatestPointer: false,
      dryRun: true,
    })
  })
})
