import {
  buildLatestClassificationSnapshot,
  ComplianceCaseClassificationRunService,
} from './compliance-case-classification-run.service'

describe('ComplianceCaseClassificationRunService', () => {
  it('should flip previous latest records before saving a new latest run', async () => {
    let manager: {
      update: jest.Mock
      create: jest.Mock
      save: jest.Mock
      transaction: jest.Mock
    }
    manager = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest
        .fn()
        .mockImplementation((_entity: unknown, payload: unknown) => payload),
      save: jest
        .fn()
        .mockImplementation(async (_entity: unknown, payload: unknown) => payload),
      transaction: jest
        .fn()
        .mockImplementation(async (callback: (tx: typeof manager) => unknown) =>
          callback(manager),
        ),
    }
    const classificationRunRepository = {
      manager,
    }

    const service = new ComplianceCaseClassificationRunService(
      classificationRunRepository as never,
    )

    await service.appendRunAndRefreshLatest({
      caseId: 'case-run-1',
      batchId: 'batch-run-1',
      classifierVersion: 'taxonomy-classifier-6.3',
      mappingVersion: '2026-04-07',
      rulebookVersion: 'it04-rulebook-v1',
      inputHash: 'hash-1',
      normalizedInputJson: { normalizedText: 'abc' },
      matchedSignals: ['signal-a'],
      decisionTrace: { chosenDomain: 'IT04' },
      l1Code: 'IT04',
      l2Code: 'IT04-10',
      confidenceScore: 0.875,
      decisionSource: 'rule',
      pathDecision: 'PRIMARY_CHAIN',
      fallbackReason: null,
      classificationStatus: 'SUCCEEDED',
      classificationSource: 'rule',
      classificationVersion: 'taxonomy-classifier-6.3',
    })

    expect(manager.transaction).toHaveBeenCalled()
    expect(manager.update).toHaveBeenCalledWith(
      expect.any(Function),
      { caseId: 'case-run-1', isLatest: true },
      { isLatest: false },
    )
    expect(manager.save).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        caseId: 'case-run-1',
        isLatest: true,
        confidenceScore: '0.8750',
      }),
    )
  })

  it('should build latest snapshot payload without leaking classification semantics into ComplianceCase.status', () => {
    const snapshot = buildLatestClassificationSnapshot({
      caseId: 'case-run-2',
      batchId: 'batch-run-2',
      classifierVersion: 'taxonomy-classifier-6.3',
      mappingVersion: '2026-04-07',
      rulebookVersion: 'it07-rulebook-v1',
      inputHash: 'hash-2',
      normalizedInputJson: { normalizedText: 'abc' },
      matchedSignals: ['signal-a'],
      decisionTrace: { chosenDomain: 'IT07' },
      l1Code: 'IT07',
      l2Code: 'IT07-06',
      confidenceScore: 0.92,
      decisionSource: 'rule',
      pathDecision: 'PRIMARY_CHAIN',
      fallbackReason: null,
      classificationStatus: 'SUCCEEDED',
      classificationSource: 'rule',
      classificationVersion: 'taxonomy-classifier-6.3',
    })

    expect(snapshot).toEqual({
      l1Code: 'IT07',
      l2Code: 'IT07-06',
      confidenceScore: '0.9200',
      classificationSource: 'rule',
      classificationVersion: 'taxonomy-classifier-6.3',
      fallbackReason: null,
    })
    expect(snapshot).not.toHaveProperty('status')
  })

  it('should nullify latest snapshot taxonomy fields for non-primary outcomes while retaining fallback reason', () => {
    const snapshot = buildLatestClassificationSnapshot({
      caseId: 'case-run-3',
      batchId: 'batch-run-3',
      classifierVersion: 'taxonomy-classifier-6.3',
      mappingVersion: '2026-04-07',
      rulebookVersion: 'it04-rulebook-v1',
      inputHash: 'hash-3',
      normalizedInputJson: { normalizedText: 'abc' },
      matchedSignals: [],
      decisionTrace: { chosenDomain: 'IT04' },
      l1Code: 'IT04',
      l2Code: null,
      confidenceScore: null,
      decisionSource: 'none',
      pathDecision: 'UNCLASSIFIED',
      fallbackReason: 'PENDING_RECLASSIFY',
      classificationStatus: 'FAILED',
      classificationSource: 'none',
      classificationVersion: 'taxonomy-classifier-6.3',
    })

    expect(snapshot).toEqual({
      l1Code: null,
      l2Code: null,
      confidenceScore: null,
      classificationSource: 'none',
      classificationVersion: 'taxonomy-classifier-6.3',
      fallbackReason: 'PENDING_RECLASSIFY',
    })
  })

  it('should nullify latest snapshot taxonomy fields for LEGACY_FALLBACK outcomes to avoid leaking fallback path into clustering entry signals', () => {
    const snapshot = buildLatestClassificationSnapshot({
      caseId: 'case-run-4',
      batchId: 'batch-run-4',
      classifierVersion: 'taxonomy-classifier-6.3',
      mappingVersion: '2026-04-07',
      rulebookVersion: 'it04-rulebook-v1',
      inputHash: 'hash-4',
      normalizedInputJson: { normalizedText: 'abc' },
      matchedSignals: ['fallback'],
      decisionTrace: { chosenDomain: 'IT04' },
      l1Code: 'IT04',
      l2Code: 'IT04-10',
      confidenceScore: 0.9,
      decisionSource: 'rule',
      pathDecision: 'LEGACY_FALLBACK',
      fallbackReason: 'LEGACY_FALLBACK_TRIGGERED',
      classificationStatus: 'FALLBACK_APPLIED',
      classificationSource: 'legacy-fallback',
      classificationVersion: 'taxonomy-classifier-6.3',
    })

    expect(snapshot).toEqual({
      l1Code: null,
      l2Code: null,
      confidenceScore: null,
      classificationSource: 'none',
      classificationVersion: 'taxonomy-classifier-6.3',
      fallbackReason: 'LEGACY_FALLBACK_TRIGGERED',
    })
  })
})
