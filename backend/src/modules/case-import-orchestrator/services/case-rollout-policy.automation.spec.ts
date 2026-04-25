import { CaseClusteringService } from './case-clustering.service'
import { CaseExtractionService } from './case-extraction.service'

describe('Story 6.5 rollout-policy automation regression', () => {
  it('[P0][6.5-AUTO-005] should fail fast when extraction rollout-policy dependencies are not wired together', async () => {
    const service = new CaseExtractionService(
      {
        find: jest.fn().mockResolvedValue([
          {
            caseId: 'case-missing-rollout-001',
            importBatchId: 'batch-missing-rollout',
            status: 'pending',
            caseFacts: '缺少控制平面依赖时不允许静默回退。',
            penaltyReason: '需要 fail-fast。',
          },
        ]),
        save: jest.fn(),
      } as never,
      {
        find: jest.fn().mockResolvedValue([]),
      } as never,
      {
        refineViolationThemes: jest.fn().mockResolvedValue(null),
      } as never,
      {
        classifyCaseText: jest.fn().mockReturnValue({
          l1Code: 'IT07',
          l2Code: 'IT07-06',
          l2Name: '核心业务系统数据被后台修改/篡改',
          score: 0.9,
          confidenceScore: 0.9,
          scoreGap: 0.18,
          decisionSource: 'rule',
          matchedSignals: ['后台'],
          matchedPhrases: ['后台'],
          matchedTokens: ['后台'],
          classifierVersion: 'taxonomy-classifier-6.4',
          mappingVersion: '2026-04-07',
          rulebookVersion: 'it07-rulebook-v1',
          classifiedAt: new Date().toISOString(),
          pathDecision: 'PRIMARY_CHAIN',
          failureSemantics: null,
        }),
      } as never,
      {
        getSupportedDomains: jest.fn().mockReturnValue(['IT07']),
      } as never,
      {
        appendRunAndRefreshLatest: jest.fn(),
      } as never,
      {
        publishLatestSnapshotWritten: jest.fn(),
      } as never,
      {
        normalize: jest.fn().mockReturnValue({
          rawText: 'normalized input',
          caseFacts: null,
          penaltyReason: null,
          mergedText: 'normalized input',
          normalizedText: 'normalizedinput',
          normalizedTokens: ['normalized', 'input'],
          normalizedPhrases: [],
        }),
      } as never,
      undefined,
      undefined,
      undefined,
    )

    await expect(service.extractBatch('batch-missing-rollout')).rejects.toThrow(
      'Rollout policy enforcement requires',
    )
  })

  it('[P1][6.5-AUTO-006] should keep clustering backward compatible when historical runs lack both l1Code and policySnapshot', async () => {
    const service = new CaseClusteringService(
      {
        find: jest.fn().mockResolvedValue([
          {
            caseId: 'case-missing-snapshot-001',
            importBatchId: 'batch-missing-snapshot',
            status: 'extracted',
            l1Code: null,
            l2Code: null,
            violationThemes: ['恢复演练不足'],
          },
        ]),
        save: jest.fn(),
      } as never,
      {
        find: jest.fn().mockResolvedValue([]),
      } as never,
      {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      } as never,
      {
        suggestMappings: jest.fn(),
      } as never,
      {
        mapCaseToControlPoints: jest.fn(),
        clearCache: jest.fn(),
      } as never,
      {
        findLatestRun: jest.fn().mockResolvedValue({
          l1Code: null,
          decisionTraceJson: {},
        }),
      } as never,
      {
        shouldAllowLegacyFallback: jest.fn(),
      } as never,
    )

    await expect(
      service.clusterBatch('batch-missing-snapshot'),
    ).resolves.toEqual(
      expect.objectContaining({
        processedCount: 1,
        fallbackToOldChainCount: 1,
      }),
    )
  })
})
